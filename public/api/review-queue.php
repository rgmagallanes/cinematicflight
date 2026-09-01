<?php
declare(strict_types=1);

// Included only after the main API has authenticated the owner. No mail transport.
final class ReviewError extends RuntimeException {}

function review_text(array $input, string $key, int $max): string
{
    $value = $input[$key] ?? null;
    if (!is_string($value) || trim($value) === '' || strlen($value) > $max || str_contains($value, "\0")) {
        throw new ReviewError("Invalid {$key}.", 422);
    }
    return $value; // Preserve exact reply text, including whitespace.
}

function review_integer(array $input, string $key): int
{
    $value = $input[$key] ?? null;
    if (!is_int($value) || $value < 1 || $value > 2147483647) throw new ReviewError("Invalid {$key}.", 422);
    return $value;
}

function review_json(array $value): string
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function review_source(array $body, string $testSender): array
{
    $source = $body['source'] ?? null;
    if (!is_array($source)) throw new ReviewError('Original email details are required.', 422);
    $enquiry = 'This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?';
    if (($source['mailbox'] ?? '') !== 'hello@cinematicflight.com' || ($source['folder'] ?? '') !== 'INBOX'
        || ($source['subject'] ?? '') !== 'CF-AI-TEST-001' || ($source['enquiryText'] ?? '') !== $enquiry
        || ($source['uid'] ?? null) !== 2 || ($body['sentToClient'] ?? null) !== false
        || ($body['approvalRecorded'] ?? null) !== false) {
        throw new ReviewError('Only the designated unsent fictional test email is enabled.', 422);
    }
    $from = strtolower(trim(review_text($source, 'from', 190)));
    $replyTo = strtolower(trim(review_text($source, 'replyTo', 190)));
    if (!filter_var($testSender, FILTER_VALIDATE_EMAIL) || $from !== strtolower($testSender) || $replyTo !== $from) {
        throw new ReviewError('The sender and reply address must match the configured owner test address.', 422);
    }
    $messageId = review_text($source, 'messageId', 255);
    // One bracketed RFC-style Message-ID only; no CRLF/header injection or guessed subject threading.
    if (!preg_match('/^<[^<>\s@]+@[^<>\s@]+>$/D', $messageId)) throw new ReviewError('A valid original Message-ID is required.', 422);
    return [
        'mailbox' => $source['mailbox'], 'folder' => 'INBOX', 'uid' => 2,
        'uidValidity' => review_integer($source, 'uidValidity'), 'messageId' => $messageId,
        'from' => $from, 'replyTo' => $replyTo, 'subject' => $source['subject'], 'enquiryText' => $enquiry,
        'verification' => 'owner-imported; not provider-verified',
    ];
}

function review_row(array $row): array
{
    $source = json_decode($row['source_json'], true, 512, JSON_THROW_ON_ERROR);
    $linkCurrent = strtolower(trim($row['contact_email'])) === $source['replyTo'];
    return [
        'id' => (int) $row['id'], 'inquiryId' => $row['inquiry_external_id'],
        'source' => $source,
        'linkStatus' => $linkCurrent ? 'contact_matches' : 'contact_changed',
        'approvalApplicable' => $linkCurrent && $row['status'] === 'approved',
        'originalText' => $row['original_text'], 'text' => $row['reply_text'], 'model' => $row['model'],
        'status' => $row['status'], 'version' => (int) $row['version'], 'revision' => (int) $row['revision'],
        'approval' => $row['approval_json'] === null ? null : json_decode($row['approval_json'], true, 512, JSON_THROW_ON_ERROR),
        'history' => json_decode($row['history_json'], true, 512, JSON_THROW_ON_ERROR),
        'sendingEnabled' => false, 'sentMailSyncEnabled' => false,
    ];
}

function review_find(PDO $pdo, int $ownerId, int $id, bool $lock = false): array
{
    $sql = 'select d.*, i.external_id as inquiry_external_id, i.contact_email from studio_review_drafts d join studio_inquiries i on i.id=d.inquiry_id and i.owner_id=d.owner_id where d.owner_id=? and d.id=?';
    $query = $pdo->prepare($sql . ($lock ? ' for update' : ''));
    $query->execute([$ownerId, $id]);
    $row = $query->fetch();
    if (!$row) throw new ReviewError('Draft not found.', 404);
    return $row;
}

function review_import(PDO $pdo, int $ownerId, array $body, string $testSender): array
{
    $source = review_source($body, $testSender);
    return review_store($pdo, $ownerId, $body, $source);
}

