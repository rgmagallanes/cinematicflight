<?php

declare(strict_types=1);

// Import-only production bridge for one explicitly designated fictional test.
// It cannot read the queue, change a decision, access attachments, or send mail.

function review_ingest_authorization(array $server): string
{
    $header = trim((string) ($server['HTTP_AUTHORIZATION'] ?? $server['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = trim((string) ($headers['Authorization'] ?? $headers['authorization'] ?? ''));
    }
    return $header;
}

function review_ingest_auth(array $server, array $config): void
{
    $expected = strtolower(trim((string) ($config['review_import_token'] ?? '')));
    if (!preg_match('/^[a-f0-9]{64}$/D', $expected)) {
        throw new ReviewError('The production review import token is not configured.', 503);
    }
    $header = review_ingest_authorization($server);
    if (!preg_match('/^Bearer ([a-f0-9]{64})$/Di', $header, $matches)
        || !hash_equals($expected, strtolower($matches[1]))) {
        throw new ReviewError('Import authorization failed.', 403);
    }
}

function review_ingest_source(array $body, array $config): array
{
    $source = $body['source'] ?? null;
    if (!is_array($source) || array_is_list($source)) throw new ReviewError('Original email details are required.', 422);

    $enquiry = 'This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?';
    $designatedUid = $config['review_import_uid'] ?? null;
    if (!is_int($designatedUid) || $designatedUid < 1 || $designatedUid > 2147483647) {
        throw new ReviewError('The designated production test UID is not configured.', 503);
    }
    if (($source['mailbox'] ?? '') !== 'hello@cinematicflight.com'
        || ($source['folder'] ?? '') !== 'INBOX'
        || ($source['subject'] ?? '') !== 'CF-AI-TEST-001'
        || ($source['enquiryText'] ?? '') !== $enquiry
        || ($source['uid'] ?? null) !== $designatedUid
        || ($body['sentToClient'] ?? null) !== false
        || ($body['approvalRecorded'] ?? null) !== false) {
        throw new ReviewError('Only the designated unsent fictional production test email is enabled.', 422);
    }

    $testSender = strtolower(trim((string) ($config['review_test_sender'] ?? '')));
    $from = strtolower(trim(review_text($source, 'from', 190)));
    $replyTo = strtolower(trim(review_text($source, 'replyTo', 190)));
    if (!filter_var($testSender, FILTER_VALIDATE_EMAIL) || $from !== $testSender || $replyTo !== $from) {
        throw new ReviewError('The sender and reply address must match the configured owner test address.', 422);
    }

    $messageId = review_text($source, 'messageId', 255);
    if (!preg_match('/^<[^<>\s@]+@[^<>\s@]+>$/D', $messageId)) {
        throw new ReviewError('A valid original Message-ID is required.', 422);
    }
    $uidValidity = $source['uidValidity'] ?? null;
    if ($uidValidity !== null && (!is_int($uidValidity) || $uidValidity < 1 || $uidValidity > 2147483647)) {
        throw new ReviewError('UIDVALIDITY must be a positive integer or null when the provider did not supply it.', 422);
    }

    return [
        'mailbox' => 'hello@cinematicflight.com',
        'folder' => 'INBOX',
        'uid' => $designatedUid,
        'uidValidity' => $uidValidity,
        'messageId' => $messageId,
        'from' => $from,
        'replyTo' => $replyTo,
        'subject' => 'CF-AI-TEST-001',
        'enquiryText' => $enquiry,
        'verification' => $uidValidity === null
            ? 'production import token; UIDVALIDITY not verified'
            : 'production import token; provider metadata supplied but not independently verified',
    ];
}

function review_ingest_route(PDO $pdo, array $config): void
{
    try {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Method not allowed.'], 405);
        if (($config['review_queue_enabled'] ?? false) !== true
            || ($config['review_import_enabled'] ?? false) !== true) {
            throw new ReviewError('The production review import is not enabled.', 503);
        }
        review_ingest_auth($_SERVER, $config);

        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if (strlen($raw) > 65536) throw new ReviewError('Import exceeds 64 KB.', 413);
        $body = json_decode($raw, true);
        if (!is_array($body) || array_is_list($body)) throw new ReviewError('A JSON object is required.', 400);

        $ownerEmail = strtolower(trim((string) ($config['review_import_owner_email'] ?? '')));
        $inquiryId = trim((string) ($config['review_import_inquiry_id'] ?? ''));
        if (!filter_var($ownerEmail, FILTER_VALIDATE_EMAIL) || $inquiryId === '' || strlen($inquiryId) > 80) {
            throw new ReviewError('The production review import designation is incomplete.', 503);
        }
        if (($body['inquiryId'] ?? null) !== $inquiryId) {
            throw new ReviewError('The import is not linked to the designated fictional enquiry.', 422);
        }

        $owner = $pdo->prepare('select id from studio_users where email=? limit 1');
        $owner->execute([$ownerEmail]);
        $ownerId = $owner->fetchColumn();
        if (!$ownerId) throw new ReviewError('The designated Studio owner is unavailable.', 503);

        $source = review_ingest_source($body, $config);
        $result = review_store($pdo, (int) $ownerId, $body, $source);
        $record = $result['record'];
        respond([
            'savedToProductionReview' => true,
            'duplicate' => $result['duplicate'],
            'id' => $record['id'],
            'status' => $record['status'],
            'version' => $record['version'],
            'sendingEnabled' => false,
            'reviewUrl' => 'https://studio.cinematicflight.com/review-inbox',
        ]);
    } catch (ReviewError $error) {
        respond(['error' => $error->getMessage()], $error->getCode());
    } catch (Throwable $error) {
        error_log('Studio production review import failed: ' . get_class($error));
        respond(['error' => 'The production review import is unavailable. Check the Review Inbox before retrying. Nothing was sent.'], 503);
    }
}
