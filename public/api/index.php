<?php

declare(strict_types=1);

$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_name('cinematic_flight_studio');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function request_body(): array
{
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw ?: '{}', true);
    if (!is_array($payload)) respond(['error' => 'The request body must be valid JSON.'], 400);
    return $payload;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$provided || !hash_equals(csrf_token(), $provided)) respond(['error' => 'Your session security token expired. Refresh Studio and try again.'], 419);
}

function require_user(): int
{
    if (empty($_SESSION['user_id'])) respond(['error' => 'Sign in to continue.'], 401);
    return (int) $_SESSION['user_id'];
}

function text_value(array $row, string $key, int $maximum = 1000): string
{
    $value = trim((string) ($row[$key] ?? ''));
    if (strlen($value) > $maximum) respond(['error' => "{$key} is too long."], 422);
    return $value;
}

$configFile = __DIR__ . '/config.php';
$action = (string) ($_GET['action'] ?? 'status');

if (!is_file($configFile)) {
    if ($action === 'status') respond(['configured' => false]);
    respond(['error' => 'The Studio API has not been configured.'], 503);
}

$config = require $configFile;
$requiredConfig = ['db_host', 'db_name', 'db_user', 'db_password', 'allowed_origin', 'setup_token'];
foreach ($requiredConfig as $key) {
    if (empty($config[$key])) respond(['error' => 'The Studio API configuration is incomplete.'], 503);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !hash_equals((string) $config['allowed_origin'], $origin)) respond(['error' => 'This origin is not allowed.'], 403);

try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], (int) ($config['db_port'] ?? 3306), $config['db_name']);
    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $error) {
    error_log('Cinematic Flight Studio database connection failed: ' . $error->getMessage());
    if ($action === 'status') respond(['configured' => false], 503);
    respond(['error' => 'The Studio database is temporarily unavailable.'], 503);
}

if ($action === 'status') respond(['configured' => true]);

