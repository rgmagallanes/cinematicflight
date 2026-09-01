<?php
declare(strict_types=1);
const REVIEW_ATTACHMENT_MAX = 8388608;
const REVIEW_PREVIEW_TYPES = ['image/jpeg','image/png','image/webp','image/gif','text/plain'];

function review_attachment_manifest(array $body): array
{
    $items = $body['attachments'] ?? null;
    if (!is_array($items) || !array_is_list($items) || count($items) > 20) throw new ReviewError('At most 20 attachments may be registered.', 422);
    $result=[]; $seen=[];
    foreach ($items as $item) {
        if (!is_array($item)) throw new ReviewError('Invalid attachment metadata.',422);
        $id=review_text($item,'id',1024);
        $name=$item['filename'] ?? 'Unnamed attachment';
        $mime=strtolower(review_text($item,'contentType',100));
        $size=$item['sizeBytes'] ?? null;
        if (!is_string($name) || trim($name)==='' || strlen($name)>255 || preg_match('/[\x00-\x1f\x7f]/',$name)
            || !preg_match('/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/D',$mime) || !is_int($size) || $size<0 || $size>2147483647
            || !is_bool($item['inline'] ?? null) || isset($seen[$id])) throw new ReviewError('Invalid or duplicate attachment metadata.',422);
        $seen[$id]=true;
        $result[]=['id'=>$id,'filename'=>$name,'contentType'=>$mime,'sizeBytes'=>$size,'inline'=>$item['inline']];
    }
    usort($result,static fn($a,$b)=>strcmp($a['id'],$b['id']));
    return $result;
}

function review_attachment_list(PDO $pdo,int $ownerId,int $draftId): array
{
    review_find($pdo,$ownerId,$draftId);
    $query=$pdo->prepare('select checked_at from studio_review_attachment_sets where owner_id=? and draft_id=?');
    $query->execute([$ownerId,$draftId]); $set=$query->fetch();
    $query=$pdo->prepare('select id,filename,content_type,byte_size,content_byte_size,inline_image,status from studio_review_attachments where owner_id=? and draft_id=? order by id');
    $query->execute([$ownerId,$draftId]);
    return ['checked'=>(bool)$set,'checkedAt'=>$set['checked_at'] ?? null,'items'=>array_map(static fn($row)=>[
        'id'=>(int)$row['id'],'name'=>$row['filename'],'contentType'=>$row['content_type'],'byteSize'=>(int)($row['content_byte_size'] ?? $row['byte_size']),
        'providerByteSize'=>(int)$row['byte_size'],
        'inline'=>(bool)$row['inline_image'],'status'=>$row['status'],'reviewStatus'=>'not_reviewed','aiAnalyzed'=>false,
    ],$query->fetchAll())];
}

