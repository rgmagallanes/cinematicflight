<?php
declare(strict_types=1);
// Disposable Docker database only. No model or mail access.
require '/app/public/api/review-queue.php';
require '/app/review-local/ingestion.php';
$pdo=new PDO('mysql:host=db;dbname=review_test;charset=utf8mb4','root','fictional-local-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('create database review_local');
$pdo->exec("create user 'review_local'@'%' identified by 'local-review-app-only'");
$pdo->exec("grant all on review_local.* to 'review_local'@'%'");
putenv('CF_REVIEW_LOCAL=yes');
putenv('CINEMATIC_FLIGHT_CONFIG_PATH=/app/review-local/config.php');
require '/app/review-local/init.php'; // Changes $pdo to the isolated review_local DB.
$designation=require '/app/review-local/designation.php';
$token=trim(file_get_contents('/run/review-private/ingest-token'));
$payload=['inquiryId'=>$designation['inquiryId'],'draftReply'=>'Fictional integration-test output. No model call.','model'=>'integration-fixture','sentToClient'=>false,'approvalRecorded'=>false,'source'=>array_diff_key($designation,['inquiryId'=>true])+['uidValidity'=>null]];
$checks=0;
function verify(bool $ok,string $name):void {global $checks;if(!$ok)throw new RuntimeException('FAIL: '.$name);$checks++;echo 'PASS: '.$name."\n";}
$log=tempnam(sys_get_temp_dir(),'cf-ingest-log-');
$proc=proc_open(['php','-S','127.0.0.1:8098','-t','/app/public','/app/review-local/router.php'],[0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']],$pipes);
fclose($pipes[0]);
register_shutdown_function(static function()use($proc,$log){proc_terminate($proc);proc_close($proc);unlink($log);});
function request_import(mixed $payload,string $token,array $extra=[],string $method='POST',string $path='/local-ingest'):array {
 $headers=array_merge(['Content-Type: application/json','Authorization: Bearer '.$token],$extra);
 $ctx=stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>is_string($payload)?$payload:json_encode($payload),'ignore_errors'=>true,'timeout'=>3]]);
 $body=@file_get_contents('http://127.0.0.1:8098'.$path,false,$ctx);
 preg_match('/HTTP\/\S+ (\d+)/',$http_response_header[0]??'',$m);
 return ['status'=>(int)($m[1]??0),'data'=>json_decode($body?:'{}',true),'headers'=>$http_response_header??[]];
}
for($i=0;$i<30;$i++){if(request_import($payload,'bad')['status']===401)break;usleep(100000);}
verify(request_import($payload,'bad')['status']===401,'wrong token denied');
verify(request_import($payload,$token,['Origin: http://127.0.0.1:5182'])['status']===403,'browser origin denied');
verify(request_import($payload,$token,['Cookie: anything=1'])['status']===403,'session cookies cannot authenticate ingestion');
verify(request_import($payload,$token,[],'GET')['status']===405,'GET denied');
verify(request_import('[]',$token)['status']===400,'list payload denied');
verify(request_import(str_repeat('x',65537),$token)['status']===413,'oversized body denied');
foreach(['uid'=>2,'messageId'=>'<wrong@example.test>','from'=>'other@example.test','replyTo'=>'other@example.test','enquiryText'=>'Real customer enquiry','uidValidity'=>100]as$field=>$value){$bad=$payload;$bad['source'][$field]=$value;verify(request_import($bad,$token)['status']===422,'source substitution denied: '.$field);}
$bad=$payload;$bad['inquiryId']='local-review-fixture';verify(request_import($bad,$token)['status']===422,'arbitrary enquiry linking denied');
$bad=$payload;$bad['approvalRecorded']=true;verify(request_import($bad,$token)['status']===422,'imported approval denied');
$result=request_import($payload,$token);verify($result['status']===200&&!$result['data']['duplicate'],'real HTTP import persisted');
$id=$result['data']['id'];verify($result['data']['sendingEnabled']===false&&$result['data']['status']==='pending','receipt is pending and unsendable');
$ownerId=(int)$pdo->query("select id from studio_users where email='reviewer@example.test'")->fetchColumn();
$record=review_row(review_find($pdo,$ownerId,$id));verify($record['source']['uidValidity']===null&&$record['source']['importMethod']==='n8n-local','missing provider evidence remains explicit');
review_change($pdo,$ownerId,['id'=>$id,'expectedVersion'=>1,'action'=>'approved','text'=>$record['text'],'confirmed'=>true,'linkConfirmed'=>true]);
$duplicate=request_import($payload,$token);verify($duplicate['data']['duplicate']&&$duplicate['data']['status']==='approved'&&$duplicate['data']['version']===2,'retry preserves exact saved approval');
$bad=$payload;$bad['draftReply']='Different model output';verify(request_import($bad,$token)['status']===409,'different generation cannot replace approval');
verify(request_import($payload,$token,[],'POST','/api/index.php?action=review-change')['status']===401,'service key cannot change owner decisions');
verify(request_import($payload,$token,[],'GET','/api/index.php?action=review-drafts')['status']===401,'service key cannot read owner queue');
require '/app/public/api/review-attachments.php';
$png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=');
$text="Fictional attachment text.\n";
$html='<html><script>alert(1)</script></html>';
$meta=static fn($id,$name,$mime,$bytes)=>['id'=>$id,'filename'=>$name,'contentType'=>$mime,'sizeBytes'=>$bytes,'inline'=>false];
$attachments=[
 $meta('photo','photo.png','image/png',strlen($png)),
 $meta('notes','notes.txt','text/plain',strlen($text)),
 $meta('page','unsafe.html','text/html',strlen($html)),
 $meta('pdf','plan.pdf','application/pdf',100),
 $meta('large','large.png','image/png',8388609),
 $meta('spoof','spoof.png','image/png',strlen($html)),
];
$manifest=$payload;$manifest['operation']='manifest';$manifest['attachments']=$attachments;
$response=request_import($manifest,$token,[],'POST','/local-attachments');
verify($response['status']===200&&$response['data']['count']===6,'attachment metadata saved over authenticated HTTP');
$record=review_row(review_find($pdo,$ownerId,$id));
verify($record['status']==='pending'&&$record['approval']===null&&$record['version']===3,'new attachment material invalidates previous approval');
verify(request_import($manifest,$token,[],'POST','/local-attachments')['data']['duplicate']===true,'identical metadata retry is idempotent');
$bad=$manifest;$bad['attachments'][0]['filename']='replacement.png';verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===409,'manifest cannot silently replace original list');
$bad=$manifest;$bad['attachments'][]=$attachments[0];verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'duplicate attachment IDs rejected');
$bad=$manifest;$bad['attachments']=array_fill(0,21,$attachments[0]);verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'too many attachments rejected');
$file=$payload;$file['operation']='file';$file['attachmentId']='photo';$file['contentBase64']=base64_encode($png);
$stored=request_import($file,$token,[],'POST','/local-attachments');
verify($stored['status']===200&&$stored['data']['stored']===true,'PNG stored privately through local service');
$attachmentId=$stored['data']['id'];
verify(request_import($file,$token,[],'POST','/local-attachments')['data']['duplicate']===true,'identical file bytes retry safely');
$bad=$file;$bad['contentBase64']='@@@';verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'malformed base64 rejected');
$bad=$file;$bad['contentBase64']=base64_encode($text);verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===409,'stored attachment bytes cannot be replaced');
$bad=$file;$bad['attachmentId']='spoof';$bad['contentBase64']=base64_encode($html.'x');verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'decoded bytes cannot exceed provider-reported size');
$bad=$file;$bad['attachmentId']='spoof';$bad['contentBase64']=base64_encode($html);verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'HTML cannot masquerade as a PNG');
$bad=$file;$bad['attachmentId']='page';$bad['contentBase64']=base64_encode($html);verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'active HTML content refused');
$bad=$file;$bad['attachmentId']='absent';verify(request_import($bad,$token,[],'POST','/local-attachments')['status']===422,'unregistered attachment refused');
$file['attachmentId']='notes';$file['contentBase64']=base64_encode($text);verify(request_import($file,$token,[],'POST','/local-attachments')['status']===200,'UTF-8 text stored for escaped in-app preview');
$list=review_attachment_list($pdo,$ownerId,$id);
verify($list['checked']&&count($list['items'])===6&&count(array_filter($list['items'],fn($a)=>$a['status']==='ready'))===2,'list separates received metadata from available previews');
verify(count(array_filter($list['items'],fn($a)=>$a['status']==='unsupported'))===3,'unsupported and oversized files remain listed');
verify(request_import([],$token,[],'GET','/api/index.php?action=review-attachment&id='.$attachmentId)['status']===401,'service key cannot read private attachments');
$login=request_import(['email'=>'reviewer@example.test','password'=>'Local-review-test-only-2026'],'',[],'POST','/api/index.php?action=login');
$cookie='';foreach($login['headers'] as $header){if(preg_match('/^Set-Cookie: ([^;]+)/i',$header,$m))$cookie=$m[1];}
verify($cookie!=='','test owner session acquired');
$view=request_import([],'',['Cookie: '.$cookie], 'GET','/api/index.php?action=review-attachment&id='.$attachmentId);
verify($view['status']===200&&base64_decode($view['data']['contentBase64'],true)===$png,'signed-in owner gets the exact private PNG');
verify($view['data']['aiAnalyzed']===false,'viewing does not claim AI analysis');
$pdo->prepare('insert into studio_users(email,password_hash,display_name) values(?,?,?)')->execute(['other@example.test',password_hash('other-test-password',PASSWORD_DEFAULT),'Other test owner']);
$login=request_import(['email'=>'other@example.test','password'=>'other-test-password'],'',[],'POST','/api/index.php?action=login');
$otherCookie='';foreach($login['headers'] as $header){if(preg_match('/^Set-Cookie: ([^;]+)/i',$header,$m))$otherCookie=$m[1];}
verify(request_import([],'',['Cookie: '.$otherCookie],'GET','/api/index.php?action=review-attachment&id='.$attachmentId)['status']===404,'another owner cannot read attachment bytes');
verify(request_import([],'',['Cookie: '.$cookie],'GET','/api/index.php?action=review-attachment&id=../../etc/passwd')['status']===422,'path traversal ID rejected');
verify(request_import([],'',[],'GET','/attachments/'.hash('sha256',$png))['status']===404,'private file hash is not a public URL');
verify(review_row(review_find($pdo,$ownerId,$id))['version']===3,'file views and retries do not change review decisions');
echo "$checks ingestion and attachment integration checks passed.\n";