if ($action === 'setup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $count = (int) $pdo->query('select count(*) from studio_users')->fetchColumn();
    if ($count > 0) respond(['error' => 'Studio setup is already complete.'], 409);
    $body = request_body();
    if (!hash_equals((string) $config['setup_token'], (string) ($body['setupToken'] ?? ''))) respond(['error' => 'The setup token is incorrect.'], 403);
    $email = filter_var(trim((string) ($body['email'] ?? '')), FILTER_VALIDATE_EMAIL);
    $password = (string) ($body['password'] ?? '');
    $displayName = trim((string) ($body['displayName'] ?? 'Studio Owner'));
    if (!$email) respond(['error' => 'Enter a valid email address.'], 422);
    if (strlen($password) < 12) respond(['error' => 'Use a password with at least 12 characters.'], 422);
    $statement = $pdo->prepare('insert into studio_users (email, password_hash, display_name) values (?, ?, ?)');
    $statement->execute([strtolower((string) $email), password_hash($password, PASSWORD_DEFAULT), $displayName ?: 'Studio Owner']);
    respond(['created' => true]);
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $now = time();
    $attempts = $_SESSION['login_attempts'] ?? [];
    $attempts = array_values(array_filter($attempts, static fn($timestamp) => $timestamp > $now - 900));
    if (count($attempts) >= 5) respond(['error' => 'Too many sign-in attempts. Wait 15 minutes and try again.'], 429);
    $body = request_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $statement = $pdo->prepare('select id, email, display_name, password_hash from studio_users where email = ? limit 1');
    $statement->execute([$email]);
    $user = $statement->fetch();
    if (!$user || !password_verify((string) ($body['password'] ?? ''), $user['password_hash'])) {
        $attempts[] = $now;
        $_SESSION['login_attempts'] = $attempts;
        respond(['error' => 'The email or password is incorrect.'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['login_attempts'] = [];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
    respond(['user' => ['id' => (int) $user['id'], 'email' => $user['email'], 'displayName' => $user['display_name']], 'csrfToken' => csrf_token()]);
}

if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['user_id'])) respond(['authenticated' => false, 'csrfToken' => csrf_token()]);
    $statement = $pdo->prepare('select id, email, display_name from studio_users where id = ? limit 1');
    $statement->execute([(int) $_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user) {
        $_SESSION = [];
        respond(['authenticated' => false, 'csrfToken' => csrf_token()]);
    }
    respond(['authenticated' => true, 'user' => ['id' => (int) $user['id'], 'email' => $user['email'], 'displayName' => $user['display_name']], 'csrfToken' => csrf_token()]);
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_user();
    require_csrf();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
    respond(['signedOut' => true]);
}

$ownerId = require_user();

if ($action === 'inquiries' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $statement = $pdo->prepare('select external_id, property_name, contact_name, contact_email, stage, activity_label, next_action, action_status, due_label, detail, working_note from studio_inquiries where owner_id = ? order by created_at asc');
    $statement->execute([$ownerId]);
    respond(['data' => $statement->fetchAll(), 'csrfToken' => csrf_token()]);
}

if ($action === 'inquiries' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $rows = request_body()['inquiries'] ?? null;
    if (!is_array($rows) || count($rows) > 500) respond(['error' => 'Provide a valid enquiry list.'], 422);
    $allowedStages = ['New', 'Contacted', 'Replied', 'Qualified', 'Proposal', 'Won'];
    $allowedStatuses = ['Due today', 'Upcoming', 'Overdue', 'Completed'];
    $sql = 'insert into studio_inquiries (owner_id, external_id, property_name, contact_name, contact_email, stage, activity_label, next_action, action_status, due_label, detail, working_note) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on duplicate key update property_name=values(property_name), contact_name=values(contact_name), contact_email=values(contact_email), stage=values(stage), activity_label=values(activity_label), next_action=values(next_action), action_status=values(action_status), due_label=values(due_label), detail=values(detail), working_note=values(working_note)';
    $statement = $pdo->prepare($sql);
    $pdo->beginTransaction();
    try {
        foreach ($rows as $row) {
            if (!is_array($row)) throw new RuntimeException('Invalid enquiry.');
            $stage = text_value($row, 'stage', 40);
            $status = text_value($row, 'action_status', 40);
            if (!in_array($stage, $allowedStages, true) || !in_array($status, $allowedStatuses, true)) throw new RuntimeException('Invalid enquiry status.');
            $statement->execute([$ownerId, text_value($row, 'external_id', 80), text_value($row, 'property_name', 190), text_value($row, 'contact_name', 190), text_value($row, 'contact_email', 190), $stage, text_value($row, 'activity_label', 80), text_value($row, 'next_action', 255), $status, text_value($row, 'due_label', 80), text_value($row, 'detail', 5000), text_value($row, 'working_note', 10000)]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        error_log('Cinematic Flight Studio enquiry save failed: ' . $error->getMessage());
        respond(['error' => 'The enquiries could not be saved. Check the fields and try again.'], 422);
    }
    respond(['saved' => count($rows)]);
}

if ($action === 'property-files' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $statement = $pdo->prepare('select external_id, property_name, stage, enquiry_id, received_label, owner_name, next_action, source_count, documents from studio_property_files where owner_id = ? order by created_at asc');
    $statement->execute([$ownerId]);
    $rows = $statement->fetchAll();
    foreach ($rows as &$row) $row['documents'] = json_decode((string) $row['documents'], true) ?: [];
    respond(['data' => $rows, 'csrfToken' => csrf_token()]);
}

if ($action === 'property-files' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $rows = request_body()['properties'] ?? null;
    if (!is_array($rows) || count($rows) > 200) respond(['error' => 'Provide a valid property-file list.'], 422);
    $sql = 'insert into studio_property_files (owner_id, external_id, property_name, stage, enquiry_id, received_label, owner_name, next_action, source_count, documents) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on duplicate key update property_name=values(property_name), stage=values(stage), enquiry_id=values(enquiry_id), received_label=values(received_label), owner_name=values(owner_name), next_action=values(next_action), source_count=values(source_count), documents=values(documents)';
    $statement = $pdo->prepare($sql);
    $pdo->beginTransaction();
    try {
        foreach ($rows as $row) {
            if (!is_array($row)) throw new RuntimeException('Invalid property file.');
            $documents = json_encode($row['documents'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($documents === false || strlen($documents) > 5000000) throw new RuntimeException('Property documents are too large.');
            $statement->execute([$ownerId, text_value($row, 'external_id', 80), text_value($row, 'property_name', 190), text_value($row, 'stage', 40), text_value($row, 'enquiry_id', 80), text_value($row, 'received_label', 120), text_value($row, 'owner_name', 190), text_value($row, 'next_action', 255), max(0, (int) ($row['source_count'] ?? 0)), $documents]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        error_log('Cinematic Flight Studio property-file save failed: ' . $error->getMessage());
        respond(['error' => 'The property files could not be saved. Try again.'], 422);
    }
    respond(['saved' => count($rows)]);
}

respond(['error' => 'API route not found.'], 404);
