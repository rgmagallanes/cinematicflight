<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!in_array($path,['/local-ingest','/local-attachments'],true)) return false;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require '/app/public/api/review-queue.php';
require __DIR__ . '/ingestion.php';
try {
    if (getenv('CF_REVIEW_LOCAL') !== 'yes') throw new ReviewError('Local ingestion disabled.', 503);
    $config = require __DIR__ . '/config.php';
    if ($config['db_host'] !== 'db' || $config['db_name'] !== 'review_local') throw new ReviewError('Local database required.', 503);
    $token = is_file('/run/review-private/ingest-token') ? trim(file_get_contents('/run/review-private/ingest-token')) : '';
    local_ingest_auth($_SERVER, $token);
    $limit=$path==='/local-attachments'?12000000:65536;
    $raw = file_get_contents('php://input', false, null, 0, $limit+1);
    if (strlen($raw) > $limit) throw new ReviewError('Import exceeds its request limit.', 413);
    $body = json_decode($raw, true);
    if (!is_array($body) || array_is_list($body)) throw new ReviewError('A JSON object is required.', 400);
    $source = local_ingest_source($body, require __DIR__ . '/designation.php');
    $pdo = new PDO('mysql:host=db;dbname=review_local;charset=utf8mb4', $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    $owner = $pdo->prepare('select id from studio_users where email=?');
    $owner->execute(['reviewer@example.test']);
    $ownerId = $owner->fetchColumn();
    if (!$ownerId) throw new ReviewError('Local test owner is missing.', 503);
    if($path==='/local-attachments') {
        require '/app/public/api/review-attachments.php';
        $q=$pdo->prepare('select d.id from studio_review_drafts d join studio_inquiries i on i.id=d.inquiry_id and i.owner_id=d.owner_id where d.owner_id=? and d.message_key=? and i.external_id=?');
        $q->execute([$ownerId,hash('sha256',review_json([$source['mailbox'],$source['messageId']])),$body['inquiryId']]);$draftId=$q->fetchColumn();
        if(!$draftId)throw new ReviewError('Import the linked draft before its attachments.',422);
        $result=match($body['operation']??'') {
            'manifest'=>review_attachment_register($pdo,(int)$ownerId,(int)$draftId,$body),
            'file'=>review_attachment_store($pdo,(int)$ownerId,(int)$draftId,$body,$config),
            default=>throw new ReviewError('Unsupported attachment operation.',422),
        };
        echo review_json($result);return true;
    }
    $result = review_store($pdo, (int)$ownerId, $body, $source);
    $record = $result['record'];
    // Narrow receipt only: service key cannot read the queue or modify decisions.
    echo review_json(['savedToLocalReview'=>true, 'duplicate'=>$result['duplicate'], 'id'=>$record['id'],
        'status'=>$record['status'], 'version'=>$record['version'], 'sendingEnabled'=>false,
        'reviewUrl'=>'http://127.0.0.1:5182/server-review']);
} catch (ReviewError $error) {
    http_response_code($error->getCode()); echo review_json(['error'=>$error->getMessage()]);
} catch (Throwable $error) {
    http_response_code(503); echo review_json(['error'=>'Local import unavailable. Check the review inbox before retrying. Nothing sent.']);
}
return true;
