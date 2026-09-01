<?php
declare(strict_types=1);

// Runs only in the isolated Compose test network. Uses no real credentials/mail.
$pdo = new PDO('mysql:host=db;dbname=review_test;charset=utf8mb4', 'root', 'fictional-local-test-only', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec(file_get_contents('/app/database/mysql-schema.sql'));
$pdo->exec(file_get_contents('/app/database/mysql-review-queue.sql'));
$pdo->exec(file_get_contents('/app/database/mysql-review-queue.sql')); // Additive/idempotent.
$password = 'fictional-test-password-only';
$insert = $pdo->prepare('insert into studio_users(email,password_hash,display_name) values(?,?,?)');
foreach (['one@example.test','two@example.test'] as $email) $insert->execute([$email, password_hash($password, PASSWORD_DEFAULT), 'Fictional owner']);
$pdo->exec("insert into studio_inquiries(owner_id,external_id,property_name,contact_name,contact_email,detail,working_note) values
    (1,'test-enquiry','Fictional property','Owner','sender@example.test','',''),
    (1,'wrong-contact','Fictional property','Other','other@example.test','',''),
    (2,'other-owner','Fictional property','Owner','sender@example.test','','')");

$configPath = tempnam(sys_get_temp_dir(), 'cf-review-config-');
$config = ['db_host'=>'db','db_name'=>'review_test','db_user'=>'root','db_password'=>'fictional-local-test-only',
    'allowed_origin'=>'http://127.0.0.1:8099','setup_token'=>'disabled-after-fixture','review_queue_enabled'=>false,'review_test_sender'=>'sender@example.test',
    'review_import_enabled'=>false,'review_import_token'=>str_repeat('a',64),'review_import_owner_email'=>'one@example.test',
    'review_import_inquiry_id'=>'test-enquiry','review_import_uid'=>7];
function save_config(): void {
    global $configPath, $config;
    file_put_contents($configPath, '<?php return ' . var_export($config, true) . ';');
}
save_config();
$log = tempnam(sys_get_temp_dir(), 'cf-review-log-');
$process = proc_open(['php','-S','127.0.0.1:8099','-t','/app/public'], [0=>['pipe','r'],1=>['file',$log,'a'],2=>['file',$log,'a']], $pipes, '/app', ['CINEMATIC_FLIGHT_CONFIG_PATH'=>$configPath]);
if (!is_resource($process)) throw new RuntimeException('Could not start isolated PHP API.');
fclose($pipes[0]);
register_shutdown_function(static function () use ($process, $configPath, $log) {
    proc_terminate($process); proc_close($process); unlink($configPath); unlink($log);
});

$checks = 0;
function check(bool $ok, string $label): void {
    global $checks;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $checks++;
    echo "PASS: {$label}\n";
}
function http_call(string $action, string $method = 'GET', ?array $body = null, array &$session = [], ?string $origin = null, bool $csrf = true, ?string $raw = null, array $extraHeaders = []): array {
    $headers = ['Accept: application/json'];
    if ($method !== 'GET') $headers[] = 'Content-Type: application/json';
    if (!empty($session['cookie'])) $headers[] = 'Cookie: ' . $session['cookie'];
    if ($csrf && !empty($session['csrfToken'])) $headers[] = 'X-CSRF-Token: ' . $session['csrfToken'];
    if ($origin !== null) $headers[] = 'Origin: ' . $origin;
    array_push($headers, ...$extraHeaders);
    $context = stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$raw ?? ($body === null ? '' : json_encode($body)), 'ignore_errors'=>true,'timeout'=>5]]);
    $response = @file_get_contents('http://127.0.0.1:8099/api/index.php?action=' . $action, false, $context);
    $status = 0;
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('/^HTTP\/\S+ (\d+)/', $header, $match)) $status = (int) $match[1];
        if (preg_match('/^Set-Cookie: ([^;]+)/i', $header, $match)) $session['cookie'] = $match[1];
    }
    $json = json_decode($response ?: '{}', true) ?: [];
    if (isset($json['csrfToken'])) $session['csrfToken'] = $json['csrfToken'];
    return ['status'=>$status,'json'=>$json,'headers'=>$http_response_header ?? []];
}
for ($attempt=0; $attempt<30; $attempt++) {
    if (http_call('status')['status'] === 200) break;
    usleep(100000);
}
check(http_call('status')['status'] === 200, 'isolated API starts against MariaDB');
check(http_call('review-drafts')['status'] === 401, 'anonymous queue access denied');
$one=[]; $two=[];
check(http_call('login','POST',['email'=>'one@example.test','password'=>$password],$one)['status'] === 200, 'existing owner login works');
check(http_call('login','POST',['email'=>'two@example.test','password'=>$password],$two)['status'] === 200, 'second owner login works');
check(http_call('review-drafts','GET',null,$one)['status'] === 503, 'queue disabled by default');
$config['review_queue_enabled']=true; save_config();
check(http_call('review-drafts','GET',null,$one,'https://untrusted.example')['status'] === 403, 'cross-origin access denied');
check(http_call('review-import','POST',[],$one,null,false)['status'] === 419, 'write without CSRF denied');
check(http_call('review-import','POST',[],$one,null,true,str_repeat('x',65537))['status'] === 413, 'oversized body denied');
check(http_call('review-import','POST',[],$one,null,true,'[]')['status'] === 400, 'non-object payload denied');
check(http_call('review-drafts','DELETE',[],$one)['status'] === 405, 'unsupported route method denied');

