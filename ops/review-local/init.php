<?php
declare(strict_types=1);
$config = require __DIR__ . '/config.php';
if ($config['db_host'] !== 'db' || $config['db_name'] !== 'review_local') throw new RuntimeException('Refusing a non-local fixture target.');
$pdo = new PDO('mysql:host=db;dbname=review_local;charset=utf8mb4', $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec(file_get_contents('/app/database/mysql-schema.sql'));
$pdo->exec(file_get_contents('/app/database/mysql-review-queue.sql'));
$pdo->exec(file_get_contents('/app/database/mysql-review-attachments.sql'));
if(!is_dir('/run/review-private/attachments'))mkdir('/run/review-private/attachments',0700);
$lookup=$pdo->prepare('select id from studio_users where email=?');
$lookup->execute(['reviewer@example.test']);
$ownerId=$lookup->fetchColumn();
if (!$ownerId) {
    $insert=$pdo->prepare('insert into studio_users(email,password_hash,display_name) values(?,?,?)');
    $insert->execute(['reviewer@example.test',password_hash('Local-review-test-only-2026',PASSWORD_DEFAULT),'Local test owner']);
    $ownerId=(int)$pdo->lastInsertId();
}
$inquiry=$pdo->prepare('select id from studio_inquiries where owner_id=? and external_id=?');
$inquiry->execute([$ownerId,'local-review-fixture']);
if (!$inquiry->fetchColumn()) {
    $insert=$pdo->prepare('insert into studio_inquiries(owner_id,external_id,property_name,contact_name,contact_email,detail,working_note) values(?,?,?,?,?,?,?)');
    $insert->execute([$ownerId,'local-review-fixture','Fictional test property','Fictional sender','sender@example.test','Local integration fixture; not a real enquiry.','']);
}
$lookup=$pdo->prepare('select id from studio_review_drafts where owner_id=? limit 1');
$lookup->execute([$ownerId]);
if (!$lookup->fetchColumn()) {
    require_once '/app/public/api/review-queue.php';
    review_import($pdo,(int)$ownerId,[
        'inquiryId'=>'local-review-fixture','model'=>'local fixture — no AI call',
        'draftReply'=>'Thank you for your enquiry. We can explore adding a cinematic experience to an existing website. We would first assess your property photographs and separately check your website platform before confirming what is possible.',
        'sentToClient'=>false,'approvalRecorded'=>false,
        'source'=>['mailbox'=>'hello@cinematicflight.com','folder'=>'INBOX','uid'=>2,'uidValidity'=>100,
            'messageId'=>'<local-review-fixture@example.test>','from'=>'sender@example.test','replyTo'=>'sender@example.test',
            'subject'=>'CF-AI-TEST-001','enquiryText'=>'This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?'],
    ],$config['review_test_sender']);
}
echo "Local review ready. Existing drafts and decisions preserved.\n";
$designation = require __DIR__ . '/designation.php';
$inquiry->execute([$ownerId, $designation['inquiryId']]);
if (!$inquiry->fetchColumn()) {
    $insert=$pdo->prepare('insert into studio_inquiries(owner_id,external_id,property_name,contact_name,contact_email,detail,working_note) values(?,?,?,?,?,?,?)');
    $insert->execute([$ownerId,$designation['inquiryId'],'Fictional n8n attachment test','Owner test sender',$designation['from'],'Controlled fictional test email, UID '.$designation['uid'].'. Not a customer enquiry.','']);
}
// Persist a random import-only secret outside the web root; never print it.
if (!is_file('/run/review-private/ingest-token')) {
    file_put_contents('/run/review-private/ingest-token', bin2hex(random_bytes(32)), LOCK_EX);
    chmod('/run/review-private/ingest-token', 0600);
}