function review_attachment_register(PDO $pdo,int $ownerId,int $draftId,array $body): array
{
    $items=review_attachment_manifest($body);$hash=hash('sha256',review_json($items));
    $pdo->beginTransaction();
    try {
        $row=review_find($pdo,$ownerId,$draftId,true);
        $query=$pdo->prepare('select manifest_hash from studio_review_attachment_sets where owner_id=? and draft_id=?');
        $query->execute([$ownerId,$draftId]);$existing=$query->fetchColumn();
        if ($existing && !hash_equals($existing,$hash)) throw new ReviewError('Attachment list changed. Review the original message identity before replacing any files.',409);
        if (!$existing) {
            $pdo->prepare('insert into studio_review_attachment_sets(draft_id,owner_id,manifest_hash) values(?,?,?)')->execute([$draftId,$ownerId,$hash]);
            $insert=$pdo->prepare('insert into studio_review_attachments(owner_id,draft_id,provider_key,provider_id,filename,content_type,byte_size,inline_image,status) values(?,?,?,?,?,?,?,?,?)');
            foreach($items as $a) $insert->execute([$ownerId,$draftId,hash('sha256',$a['id']),$a['id'],$a['filename'],$a['contentType'],$a['sizeBytes'],(int)$a['inline'],in_array($a['contentType'],REVIEW_PREVIEW_TYPES,true)&&$a['sizeBytes']>0&&$a['sizeBytes']<=REVIEW_ATTACHMENT_MAX?'metadata_only':'unsupported']);
            if(count($items)>0) {
                // New material must not silently retain an earlier approval.
                $history=json_decode($row['history_json'],true,512,JSON_THROW_ON_ERROR);
                $history[]=['action'=>'attachments_received','version'=>(int)$row['version']+1,'revision'=>(int)$row['revision'],'text'=>$row['reply_text'],'actorId'=>$ownerId,'at'=>gmdate('c'),'note'=>'Attachment metadata received, not reviewed or AI-analyzed. Previous approval invalidated; files are not malware-scanned.'];
                $pdo->prepare("update studio_review_drafts set status='pending',approval_json=null,version=version+1,history_json=? where owner_id=? and id=?")->execute([review_json($history),$ownerId,$draftId]);
            }
        }
        $pdo->commit();
        return ['registered'=>true,'duplicate'=>(bool)$existing,'count'=>count($items),'sendingEnabled'=>false];
    } catch(Throwable $e) {if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function review_attachment_root(array $config): string
{
    $root=$config['review_attachment_storage'] ?? '';
    if(!is_string($root)||$root===''||!is_dir($root)||!is_writable($root)) throw new ReviewError('Private attachment storage is unavailable.',503);
    return rtrim($root,'/');
}

function review_attachment_store(PDO $pdo,int $ownerId,int $draftId,array $body,array $config): array
{
    $providerId=review_text($body,'attachmentId',1024);
    $encoded=review_text($body,'contentBase64',11184812);
    $bytes=base64_decode($encoded,true);
    if($bytes===false||strlen($bytes)<1||strlen($bytes)>REVIEW_ATTACHMENT_MAX) throw new ReviewError('File must be between 1 byte and 8 MB.',422);
    $hash=hash('sha256',$bytes);$root=review_attachment_root($config);
    $pdo->beginTransaction();
    try {
        review_find($pdo,$ownerId,$draftId,true);
        $q=$pdo->prepare('select * from studio_review_attachments where owner_id=? and draft_id=? and provider_key=? for update');
        $q->execute([$ownerId,$draftId,hash('sha256',$providerId)]);$file=$q->fetch();
        if(!$file) throw new ReviewError('Register the original attachment metadata first.',422);
        if($file['status']==='unsupported') throw new ReviewError('This file type or size is not enabled for preview.',422);
        if(strlen($bytes)>(int)$file['byte_size']) throw new ReviewError('Decoded attachment exceeds its provider-reported size.',422);
        if($file['content_hash']!==null&&!hash_equals($file['content_hash'],$hash))throw new ReviewError('Stored attachment bytes cannot be replaced.',409);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if($mime!==$file['content_type']||!in_array($mime,REVIEW_PREVIEW_TYPES,true))throw new ReviewError('File contents do not match the allowed declared type.',422);
        if(str_starts_with($mime,'image/')) {
            $info=@getimagesizefromstring($bytes);
            if(!$info||($info['mime']??'')!==$mime||$info[0]>12000||$info[1]>12000||$info[0]*$info[1]>30000000)throw new ReviewError('Image dimensions or format cannot be safely previewed.',422);
        } elseif(!preg_match('//u',$bytes)||str_contains($bytes,"\0")) throw new ReviewError('Only UTF-8 plain text is previewable.',422);
        $q=$pdo->prepare("select coalesce(sum(content_byte_size),0) from studio_review_attachments where owner_id=? and draft_id=? and status='ready' and id<>?");
        $q->execute([$ownerId,$draftId,$file['id']]);
        if((int)$q->fetchColumn()+strlen($bytes)>41943040)throw new ReviewError('Preview storage is limited to 40 MB per test email.',422);
        $path=$root.'/'.$hash;
        if(is_file($path)) {if(!hash_equals($hash,hash_file('sha256',$path)))throw new ReviewError('Private stored file failed its integrity check.',503);}
        else {
            $temp=tempnam($root,'incoming-');
            try {if(file_put_contents($temp,$bytes,LOCK_EX)!==strlen($bytes))throw new ReviewError('File storage failed.',503);chmod($temp,0600);if(!rename($temp,$path))throw new ReviewError('File storage failed.',503);}
            finally {if(is_file($temp))unlink($temp);}
        }
        $pdo->prepare("update studio_review_attachments set status='ready',content_hash=?,content_byte_size=? where id=? and owner_id=?")->execute([$hash,strlen($bytes),$file['id'],$ownerId]);
        $pdo->commit();return ['stored'=>true,'id'=>(int)$file['id'],'duplicate'=>$file['content_hash']!==null,'aiAnalyzed'=>false,'sendingEnabled'=>false];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function review_attachment_content(PDO $pdo,int $ownerId,int $id,array $config): array
{
    $q=$pdo->prepare('select a.* from studio_review_attachments a join studio_review_drafts d on d.id=a.draft_id and d.owner_id=a.owner_id where a.id=? and a.owner_id=?');
    $q->execute([$id,$ownerId]);$file=$q->fetch();
    if(!$file)throw new ReviewError('Attachment not found.',404);
    if($file['status']!=='ready'||!in_array($file['content_type'],REVIEW_PREVIEW_TYPES,true)||!preg_match('/^[a-f0-9]{64}$/D',$file['content_hash']??''))throw new ReviewError('Attachment preview is not available. Run the attachment sync or check its type and size.',409);
    $path=review_attachment_root($config).'/'.$file['content_hash'];
    if(!is_file($path)||filesize($path)!==(int)$file['content_byte_size']||!hash_equals($file['content_hash'],hash_file('sha256',$path)))throw new ReviewError('Private file is missing or failed its integrity check.',503);
    return ['id'=>(int)$file['id'],'contentType'=>$file['content_type'],'byteSize'=>(int)$file['content_byte_size'],'contentBase64'=>base64_encode(file_get_contents($path)),'aiAnalyzed'=>false];
}