$service=[];
$serviceDraft=['inquiryId'=>'test-enquiry','draftReply'=>'Production bridge fictional reply.','model'=>'test-model','sentToClient'=>false,'approvalRecorded'=>false,
    'source'=>['mailbox'=>'hello@cinematicflight.com','folder'=>'INBOX','uid'=>7,'uidValidity'=>null,'messageId'=>'<production-test-007@example.test>',
        'from'=>'sender@example.test','replyTo'=>'sender@example.test','subject'=>'CF-AI-TEST-001',
        'enquiryText'=>'This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?']];
$bearer=['Authorization: Bearer '.str_repeat('a',64)];
check(http_call('review-ingest','GET',null,$service,null,false,null,$bearer)['status'] === 405, 'production import rejects non-POST methods');
check(http_call('review-ingest','POST',$serviceDraft,$service,null,false,null,$bearer)['status'] === 503, 'production import has a separate disabled flag');
$config['review_import_enabled']=true; save_config();
check(http_call('review-ingest','POST',$serviceDraft,$service,null,false)['status'] === 403, 'production import requires Bearer authorization');
check(http_call('review-ingest','POST',$serviceDraft,$service,null,false,null,['Authorization: Bearer '.str_repeat('b',64)])['status'] === 403, 'production import rejects the wrong token');
$invalidService=$serviceDraft;$invalidService['source']['uid']=8;
check(http_call('review-ingest','POST',$invalidService,$service,null,false,null,$bearer)['status'] === 422, 'production import rejects another message UID');
$invalidService=$serviceDraft;$invalidService['source']['enquiryText']='A real customer message';
check(http_call('review-ingest','POST',$invalidService,$service,null,false,null,$bearer)['status'] === 422, 'production import rejects non-fictional body text');
$invalidService=$serviceDraft;$invalidService['approvalRecorded']=true;
check(http_call('review-ingest','POST',$invalidService,$service,null,false,null,$bearer)['status'] === 422, 'production import cannot carry approval');
$invalidService=$serviceDraft;$invalidService['inquiryId']='wrong-contact';
check(http_call('review-ingest','POST',$invalidService,$service,null,false,null,$bearer)['status'] === 422, 'production import is pinned to one enquiry');
$serviceCreated=http_call('review-ingest','POST',$serviceDraft,$service,null,false,null,$bearer);
check($serviceCreated['status'] === 200 && $serviceCreated['json']['savedToProductionReview'] === true && $serviceCreated['json']['duplicate'] === false, 'production import stores the designated pending draft');
check($serviceCreated['json']['status'] === 'pending' && $serviceCreated['json']['sendingEnabled'] === false && !isset($serviceCreated['json']['record']), 'production import returns only a narrow unsendable receipt');
check(count(http_call('review-drafts','GET',null,$one)['json']['data']) === 1, 'signed-in designated owner can see the imported draft');
$serviceDuplicate=http_call('review-ingest','POST',$serviceDraft,$service,null,false,null,$bearer);
check($serviceDuplicate['status'] === 200 && $serviceDuplicate['json']['duplicate'] === true, 'production import replay is idempotent');
$invalidService=$serviceDraft;$invalidService['draftReply']='A different generation.';
check(http_call('review-ingest','POST',$invalidService,$service,null,false,null,$bearer)['status'] === 409, 'production import cannot overwrite a saved generation');
$config['review_import_enabled']=false; save_config();
check(http_call('review-ingest','POST',$serviceDraft,$service,null,false,null,$bearer)['status'] === 503, 'production import can be switched off after the test');
$config['review_import_enabled']=true; save_config();