// Internal persistence primitive. Callers must authenticate and validate source first.
// The public owner-import route retains its original strict fixture validator.
function review_store(PDO $pdo, int $ownerId, array $body, array $source): array
{
    $inquiryId = review_text($body, 'inquiryId', 80);
    $text = review_text($body, 'draftReply', 10000);
    $model = review_text($body, 'model', 150);
    $key = hash('sha256', review_json($source['uidValidity'] === null
        ? ['message-id-only', $source['mailbox'], $source['messageId']]
        : [$source['mailbox'], $source['folder'], $source['uidValidity'], $source['uid']]));
    $messageKey = hash('sha256', review_json([$source['mailbox'], $source['messageId']]));
    $pdo->beginTransaction();
    try {
        // Lock the owner row to serialize duplicate imports even when the draft does not yet exist.
        $owner = $pdo->prepare('select id from studio_users where id=? for update');
        $owner->execute([$ownerId]);
        if (!$owner->fetch()) throw new ReviewError('Owner not found.', 401);
        $query = $pdo->prepare('select id, contact_email from studio_inquiries where owner_id=? and external_id=? for update');
        $query->execute([$ownerId, $inquiryId]);
        $inquiry = $query->fetch();
        if (!$inquiry) throw new ReviewError('Select an existing enquiry belonging to this owner.', 422);
        if (strtolower(trim($inquiry['contact_email'])) !== $source['from']) throw new ReviewError('The enquiry contact does not match the test sender.', 422);
        $duplicate = $pdo->prepare('select id from studio_review_drafts where owner_id=? and (source_key=? or message_key=?)');
        $duplicate->execute([$ownerId, $key, $messageKey]);
        $existing = $duplicate->fetchColumn();
        if ($existing) {
            $row = review_find($pdo, $ownerId, (int) $existing);
            if ((int) $row['inquiry_id'] !== (int) $inquiry['id'] || $row['source_json'] !== review_json($source)
                || $row['original_text'] !== $text || $row['model'] !== $model) {
                throw new ReviewError('This email is already linked. An import cannot replace its source, enquiry or original draft.', 409);
            }
            $pdo->commit();
            return ['record' => review_row($row), 'duplicate' => true];
        }
        $history = [['action' => 'imported', 'version' => 1, 'revision' => 1, 'text' => $text,
            'actorId' => $ownerId, 'at' => gmdate('c'), 'note' => ($source['importMethod'] ?? '') === 'n8n-local'
                ? 'Local n8n service imported a pending test draft. Independent provider verification and sending are disabled.'
                : 'Owner imported test email; provider verification and sending are disabled.']];
        $insert = $pdo->prepare('insert into studio_review_drafts (owner_id,inquiry_id,source_key,message_key,source_json,original_text,reply_text,model,history_json) values (?,?,?,?,?,?,?,?,?)');
        $insert->execute([$ownerId, $inquiry['id'], $key, $messageKey, review_json($source), $text, $text, $model, review_json($history)]);
        $record = review_row(review_find($pdo, $ownerId, (int) $pdo->lastInsertId()));
        $pdo->commit();
        return ['record' => $record, 'duplicate' => false];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function review_change(PDO $pdo, int $ownerId, array $body): array
{
    $id = review_integer($body, 'id');
    $expected = review_integer($body, 'expectedVersion');
    $pdo->beginTransaction();
    try {
        $row = review_find($pdo, $ownerId, $id, true);
        $record = review_row($row);
        if ($record['version'] !== $expected) throw new ReviewError('This draft changed. Reload before recording a decision.', 409);
        $action = $body['action'] ?? '';
        $note = '';
        if ($action === 'edited') {
            $text = review_text($body, 'text', 10000);
            if ($text === $record['text']) throw new ReviewError('There are no changes to save.', 422);
            $record['text'] = $text;
            $record['revision']++;
            $record['status'] = 'pending';
            $record['approval'] = null;
            $note = 'Saved edit; all previous approvals no longer apply.';
        } elseif ($action === 'approved' || $action === 'rejected') {
            if ($record['status'] !== 'pending' || ($body['text'] ?? null) !== $record['text']) throw new ReviewError('Review the exact pending saved text.', 409);
            if ($action === 'approved') {
                if (($body['confirmed'] ?? false) !== true || ($body['linkConfirmed'] ?? false) !== true) throw new ReviewError('Confirm both the reply text and its enquiry/email link.', 422);
                if (strtolower(trim($row['contact_email'])) !== $record['source']['replyTo']) throw new ReviewError('The enquiry contact changed. Resolve the email link before approval.', 409);
                $record['approval'] = ['revision' => $record['revision'], 'text' => $record['text'], 'inquiryId' => $record['inquiryId'],
                    'sourceKey' => $row['source_key'], 'recipient' => $record['source']['replyTo'], 'messageId' => $record['source']['messageId'],
                    'actorId' => $ownerId, 'at' => gmdate('c')];
                $note = 'Exact reply and enquiry/email link reviewed. No sending authorized.';
            } else {
                $note = review_text($body, 'note', 1000);
                $record['approval'] = null;
            }
            $record['status'] = $action === 'approved' ? 'approved' : 'rejected';
        } elseif ($action === 'reopened') {
            if ($record['status'] === 'pending') throw new ReviewError('Already awaiting review.', 409);
            $record['status'] = 'pending';
            $record['approval'] = null;
            $note = 'Returned to review; earlier approval invalidated.';
        } else throw new ReviewError('Unsupported action. Sending and sent-mail tracking are not enabled.', 422);
        $record['version']++;
        $record['history'][] = ['action' => $action, 'version' => $record['version'], 'revision' => $record['revision'],
            'text' => $record['text'], 'actorId' => $ownerId, 'at' => gmdate('c'), 'note' => $note];
        $query = $pdo->prepare('update studio_review_drafts set reply_text=?,status=?,version=?,revision=?,approval_json=?,history_json=? where owner_id=? and id=?');
        $query->execute([$record['text'], $record['status'], $record['version'], $record['revision'],
            $record['approval'] === null ? null : review_json($record['approval']), review_json($record['history']), $ownerId, $id]);
        $pdo->commit();
        return $record;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function review_route(PDO $pdo, int $ownerId, string $action, array $config): void
{
    if (($config['review_queue_enabled'] ?? false) !== true || !filter_var($config['review_test_sender'] ?? '', FILTER_VALIDATE_EMAIL)) {
        respond(['error' => 'The server review test is not enabled.'], 503);
    }
    $method = $_SERVER['REQUEST_METHOD'];
    try {
        if ($action === 'review-drafts' && $method === 'GET') {
            $before = filter_var($_GET['before'] ?? PHP_INT_MAX, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($before === false) throw new ReviewError('Invalid queue cursor.', 422);
            $query = $pdo->prepare('select d.id,d.status,d.version,d.revision,d.updated_at,i.external_id as inquiryId from studio_review_drafts d join studio_inquiries i on i.id=d.inquiry_id and i.owner_id=d.owner_id where d.owner_id=? and d.id<? order by d.id desc limit 51');
            $query->execute([$ownerId, $before]);
            $rows = $query->fetchAll();
            $more = count($rows) > 50;
            $rows = array_slice($rows, 0, 50);
            respond(['data' => $rows, 'nextCursor' => $more ? (int) end($rows)['id'] : null, 'csrfToken' => csrf_token(), 'sendingEnabled' => false]);
        }
        if ($action === 'review-draft' && $method === 'GET') {
            $id = filter_var($_GET['id'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]);
            if (!$id) throw new ReviewError('Invalid draft ID.', 422);
            $record=review_row(review_find($pdo, $ownerId, $id));
            if(($config['review_attachments_enabled']??false)===true){require_once __DIR__.'/review-attachments.php';$record['attachments']=review_attachment_list($pdo,$ownerId,$id);}
            respond(['record' => $record, 'csrfToken' => csrf_token()]);
        }
        if ($action === 'review-attachment' && $method === 'GET') {
            if(($config['review_attachments_enabled']??false)!==true)throw new ReviewError('Attachment previews are not enabled.',503);
            require_once __DIR__.'/review-attachments.php';
            $id=filter_var($_GET['id']??'',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>2147483647]]);
            if(!$id)throw new ReviewError('Invalid attachment ID.',422);
            respond(review_attachment_content($pdo,$ownerId,$id,$config));
        }
        if ($method !== 'POST' || !in_array($action, ['review-import', 'review-change'], true)) respond(['error' => 'Method not allowed.'], 405);
        require_csrf();
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if (strlen($raw) > 65536) throw new ReviewError('Review request exceeds 64 KB.', 413);
        $body = json_decode($raw, true);
        if (!is_array($body) || array_is_list($body)) throw new ReviewError('Provide a JSON object.', 400);
        if ($action === 'review-import') respond(review_import($pdo, $ownerId, $body, $config['review_test_sender']));
        $record=review_change($pdo, $ownerId, $body);
        if(($config['review_attachments_enabled']??false)===true){require_once __DIR__.'/review-attachments.php';$record['attachments']=review_attachment_list($pdo,$ownerId,$record['id']);}
        respond(['record' => $record]);
    } catch (ReviewError $error) {
        respond(['error' => $error->getMessage()], $error->getCode());
    } catch (Throwable $error) {
        error_log('Studio review queue failed: ' . get_class($error));
        respond(['error' => 'The server review queue is unavailable. No local fallback or email send was attempted.'], 503);
    }
}
