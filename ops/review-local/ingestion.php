<?php
declare(strict_types=1);

// Only loaded by the local Docker router, never the production API router.
function local_ingest_source(array $body, array $designation): array
{
    if (($body['sentToClient'] ?? null) !== false || ($body['approvalRecorded'] ?? null) !== false
        || ($body['inquiryId'] ?? null) !== $designation['inquiryId']) {
        throw new ReviewError('Only the designated pending local test import is allowed.', 422);
    }
    $source = $body['source'] ?? null;
    if (!is_array($source)) throw new ReviewError('Source email metadata is required.', 422);
    foreach (['mailbox', 'folder', 'uid', 'messageId', 'from', 'replyTo', 'subject', 'enquiryText'] as $field) {
        if (($source[$field] ?? null) !== $designation[$field]) {
            throw new ReviewError('Source does not match the designated test email: ' . $field, 422);
        }
    }
    // Search metadata does not establish UIDVALIDITY or Reply-To header semantics.
    // Do not invent either. The reply target is explicitly owner-designated, not send-ready.
    if (!array_key_exists('uidValidity', $source) || $source['uidValidity'] !== null) {
        throw new ReviewError('UIDVALIDITY has not been verified for this local test.', 422);
    }
    return array_intersect_key($source, array_flip(['mailbox','folder','uid','uidValidity','messageId','from','replyTo','subject','enquiryText'])) + [
        'verification'=>'n8n-imported; not independently provider-verified',
        'importMethod'=>'n8n-local', 'identityBasis'=>'mailbox + original Message-ID; UIDVALIDITY unavailable',
        'recipientVerification'=>'Owner-designated test address; Reply-To headers not independently verified',
    ];
}

function local_ingest_auth(array $server, string $token): void
{
    if (($server['REQUEST_METHOD'] ?? '') !== 'POST') throw new ReviewError('Method not allowed.', 405);
    // Service-to-service only. No cookie/session authentication, browser origins or query secrets.
    if (!empty($server['HTTP_ORIGIN']) || !empty($server['HTTP_COOKIE'])) throw new ReviewError('Browser requests are not allowed.', 403);
    if (strlen($token) !== 64 || !hash_equals('Bearer ' . $token, $server['HTTP_AUTHORIZATION'] ?? '')) {
        throw new ReviewError('Local ingestion credential required.', 401);
    }
    if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new ReviewError('JSON required.', 415);
}