$draft = ['inquiryId'=>'test-enquiry','draftReply'=>"A fictional reply.\nPlease review.",'model'=>'test-model','sentToClient'=>false,'approvalRecorded'=>false,
    'source'=>['mailbox'=>'hello@cinematicflight.com','folder'=>'INBOX','uid'=>2,'uidValidity'=>100,'messageId'=>'<test-001@example.test>',
        'from'=>'sender@example.test','replyTo'=>'sender@example.test','subject'=>'CF-AI-TEST-001',
        'enquiryText'=>'This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?']];
check(http_call('review-import','POST',$draft,$two)['status'] === 422, 'cannot link another owners enquiry');
$invalid=$draft; $invalid['inquiryId']='wrong-contact';
check(http_call('review-import','POST',$invalid,$one)['status'] === 422, 'mismatched enquiry email denied');
$invalid=$draft; unset($invalid['source']['messageId']);
check(http_call('review-import','POST',$invalid,$one)['status'] === 422, 'missing email identity denied');
$invalid=$draft; $invalid['source']['messageId']="<id@example.test>\r\nBcc: victim@example.test";
check(http_call('review-import','POST',$invalid,$one)['status'] === 422, 'header injection denied');
$invalid=$draft; $invalid['source']['replyTo']='other@example.test';
check(http_call('review-import','POST',$invalid,$one)['status'] === 422, 'recipient substitution denied');
$invalid=$draft; $invalid['source']['enquiryText']='Real customer enquiry';
check(http_call('review-import','POST',$invalid,$one)['status'] === 422, 'real customer import denied');
$invalid=$draft; $invalid['approvalRecorded']=true;
check(http_call('review-import','POST',$invalid,$one)['status'] === 422, 'browser approval cannot be imported');
$created=http_call('review-import','POST',$draft,$one);
check($created['status'] === 200 && $created['json']['duplicate'] === false, 'linked test draft persisted');
$record=$created['json']['record']; $id=$record['id'];
check($record['inquiryId'] === 'test-enquiry' && $record['status'] === 'pending' && $record['sendingEnabled'] === false, 'new record is linked pending and unsendable');
check(http_call('review-draft&id='.$id,'GET',null,$two)['status'] === 404, 'another owner cannot read draft');
check(count(http_call('review-drafts','GET',null,$two)['json']['data']) === 0, 'queue lists only current owners records');
check(http_call('review-drafts&before=bad','GET',null,$one)['status'] === 422, 'invalid pagination cursor denied');
$changed=['id'=>$id,'expectedVersion'=>1,'action'=>'approved','text'=>$record['text'],'confirmed'=>true];
check(http_call('review-change','POST',$changed,$one)['status'] === 422, 'approval requires explicit email/enquiry link confirmation');
$changed['linkConfirmed']=true;
check(http_call('review-change','POST',$changed,$two)['status'] === 404, 'another owner cannot approve');
$approved=http_call('review-change','POST',$changed,$one)['json']['record'];
check($approved['status'] === 'approved' && $approved['approval']['text'] === $record['text'] && $approved['approval']['recipient'] === 'sender@example.test', 'approval binds exact text and recipient');
check($approved['approval']['actorId'] === 1 && $approved['approval']['messageId'] === '<test-001@example.test>', 'server records actor and original message');
check(http_call('review-change','POST',$changed,$one)['status'] === 409, 'stale decision cannot overwrite approval');
$pdo->exec("update studio_inquiries set contact_email='changed@example.test' where id=1");
$staleLink=http_call('review-draft&id='.$id,'GET',null,$one)['json']['record'];
check($staleLink['linkStatus'] === 'contact_changed' && $staleLink['approvalApplicable'] === false, 'existing approval is not applicable after contact changes');
$pdo->exec("update studio_inquiries set contact_email='sender@example.test' where id=1");
$duplicate=http_call('review-import','POST',$draft,$one);
check($duplicate['json']['duplicate'] && $duplicate['json']['record']['status'] === 'approved', 'duplicate import preserves approval');
$invalid=$draft; $invalid['source']['uidValidity']=101;
check(http_call('review-import','POST',$invalid,$one)['status'] === 409, 'same Message-ID cannot duplicate after UID validity change');
$invalid=$draft; $invalid['draftReply']='Replacement';
check(http_call('review-import','POST',$invalid,$one)['status'] === 409, 'different generation cannot overwrite saved review');
$edit=['id'=>$id,'expectedVersion'=>2,'action'=>'edited','text'=>'Edited fictional reply.'];
$edited=http_call('review-change','POST',$edit,$one)['json']['record'];
check($edited['status'] === 'pending' && $edited['revision'] === 2 && $edited['approval'] === null, 'edit invalidates approval');
check(count($edited['history']) === 3 && $edited['history'][1]['text'] === $record['text'], 'server history preserves previously approved exact text');
$pdo->exec("update studio_inquiries set contact_email='changed@example.test' where id=1");
$changed['expectedVersion']=3; $changed['text']=$edited['text'];
check(http_call('review-change','POST',$changed,$one)['status'] === 409, 'changed enquiry contact blocks fresh approval');
$pdo->exec("update studio_inquiries set contact_email='sender@example.test' where id=1");
$reject=['id'=>$id,'expectedVersion'=>3,'action'=>'rejected','text'=>$edited['text'],'note'=>''];
check(http_call('review-change','POST',$reject,$one)['status'] === 422, 'rejection requires reason');
$reject['note']='Needs factual checking.';
check(http_call('review-change','POST',$reject,$one)['json']['record']['status'] === 'rejected', 'rejection recorded');
check(http_call('review-change','POST',['id'=>$id,'expectedVersion'=>4,'action'=>'sent'],$one)['status'] === 422, 'send action is unavailable');
$reopen=['id'=>$id,'expectedVersion'=>4,'action'=>'reopened'];
check(http_call('review-change','POST',$reopen,$one)['json']['record']['status'] === 'pending', 'rejected draft can return to review');
http_call('logout','POST',[],$one);
check(http_call('review-draft&id='.$id,'GET',null,$one)['status'] === 401, 'logout removes review access');
http_call('login','POST',['email'=>'one@example.test','password'=>$password],$one);
check(http_call('review-draft&id='.$id,'GET',null,$one)['json']['record']['version'] === 5, 'server state survives new login session');

// Two independent PHP processes race at the same expected version against real InnoDB locks.
$worker = 'require "/app/public/api/review-queue.php"; $p=new PDO("mysql:host=db;dbname=review_test;charset=utf8mb4","root","fictional-local-test-only",[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); try { review_change($p,1,["id"=>(int)$argv[1],"expectedVersion"=>5,"action"=>"edited","text"=>$argv[2]]); echo "saved"; } catch(ReviewError $e) { echo $e->getCode(); }';
$workers=[];
foreach (['Concurrent edit A','Concurrent edit B'] as $text) {
    $handles=[];
    $proc=proc_open(['php','-r',$worker,(string)$id,$text],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$handles);
    fclose($handles[0]); $workers[]=[$proc,$handles];
}
$outcomes=[];
foreach ($workers as [$proc,$handles]) {
    $outcomes[]=stream_get_contents($handles[1]); fclose($handles[1]);
    $errors=stream_get_contents($handles[2]); fclose($handles[2]);
    check(proc_close($proc) === 0 && $errors === '', 'concurrent worker completed');
}
sort($outcomes);
check($outcomes === ['409','saved'], 'real concurrent writers produce one commit and one version conflict');
$pdo->exec('rename table studio_review_drafts to studio_review_drafts_unavailable');
check(http_call('review-drafts','GET',null,$one)['status'] === 503, 'missing migration fails closed without local fallback');
echo "{$checks} API integration checks passed. No external mail requests made.\n";
