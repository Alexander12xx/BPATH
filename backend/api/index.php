<?php
/**
 * BrightPath production API
 * PHP 7.2+ / MariaDB 10.3+ / InfinityFree compatible.
 *
 * Server-only secrets belong in config.php beside this file. Never commit it.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

const BP_API_VERSION = '2.0.0';
const BP_ROLES = array('student', 'parent', 'tutor', 'school_admin', 'admin');
const BP_AVATARS = array('star', 'rocket', 'book', 'fox', 'panda', 'owl', 'cat', 'robot', 'flower', 'moon');
const BP_LESSON_ICONS = array('star', 'book', 'leaf', 'sparkle', 'chart', 'pencil', 'rocket', 'trophy', 'heart', 'people', 'game');
const BP_THEMES = array('purple', 'mint', 'orange', 'peach', 'blue', 'yellow');
const BP_GAMES = array('math', 'memory', 'words', 'focus');

$BP_CONFIG = array();
$BP_DB = null;

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message, array $extra = array()): void
{
    respond($status, array_merge(array('ok' => false, 'error' => $message), $extra));
}

function config(string $key, $default = null)
{
    global $BP_CONFIG;
    return array_key_exists($key, $BP_CONFIG) ? $BP_CONFIG[$key] : $default;
}

function setting(mysqli $db, string $key, string $default = ''): string
{
    static $cache = array();
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $row = db_one($db, 'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', 's', array($key));
    $value = $row && $row['setting_value'] !== null ? trim((string)$row['setting_value']) : '';
    $cache[$key] = $value !== '' ? $value : $default;
    return $cache[$key];
}

function request_method(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function route_name(): string
{
    $route = trim((string)($_GET['r'] ?? ''), '/');
    if ($route === '' && !empty($_SERVER['PATH_INFO'])) {
        $route = trim((string)$_SERVER['PATH_INFO'], '/');
    }
    return preg_replace('/[^a-z0-9_\/-]/', '', strtolower($route));
}

function body_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return array();
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail(400, 'Please send a valid request.');
    }
    return $data;
}

function request_body(): array
{
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (strpos($contentType, 'application/json') === 0) {
        return body_json();
    }
    return $_POST;
}

function input(array $body, string $key, $default = ''): string
{
    if (!array_key_exists($key, $body) || is_array($body[$key]) || is_object($body[$key])) {
        return (string)$default;
    }
    return trim((string)$body[$key]);
}

function input_int(array $body, string $key)
{
    if (!array_key_exists($key, $body) || $body[$key] === '' || $body[$key] === null) {
        return null;
    }
    $value = filter_var($body[$key], FILTER_VALIDATE_INT);
    return $value === false ? null : (int)$value;
}

function valid_email(string $email): bool
{
    return strlen($email) <= 190 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function clean_text(string $value, int $maxLength): string
{
    $value = trim($value);
    if (function_exists('mb_substr')) {
        $value = mb_substr($value, 0, $maxLength, 'UTF-8');
    } else {
        $value = substr($value, 0, $maxLength);
    }
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
}

function valid_password(string $password): bool
{
    return strlen($password) >= 8 && strlen($password) <= 128;
}

function password_problem(string $password): string
{
    if (strlen($password) < 8) {
        return 'Use at least 8 characters for your password.';
    }
    if (strlen($password) > 128) {
        return 'Your password is too long.';
    }
    return '';
}

function client_ip_hash(): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $forwarded = (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? '');
    if ($forwarded !== '' && filter_var($forwarded, FILTER_VALIDATE_IP)) {
        $ip = $forwarded;
    }
    return hash('sha256', 'bp-ip|' . $ip);
}

function bearer_token(): string
{
    $authorization = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authorization = (string)$_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authorization = (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        foreach ((array)getallheaders() as $key => $value) {
            if (strtolower((string)$key) === 'authorization') {
                $authorization = (string)$value;
                break;
            }
        }
    }
    if ($authorization === '' && !empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        $authorization = 'Bearer ' . (string)$_SERVER['HTTP_X_AUTH_TOKEN'];
    }
    if (preg_match('/^Bearer\s+([A-Za-z0-9_-]{40,64})$/', trim($authorization), $matches)) {
        return $matches[1];
    }
    return '';
}

function db_prepare(mysqli $db, string $sql, string $types = '', array $params = array()): mysqli_stmt
{
    $stmt = $db->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Database prepare failed.');
    }
    if ($types !== '') {
        $args = array($types);
        foreach ($params as $index => $unused) {
            $args[] = &$params[$index];
        }
        if (!call_user_func_array(array($stmt, 'bind_param'), $args)) {
            $stmt->close();
            throw new RuntimeException('Database parameter binding failed.');
        }
    }
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Database query failed.');
    }
    return $stmt;
}

function db_all(mysqli $db, string $sql, string $types = '', array $params = array()): array
{
    $stmt = db_prepare($db, $sql, $types, $params);
    $result = $stmt->get_result();
    $rows = array();
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    return $rows;
}

function db_one(mysqli $db, string $sql, string $types = '', array $params = array())
{
    $stmt = db_prepare($db, $sql, $types, $params);
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function db_exec(mysqli $db, string $sql, string $types = '', array $params = array()): int
{
    $stmt = db_prepare($db, $sql, $types, $params);
    $affected = $stmt->affected_rows;
    $insertId = (int)$db->insert_id;
    $stmt->close();
    return $insertId > 0 ? $insertId : $affected;
}

function public_user(array $user, bool $self = false): array
{
    $result = array(
        'id' => (int)$user['id'],
        'name' => (string)$user['name'],
        'email' => (string)$user['email'],
        'role' => (string)$user['role'],
        'grade' => $user['grade'] === null ? null : (int)$user['grade'],
        'avatar' => (string)($user['avatar'] ?? 'star'),
        'school_id' => $user['school_id'] === null ? null : (int)$user['school_id'],
        'school_name' => isset($user['school_name']) ? $user['school_name'] : null,
        'must_change_password' => (int)($user['must_change_password'] ?? 0) === 1,
        'active' => (int)($user['active'] ?? 1) === 1,
        'created_at' => isset($user['created_at']) ? $user['created_at'] : null,
    );
    if ($self) {
        $result['family_code'] = isset($user['family_code']) ? $user['family_code'] : null;
        $result['guardian_email'] = isset($user['guardian_email']) ? $user['guardian_email'] : null;
        $result['last_login_at'] = isset($user['last_login_at']) ? $user['last_login_at'] : null;
    }
    return $result;
}

function current_user(mysqli $db, bool $required = true)
{
    $token = bearer_token();
    if ($token === '') {
        if ($required) {
            fail(401, 'Please sign in to continue.');
        }
        return null;
    }
    $tokenHash = hash('sha256', $token);
    $user = db_one(
        $db,
        "SELECT u.id, u.name, u.email, u.role, u.grade, u.avatar, u.school_id, u.family_code,
                u.guardian_email, u.must_change_password, u.active, u.last_login_at, u.created_at,
                s.name AS school_name
         FROM api_tokens t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN schools s ON s.id = u.school_id
         WHERE t.token_hash = ? AND t.expires_at > UTC_TIMESTAMP() AND u.active = 1
         LIMIT 1",
        's',
        array($tokenHash)
    );
    if (!$user) {
        if ($required) {
            fail(401, 'Your session has ended. Please sign in again.');
        }
        return null;
    }
    db_exec($db, 'UPDATE api_tokens SET last_used_at = UTC_TIMESTAMP() WHERE token_hash = ?', 's', array($tokenHash));
    return $user;
}

function require_roles(array $user, array $roles): void
{
    if (!in_array((string)$user['role'], $roles, true)) {
        fail(403, 'This part of BrightPath is not available for your account.');
    }
}

function is_admin(array $user): bool
{
    return in_array((string)$user['role'], array('admin', 'school_admin'), true);
}

function audit(mysqli $db, $actorId, string $action, string $entity = '', $entityId = null, array $details = array()): void
{
    $detailsJson = $details ? json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
    db_exec(
        $db,
        'INSERT INTO audit_log (actor_id, action, entity, entity_id, details_json, ip_hash) VALUES (?, ?, ?, ?, ?, ?)',
        'ississ',
        array($actorId, $action, $entity, $entityId, $detailsJson, client_ip_hash())
    );
}

function notify(mysqli $db, int $userId, string $title, string $body = '', string $kind = 'general', string $page = 'home'): void
{
    if ($userId < 1) {
        return;
    }
    db_exec(
        $db,
        'INSERT INTO notifications (user_id, title, body, kind, page) VALUES (?, ?, ?, ?, ?)',
        'issss',
        array($userId, clean_text($title, 160), clean_text($body, 500), clean_text($kind, 40), clean_text($page, 40))
    );
}

function notify_admins(mysqli $db, string $title, string $body, string $kind = 'admin', string $page = 'admin'): void
{
    $admins = db_all($db, "SELECT id FROM users WHERE role = 'admin' AND active = 1 LIMIT 50");
    foreach ($admins as $admin) {
        notify($db, (int)$admin['id'], $title, $body, $kind, $page);
    }
}

function notify_parents(mysqli $db, int $studentId, string $title, string $body, string $kind = 'family', string $page = 'family'): void
{
    $parents = db_all(
        $db,
        "SELECT p.parent_id FROM parent_child_links p
         WHERE p.student_id = ? AND p.status = 'active' LIMIT 20",
        'i',
        array($studentId)
    );
    foreach ($parents as $parent) {
        notify($db, (int)$parent['parent_id'], $title, $body, $kind, $page);
    }
}

function award_badge(mysqli $db, int $userId, string $code): bool
{
    $badge = db_one($db, 'SELECT code, title FROM badges WHERE code = ? LIMIT 1', 's', array($code));
    if (!$badge) {
        return false;
    }
    $existing = db_one($db, 'SELECT id FROM user_badges WHERE user_id = ? AND badge_code = ? LIMIT 1', 'is', array($userId, $code));
    if ($existing) {
        return false;
    }
    db_exec($db, 'INSERT IGNORE INTO user_badges (user_id, badge_code) VALUES (?, ?)', 'is', array($userId, $code));
    notify($db, $userId, 'New sticker unlocked: ' . $badge['title'], 'Open your rewards page to see it.', 'badge', 'rewards');
    return true;
}

function issue_token(mysqli $db, array $user): array
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $tokenHash = hash('sha256', $token);
    $staff = in_array((string)$user['role'], array('tutor', 'school_admin', 'admin'), true);
    $seconds = $staff
        ? (int)config('staff_token_lifetime_seconds', 43200)
        : (int)config('token_lifetime_seconds', 28800);
    $seconds = max(900, min($seconds, 86400));
    $expiresAt = gmdate('Y-m-d H:i:s', time() + $seconds);
    db_exec($db, 'DELETE FROM api_tokens WHERE expires_at <= UTC_TIMESTAMP()');
    db_exec(
        $db,
        'INSERT INTO api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        'iss',
        array((int)$user['id'], $tokenHash, $expiresAt)
    );
    return array('token' => $token, 'expires_in' => $seconds, 'expires_at' => $expiresAt);
}

function family_code(mysqli $db): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($attempt = 0; $attempt < 25; $attempt++) {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        $exists = db_one($db, 'SELECT id FROM users WHERE family_code = ? LIMIT 1', 's', array($code));
        if (!$exists) {
            return $code;
        }
    }
    return strtoupper(substr(bin2hex(random_bytes(5)), 0, 8));
}

function random_code(int $length): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $code;
}

function temporary_password(): string
{
    $words = array('Sun', 'Star', 'Moon', 'Rain', 'Leaf', 'Bird', 'Book', 'Tree', 'Wave', 'Sky');
    return $words[random_int(0, count($words) - 1)] . '-' . random_code(4) . random_int(10, 99);
}

function parse_date(string $value)
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d') !== $value) {
        return false;
    }
    return $value;
}

function parse_datetime(string $value)
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    $value = str_replace('T', ' ', $value);
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $value)) {
        $value .= ':00';
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d H:i:s') !== $value) {
        return false;
    }
    return $value;
}

function days_streak(mysqli $db, int $userId): int
{
    $rows = db_all(
        $db,
        'SELECT DISTINCT DATE(created_at) AS day FROM learning_activity WHERE student_id = ? ORDER BY day DESC LIMIT 60',
        'i',
        array($userId)
    );
    if (!$rows) {
        return 0;
    }
    $days = array();
    foreach ($rows as $row) {
        $days[(string)$row['day']] = true;
    }
    $streak = 0;
    $cursor = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if (!isset($days[$cursor->format('Y-m-d')])) {
        $cursor = $cursor->modify('-1 day');
    }
    while (isset($days[$cursor->format('Y-m-d')])) {
        $streak++;
        $cursor = $cursor->modify('-1 day');
    }
    return $streak;
}

function points_total(mysqli $db, int $userId): int
{
    $row = db_one($db, 'SELECT COALESCE(SUM(points), 0) AS total FROM learning_activity WHERE student_id = ?', 'i', array($userId));
    return $row ? (int)$row['total'] : 0;
}

function login_counts(mysqli $db, string $emailHash, string $ipHash): array
{
    $emailCount = db_one(
        $db,
        'SELECT COUNT(*) AS total FROM login_attempts
         WHERE email_hash = ? AND success = 0 AND attempted_at > (UTC_TIMESTAMP() - INTERVAL 15 MINUTE)',
        's',
        array($emailHash)
    );
    $ipCount = db_one(
        $db,
        'SELECT COUNT(*) AS total FROM login_attempts
         WHERE ip_hash = ? AND success = 0 AND attempted_at > (UTC_TIMESTAMP() - INTERVAL 15 MINUTE)',
        's',
        array($ipHash)
    );
    return array(
        'email' => $emailCount ? (int)$emailCount['total'] : 0,
        'ip' => $ipCount ? (int)$ipCount['total'] : 0,
    );
}

function record_login(mysqli $db, string $emailHash, string $ipHash, bool $success): void
{
    db_exec(
        $db,
        'INSERT INTO login_attempts (email_hash, ip_hash, success) VALUES (?, ?, ?)',
        'ssi',
        array($emailHash, $ipHash, $success ? 1 : 0)
    );
}

function json_choices($value): array
{
    if (is_array($value)) {
        return $value;
    }
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : array();
}

function can_view_student(mysqli $db, array $viewer, int $studentId): bool
{
    if ((int)$viewer['id'] === $studentId) {
        return true;
    }
    if (in_array((string)$viewer['role'], array('admin', 'school_admin'), true)) {
        if ((string)$viewer['role'] === 'admin') {
            return true;
        }
        $student = db_one($db, 'SELECT school_id FROM users WHERE id = ? LIMIT 1', 'i', array($studentId));
        return $student && $student['school_id'] !== null && (int)$student['school_id'] === (int)$viewer['school_id'];
    }
    if ((string)$viewer['role'] === 'parent') {
        $link = db_one(
            $db,
            "SELECT id FROM parent_child_links WHERE parent_id = ? AND student_id = ? AND status = 'active' LIMIT 1",
            'ii',
            array((int)$viewer['id'], $studentId)
        );
        return (bool)$link;
    }
    if ((string)$viewer['role'] === 'tutor') {
        $link = db_one(
            $db,
            "SELECT id FROM tutor_students WHERE tutor_id = ? AND student_id = ? AND status = 'active' LIMIT 1",
            'ii',
            array((int)$viewer['id'], $studentId)
        );
        return (bool)$link;
    }
    return false;
}

function can_message(mysqli $db, array $from, array $to): bool
{
    $fromId = (int)$from['id'];
    $toId = (int)$to['id'];
    if ($fromId === $toId) {
        return false;
    }
    if ((string)$from['role'] === 'admin' || (string)$to['role'] === 'admin') {
        return true;
    }
    $family = db_one(
        $db,
        "SELECT id FROM parent_child_links
         WHERE status = 'active' AND ((parent_id = ? AND student_id = ?) OR (parent_id = ? AND student_id = ?))
         LIMIT 1",
        'iiii',
        array($fromId, $toId, $toId, $fromId)
    );
    if ($family) {
        return true;
    }
    $tutoring = db_one(
        $db,
        "SELECT id FROM tutor_students
         WHERE status = 'active' AND ((tutor_id = ? AND student_id = ?) OR (tutor_id = ? AND student_id = ?))
         LIMIT 1",
        'iiii',
        array($fromId, $toId, $toId, $fromId)
    );
    if ($tutoring) {
        return true;
    }
    $toRow = db_one($db, 'SELECT id, role, school_id FROM users WHERE id = ? LIMIT 1', 'i', array($toId));
    if (!$toRow) {
        return false;
    }
    if ($from['school_id'] !== null && $toRow['school_id'] !== null && (int)$from['school_id'] === (int)$toRow['school_id']) {
        return true;
    }
    if ((string)$from['role'] === 'parent' && (string)$toRow['role'] === 'tutor') {
        $shared = db_one(
            $db,
            "SELECT 1 AS found FROM parent_child_links p
             JOIN tutor_students ts ON ts.student_id = p.student_id
             WHERE p.parent_id = ? AND ts.tutor_id = ? AND p.status = 'active' AND ts.status = 'active' LIMIT 1",
            'ii',
            array($fromId, $toId)
        );
        return (bool)$shared;
    }
    if ((string)$from['role'] === 'tutor' && (string)$toRow['role'] === 'parent') {
        $shared = db_one(
            $db,
            "SELECT 1 AS found FROM parent_child_links p
             JOIN tutor_students ts ON ts.student_id = p.student_id
             WHERE p.parent_id = ? AND ts.tutor_id = ? AND p.status = 'active' AND ts.status = 'active' LIMIT 1",
            'ii',
            array($toId, $fromId)
        );
        return (bool)$shared;
    }
    return false;
}

function can_access_class(mysqli $db, array $user, array $class): bool
{
    if ((string)$user['role'] === 'admin') {
        return true;
    }
    if ((string)$user['role'] === 'tutor' && (int)$class['tutor_id'] === (int)$user['id']) {
        return true;
    }
    if ((string)$user['role'] === 'student') {
        if ((int)$user['grade'] !== (int)$class['grade']) {
            return false;
        }
        return $class['school_id'] === null || (int)$class['school_id'] === (int)$user['school_id'];
    }
    if ((string)$user['role'] === 'parent') {
        $child = db_one(
            $db,
            "SELECT u.id FROM parent_child_links p JOIN users u ON u.id = p.student_id
             WHERE p.parent_id = ? AND p.status = 'active' AND u.grade = ?
               AND (? IS NULL OR u.school_id = ?) LIMIT 1",
            'iiii',
            array((int)$user['id'], (int)$class['grade'], $class['school_id'], $class['school_id'])
        );
        return (bool)$child;
    }
    if ((string)$user['role'] === 'school_admin' && $class['school_id'] !== null) {
        return (int)$class['school_id'] === (int)$user['school_id'];
    }
    return false;
}

function upload_kind(string $kind): array
{
    if ($kind === 'resource') {
        return array(
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        );
    }
    if ($kind === 'avatar') {
        return array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp');
    }
    return array(
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    );
}

function store_upload(mysqli $db, array $file, string $kind, int $maxBytes): array
{
    if (!isset($file['error']) || (int)$file['error'] !== UPLOAD_ERR_OK) {
        fail(422, 'Choose a file and try again.');
    }
    if (!is_uploaded_file((string)$file['tmp_name']) || (int)$file['size'] < 1) {
        fail(422, 'That file could not be read. Try another file.');
    }
    if ((int)$file['size'] > $maxBytes) {
        fail(422, 'That file is too large. The limit is ' . (int)round($maxBytes / 1048576) . ' MB.');
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string)$finfo->file((string)$file['tmp_name']);
    $allowed = upload_kind($kind);
    if (!isset($allowed[$mime])) {
        fail(415, $kind === 'resource'
            ? 'Assignment resources must be PDF, DOC, or DOCX.'
            : 'Choose a JPG, PNG, WebP, or PDF file.');
    }
    $uploadDir = (string)config('upload_dir', __DIR__ . '/storage');
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0700, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Upload directory could not be created.');
    }
    $stored = bin2hex(random_bytes(20)) . '.' . $allowed[$mime];
    $target = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $stored;
    if (!move_uploaded_file((string)$file['tmp_name'], $target)) {
        throw new RuntimeException('Uploaded file could not be stored.');
    }
    @chmod($target, 0600);
    $original = function_exists('mb_substr')
        ? mb_substr(basename((string)$file['name']), 0, 180, 'UTF-8')
        : substr(basename((string)$file['name']), 0, 180);
    return array(
        'stored_filename' => $stored,
        'original_filename' => $original,
        'mime_type' => $mime,
        'file_size' => (int)$file['size'],
        'path' => $target,
    );
}

function stream_stored_file(array $file): void
{
    $uploadDir = (string)config('upload_dir', __DIR__ . '/storage');
    $name = (string)$file['stored_filename'];
    if (!preg_match('/^[a-f0-9]{40}\.(pdf|doc|docx|jpg|png|webp)$/', $name)) {
        fail(404, 'That file could not be found.');
    }
    $path = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $name;
    if (!is_file($path)) {
        fail(404, 'That file is no longer available.');
    }
    $downloadName = str_replace(array("\r", "\n", '"', '\\'), '_', basename((string)$file['original_filename']));
    header('Content-Type: ' . (string)$file['mime_type']);
    header('Content-Length: ' . (string)filesize($path));
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    readfile($path);
    exit;
}

/* -------------------------------------------------------------------------
 * Bootstrap
 * ---------------------------------------------------------------------- */

try {
    $configPath = __DIR__ . '/config.php';
    if (!is_file($configPath)) {
        fail(503, 'BrightPath server setup is incomplete. Add the server-only config.php beside index.php.');
    }
    $loadedConfig = require $configPath;
    if (!is_array($loadedConfig)) {
        fail(503, 'BrightPath server configuration is invalid.');
    }
    $BP_CONFIG = $loadedConfig;

    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    $allowedOrigins = isset($BP_CONFIG['allowed_origins']) && is_array($BP_CONFIG['allowed_origins'])
        ? $BP_CONFIG['allowed_origins'] : array();
    if ($origin !== '') {
        if (!in_array($origin, $allowedOrigins, true)) {
            fail(403, 'This website origin is not allowed to use the BrightPath API.');
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Auth-Token');
    header('Access-Control-Max-Age: 600');
    if (request_method() === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $BP_DB = new mysqli(
        (string)($BP_CONFIG['db_host'] ?? ''),
        (string)($BP_CONFIG['db_user'] ?? ''),
        (string)($BP_CONFIG['db_password'] ?? ''),
        (string)($BP_CONFIG['db_name'] ?? '')
    );
    $BP_DB->set_charset('utf8mb4');
    $BP_DB->query("SET time_zone = '+00:00'");

    $route = route_name();
    $method = request_method();

    if ($method === 'GET' && ($route === 'health' || $route === '')) {
        $database = 'connected';
        try {
            $BP_DB->query('SELECT 1');
        } catch (Throwable $ignored) {
            $database = 'unavailable';
        }
        respond(200, array(
            'ok' => true,
            'app' => 'BrightPath',
            'api_version' => BP_API_VERSION,
            'database' => $database,
            'php_version' => PHP_VERSION,
            'server_time' => gmdate('c'),
            'features' => array('accounts', 'lessons', 'assignments', 'live_classes', 'messages', 'notifications', 'parents', 'tutors', 'rewards', 'games', 'sponsors', 'support'),
        ));
    }

    if (!isset($BP_DB) || !($BP_DB instanceof mysqli)) {
        fail(503, 'The school database is not available right now.');
    }

    /* ---------------------------------------------------------------------
     * Public: settings and first administrator setup
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'settings') {
        respond(200, array(
            'ok' => true,
            'settings' => array(
                'app_name' => setting($BP_DB, 'app_name', (string)config('app_name', 'BrightPath')),
                'welcome_message' => setting($BP_DB, 'welcome_message', 'A little progress every day adds up to something brilliant.'),
                'jitsi_domain' => setting($BP_DB, 'jitsi_domain', (string)config('jitsi_domain', 'meet.jit.si')),
                'support_email' => setting($BP_DB, 'support_email', (string)config('support_email', '')),
                'api_version' => BP_API_VERSION,
            ),
        ));
    }

    if ($method === 'POST' && $route === 'auth/bootstrap') {
        $body = request_body();
        $configuredKey = (string)config('bootstrap_key', '');
        if ($configuredKey === '' || !hash_equals($configuredKey, input($body, 'bootstrap_key'))) {
            fail(403, 'The one-time setup key is not valid.');
        }
        $adminCount = db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
        if ($adminCount && (int)$adminCount['total'] > 0) {
            fail(409, 'An administrator already exists. One-time setup is closed.');
        }
        $name = clean_text(input($body, 'name'), 120);
        $email = strtolower(input($body, 'email'));
        $password = (string)($body['password'] ?? '');
        if ($name === '' || !valid_email($email)) {
            fail(422, 'Enter the administrator name and a valid email address.');
        }
        $problem = password_problem($password);
        if ($problem !== '') {
            fail(422, $problem);
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $id = db_exec(
            $BP_DB,
            "INSERT INTO users (name, email, password_hash, role, avatar, active) VALUES (?, ?, ?, 'admin', 'star', 1)",
            'sss',
            array($name, $email, $hash)
        );
        audit($BP_DB, $id, 'admin.bootstrap', 'user', $id, array('email' => $email));
        respond(201, array(
            'ok' => true,
            'message' => 'Administrator created. Remove bootstrap_key from config.php now.',
            'user_id' => $id,
        ));
    }

    /* ---------------------------------------------------------------------
     * Public: registration
     * ------------------------------------------------------------------ */

    if ($method === 'POST' && $route === 'auth/register') {
        $body = request_body();
        $role = strtolower(input($body, 'role', 'student'));
        if (!in_array($role, array('student', 'parent', 'tutor'), true)) {
            fail(422, 'Choose Student, Parent, or Tutor.');
        }
        $name = clean_text(input($body, 'name'), 120);
        $email = strtolower(input($body, 'email'));
        $password = (string)($body['password'] ?? '');
        $grade = input_int($body, 'grade');
        $avatar = input($body, 'avatar', 'star');
        $inviteCode = strtoupper(input($body, 'invite_code'));
        if ($name === '' || strlen($name) < 2) {
            fail(422, 'Please write your name.');
        }
        if (!valid_email($email)) {
            fail(422, 'Please enter a real email address.');
        }
        $problem = password_problem($password);
        if ($problem !== '') {
            fail(422, $problem);
        }
        if ($role === 'student' && ($grade === null || $grade < 1 || $grade > 8)) {
            fail(422, 'Choose a grade from 1 to 8.');
        }
        if (!in_array($avatar, BP_AVATARS, true)) {
            $avatar = 'star';
        }
        $guardianEmail = strtolower(clean_text(input($body, 'guardian_email'), 190));
        $consent = !empty($body['guardian_consent']);
        if ($role === 'student') {
            if (!valid_email($guardianEmail)) {
                fail(422, 'A parent or guardian email is needed for a student account.');
            }
            if (!$consent) {
                fail(422, 'A parent or guardian must give consent before a student account is created.');
            }
        } else {
            $guardianEmail = '';
            $consent = false;
        }

        $schoolId = null;
        if ($inviteCode !== '') {
            $school = db_one($BP_DB, 'SELECT id FROM schools WHERE invite_code = ? LIMIT 1', 's', array($inviteCode));
            if (!$school) {
                fail(422, 'That school invite code was not found. Leave it blank or check with your school.');
            }
            $schoolId = (int)$school['id'];
        }

        $existing = db_one($BP_DB, 'SELECT id FROM users WHERE email = ? LIMIT 1', 's', array($email));
        if ($existing) {
            fail(409, 'An account already uses this email. Try signing in or resetting the password.', array('code' => 'email_taken'));
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $active = $role === 'tutor' ? 0 : 1;
        $family = $role === 'student' ? family_code($BP_DB) : null;
        $consentAt = $role === 'student' ? gmdate('Y-m-d H:i:s') : null;

        try {
            $userId = db_exec(
                $BP_DB,
                'INSERT INTO users (name, email, password_hash, role, school_id, grade, avatar, family_code,
                                    guardian_email, guardian_consent_at, active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                'ssssiissssi',
                array($name, $email, $hash, $role, $schoolId, $role === 'student' ? $grade : null, $avatar,
                      $family, $guardianEmail !== '' ? $guardianEmail : null, $consentAt, $active)
            );
        } catch (mysqli_sql_exception $error) {
            if ((int)$error->getCode() === 1062) {
                fail(409, 'An account already uses this email. Try signing in.');
            }
            throw $error;
        }

        if ($role === 'tutor') {
            db_exec($BP_DB, 'INSERT IGNORE INTO tutors (user_id, school_id, verified) VALUES (?, ?, 0)', 'ii', array($userId, $schoolId));
            notify_admins($BP_DB, 'New tutor needs approval', $name . ' (' . $email . ') registered as a tutor. Approve the account in Admin.', 'admin', 'admin');
            audit($BP_DB, $userId, 'auth.register.tutor', 'user', $userId, array('email' => $email));
            respond(201, array(
                'ok' => true,
                'pending' => true,
                'message' => 'Your tutor account was created. An administrator will review and approve it before you can sign in.',
            ));
        }

        if ($role === 'student' && $guardianEmail !== '') {
            $parent = db_one($BP_DB, "SELECT id FROM users WHERE email = ? AND role = 'parent' AND active = 1 LIMIT 1", 's', array($guardianEmail));
            if ($parent) {
                db_exec(
                    $BP_DB,
                    "INSERT IGNORE INTO parent_child_links (parent_id, student_id, status, requested_by)
                     VALUES (?, ?, 'pending', ?)",
                    'iii',
                    array((int)$parent['id'], $userId, $userId)
                );
                notify($BP_DB, (int)$parent['id'], 'Family link request', $name . ' added your email as their guardian. Open Family to approve.', 'family', 'family');
            }
        }

        $newUser = db_one($BP_DB, 'SELECT * FROM users WHERE id = ? LIMIT 1', 'i', array($userId));
        $tokenData = issue_token($BP_DB, $newUser);
        db_exec($BP_DB, 'UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', 'i', array($userId));
        audit($BP_DB, $userId, 'auth.register', 'user', $userId, array('role' => $role));
        notify($BP_DB, $userId, 'Welcome to BrightPath', 'Your learning space is ready. Take the quick tour to meet your guide.', 'welcome', 'home');
        respond(201, array(
            'ok' => true,
            'token' => $tokenData['token'],
            'expires_in' => $tokenData['expires_in'],
            'user' => public_user($newUser, true),
            'message' => 'Welcome to BrightPath!',
        ));
    }

    /* ---------------------------------------------------------------------
     * Public: sign in / recovery
     * ------------------------------------------------------------------ */

    if ($method === 'POST' && $route === 'auth/login') {
        $body = request_body();
        $email = strtolower(input($body, 'email'));
        $password = (string)($body['password'] ?? '');
        if (!valid_email($email) || $password === '') {
            fail(422, 'Enter your email and password.');
        }
        $emailHash = hash('sha256', 'bp-email|' . $email);
        $ipHash = client_ip_hash();
        $counts = login_counts($BP_DB, $emailHash, $ipHash);
        if ($counts['email'] >= (int)config('login_max_attempts_per_email', 8)
            || $counts['ip'] >= (int)config('login_max_attempts_per_ip', 30)) {
            fail(429, 'Too many sign-in tries. Please wait 15 minutes and try again.');
        }

        $user = db_one($BP_DB, 'SELECT * FROM users WHERE email = ? LIMIT 1', 's', array($email));
        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            record_login($BP_DB, $emailHash, $ipHash, false);
            fail(401, 'We could not sign you in. Check your email and password.');
        }
        if ((int)$user['active'] !== 1) {
            record_login($BP_DB, $emailHash, $ipHash, false);
            $message = $user['role'] === 'tutor'
                ? 'Your tutor account is waiting for administrator approval.'
                : 'This account is paused. Ask an administrator for help.';
            fail(403, $message);
        }
        if (password_needs_rehash((string)$user['password_hash'], PASSWORD_DEFAULT)) {
            db_exec($BP_DB, 'UPDATE users SET password_hash = ? WHERE id = ?', 'si', array(password_hash($password, PASSWORD_DEFAULT), (int)$user['id']));
        }
        record_login($BP_DB, $emailHash, $ipHash, true);
        db_exec($BP_DB, 'UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', 'i', array((int)$user['id']));
        $tokenData = issue_token($BP_DB, $user);
        audit($BP_DB, (int)$user['id'], 'auth.login', 'user', (int)$user['id']);
        respond(200, array(
            'ok' => true,
            'token' => $tokenData['token'],
            'expires_in' => $tokenData['expires_in'],
            'user' => public_user($user, true),
        ));
    }

    if ($method === 'POST' && $route === 'auth/forgot') {
        $body = request_body();
        $email = strtolower(input($body, 'email'));
        $generic = 'If that email belongs to an account, recovery help is on the way. Ask your parent, tutor, or school administrator if you need help now.';
        if (!valid_email($email)) {
            respond(200, array('ok' => true, 'message' => $generic));
        }
        $user = db_one($BP_DB, 'SELECT id, name FROM users WHERE email = ? AND active = 1 LIMIT 1', 's', array($email));
        if ($user && (bool)config('mail_enabled', false)) {
            $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
            $tokenHash = hash('sha256', $token);
            $expires = gmdate('Y-m-d H:i:s', time() + 3600);
            db_exec($BP_DB, 'DELETE FROM password_resets WHERE user_id = ? OR expires_at <= UTC_TIMESTAMP()', 'i', array((int)$user['id']));
            db_exec(
                $BP_DB,
                'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
                'iss',
                array((int)$user['id'], $tokenHash, $expires)
            );
            $link = 'https://brightpath.gt.tc/app.html?reset=' . rawurlencode($token);
            $subject = 'BrightPath password reset';
            $message = "Hello " . $user['name'] . ",\n\nReset your BrightPath password here (valid for one hour):\n" . $link . "\n\nIf you did not ask for this, ignore this email.";
            $from = (string)config('mail_from', 'no-reply@brightpath.gt.tc');
            @mail($email, $subject, $message, 'From: BrightPath <' . $from . ">\r\nContent-Type: text/plain; charset=UTF-8");
        }
        respond(200, array('ok' => true, 'message' => $generic));
    }

    if ($method === 'POST' && $route === 'auth/reset') {
        $body = request_body();
        $token = input($body, 'token');
        $password = (string)($body['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_-]{40,64}$/', $token)) {
            fail(422, 'That recovery link is not valid. Ask an administrator for a temporary password.');
        }
        $problem = password_problem($password);
        if ($problem !== '') {
            fail(422, $problem);
        }
        $tokenHash = hash('sha256', $token);
        $reset = db_one(
            $BP_DB,
            'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() LIMIT 1',
            's',
            array($tokenHash)
        );
        if (!$reset) {
            fail(422, 'That recovery link has expired. Ask an administrator for a temporary password.');
        }
        db_exec($BP_DB, 'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', 'si', array(password_hash($password, PASSWORD_DEFAULT), (int)$reset['user_id']));
        db_exec($BP_DB, 'UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE id = ?', 'i', array((int)$reset['id']));
        db_exec($BP_DB, 'DELETE FROM api_tokens WHERE user_id = ?', 'i', array((int)$reset['user_id']));
        audit($BP_DB, (int)$reset['user_id'], 'auth.reset_password', 'user', (int)$reset['user_id']);
        respond(200, array('ok' => true, 'message' => 'Your password was changed. You can sign in now.'));
    }

    if ($method === 'POST' && $route === 'support') {
        $body = request_body();
        $supportUser = current_user($BP_DB, false);
        $name = clean_text(input($body, 'name', $supportUser ? (string)$supportUser['name'] : ''), 120);
        $email = strtolower(clean_text(input($body, 'email', $supportUser ? (string)$supportUser['email'] : ''), 190));
        $page = clean_text(input($body, 'page'), 40);
        $message = clean_text(input($body, 'body'), 2000);
        if ($name === '') {
            $name = 'BrightPath visitor';
        }
        if (!valid_email($email)) {
            fail(422, 'Add an email address so we can reply.');
        }
        if (strlen($message) < 5) {
            fail(422, 'Tell us a little more so we can help.');
        }
        $recent = db_one(
            $BP_DB,
            'SELECT COUNT(*) AS total FROM support_messages WHERE email = ? AND created_at > (UTC_TIMESTAMP() - INTERVAL 1 HOUR)',
            's',
            array($email)
        );
        if ($recent && (int)$recent['total'] >= 5) {
            fail(429, 'You already sent a few messages. Please wait an hour or ask your school administrator.');
        }
        $id = db_exec(
            $BP_DB,
            'INSERT INTO support_messages (user_id, name, email, page, body) VALUES (?, ?, ?, ?, ?)',
            'issss',
            array($supportUser ? (int)$supportUser['id'] : null, $name, $email, $page, $message)
        );
        notify_admins($BP_DB, 'New help request', $name . ' sent a message from the ' . ($page !== '' ? $page : 'app') . ' page.', 'support', 'admin');
        respond(201, array('ok' => true, 'message' => 'Your message was sent. A grown-up helper will reply by email.', 'support_id' => $id));
    }

    /* ---------------------------------------------------------------------
     * Authenticated account basics
     * ------------------------------------------------------------------ */

    $user = current_user($BP_DB);

    if ($method === 'GET' && $route === 'auth/me') {
        $fresh = db_one(
            $BP_DB,
            'SELECT u.*, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.id = ? LIMIT 1',
            'i',
            array((int)$user['id'])
        );
        $unread = db_one($BP_DB, 'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', 'i', array((int)$user['id']));
        respond(200, array(
            'ok' => true,
            'user' => public_user($fresh, true),
            'unread_notifications' => $unread ? (int)$unread['total'] : 0,
            'settings' => array(
                'app_name' => setting($BP_DB, 'app_name', 'BrightPath'),
                'welcome_message' => setting($BP_DB, 'welcome_message', 'A little progress every day adds up to something brilliant.'),
                'jitsi_domain' => setting($BP_DB, 'jitsi_domain', (string)config('jitsi_domain', 'meet.jit.si')),
                'support_email' => setting($BP_DB, 'support_email', (string)config('support_email', '')),
            ),
        ));
    }

    if ($method === 'POST' && $route === 'auth/logout') {
        $token = bearer_token();
        if ($token !== '') {
            db_exec($BP_DB, 'DELETE FROM api_tokens WHERE token_hash = ?', 's', array(hash('sha256', $token)));
        }
        respond(200, array('ok' => true));
    }

    if ($method === 'POST' && $route === 'auth/change-password') {
        $body = request_body();
        $current = (string)($body['current_password'] ?? '');
        $new = (string)($body['new_password'] ?? '');
        $row = db_one($BP_DB, 'SELECT password_hash FROM users WHERE id = ? LIMIT 1', 'i', array((int)$user['id']));
        if (!$row || !password_verify($current, (string)$row['password_hash'])) {
            fail(401, 'Your current password is not correct.');
        }
        $problem = password_problem($new);
        if ($problem !== '') {
            fail(422, $problem);
        }
        db_exec(
            $BP_DB,
            'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            'si',
            array(password_hash($new, PASSWORD_DEFAULT), (int)$user['id'])
        );
        $token = bearer_token();
        db_exec($BP_DB, 'DELETE FROM api_tokens WHERE user_id = ? AND token_hash <> ?', 'is', array((int)$user['id'], hash('sha256', $token)));
        audit($BP_DB, (int)$user['id'], 'auth.change_password', 'user', (int)$user['id']);
        respond(200, array('ok' => true, 'message' => 'Your password is updated.'));
    }

    if ($method === 'POST' && $route === 'profile/update') {
        $body = request_body();
        $name = clean_text(input($body, 'name', (string)$user['name']), 120);
        $avatar = input($body, 'avatar', (string)$user['avatar']);
        if ($name === '' || strlen($name) < 2) {
            fail(422, 'Please keep a name of at least 2 characters.');
        }
        if (!in_array($avatar, BP_AVATARS, true)) {
            $avatar = 'star';
        }
        db_exec($BP_DB, 'UPDATE users SET name = ?, avatar = ? WHERE id = ?', 'ssi', array($name, $avatar, (int)$user['id']));
        respond(200, array('ok' => true, 'message' => 'Profile updated.', 'avatar' => $avatar, 'name' => $name));
    }

    /* ---------------------------------------------------------------------
     * Assignments and student work
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'assignments') {
        $rows = array();
        $select = "SELECT a.id, a.title, a.description, a.grade, a.assignment_type, a.question_text,
                          a.choices_json, a.points, DATE_FORMAT(a.due_at, '%Y-%m-%d') AS due_at,
                          a.status, a.class_id, a.lesson_id, a.created_at,
                          s.id AS submission_id, s.status AS submission_status, s.grade AS score_grade,
                          s.feedback AS submission_feedback, s.original_filename,
                          aa.id AS answer_id, aa.selected_choice, aa.answer_text, aa.is_correct,
                          aa.points AS answer_points, aa.feedback AS answer_feedback, aa.submitted_at AS answer_submitted_at,
                          s.submitted_at AS file_submitted_at";
        $from = ' FROM assignments a
                  LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
                  LEFT JOIN assignment_answers aa ON aa.assignment_id = a.id AND aa.student_id = ? ';

        if ((string)$user['role'] === 'student') {
            $rows = db_all(
                $BP_DB,
                $select . $from . " WHERE a.grade = ? AND a.status = 'published'
                    AND (a.due_at IS NULL OR a.due_at >= UTC_DATE())
                    ORDER BY (a.due_at IS NULL) ASC, a.due_at ASC, a.id DESC LIMIT 200",
                'iii',
                array((int)$user['id'], (int)$user['id'], (int)$user['grade'])
            );
        } elseif ((string)$user['role'] === 'parent') {
            $childId = input_int($_GET, 'student_id');
            if ($childId === null) {
                $first = db_one(
                    $BP_DB,
                    "SELECT student_id FROM parent_child_links WHERE parent_id = ? AND status = 'active' ORDER BY id LIMIT 1",
                    'i',
                    array((int)$user['id'])
                );
                $childId = $first ? (int)$first['student_id'] : null;
            }
            if ($childId === null || !can_view_student($BP_DB, $user, $childId)) {
                fail(403, 'Link a child to your account before viewing their work.');
            }
            $child = db_one($BP_DB, 'SELECT grade FROM users WHERE id = ? LIMIT 1', 'i', array($childId));
            $rows = db_all(
                $BP_DB,
                $select . $from . ' WHERE a.grade = ? AND a.status <> \'draft\'
                    ORDER BY a.created_at DESC LIMIT 200',
                'iii',
                array($childId, $childId, (int)$child['grade'])
            );
        } elseif ((string)$user['role'] === 'tutor') {
            $rows = db_all(
                $BP_DB,
                "SELECT a.id, a.title, a.description, a.grade, a.assignment_type, a.question_text,
                        a.choices_json, a.correct_choice, a.points, DATE_FORMAT(a.due_at, '%Y-%m-%d') AS due_at,
                        a.status, a.class_id, a.lesson_id, a.created_at,
                        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count,
                        (SELECT COUNT(*) FROM assignment_answers aa WHERE aa.assignment_id = a.id) AS answer_count
                 FROM assignments a WHERE a.created_by = ? ORDER BY a.created_at DESC LIMIT 200",
                'i',
                array((int)$user['id'])
            );
        } else {
            $rows = db_all(
                $BP_DB,
                "SELECT a.id, a.title, a.description, a.grade, a.assignment_type, a.question_text,
                        a.choices_json, a.correct_choice, a.points, DATE_FORMAT(a.due_at, '%Y-%m-%d') AS due_at,
                        a.status, a.class_id, a.lesson_id, a.created_at,
                        u.name AS creator_name,
                        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count,
                        (SELECT COUNT(*) FROM assignment_answers aa WHERE aa.assignment_id = a.id) AS answer_count
                 FROM assignments a LEFT JOIN users u ON u.id = a.created_by
                 ORDER BY a.created_at DESC LIMIT 300"
            );
        }

        foreach ($rows as $index => $row) {
            if (isset($row['choices_json'])) {
                $row['choices'] = json_choices($row['choices_json']);
                unset($row['choices_json']);
            }
            if (isset($row['correct_choice']) && $row['correct_choice'] !== null) {
                $row['correct_choice'] = (int)$row['correct_choice'];
            }
            $row['submitted'] = !empty($row['submission_id']) || !empty($row['answer_id']);
            $rows[$index] = $row;
        }
        respond(200, array('ok' => true, 'assignments' => $rows));
    }

    if ($method === 'POST' && $route === 'assignments') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $title = clean_text(input($body, 'title'), 180);
        $description = clean_text(input($body, 'description'), 5000);
        $grade = input_int($body, 'grade');
        $type = input($body, 'assignment_type', 'file');
        $questionText = clean_text(input($body, 'question_text'), 3000);
        $dueAt = parse_date(input($body, 'due_at'));
        $status = input($body, 'status', 'published');
        $classId = input_int($body, 'class_id');
        $lessonId = input_int($body, 'lesson_id');
        $points = input_int($body, 'points');
        $points = $points === null ? 10 : max(0, min($points, 100));
        if ($title === '' || $grade === null || $grade < 1 || $grade > 8) {
            fail(422, 'Add a title and choose a grade from 1 to 8.');
        }
        if (!in_array($type, array('file', 'choice', 'text'), true)) {
            fail(422, 'Choose file, multiple choice, or written answer.');
        }
        if ($dueAt === false) {
            fail(422, 'Choose a valid due date.');
        }
        if (!in_array($status, array('draft', 'published', 'closed'), true)) {
            $status = 'published';
        }
        $choices = array();
        $correctChoice = null;
        if ($type === 'choice') {
            $rawChoices = isset($body['choices']) ? $body['choices'] : (isset($body['choices_json']) ? $body['choices_json'] : array());
            if (is_string($rawChoices)) {
                $rawChoices = json_decode($rawChoices, true);
            }
            if (is_array($rawChoices)) {
                foreach ($rawChoices as $choice) {
                    if (is_string($choice) && trim($choice) !== '') {
                        $choices[] = clean_text($choice, 300);
                    }
                }
            }
            $correctChoice = input_int($body, 'correct_choice');
            if ($questionText === '' || count($choices) < 2 || count($choices) > 4
                || $correctChoice === null || $correctChoice < 0 || $correctChoice >= count($choices)) {
                fail(422, 'A multiple-choice question needs 2 to 4 answers and one correct answer.');
            }
        } elseif ($type === 'text' && $questionText === '') {
            fail(422, 'Write the question students should answer.');
        }

        if ($classId !== null) {
            $class = db_one($BP_DB, 'SELECT id, tutor_id, grade FROM classes WHERE id = ? LIMIT 1', 'i', array($classId));
            if (!$class || ((string)$user['role'] === 'tutor' && (int)$class['tutor_id'] !== (int)$user['id'])) {
                fail(404, 'That class was not found.');
            }
        }
        if ($lessonId !== null) {
            $lesson = db_one($BP_DB, 'SELECT id FROM lessons WHERE id = ? LIMIT 1', 'i', array($lessonId));
            if (!$lesson) {
                $lessonId = null;
            }
        }

        $schoolId = $user['school_id'] === null ? null : (int)$user['school_id'];
        $resource = null;
        $file = $_FILES['resource_file'] ?? null;
        if ($file && (int)$file['error'] !== UPLOAD_ERR_NO_FILE) {
            $maxBytes = max(1024, min((int)config('max_upload_bytes', 8388608), 8388608));
            $resource = store_upload($BP_DB, $file, 'resource', $maxBytes);
        }

        $choicesJson = $type === 'choice' ? json_encode($choices, JSON_UNESCAPED_UNICODE) : null;
        $creatorId = (int)$user['id'];
        try {
            $assignmentId = db_exec(
                $BP_DB,
                'INSERT INTO assignments
                 (title, description, grade, assignment_type, question_text, choices_json, correct_choice,
                  resource_stored_filename, resource_original_filename, resource_mime_type, resource_file_size,
                  points, due_at, status, school_id, class_id, lesson_id, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                'ssisssississsssiii',
                array($title, $description, $grade, $type, $questionText !== '' ? $questionText : null,
                      $choicesJson, $correctChoice,
                      $resource ? $resource['stored_filename'] : null,
                      $resource ? $resource['original_filename'] : null,
                      $resource ? $resource['mime_type'] : null,
                      $resource ? $resource['file_size'] : null,
                      $points, $dueAt, $status, $schoolId, $classId, $lessonId, $creatorId)
            );
        } catch (Throwable $error) {
            if ($resource && is_file($resource['path'])) {
                @unlink($resource['path']);
            }
            throw $error;
        }

        if ($status === 'published' && (string)$user['role'] === 'tutor') {
            $students = db_all(
                $BP_DB,
                "SELECT student_id FROM tutor_students WHERE tutor_id = ? AND status = 'active' LIMIT 100",
                'i',
                array((int)$user['id'])
            );
            foreach ($students as $student) {
                notify(
                    $BP_DB,
                    (int)$student['student_id'],
                    'New assignment: ' . $title,
                    'Due ' . ($dueAt !== null ? $dueAt : 'when you are ready') . '. Open My work to begin.',
                    'assignment',
                    'assignments'
                );
            }
        }
        audit($BP_DB, (int)$user['id'], 'assignment.create', 'assignment', $assignmentId, array('title' => $title, 'grade' => $grade));
        respond(201, array('ok' => true, 'assignment_id' => $assignmentId, 'message' => 'Assignment created.'));
    }

    if ($method === 'POST' && $route === 'assignments/update') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $id = input_int($body, 'id');
        $status = input($body, 'status');
        if ($id === null || !in_array($status, array('draft', 'published', 'closed'), true)) {
            fail(422, 'Choose an assignment and a valid status.');
        }
        $assignment = db_one($BP_DB, 'SELECT id, created_by, title FROM assignments WHERE id = ? LIMIT 1', 'i', array($id));
        if (!$assignment) {
            fail(404, 'That assignment was not found.');
        }
        if (!is_admin($user) && (int)$assignment['created_by'] !== (int)$user['id']) {
            fail(403, 'You can only change your own assignments.');
        }
        db_exec($BP_DB, 'UPDATE assignments SET status = ? WHERE id = ?', 'si', array($status, $id));
        audit($BP_DB, (int)$user['id'], 'assignment.status', 'assignment', $id, array('status' => $status));
        respond(200, array('ok' => true, 'message' => 'Assignment updated.'));
    }

    if ($method === 'GET' && $route === 'assignments/download') {
        $id = input_int($_GET, 'id');
        if ($id === null) {
            fail(422, 'Choose an assignment resource.');
        }
        $assignment = db_one(
            $BP_DB,
            'SELECT id, grade, created_by, status, resource_stored_filename, resource_original_filename, resource_mime_type
             FROM assignments WHERE id = ? LIMIT 1',
            'i',
            array($id)
        );
        if (!$assignment) {
            fail(404, 'That assignment was not found.');
        }
        $allowed = is_admin($user) || (int)$assignment['created_by'] === (int)$user['id'];
        if ((string)$user['role'] === 'student') {
            $allowed = (int)$assignment['grade'] === (int)$user['grade'] && $assignment['status'] === 'published';
        } elseif ((string)$user['role'] === 'parent') {
            $child = db_one(
                $BP_DB,
                "SELECT p.id FROM parent_child_links p JOIN users u ON u.id = p.student_id
                 WHERE p.parent_id = ? AND p.status = 'active' AND u.grade = ? LIMIT 1",
                'ii',
                array((int)$user['id'], (int)$assignment['grade'])
            );
            $allowed = (bool)$child;
        }
        if (!$allowed) {
            fail(403, 'You cannot download that resource.');
        }
        if (empty($assignment['resource_stored_filename'])) {
            fail(404, 'This assignment has no attached resource.');
        }
        stream_stored_file(array(
            'stored_filename' => $assignment['resource_stored_filename'],
            'original_filename' => $assignment['resource_original_filename'],
            'mime_type' => $assignment['resource_mime_type'],
        ));
    }

    if ($method === 'POST' && $route === 'submissions') {
        require_roles($user, array('student'));
        $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
        $isMultipart = strpos($contentType, 'multipart/form-data') === 0;
        $body = $isMultipart ? $_POST : body_json();
        $assignmentId = input_int($body, 'assignment_id');
        if ($assignmentId === null) {
            fail(422, 'Choose an assignment.');
        }
        $assignment = db_one(
            $BP_DB,
            "SELECT id, title, grade, assignment_type, question_text, choices_json, correct_choice, points,
                    due_at, status, created_by
             FROM assignments WHERE id = ? LIMIT 1",
            'i',
            array($assignmentId)
        );
        if (!$assignment || (int)$assignment['grade'] !== (int)$user['grade'] || $assignment['status'] !== 'published') {
            fail(404, 'That assignment is not available for your grade.');
        }
        if ($assignment['due_at'] !== null && $assignment['due_at'] < gmdate('Y-m-d')) {
            fail(409, 'This assignment is past its due date. Ask your tutor to reopen it.');
        }

        if ($isMultipart) {
            if ($assignment['assignment_type'] !== 'file') {
                fail(422, 'This assignment does not use a file upload.');
            }
            $notes = clean_text(input($body, 'notes'), 1000);
            $file = $_FILES['file'] ?? null;
            if (!$file) {
                fail(422, 'Choose a photo or PDF of your work.');
            }
            $maxBytes = max(1024, min((int)config('max_upload_bytes', 8388608), 8388608));
            $upload = store_upload($BP_DB, $file, 'submission', $maxBytes);
            $old = db_one($BP_DB, 'SELECT stored_filename FROM submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1', 'ii', array($assignmentId, (int)$user['id']));
            try {
                db_exec(
                    $BP_DB,
                    'INSERT INTO submissions (assignment_id, student_id, stored_filename, original_filename, mime_type, file_size, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE stored_filename = VALUES(stored_filename),
                       original_filename = VALUES(original_filename), mime_type = VALUES(mime_type),
                       file_size = VALUES(file_size), notes = VALUES(notes), status = \'submitted\',
                       feedback = \'\', grade = NULL, reviewed_by = NULL, reviewed_at = NULL,
                       submitted_at = CURRENT_TIMESTAMP',
                    'iisssis',
                    array($assignmentId, (int)$user['id'], $upload['stored_filename'], $upload['original_filename'],
                          $upload['mime_type'], $upload['file_size'], $notes)
                );
            } catch (Throwable $error) {
                @unlink($upload['path']);
                throw $error;
            }
            if ($old) {
                $uploadDir = (string)config('upload_dir', __DIR__ . '/storage');
                $oldPath = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . basename((string)$old['stored_filename']);
                if (is_file($oldPath)) {
                    @unlink($oldPath);
                }
            }
            notify(
                $BP_DB,
                (int)$assignment['created_by'],
                'New work from ' . $user['name'],
                $assignment['title'] . ' was submitted.',
                'submission',
                'tutor'
            );
            notify_parents($BP_DB, (int)$user['id'], $user['name'] . ' submitted work', $assignment['title'], 'submission', 'family');
            respond(201, array('ok' => true, 'message' => 'Your work was sent to your tutor.'));
        }

        if (!in_array($assignment['assignment_type'], array('choice', 'text'), true)) {
            fail(422, 'This assignment needs a file upload.');
        }
        $previous = db_one($BP_DB, 'SELECT id FROM assignment_answers WHERE assignment_id = ? AND student_id = ? LIMIT 1', 'ii', array($assignmentId, (int)$user['id']));
        $selectedChoice = null;
        $answerText = null;
        $isCorrect = null;
        if ($assignment['assignment_type'] === 'choice') {
            $selectedChoice = input_int($body, 'selected_choice');
            $choices = json_choices($assignment['choices_json']);
            if ($selectedChoice === null || !array_key_exists($selectedChoice, $choices)) {
                fail(422, 'Choose one answer before sending.');
            }
            $isCorrect = $selectedChoice === (int)$assignment['correct_choice'] ? 1 : 0;
        } else {
            $answerText = clean_text(input($body, 'answer_text'), 5000);
            if ($answerText === '') {
                fail(422, 'Write your answer before sending.');
            }
        }
        db_exec(
            $BP_DB,
            'INSERT INTO assignment_answers (assignment_id, student_id, selected_choice, answer_text, is_correct, feedback, reviewed_at)
             VALUES (?, ?, ?, ?, ?, \'\', NULL)
             ON DUPLICATE KEY UPDATE selected_choice = VALUES(selected_choice), answer_text = VALUES(answer_text),
               is_correct = VALUES(is_correct), feedback = \'\', points = NULL, reviewed_by = NULL,
               reviewed_at = NULL, submitted_at = CURRENT_TIMESTAMP',
            'iiisi',
            array($assignmentId, (int)$user['id'], $selectedChoice, $answerText, $isCorrect)
        );
        if (!$previous && $isCorrect === 1) {
            $earned = max(1, (int)$assignment['points']);
            db_exec(
                $BP_DB,
                "INSERT INTO learning_activity (student_id, activity_type, detail, minutes, points)
                 VALUES (?, 'assignment', ?, 5, ?)",
                'isi',
                array((int)$user['id'], clean_text($assignment['title'], 180), $earned)
            );
        }
        notify(
            $BP_DB,
            (int)$assignment['created_by'],
            'New answer from ' . $user['name'],
            $assignment['title'] . ' was submitted.',
            'submission',
            'tutor'
        );
        respond(201, array(
            'ok' => true,
            'is_correct' => $isCorrect,
            'message' => $isCorrect === null
                ? 'Your answer was sent to your tutor for review.'
                : ($isCorrect === 1 ? 'That is correct! Nice work.' : 'Answer sent. Read the hint and try again.'),
        ));
    }

    if ($method === 'GET' && $route === 'submissions') {
        $files = array();
        $answers = array();
        if ((string)$user['role'] === 'student') {
            $files = db_all(
                $BP_DB,
                "SELECT s.id, s.assignment_id, a.title, a.grade, s.original_filename, s.mime_type, s.file_size,
                        s.notes, s.status, s.feedback, s.grade AS score_grade, s.submitted_at, s.reviewed_at,
                        'file' AS submission_type, u.name AS student_name
                 FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.student_id
                 WHERE s.student_id = ? ORDER BY s.submitted_at DESC LIMIT 100",
                'i',
                array((int)$user['id'])
            );
            $answers = db_all(
                $BP_DB,
                "SELECT aa.id, aa.assignment_id, a.title, a.grade, aa.selected_choice, aa.answer_text, aa.is_correct,
                        aa.points, aa.feedback, aa.reviewed_at, aa.submitted_at, a.choices_json, a.question_text,
                        'answer' AS submission_type, u.name AS student_name
                 FROM assignment_answers aa JOIN assignments a ON a.id = aa.assignment_id JOIN users u ON u.id = aa.student_id
                 WHERE aa.student_id = ? ORDER BY aa.submitted_at DESC LIMIT 100",
                'i',
                array((int)$user['id'])
            );
        } elseif ((string)$user['role'] === 'parent') {
            $childId = input_int($_GET, 'student_id');
            if ($childId === null) {
                $first = db_one(
                    $BP_DB,
                    "SELECT student_id FROM parent_child_links WHERE parent_id = ? AND status = 'active' ORDER BY id LIMIT 1",
                    'i',
                    array((int)$user['id'])
                );
                $childId = $first ? (int)$first['student_id'] : null;
            }
            if ($childId === null || !can_view_student($BP_DB, $user, $childId)) {
                fail(403, 'Link a child to your account first.');
            }
            $files = db_all(
                $BP_DB,
                "SELECT s.id, s.assignment_id, a.title, a.grade, s.original_filename, s.mime_type, s.file_size,
                        s.notes, s.status, s.feedback, s.grade AS score_grade, s.submitted_at, s.reviewed_at,
                        'file' AS submission_type, u.name AS student_name
                 FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.student_id
                 WHERE s.student_id = ? ORDER BY s.submitted_at DESC LIMIT 100",
                'i',
                array($childId)
            );
            $answers = db_all(
                $BP_DB,
                "SELECT aa.id, aa.assignment_id, a.title, a.grade, aa.selected_choice, aa.answer_text, aa.is_correct,
                        aa.points, aa.feedback, aa.reviewed_at, aa.submitted_at, a.choices_json, a.question_text,
                        'answer' AS submission_type, u.name AS student_name
                 FROM assignment_answers aa JOIN assignments a ON a.id = aa.assignment_id JOIN users u ON u.id = aa.student_id
                 WHERE aa.student_id = ? ORDER BY aa.submitted_at DESC LIMIT 100",
                'i',
                array($childId)
            );
        } elseif ((string)$user['role'] === 'tutor') {
            $files = db_all(
                $BP_DB,
                "SELECT s.id, s.assignment_id, a.title, a.grade, s.original_filename, s.mime_type, s.file_size,
                        s.notes, s.status, s.feedback, s.grade AS score_grade, s.submitted_at, s.reviewed_at,
                        'file' AS submission_type, u.name AS student_name
                 FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.student_id
                 WHERE a.created_by = ? ORDER BY s.submitted_at DESC LIMIT 200",
                'i',
                array((int)$user['id'])
            );
            $answers = db_all(
                $BP_DB,
                "SELECT aa.id, aa.assignment_id, a.title, a.grade, aa.selected_choice, aa.answer_text, aa.is_correct,
                        aa.points, aa.feedback, aa.reviewed_at, aa.submitted_at, a.choices_json, a.question_text,
                        'answer' AS submission_type, u.name AS student_name
                 FROM assignment_answers aa JOIN assignments a ON a.id = aa.assignment_id JOIN users u ON u.id = aa.student_id
                 WHERE a.created_by = ? ORDER BY aa.submitted_at DESC LIMIT 200",
                'i',
                array((int)$user['id'])
            );
        } else {
            $files = db_all(
                $BP_DB,
                "SELECT s.id, s.assignment_id, a.title, a.grade, s.original_filename, s.mime_type, s.file_size,
                        s.notes, s.status, s.feedback, s.grade AS score_grade, s.submitted_at, s.reviewed_at,
                        'file' AS submission_type, u.name AS student_name
                 FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.student_id
                 ORDER BY s.submitted_at DESC LIMIT 200"
            );
            $answers = db_all(
                $BP_DB,
                "SELECT aa.id, aa.assignment_id, a.title, a.grade, aa.selected_choice, aa.answer_text, aa.is_correct,
                        aa.points, aa.feedback, aa.reviewed_at, aa.submitted_at, a.choices_json, a.question_text,
                        'answer' AS submission_type, u.name AS student_name
                 FROM assignment_answers aa JOIN assignments a ON a.id = aa.assignment_id JOIN users u ON u.id = aa.student_id
                 ORDER BY aa.submitted_at DESC LIMIT 200"
            );
        }
        foreach ($answers as $index => $row) {
            $row['choices'] = json_choices(isset($row['choices_json']) ? $row['choices_json'] : array());
            unset($row['choices_json']);
            $answers[$index] = $row;
        }
        $all = array_merge($files, $answers);
        usort($all, function ($a, $b) {
            $left = isset($a['submitted_at']) ? (string)$a['submitted_at'] : '';
            $right = isset($b['submitted_at']) ? (string)$b['submitted_at'] : '';
            return strcmp($right, $left);
        });
        respond(200, array('ok' => true, 'submissions' => array_slice($all, 0, 200)));
    }

    if ($method === 'POST' && $route === 'submissions/review') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $type = input($body, 'submission_type', 'file');
        $id = input_int($body, 'id');
        $score = input_int($body, 'grade');
        $feedback = clean_text(input($body, 'feedback'), 2000);
        if ($id === null || !in_array($type, array('file', 'answer'), true)) {
            fail(422, 'Choose a submission to review.');
        }
        if ($score !== null && ($score < 0 || $score > 100)) {
            fail(422, 'Give a score from 0 to 100.');
        }
        if ($type === 'file') {
            $row = db_one(
                $BP_DB,
                'SELECT s.id, s.assignment_id, s.student_id, a.created_by, a.title
                 FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ? LIMIT 1',
                'i',
                array($id)
            );
        } else {
            $row = db_one(
                $BP_DB,
                'SELECT aa.id, aa.assignment_id, aa.student_id, a.created_by, a.title, a.points AS assignment_points
                 FROM assignment_answers aa JOIN assignments a ON a.id = aa.assignment_id WHERE aa.id = ? LIMIT 1',
                'i',
                array($id)
            );
        }
        if (!$row) {
            fail(404, 'That submission was not found.');
        }
        if (!is_admin($user) && (int)$row['created_by'] !== (int)$user['id']) {
            fail(403, 'You can only review work for your own assignments.');
        }
        if ($type === 'file') {
            db_exec(
                $BP_DB,
                "UPDATE submissions SET status = 'reviewed', grade = ?, feedback = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?",
                'isii',
                array($score, $feedback, (int)$user['id'], $id)
            );
        } else {
            $points = null;
            if ($score !== null && isset($row['assignment_points'])) {
                $points = (int)round(((int)$row['assignment_points'] * $score) / 100);
            }
            db_exec(
                $BP_DB,
                'UPDATE assignment_answers SET points = ?, feedback = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?',
                'isii',
                array($points, $feedback, (int)$user['id'], $id)
            );
        }
        notify(
            $BP_DB,
            (int)$row['student_id'],
            'Your work was reviewed',
            $row['title'] . ($score !== null ? ' - score ' . $score . '%' : '') . ($feedback !== '' ? ' - ' . $feedback : ''),
            'review',
            'assignments'
        );
        notify_parents($BP_DB, (int)$row['student_id'], 'Work reviewed', $row['title'] . ($score !== null ? ' - score ' . $score . '%' : ''), 'review', 'family');
        respond(200, array('ok' => true, 'message' => 'Review saved and the learner was notified.'));
    }

    if ($method === 'GET' && $route === 'submissions/download') {
        $id = input_int($_GET, 'id');
        if ($id === null) {
            fail(422, 'Choose a submission.');
        }
        $row = db_one(
            $BP_DB,
            'SELECT s.id, s.student_id, s.stored_filename, s.original_filename, s.mime_type, a.created_by
             FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ? LIMIT 1',
            'i',
            array($id)
        );
        if (!$row) {
            fail(404, 'That submission was not found.');
        }
        $allowed = is_admin($user) || (int)$row['created_by'] === (int)$user['id'] || (int)$row['student_id'] === (int)$user['id'];
        if ((string)$user['role'] === 'parent') {
            $allowed = can_view_student($BP_DB, $user, (int)$row['student_id']);
        }
        if (!$allowed) {
            fail(403, 'You cannot download that submission.');
        }
        stream_stored_file($row);
    }

    /* ---------------------------------------------------------------------
     * Live classes (Jitsi Meet)
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'classes') {
        $rows = array();
        $base = "SELECT c.id, c.title, c.subject, c.grade, c.scheduled_at, c.duration_minutes,
                        c.audio_only, c.allow_recording, c.recording_url, c.status, c.join_code,
                        u.name AS tutor_name, u.avatar AS tutor_avatar,
                        (SELECT COUNT(*) FROM class_attendance ca WHERE ca.class_id = c.id) AS attendee_count,
                        ca2.minutes AS my_minutes
                 FROM classes c
                 JOIN users u ON u.id = c.tutor_id
                 LEFT JOIN class_attendance ca2 ON ca2.class_id = c.id AND ca2.user_id = ?";
        if ((string)$user['role'] === 'student') {
            $rows = db_all(
                $BP_DB,
                $base . " WHERE c.grade = ? AND (c.school_id IS NULL OR c.school_id = ?)
                    AND c.status <> 'cancelled'
                    ORDER BY (c.scheduled_at >= UTC_TIMESTAMP()) DESC, c.scheduled_at ASC LIMIT 80",
                'iii',
                array((int)$user['id'], (int)$user['grade'], $user['school_id'] === null ? 0 : (int)$user['school_id'])
            );
        } elseif ((string)$user['role'] === 'parent') {
            $childId = input_int($_GET, 'student_id');
            if ($childId === null) {
                $first = db_one(
                    $BP_DB,
                    "SELECT student_id FROM parent_child_links WHERE parent_id = ? AND status = 'active' ORDER BY id LIMIT 1",
                    'i',
                    array((int)$user['id'])
                );
                $childId = $first ? (int)$first['student_id'] : null;
            }
            if ($childId === null || !can_view_student($BP_DB, $user, $childId)) {
                fail(403, 'Link a child to your account before viewing classes.');
            }
            $child = db_one($BP_DB, 'SELECT grade, school_id FROM users WHERE id = ? LIMIT 1', 'i', array($childId));
            $rows = db_all(
                $BP_DB,
                $base . " WHERE c.grade = ? AND (c.school_id IS NULL OR c.school_id = ?) AND c.status <> 'cancelled'
                    ORDER BY (c.scheduled_at >= UTC_TIMESTAMP()) DESC, c.scheduled_at ASC LIMIT 80",
                'iii',
                array((int)$user['id'], (int)$child['grade'], $child['school_id'] === null ? 0 : (int)$child['school_id'])
            );
        } elseif ((string)$user['role'] === 'tutor') {
            $rows = db_all(
                $BP_DB,
                $base . ' WHERE c.tutor_id = ? ORDER BY (c.scheduled_at >= UTC_TIMESTAMP()) DESC, c.scheduled_at ASC LIMIT 100',
                'ii',
                array((int)$user['id'], (int)$user['id'])
            );
        } else {
            $rows = db_all(
                $BP_DB,
                $base . ' ORDER BY (c.scheduled_at >= UTC_TIMESTAMP()) DESC, c.scheduled_at ASC LIMIT 200',
                'i',
                array((int)$user['id'])
            );
        }
        respond(200, array(
            'ok' => true,
            'classes' => $rows,
            'jitsi_domain' => setting($BP_DB, 'jitsi_domain', (string)config('jitsi_domain', 'meet.jit.si')),
        ));
    }

    if ($method === 'POST' && $route === 'classes') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $title = clean_text(input($body, 'title'), 180);
        $subject = clean_text(input($body, 'subject', 'General'), 60);
        $grade = input_int($body, 'grade');
        $scheduledAt = parse_datetime(input($body, 'scheduled_at'));
        $duration = input_int($body, 'duration_minutes');
        $duration = $duration === null ? 45 : max(10, min($duration, 240));
        $audioOnly = !empty($body['audio_only']) ? 1 : 0;
        $allowRecording = !empty($body['allow_recording']) ? 1 : 0;
        if ($title === '' || $grade === null || $grade < 1 || $grade > 8) {
            fail(422, 'Add a class title and choose a grade from 1 to 8.');
        }
        if ($scheduledAt === false || $scheduledAt === null) {
            fail(422, 'Choose a valid class date and time.');
        }
        $schoolId = $user['school_id'] === null ? null : (int)$user['school_id'];
        $room = 'brightpath-' . bin2hex(random_bytes(10));
        $joinCode = random_code(6);
        $id = db_exec(
            $BP_DB,
            "INSERT INTO classes (title, subject, grade, tutor_id, school_id, scheduled_at, duration_minutes,
                                  audio_only, allow_recording, status, room_name, join_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
            'ssiiisiiiss',
            array($title, $subject, $grade, (int)$user['id'], $schoolId, $scheduledAt, $duration,
                  $audioOnly, $allowRecording, $room, $joinCode)
        );
        $students = db_all(
            $BP_DB,
            "SELECT student_id FROM tutor_students WHERE tutor_id = ? AND status = 'active' LIMIT 100",
            'i',
            array((int)$user['id'])
        );
        foreach ($students as $student) {
            notify(
                $BP_DB,
                (int)$student['student_id'],
                'New live class: ' . $title,
                'Starts ' . $scheduledAt . ' UTC. Open Live classes to join.',
                'class',
                'classes'
            );
        }
        audit($BP_DB, (int)$user['id'], 'class.create', 'class', $id, array('title' => $title, 'grade' => $grade));
        respond(201, array(
            'ok' => true,
            'class_id' => $id,
            'join_code' => $joinCode,
            'message' => 'Live class scheduled. Share the join code only with your learners.',
        ));
    }

    if ($method === 'POST' && $route === 'classes/join') {
        $body = request_body();
        $classId = input_int($body, 'class_id');
        if ($classId === null) {
            fail(422, 'Choose a class to join.');
        }
        $class = db_one($BP_DB, 'SELECT * FROM classes WHERE id = ? LIMIT 1', 'i', array($classId));
        if (!$class) {
            fail(404, 'That class was not found.');
        }
        if (in_array((string)$class['status'], array('cancelled', 'ended'), true)) {
            fail(409, 'This class has already finished.');
        }
        if (!can_access_class($BP_DB, $user, $class)) {
            fail(403, 'This live class is not open to your account.');
        }
        if ($class['status'] === 'scheduled') {
            db_exec($BP_DB, "UPDATE classes SET status = 'live' WHERE id = ?", 'i', array($classId));
        }
        db_exec(
            $BP_DB,
            'INSERT INTO class_attendance (class_id, user_id, joined_at, left_at, minutes)
             VALUES (?, ?, UTC_TIMESTAMP(), NULL, 0)
             ON DUPLICATE KEY UPDATE joined_at = UTC_TIMESTAMP(), left_at = NULL',
            'ii',
            array($classId, (int)$user['id'])
        );
        if ((string)$user['role'] === 'student') {
            award_badge($BP_DB, (int)$user['id'], 'team_player');
        }
        $domain = setting($BP_DB, 'jitsi_domain', (string)config('jitsi_domain', 'meet.jit.si'));
        $isModerator = (string)$user['role'] === 'admin' || (int)$class['tutor_id'] === (int)$user['id'];
        $audioOnly = (int)$class['audio_only'] === 1;
        respond(200, array(
            'ok' => true,
            'join' => array(
                'domain' => $domain,
                'script_url' => (string)config('jitsi_script_url', 'https://' . $domain . '/external_api.js'),
                'room' => (string)$class['room_name'],
                'display_name' => (string)$user['name'],
                'email' => (string)$user['email'],
                'subject' => (string)$class['title'],
                'audio_only' => $audioOnly,
                'is_moderator' => $isModerator,
                'start_with_video_muted' => $audioOnly || !$isModerator,
                'config' => array(
                    'startAudioOnly' => $audioOnly,
                    'startWithVideoMuted' => $audioOnly || !$isModerator,
                    'prejoinPageEnabled' => true,
                    'disableDeepLinking' => true,
                ),
            ),
        ));
    }

    if ($method === 'POST' && $route === 'classes/leave') {
        $body = request_body();
        $classId = input_int($body, 'class_id');
        $minutes = input_int($body, 'minutes');
        $minutes = $minutes === null ? 0 : max(0, min($minutes, 240));
        if ($classId === null) {
            fail(422, 'Choose a class.');
        }
        db_exec(
            $BP_DB,
            'UPDATE class_attendance SET left_at = UTC_TIMESTAMP(), minutes = GREATEST(minutes, ?)
             WHERE class_id = ? AND user_id = ?',
            'iii',
            array($minutes, $classId, (int)$user['id'])
        );
        if ((string)$user['role'] === 'student' && $minutes >= 5) {
            db_exec(
                $BP_DB,
                "INSERT INTO learning_activity (student_id, activity_type, detail, minutes, points)
                 VALUES (?, 'class', 'Live class attendance', ?, 5)",
                'ii',
                array((int)$user['id'], $minutes)
            );
        }
        respond(200, array('ok' => true, 'minutes' => $minutes));
    }

    if ($method === 'GET' && $route === 'classes/messages') {
        $classId = input_int($_GET, 'id');
        if ($classId === null) {
            fail(422, 'Choose a class.');
        }
        $class = db_one($BP_DB, 'SELECT * FROM classes WHERE id = ? LIMIT 1', 'i', array($classId));
        if (!$class) {
            fail(404, 'That class was not found.');
        }
        if (!can_access_class($BP_DB, $user, $class)) {
            fail(403, 'You cannot read this class chat.');
        }
        $rows = db_all(
            $BP_DB,
            'SELECT m.id, m.body, m.created_at, u.id AS user_id, u.name AS user_name, u.avatar, u.role
             FROM class_messages m JOIN users u ON u.id = m.user_id
             WHERE m.class_id = ? AND m.deleted_at IS NULL
             ORDER BY m.id DESC LIMIT 80',
            'i',
            array($classId)
        );
        respond(200, array('ok' => true, 'messages' => array_reverse($rows)));
    }

    if ($method === 'POST' && $route === 'classes/messages') {
        $body = request_body();
        $classId = input_int($body, 'class_id');
        $text = clean_text(input($body, 'body'), 1000);
        if ($classId === null || $text === '') {
            fail(422, 'Write a message before sending.');
        }
        $class = db_one($BP_DB, 'SELECT * FROM classes WHERE id = ? LIMIT 1', 'i', array($classId));
        if (!$class || !can_access_class($BP_DB, $user, $class)) {
            fail(403, 'You cannot post in this class chat.');
        }
        $id = db_exec(
            $BP_DB,
            'INSERT INTO class_messages (class_id, user_id, body) VALUES (?, ?, ?)',
            'iis',
            array($classId, (int)$user['id'], $text)
        );
        respond(201, array(
            'ok' => true,
            'message' => array(
                'id' => $id,
                'body' => $text,
                'created_at' => gmdate('Y-m-d H:i:s'),
                'user_id' => (int)$user['id'],
                'user_name' => (string)$user['name'],
                'avatar' => (string)$user['avatar'],
                'role' => (string)$user['role'],
            ),
        ));
    }

    if ($method === 'GET' && $route === 'classes/attendance') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $classId = input_int($_GET, 'id');
        if ($classId === null) {
            fail(422, 'Choose a class.');
        }
        $class = db_one($BP_DB, 'SELECT id, tutor_id FROM classes WHERE id = ? LIMIT 1', 'i', array($classId));
        if (!$class) {
            fail(404, 'That class was not found.');
        }
        if (!is_admin($user) && (int)$class['tutor_id'] !== (int)$user['id']) {
            fail(403, 'You can only see attendance for your own classes.');
        }
        $rows = db_all(
            $BP_DB,
            'SELECT ca.user_id, ca.joined_at, ca.left_at, ca.minutes, u.name, u.avatar, u.role, u.grade
             FROM class_attendance ca JOIN users u ON u.id = ca.user_id
             WHERE ca.class_id = ? ORDER BY ca.joined_at',
            'i',
            array($classId)
        );
        respond(200, array('ok' => true, 'attendance' => $rows));
    }

    if ($method === 'POST' && $route === 'classes/end') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $classId = input_int($body, 'class_id');
        $recordingUrl = clean_text(input($body, 'recording_url'), 500);
        if ($classId === null) {
            fail(422, 'Choose a class.');
        }
        $class = db_one($BP_DB, 'SELECT id, tutor_id FROM classes WHERE id = ? LIMIT 1', 'i', array($classId));
        if (!$class) {
            fail(404, 'That class was not found.');
        }
        if (!is_admin($user) && (int)$class['tutor_id'] !== (int)$user['id']) {
            fail(403, 'You can only end your own classes.');
        }
        db_exec(
            $BP_DB,
            "UPDATE classes SET status = 'ended', recording_url = NULLIF(?, '') WHERE id = ?",
            'si',
            array($recordingUrl, $classId)
        );
        respond(200, array('ok' => true, 'message' => 'Class marked as finished.'));
    }

    /* ---------------------------------------------------------------------
     * Direct and group messages
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'conversations') {
        $rows = db_all(
            $BP_DB,
            'SELECT c.id, c.title, c.kind, c.class_id, c.updated_at, cm.last_read_at,
                    (SELECT body FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 1) AS last_message,
                    (SELECT created_at FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 1) AS last_message_at
             FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
             WHERE cm.user_id = ?
             ORDER BY c.updated_at DESC LIMIT 60',
            'i',
            array((int)$user['id'])
        );
        foreach ($rows as $index => $row) {
            $members = db_all(
                $BP_DB,
                'SELECT u.id, u.name, u.avatar, u.role FROM conversation_members cm
                 JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ? ORDER BY u.name',
                'i',
                array((int)$row['id'])
            );
            $row['members'] = $members;
            $otherName = '';
            foreach ($members as $member) {
                if ((int)$member['id'] !== (int)$user['id']) {
                    $otherName = (string)$member['name'];
                    break;
                }
            }
            if (trim((string)$row['title']) === '' && $row['kind'] === 'direct') {
                $row['title'] = $otherName !== '' ? $otherName : 'Conversation';
            }
            $unread = db_one(
                $BP_DB,
                'SELECT COUNT(*) AS total FROM messages m WHERE m.conversation_id = ? AND m.sender_id <> ?
                 AND m.deleted_at IS NULL AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)',
                'ii',
                array((int)$row['id'], (int)$user['id'])
            );
            $row['unread'] = $unread ? (int)$unread['total'] : 0;
            unset($row['last_read_at']);
            $rows[$index] = $row;
        }
        respond(200, array('ok' => true, 'conversations' => $rows));
    }

    if ($method === 'POST' && $route === 'conversations') {
        $body = request_body();
        $targetId = input_int($body, 'user_id');
        $memberIds = isset($body['member_ids']) && is_array($body['member_ids']) ? $body['member_ids'] : array();
        $title = clean_text(input($body, 'title'), 180);
        if ($targetId !== null) {
            $memberIds = array($targetId);
        }
        $memberIds = array_values(array_unique(array_filter(array_map('intval', $memberIds))));
        if (count($memberIds) === 0 || count($memberIds) > 20) {
            fail(422, 'Choose at least one person to message.');
        }
        $members = array();
        foreach ($memberIds as $memberId) {
            if ($memberId === (int)$user['id']) {
                continue;
            }
            $target = db_one($BP_DB, 'SELECT id, name, role, school_id FROM users WHERE id = ? AND active = 1 LIMIT 1', 'i', array($memberId));
            if (!$target) {
                fail(404, 'One of those people was not found.');
            }
            if (!can_message($BP_DB, $user, $target)) {
                fail(403, 'You can only message people in your school, family, or tutoring group.');
            }
            $members[] = $target;
        }
        if (count($members) === 0) {
            fail(422, 'Choose someone else to message.');
        }
        if (count($members) === 1) {
            $otherId = (int)$members[0]['id'];
            $existing = db_one(
                $BP_DB,
                "SELECT c.id FROM conversations c
                 JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
                 JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
                 WHERE c.kind = 'direct'
                   AND (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id = c.id) = 2
                 LIMIT 1",
                'ii',
                array((int)$user['id'], $otherId)
            );
            if ($existing) {
                respond(200, array('ok' => true, 'conversation_id' => (int)$existing['id']));
            }
        }
        $kind = count($members) > 1 ? 'group' : 'direct';
        $conversationId = db_exec(
            $BP_DB,
            'INSERT INTO conversations (title, kind, created_by) VALUES (?, ?, ?)',
            'ssi',
            array($title, $kind, (int)$user['id'])
        );
        db_exec(
            $BP_DB,
            'INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, UTC_TIMESTAMP())',
            'ii',
            array($conversationId, (int)$user['id'])
        );
        foreach ($members as $member) {
            db_exec(
                $BP_DB,
                'INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)',
                'ii',
                array($conversationId, (int)$member['id'])
            );
            notify($BP_DB, (int)$member['id'], 'New conversation', $user['name'] . ' started a conversation with you.', 'message', 'messages');
        }
        respond(201, array('ok' => true, 'conversation_id' => $conversationId));
    }

    if ($method === 'GET' && $route === 'messages') {
        $conversationId = input_int($_GET, 'conversation_id');
        if ($conversationId === null) {
            fail(422, 'Choose a conversation.');
        }
        $member = db_one(
            $BP_DB,
            'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
            'ii',
            array($conversationId, (int)$user['id'])
        );
        if (!$member) {
            fail(403, 'You are not part of that conversation.');
        }
        db_exec($BP_DB, 'UPDATE conversation_members SET last_read_at = UTC_TIMESTAMP() WHERE conversation_id = ? AND user_id = ?', 'ii', array($conversationId, (int)$user['id']));
        $rows = db_all(
            $BP_DB,
            'SELECT m.id, m.body, m.created_at, m.sender_id, u.name AS sender_name, u.avatar
             FROM messages m JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = ? AND m.deleted_at IS NULL
             ORDER BY m.id DESC LIMIT 100',
            'i',
            array($conversationId)
        );
        respond(200, array('ok' => true, 'messages' => array_reverse($rows)));
    }

    if ($method === 'POST' && $route === 'messages') {
        $body = request_body();
        $conversationId = input_int($body, 'conversation_id');
        $text = clean_text(input($body, 'body'), 2000);
        if ($conversationId === null || $text === '') {
            fail(422, 'Write a message before sending.');
        }
        $member = db_one(
            $BP_DB,
            'SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
            'ii',
            array($conversationId, (int)$user['id'])
        );
        if (!$member) {
            fail(403, 'You are not part of that conversation.');
        }
        $id = db_exec(
            $BP_DB,
            'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
            'iis',
            array($conversationId, (int)$user['id'], $text)
        );
        db_exec($BP_DB, 'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', 'i', array($conversationId));
        $others = db_all(
            $BP_DB,
            'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id <> ?',
            'ii',
            array($conversationId, (int)$user['id'])
        );
        foreach ($others as $other) {
            notify($BP_DB, (int)$other['user_id'], 'New message from ' . $user['name'], clean_text($text, 120), 'message', 'messages');
        }
        respond(201, array(
            'ok' => true,
            'message' => array(
                'id' => $id,
                'body' => $text,
                'created_at' => gmdate('Y-m-d H:i:s'),
                'sender_id' => (int)$user['id'],
                'sender_name' => (string)$user['name'],
                'avatar' => (string)$user['avatar'],
            ),
        ));
    }

    if ($method === 'GET' && $route === 'notifications') {
        $rows = db_all(
            $BP_DB,
            'SELECT id, title, body, kind, page, read_at, created_at FROM notifications
             WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
            'i',
            array((int)$user['id'])
        );
        $unread = db_one($BP_DB, 'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', 'i', array((int)$user['id']));
        respond(200, array('ok' => true, 'notifications' => $rows, 'unread' => $unread ? (int)$unread['total'] : 0));
    }

    if ($method === 'POST' && $route === 'notifications/read') {
        $body = request_body();
        $id = input_int($body, 'id');
        if ($id !== null) {
            db_exec($BP_DB, 'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ? AND read_at IS NULL', 'ii', array($id, (int)$user['id']));
        } else {
            db_exec($BP_DB, 'UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL', 'i', array((int)$user['id']));
        }
        respond(200, array('ok' => true));
    }

    /* ---------------------------------------------------------------------
     * Sponsors (parent-approved, non-personalized)
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'sponsors') {
        $grade = $user['grade'] === null ? 0 : (int)$user['grade'];
        if ($grade > 0) {
            $rows = db_all(
                $BP_DB,
                'SELECT id, title, body, label, image_url, target_url
                 FROM sponsors WHERE active = 1 AND grade_min <= ? AND grade_max >= ?
                 ORDER BY id DESC LIMIT 4',
                'ii',
                array($grade, $grade)
            );
        } else {
            $rows = db_all($BP_DB, 'SELECT id, title, body, label, image_url, target_url FROM sponsors WHERE active = 1 ORDER BY id DESC LIMIT 4');
        }
        respond(200, array('ok' => true, 'sponsors' => $rows));
    }

    if ($method === 'POST' && $route === 'sponsors/event') {
        $body = request_body();
        $sponsorId = input_int($body, 'id');
        $event = input($body, 'event');
        if ($sponsorId === null || !in_array($event, array('impression', 'click'), true)) {
            fail(422, 'Choose a valid sponsor event.');
        }
        $exists = db_one($BP_DB, 'SELECT id FROM sponsors WHERE id = ? AND active = 1 LIMIT 1', 'i', array($sponsorId));
        if (!$exists) {
            fail(404, 'That sponsor card is no longer available.');
        }
        db_exec($BP_DB, 'INSERT INTO sponsor_events (sponsor_id, user_id, event) VALUES (?, ?, ?)', 'iis', array($sponsorId, (int)$user['id'], $event));
        respond(200, array('ok' => true));
    }

    /* ---------------------------------------------------------------------
     * Badges and dashboard
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'badges') {
        $rows = db_all(
            $BP_DB,
            'SELECT b.code, b.title, b.description, b.icon, b.theme, ub.awarded_at
             FROM badges b
             LEFT JOIN user_badges ub ON ub.badge_code = b.code AND ub.user_id = ?
             ORDER BY b.id',
            'i',
            array((int)$user['id'])
        );
        respond(200, array('ok' => true, 'badges' => $rows));
    }

    if ($method === 'GET' && $route === 'dashboard') {
        $role = (string)$user['role'];
        $stats = array();
        $extras = array();

        if ($role === 'student') {
            $grade = (int)$user['grade'];
            $stats['points'] = points_total($BP_DB, (int)$user['id']);
            $stats['streak'] = days_streak($BP_DB, (int)$user['id']);
            $done = db_one($BP_DB, "SELECT COUNT(*) AS total FROM lesson_progress WHERE student_id = ? AND status = 'completed'", 'i', array((int)$user['id']));
            $all = db_one($BP_DB, 'SELECT COUNT(*) AS total FROM lessons WHERE grade = ? AND published = 1', 'i', array($grade));
            $stats['lessons_completed'] = $done ? (int)$done['total'] : 0;
            $stats['lessons_total'] = $all ? (int)$all['total'] : 0;
            $pending = db_one(
                $BP_DB,
                "SELECT COUNT(*) AS total FROM assignments a
                 LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
                 LEFT JOIN assignment_answers aa ON aa.assignment_id = a.id AND aa.student_id = ?
                 WHERE a.grade = ? AND a.status = 'published'
                   AND (a.due_at IS NULL OR a.due_at >= UTC_DATE())
                   AND s.id IS NULL AND aa.id IS NULL",
                'iii',
                array((int)$user['id'], (int)$user['id'], $grade)
            );
            $stats['assignments_pending'] = $pending ? (int)$pending['total'] : 0;
            $upcoming = db_all(
                $BP_DB,
                "SELECT id, title, subject, grade, scheduled_at, duration_minutes, audio_only, status, join_code
                 FROM classes
                 WHERE status IN ('scheduled','live') AND grade = ?
                   AND scheduled_at >= (UTC_TIMESTAMP() - INTERVAL 6 HOUR)
                   AND (school_id IS NULL OR school_id = ?)
                 ORDER BY scheduled_at ASC LIMIT 3",
                'ii',
                array($grade, $user['school_id'] === null ? 0 : (int)$user['school_id'])
            );
            $stats['upcoming_classes'] = count($upcoming);
            $extras['upcoming_classes'] = $upcoming;
            $nextLesson = db_one(
                $BP_DB,
                "SELECT l.id, l.title, l.subject, l.icon, l.theme, l.estimated_minutes, l.points,
                        COALESCE(lp.status, 'new') AS progress_status, COALESCE(lp.score, 0) AS score
                 FROM lessons l
                 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = ?
                 WHERE l.grade = ? AND l.published = 1
                 ORDER BY (lp.status = 'completed') ASC, (lp.status = 'started') DESC, l.sort_order ASC
                 LIMIT 1",
                'ii',
                array((int)$user['id'], $grade)
            );
            $extras['next_lesson'] = $nextLesson;
            $extras['recent_activity'] = db_all(
                $BP_DB,
                'SELECT activity_type, detail, minutes, points, created_at FROM learning_activity
                 WHERE student_id = ? ORDER BY created_at DESC LIMIT 5',
                'i',
                array((int)$user['id'])
            );
            $extras['recent_badges'] = db_all(
                $BP_DB,
                'SELECT b.code, b.title, b.icon, b.theme, ub.awarded_at
                 FROM user_badges ub JOIN badges b ON b.code = ub.badge_code
                 WHERE ub.user_id = ? ORDER BY ub.awarded_at DESC LIMIT 4',
                'i',
                array((int)$user['id'])
            );
        } elseif ($role === 'parent') {
            $children = db_all(
                $BP_DB,
                "SELECT u.id, u.name, u.grade, u.avatar, u.email
                 FROM parent_child_links p JOIN users u ON u.id = p.student_id
                 WHERE p.parent_id = ? AND p.status = 'active' AND u.active = 1
                 ORDER BY u.name",
                'i',
                array((int)$user['id'])
            );
            foreach ($children as $index => $child) {
                $childId = (int)$child['id'];
                $child['points'] = points_total($BP_DB, $childId);
                $child['streak'] = days_streak($BP_DB, $childId);
                $done = db_one($BP_DB, "SELECT COUNT(*) AS total FROM lesson_progress WHERE student_id = ? AND status = 'completed'", 'i', array($childId));
                $child['lessons_completed'] = $done ? (int)$done['total'] : 0;
                $pending = db_one(
                    $BP_DB,
                    "SELECT COUNT(*) AS total FROM assignments a
                     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
                     LEFT JOIN assignment_answers aa ON aa.assignment_id = a.id AND aa.student_id = ?
                     WHERE a.grade = ? AND a.status = 'published'
                       AND (a.due_at IS NULL OR a.due_at >= UTC_DATE())
                       AND s.id IS NULL AND aa.id IS NULL",
                    'iii',
                    array($childId, $childId, (int)$child['grade'])
                );
                $child['assignments_pending'] = $pending ? (int)$pending['total'] : 0;
                $children[$index] = $child;
            }
            $stats['children'] = count($children);
            $pendingLinks = db_one(
                $BP_DB,
                "SELECT COUNT(*) AS total FROM parent_child_links WHERE parent_id = ? AND status = 'pending' AND requested_by <> ?",
                'ii',
                array((int)$user['id'], (int)$user['id'])
            );
            $stats['pending_links'] = $pendingLinks ? (int)$pendingLinks['total'] : 0;
            $extras['children'] = $children;
        } elseif ($role === 'tutor') {
            $studentCount = db_one($BP_DB, "SELECT COUNT(*) AS total FROM tutor_students WHERE tutor_id = ? AND status = 'active'", 'i', array((int)$user['id']));
            $stats['students'] = $studentCount ? (int)$studentCount['total'] : 0;
            $classes = db_one($BP_DB, "SELECT COUNT(*) AS total FROM classes WHERE tutor_id = ? AND status IN ('scheduled','live')", 'i', array((int)$user['id']));
            $stats['upcoming_classes'] = $classes ? (int)$classes['total'] : 0;
            $reviews = db_one(
                $BP_DB,
                "SELECT COUNT(*) AS total FROM submissions s JOIN assignments a ON a.id = s.assignment_id
                 WHERE a.created_by = ? AND s.status = 'submitted'",
                'i',
                array((int)$user['id'])
            );
            $written = db_one(
                $BP_DB,
                "SELECT COUNT(*) AS total FROM assignment_answers aa JOIN assignments a ON a.id = aa.assignment_id
                 WHERE a.created_by = ? AND aa.answer_text IS NOT NULL AND aa.reviewed_at IS NULL",
                'i',
                array((int)$user['id'])
            );
            $stats['reviews_pending'] = ($reviews ? (int)$reviews['total'] : 0) + ($written ? (int)$written['total'] : 0);
            $stats['assignments'] = (function () use ($BP_DB, $user) {
                $row = db_one($BP_DB, 'SELECT COUNT(*) AS total FROM assignments WHERE created_by = ?', 'i', array((int)$user['id']));
                return $row ? (int)$row['total'] : 0;
            })();
            $extras['upcoming_classes'] = db_all(
                $BP_DB,
                "SELECT id, title, subject, grade, scheduled_at, duration_minutes, audio_only, status, join_code
                 FROM classes WHERE tutor_id = ? AND status IN ('scheduled','live')
                 ORDER BY scheduled_at ASC LIMIT 5",
                'i',
                array((int)$user['id'])
            );
        } else {
            $stats['users'] = (int)db_one($BP_DB, 'SELECT COUNT(*) AS total FROM users')['total'];
            $stats['students'] = (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND active = 1")['total'];
            $stats['tutors_pending'] = (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'tutor' AND active = 0")['total'];
            $stats['classes_upcoming'] = (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM classes WHERE status IN ('scheduled','live')")['total'];
            $stats['support_open'] = (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM support_messages WHERE status = 'open'")['total'];
        }

        $sponsors = array();
        $gradeForSponsors = $user['grade'] === null ? 0 : (int)$user['grade'];
        if ($gradeForSponsors > 0) {
            $sponsors = db_all(
                $BP_DB,
                'SELECT id, title, body, label, image_url, target_url FROM sponsors
                 WHERE active = 1 AND grade_min <= ? AND grade_max >= ? ORDER BY id DESC LIMIT 2',
                'ii',
                array($gradeForSponsors, $gradeForSponsors)
            );
        }

        respond(200, array(
            'ok' => true,
            'user' => public_user($user, true),
            'stats' => $stats,
            'extras' => $extras,
            'sponsors' => $sponsors,
            'settings' => array(
                'welcome_message' => setting($BP_DB, 'welcome_message', 'A little progress every day adds up to something brilliant.'),
                'support_email' => setting($BP_DB, 'support_email', (string)config('support_email', '')),
            ),
        ));
    }

    /* ---------------------------------------------------------------------
     * Lessons and progress
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'lessons') {
        $lessonId = input_int($_GET, 'id');
        if ($lessonId !== null) {
            $lesson = db_one($BP_DB, 'SELECT * FROM lessons WHERE id = ? LIMIT 1', 'i', array($lessonId));
            if (!$lesson) {
                fail(404, 'That lesson was not found.');
            }
            if ($user['role'] === 'student' && (int)$lesson['grade'] !== (int)$user['grade']) {
                fail(403, 'This lesson is for another grade.');
            }
            $questions = db_all(
                $BP_DB,
                'SELECT id, prompt, choices_json, correct_choice, explanation, points, sort_order
                 FROM lesson_questions WHERE lesson_id = ? ORDER BY sort_order, id',
                'i',
                array($lessonId)
            );
            $reveal = in_array((string)$user['role'], array('tutor', 'school_admin', 'admin'), true);
            foreach ($questions as $index => $question) {
                $question['choices'] = json_choices($question['choices_json']);
                unset($question['choices_json']);
                $question['correct_choice'] = $reveal ? (int)$question['correct_choice'] : null;
                $questions[$index] = $question;
            }
            $progress = db_one($BP_DB, 'SELECT status, score, completed_at FROM lesson_progress WHERE lesson_id = ? AND student_id = ? LIMIT 1', 'ii', array($lessonId, (int)$user['id']));
            respond(200, array('ok' => true, 'lesson' => $lesson, 'questions' => $questions, 'progress' => $progress));
        }

        if ($user['role'] === 'student') {
            $rows = db_all(
                $BP_DB,
                "SELECT l.id, l.title, l.subject, l.grade, l.description, l.icon, l.theme,
                        l.estimated_minutes, l.points,
                        COALESCE(lp.status, 'new') AS progress_status, COALESCE(lp.score, 0) AS score
                 FROM lessons l
                 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = ?
                 WHERE l.published = 1 AND l.grade = ?
                 ORDER BY l.sort_order, l.id",
                'ii',
                array((int)$user['id'], (int)$user['grade'])
            );
        } else {
            $rows = db_all(
                $BP_DB,
                'SELECT id, title, subject, grade, description, icon, theme, estimated_minutes, points, published
                 FROM lessons WHERE published = 1 ORDER BY grade, sort_order, id LIMIT 200'
            );
        }
        respond(200, array('ok' => true, 'lessons' => $rows));
    }

    if ($method === 'POST' && $route === 'lessons/start') {
        require_roles($user, array('student'));
        $body = request_body();
        $lessonId = input_int($body, 'lesson_id');
        if ($lessonId === null) {
            fail(422, 'Choose a lesson.');
        }
        $lesson = db_one($BP_DB, 'SELECT id, grade, published FROM lessons WHERE id = ? LIMIT 1', 'i', array($lessonId));
        if (!$lesson || (int)$lesson['published'] !== 1 || (int)$lesson['grade'] !== (int)$user['grade']) {
            fail(404, 'That lesson is not available for your grade.');
        }
        db_exec(
            $BP_DB,
            "INSERT INTO lesson_progress (lesson_id, student_id, status) VALUES (?, ?, 'started')
             ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP",
            'ii',
            array($lessonId, (int)$user['id'])
        );
        respond(200, array('ok' => true));
    }

    if ($method === 'POST' && $route === 'lessons/complete') {
        require_roles($user, array('student'));
        $body = request_body();
        $lessonId = input_int($body, 'lesson_id');
        $answers = isset($body['answers']) && is_array($body['answers']) ? $body['answers'] : array();
        if ($lessonId === null) {
            fail(422, 'Choose a lesson.');
        }
        $lesson = db_one($BP_DB, 'SELECT * FROM lessons WHERE id = ? AND published = 1 LIMIT 1', 'i', array($lessonId));
        if (!$lesson || (int)$lesson['grade'] !== (int)$user['grade']) {
            fail(404, 'That lesson is not available for your grade.');
        }
        if (count($answers) === 0) {
            fail(422, 'Answer the lesson questions before finishing.');
        }
        $questions = db_all($BP_DB, 'SELECT * FROM lesson_questions WHERE lesson_id = ? ORDER BY sort_order, id', 'i', array($lessonId));
        $correctCount = 0;
        $review = array();
        foreach ($questions as $question) {
            $questionId = (string)$question['id'];
            $selected = isset($answers[$questionId]) ? (int)$answers[$questionId] : -1;
            $isCorrect = $selected === (int)$question['correct_choice'];
            if ($isCorrect) {
                $correctCount++;
            }
            $review[] = array(
                'question_id' => (int)$question['id'],
                'prompt' => $question['prompt'],
                'choices' => json_choices($question['choices_json']),
                'selected_choice' => $selected,
                'correct_choice' => (int)$question['correct_choice'],
                'is_correct' => $isCorrect,
                'explanation' => $question['explanation'],
            );
        }
        $total = count($questions);
        $score = $total > 0 ? (int)round(($correctCount / $total) * 100) : 100;
        $questionPoints = 0;
        foreach ($questions as $question) {
            $questionId = (string)$question['id'];
            if (isset($answers[$questionId]) && (int)$answers[$questionId] === (int)$question['correct_choice']) {
                $questionPoints += (int)$question['points'];
            }
        }
        $earned = (int)$lesson['points'] + $questionPoints;
        $previous = db_one($BP_DB, 'SELECT status FROM lesson_progress WHERE lesson_id = ? AND student_id = ? LIMIT 1', 'ii', array($lessonId, (int)$user['id']));
        $firstCompletion = !$previous || $previous['status'] !== 'completed';
        db_exec(
            $BP_DB,
            "INSERT INTO lesson_progress (lesson_id, student_id, status, score, completed_at)
             VALUES (?, ?, 'completed', ?, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE status = 'completed', score = GREATEST(score, VALUES(score)),
               completed_at = COALESCE(completed_at, UTC_TIMESTAMP())",
            'iii',
            array($lessonId, (int)$user['id'], $score)
        );
        if ($firstCompletion) {
            db_exec(
                $BP_DB,
                "INSERT INTO learning_activity (student_id, activity_type, detail, minutes, points)
                 VALUES (?, 'lesson', ?, ?, ?)",
                'isii',
                array((int)$user['id'], clean_text($lesson['title'], 180), (int)$lesson['estimated_minutes'], $earned)
            );
        }
        $newBadges = array();
        if ($firstCompletion && award_badge($BP_DB, (int)$user['id'], 'first_steps')) {
            $newBadges[] = 'First Steps';
        }
        if ($correctCount >= 3 && award_badge($BP_DB, (int)$user['id'], 'quiz_whiz')) {
            $newBadges[] = 'Quiz Whiz';
        }
        $completedCount = db_one($BP_DB, "SELECT COUNT(*) AS total FROM lesson_progress WHERE student_id = ? AND status = 'completed'", 'i', array((int)$user['id']));
        if ($completedCount && (int)$completedCount['total'] >= 5 && award_badge($BP_DB, (int)$user['id'], 'bookworm')) {
            $newBadges[] = 'Bookworm';
        }
        $streak = days_streak($BP_DB, (int)$user['id']);
        if ($streak >= 3 && award_badge($BP_DB, (int)$user['id'], 'streak_3')) {
            $newBadges[] = 'Three in a Row';
        }
        if ($streak >= 7 && award_badge($BP_DB, (int)$user['id'], 'streak_7')) {
            $newBadges[] = 'Week Wonder';
        }
        notify_parents(
            $BP_DB,
            (int)$user['id'],
            $user['name'] . ' finished a lesson',
            $lesson['title'] . ' - score ' . $score . '%.',
            'progress',
            'family'
        );
        respond(200, array(
            'ok' => true,
            'score' => $score,
            'correct' => $correctCount,
            'total' => $total,
            'points_earned' => $firstCompletion ? $earned : 0,
            'new_badges' => $newBadges,
            'review' => $review,
            'message' => $score >= 80 ? 'Brilliant work! You earned a sticker path boost.' : 'Good try! Read the friendly hints and try again.',
        ));
    }

    if ($method === 'GET' && $route === 'progress') {
        $studentId = input_int($_GET, 'student_id');
        if ($studentId === null) {
            $studentId = (int)$user['id'];
        }
        if (!can_view_student($BP_DB, $user, $studentId)) {
            fail(403, 'You cannot view that learner.');
        }
        $completed = db_all(
            $BP_DB,
            "SELECT l.title, l.subject, lp.score, lp.completed_at, lp.status
             FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
             WHERE lp.student_id = ? ORDER BY lp.updated_at DESC LIMIT 60",
            'i',
            array($studentId)
        );
        $activity = db_all(
            $BP_DB,
            'SELECT activity_type, detail, minutes, points, created_at FROM learning_activity
             WHERE student_id = ? ORDER BY created_at DESC LIMIT 40',
            'i',
            array($studentId)
        );
        respond(200, array(
            'ok' => true,
            'points' => points_total($BP_DB, $studentId),
            'streak' => days_streak($BP_DB, $studentId),
            'lessons' => $completed,
            'activity' => $activity,
        ));
    }

    /* ---------------------------------------------------------------------
     * Games
     * ------------------------------------------------------------------ */

    if ($method === 'POST' && $route === 'games/score') {
        require_roles($user, array('student'));
        $body = request_body();
        $game = input($body, 'game');
        $score = input_int($body, 'score');
        $duration = input_int($body, 'duration_seconds');
        if (!in_array($game, BP_GAMES, true) || $score === null || $score < 0 || $score > 10000) {
            fail(422, 'That game score is not valid.');
        }
        $duration = $duration === null ? 0 : max(0, min($duration, 7200));
        $bestRow = db_one($BP_DB, 'SELECT MAX(score) AS best FROM game_scores WHERE student_id = ? AND game = ?', 'is', array((int)$user['id'], $game));
        $previousBest = $bestRow && $bestRow['best'] !== null ? (int)$bestRow['best'] : 0;
        db_exec(
            $BP_DB,
            'INSERT INTO game_scores (student_id, game, score, duration_seconds) VALUES (?, ?, ?, ?)',
            'isii',
            array((int)$user['id'], $game, $score, $duration)
        );
        $pointsAwarded = 0;
        if ($score > $previousBest) {
            $pointsAwarded = 10;
            db_exec(
                $BP_DB,
                "INSERT INTO learning_activity (student_id, activity_type, detail, minutes, points)
                 VALUES (?, 'game', ?, ?, ?)",
                'isii',
                array((int)$user['id'], clean_text(ucfirst($game) . ' brain break', 180), max(1, (int)round($duration / 60)), $pointsAwarded)
            );
            award_badge($BP_DB, (int)$user['id'], 'game_on');
        }
        $best = max($previousBest, $score);
        $rankRow = db_one(
            $BP_DB,
            'SELECT COUNT(*) AS higher FROM (SELECT student_id, MAX(score) AS best FROM game_scores WHERE game = ? GROUP BY student_id) t WHERE t.best > ?',
            'si',
            array($game, $best)
        );
        respond(200, array(
            'ok' => true,
            'best' => $best,
            'points_awarded' => $pointsAwarded,
            'rank' => $rankRow ? (int)$rankRow['higher'] + 1 : 1,
            'message' => $score > $previousBest ? 'New personal best! +10 points' : 'Nice practice. Your best is still ' . $best . '.',
        ));
    }

    if ($method === 'GET' && $route === 'games/leaderboard') {
        $game = input($_GET, 'game', 'math');
        if (!in_array($game, BP_GAMES, true)) {
            $game = 'math';
        }
        $rows = db_all(
            $BP_DB,
            'SELECT u.id, u.name, u.avatar, u.grade, MAX(g.score) AS best
             FROM game_scores g JOIN users u ON u.id = g.student_id
             WHERE g.game = ? AND u.active = 1
             GROUP BY u.id, u.name, u.avatar, u.grade
             ORDER BY best DESC, u.name ASC LIMIT 20',
            's',
            array($game)
        );
        $myBest = db_one($BP_DB, 'SELECT MAX(score) AS best FROM game_scores WHERE student_id = ? AND game = ?', 'is', array((int)$user['id'], $game));
        respond(200, array(
            'ok' => true,
            'game' => $game,
            'leaders' => $rows,
            'my_best' => $myBest && $myBest['best'] !== null ? (int)$myBest['best'] : 0,
        ));
    }

    /* ---------------------------------------------------------------------
     * Contacts, family links, tutor students
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'contacts') {
        $contacts = array();
        $role = (string)$user['role'];
        if ($role === 'student') {
            $contacts = db_all(
                $BP_DB,
                "SELECT u.id, u.name, u.role, u.avatar, u.grade FROM parent_child_links p
                 JOIN users u ON u.id = p.parent_id
                 WHERE p.student_id = ? AND p.status = 'active'
                 UNION
                 SELECT u.id, u.name, u.role, u.avatar, u.grade FROM tutor_students ts
                 JOIN users u ON u.id = ts.tutor_id
                 WHERE ts.student_id = ? AND ts.status = 'active'",
                'ii',
                array((int)$user['id'], (int)$user['id'])
            );
            if ($user['school_id'] !== null) {
                $schoolContacts = db_all(
                    $BP_DB,
                    "SELECT id, name, role, avatar, grade FROM users
                     WHERE school_id = ? AND active = 1 AND id <> ? AND role IN ('student','tutor','school_admin')
                     ORDER BY role, name LIMIT 40",
                    'ii',
                    array((int)$user['school_id'], (int)$user['id'])
                );
                $contacts = array_merge($contacts, $schoolContacts);
            }
        } elseif ($role === 'parent') {
            $contacts = db_all(
                $BP_DB,
                "SELECT u.id, u.name, u.role, u.avatar, u.grade FROM parent_child_links p
                 JOIN users u ON u.id = p.student_id
                 WHERE p.parent_id = ? AND p.status = 'active'
                 UNION
                 SELECT DISTINCT u.id, u.name, u.role, u.avatar, u.grade FROM parent_child_links p
                 JOIN tutor_students ts ON ts.student_id = p.student_id
                 JOIN users u ON u.id = ts.tutor_id
                 WHERE p.parent_id = ? AND p.status = 'active' AND ts.status = 'active'",
                'ii',
                array((int)$user['id'], (int)$user['id'])
            );
        } elseif ($role === 'tutor') {
            $contacts = db_all(
                $BP_DB,
                "SELECT u.id, u.name, u.role, u.avatar, u.grade FROM tutor_students ts
                 JOIN users u ON u.id = ts.student_id
                 WHERE ts.tutor_id = ? AND ts.status = 'active'
                 UNION
                 SELECT DISTINCT u.id, u.name, u.role, u.avatar, u.grade FROM tutor_students ts
                 JOIN parent_child_links p ON p.student_id = ts.student_id
                 JOIN users u ON u.id = p.parent_id
                 WHERE ts.tutor_id = ? AND ts.status = 'active' AND p.status = 'active'",
                'ii',
                array((int)$user['id'], (int)$user['id'])
            );
        } else {
            $contacts = db_all(
                $BP_DB,
                'SELECT id, name, role, avatar, grade FROM users WHERE active = 1 AND id <> ? ORDER BY role, name LIMIT 100',
                'i',
                array((int)$user['id'])
            );
        }
        $seen = array();
        $unique = array();
        foreach ($contacts as $contact) {
            $id = (int)$contact['id'];
            if ($id === (int)$user['id'] || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $unique[] = $contact;
        }
        respond(200, array('ok' => true, 'contacts' => $unique));
    }

    if ($method === 'GET' && $route === 'parent/links') {
        require_roles($user, array('parent', 'student'));
        $role = (string)$user['role'];
        $where = $role === 'parent' ? 'p.parent_id = ?' : 'p.student_id = ?';
        $links = db_all(
            $BP_DB,
            "SELECT p.id, p.status, p.requested_by, p.created_at,
                    parent.id AS parent_id, parent.name AS parent_name, parent.email AS parent_email, parent.avatar AS parent_avatar,
                    student.id AS student_id, student.name AS student_name, student.email AS student_email,
                    student.avatar AS student_avatar, student.grade AS student_grade
             FROM parent_child_links p
             JOIN users parent ON parent.id = p.parent_id
             JOIN users student ON student.id = p.student_id
             WHERE " . $where . ' ORDER BY p.created_at DESC LIMIT 50',
            'i',
            array((int)$user['id'])
        );
        foreach ($links as $index => $link) {
            $childId = $role === 'parent' ? (int)$link['student_id'] : (int)$link['student_id'];
            $completed = db_one($BP_DB, "SELECT COUNT(*) AS total FROM lesson_progress WHERE student_id = ? AND status = 'completed'", 'i', array($childId));
            $link['points'] = points_total($BP_DB, $childId);
            $link['streak'] = days_streak($BP_DB, $childId);
            $link['lessons_completed'] = $completed ? (int)$completed['total'] : 0;
            $link['can_respond'] = $link['status'] === 'pending' && (int)$link['requested_by'] !== (int)$user['id'];
            $links[$index] = $link;
        }
        respond(200, array('ok' => true, 'links' => $links, 'family_code' => $role === 'student' ? $user['family_code'] : null));
    }

    if ($method === 'POST' && $route === 'parent/link') {
        require_roles($user, array('parent', 'student'));
        $body = request_body();
        $code = strtoupper(clean_text(input($body, 'code'), 12));
        $email = strtolower(clean_text(input($body, 'email'), 190));
        if ($code !== '') {
            if ((string)$user['role'] !== 'parent') {
                fail(403, 'Only a parent account can use a student family code.');
            }
            $student = db_one($BP_DB, "SELECT id, name FROM users WHERE family_code = ? AND role = 'student' AND active = 1 LIMIT 1", 's', array($code));
            if (!$student) {
                fail(404, 'That family code was not found. Ask your child to open Family and share the code.');
            }
            if ((int)$student['id'] === (int)$user['id']) {
                fail(422, 'You cannot link your own account.');
            }
            db_exec(
                $BP_DB,
                "INSERT INTO parent_child_links (parent_id, student_id, status, requested_by)
                 VALUES (?, ?, 'active', ?)
                 ON DUPLICATE KEY UPDATE status = 'active'",
                'iii',
                array((int)$user['id'], (int)$student['id'], (int)$user['id'])
            );
            notify($BP_DB, (int)$student['id'], 'Family account linked', $user['name'] . ' joined your family space with your code.', 'family', 'family');
            audit($BP_DB, (int)$user['id'], 'parent.link.code', 'user', (int)$student['id']);
            respond(200, array('ok' => true, 'message' => 'Family link created.', 'student_id' => (int)$student['id']));
        }
        if (!valid_email($email)) {
            fail(422, 'Enter a family code or a valid email address.');
        }
        $target = db_one($BP_DB, 'SELECT id, name, role FROM users WHERE email = ? AND active = 1 LIMIT 1', 's', array($email));
        if (!$target || (int)$target['id'] === (int)$user['id']) {
            fail(404, 'No active account uses that email.');
        }
        if ((string)$user['role'] === 'parent' && (string)$target['role'] !== 'student') {
            fail(422, 'A parent can invite a student account.');
        }
        if ((string)$user['role'] === 'student' && (string)$target['role'] !== 'parent') {
            fail(422, 'A student can invite a parent account.');
        }
        $parentId = (string)$user['role'] === 'parent' ? (int)$user['id'] : (int)$target['id'];
        $studentId = (string)$user['role'] === 'student' ? (int)$user['id'] : (int)$target['id'];
        db_exec(
            $BP_DB,
            "INSERT INTO parent_child_links (parent_id, student_id, status, requested_by)
             VALUES (?, ?, 'pending', ?)
             ON DUPLICATE KEY UPDATE status = IF(status = 'active', 'active', 'pending'), requested_by = VALUES(requested_by)",
            'iii',
            array($parentId, $studentId, (int)$user['id'])
        );
        notify(
            $BP_DB,
            (string)$user['role'] === 'parent' ? $studentId : $parentId,
            'Family link request',
            $user['name'] . ' wants to link family accounts. Open Family to approve.',
            'family',
            'family'
        );
        respond(200, array('ok' => true, 'pending' => true, 'message' => 'Request sent. The other person can approve it in Family.'));
    }

    if ($method === 'POST' && $route === 'parent/respond') {
        require_roles($user, array('parent', 'student'));
        $body = request_body();
        $linkId = input_int($body, 'link_id');
        $action = input($body, 'action');
        if ($linkId === null || !in_array($action, array('accept', 'decline', 'revoke'), true)) {
            fail(422, 'Choose a family request and an action.');
        }
        $link = db_one($BP_DB, 'SELECT * FROM parent_child_links WHERE id = ? LIMIT 1', 'i', array($linkId));
        if (!$link || ((int)$link['parent_id'] !== (int)$user['id'] && (int)$link['student_id'] !== (int)$user['id'])) {
            fail(404, 'That family request was not found.');
        }
        if ($action === 'accept' && (int)$link['requested_by'] === (int)$user['id']) {
            fail(403, 'The other person needs to approve this request.');
        }
        $status = $action === 'accept' ? 'active' : 'revoked';
        db_exec($BP_DB, 'UPDATE parent_child_links SET status = ? WHERE id = ?', 'si', array($status, $linkId));
        $otherId = (int)$link['parent_id'] === (int)$user['id'] ? (int)$link['student_id'] : (int)$link['parent_id'];
        notify(
            $BP_DB,
            $otherId,
            $action === 'accept' ? 'Family link approved' : 'Family link changed',
            $user['name'] . ($action === 'accept' ? ' approved the family link.' : ' updated the family link.'),
            'family',
            'family'
        );
        audit($BP_DB, (int)$user['id'], 'parent.' . $action, 'parent_child_link', $linkId);
        respond(200, array('ok' => true, 'message' => $action === 'accept' ? 'Family link is active.' : 'Family link updated.'));
    }

    if ($method === 'GET' && $route === 'tutor/students') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        if ((string)$user['role'] === 'tutor') {
            $rows = db_all(
                $BP_DB,
                "SELECT u.id, u.name, u.email, u.grade, u.avatar, ts.status, ts.created_at
                 FROM tutor_students ts JOIN users u ON u.id = ts.student_id
                 WHERE ts.tutor_id = ? ORDER BY u.name",
                'i',
                array((int)$user['id'])
            );
        } else {
            $rows = db_all(
                $BP_DB,
                "SELECT u.id, u.name, u.email, u.grade, u.avatar, ts.status, ts.created_at, t.name AS tutor_name
                 FROM tutor_students ts JOIN users u ON u.id = ts.student_id JOIN users t ON t.id = ts.tutor_id
                 ORDER BY t.name, u.name LIMIT 300"
            );
        }
        foreach ($rows as $index => $row) {
            $row['points'] = points_total($BP_DB, (int)$row['id']);
            $row['streak'] = days_streak($BP_DB, (int)$row['id']);
            $rows[$index] = $row;
        }
        respond(200, array('ok' => true, 'students' => $rows));
    }

    if ($method === 'POST' && $route === 'tutor/students') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $email = strtolower(clean_text(input($body, 'email'), 190));
        if (!valid_email($email)) {
            fail(422, 'Enter the student email address.');
        }
        $student = db_one($BP_DB, "SELECT id, name FROM users WHERE email = ? AND role = 'student' AND active = 1 LIMIT 1", 's', array($email));
        if (!$student) {
            fail(404, 'No active student account uses that email.');
        }
        $tutorId = (string)$user['role'] === 'tutor' ? (int)$user['id'] : input_int($body, 'tutor_id');
        if ($tutorId === null) {
            fail(422, 'Choose a tutor for this student.');
        }
        db_exec(
            $BP_DB,
            "INSERT INTO tutor_students (tutor_id, student_id, status) VALUES (?, ?, 'active')
             ON DUPLICATE KEY UPDATE status = 'active'",
            'ii',
            array($tutorId, (int)$student['id'])
        );
        notify($BP_DB, (int)$student['id'], 'Your tutor added you', $user['name'] . ' added you to their tutoring group.', 'class', 'classes');
        notify_parents($BP_DB, (int)$student['id'], 'Tutor added', $user['name'] . ' added your child to a tutoring group.', 'family', 'family');
        respond(200, array('ok' => true, 'message' => 'Student added to the tutoring group.', 'student_id' => (int)$student['id']));
    }

    if ($method === 'POST' && $route === 'tutor/students/remove') {
        require_roles($user, array('tutor', 'school_admin', 'admin'));
        $body = request_body();
        $studentId = input_int($body, 'student_id');
        if ($studentId === null) {
            fail(422, 'Choose a student.');
        }
        if ((string)$user['role'] === 'tutor') {
            db_exec($BP_DB, "UPDATE tutor_students SET status = 'ended' WHERE tutor_id = ? AND student_id = ?", 'ii', array((int)$user['id'], $studentId));
        } else {
            db_exec($BP_DB, "UPDATE tutor_students SET status = 'ended' WHERE student_id = ?", 'i', array($studentId));
        }
        respond(200, array('ok' => true, 'message' => 'Student removed from the group.'));
    }

    /* ---------------------------------------------------------------------
     * Schools
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'schools') {
        require_roles($user, array('school_admin', 'admin'));
        if ((string)$user['role'] === 'admin') {
            $rows = db_all(
                $BP_DB,
                'SELECT s.id, s.name, s.address, s.phone, s.email, s.invite_code, s.created_at,
                        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.active = 1) AS member_count
                 FROM schools s ORDER BY s.name'
            );
        } else {
            $rows = db_all(
                $BP_DB,
                'SELECT s.id, s.name, s.address, s.phone, s.email, s.invite_code, s.created_at,
                        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.active = 1) AS member_count
                 FROM schools s WHERE s.id = ?',
                'i',
                array((int)$user['school_id'])
            );
        }
        respond(200, array('ok' => true, 'schools' => $rows));
    }

    if ($method === 'POST' && $route === 'schools') {
        require_roles($user, array('admin'));
        $body = request_body();
        $name = clean_text(input($body, 'name'), 180);
        $address = clean_text(input($body, 'address'), 255);
        $phone = clean_text(input($body, 'phone'), 40);
        $email = strtolower(clean_text(input($body, 'email'), 190));
        if ($name === '') {
            fail(422, 'Add the school name.');
        }
        if ($email !== '' && !valid_email($email)) {
            fail(422, 'Enter a valid school email or leave it blank.');
        }
        $invite = random_code(8);
        $id = db_exec(
            $BP_DB,
            'INSERT INTO schools (name, address, phone, email, invite_code, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            'sssssi',
            array($name, $address !== '' ? $address : null, $phone !== '' ? $phone : null, $email !== '' ? $email : null, $invite, (int)$user['id'])
        );
        audit($BP_DB, (int)$user['id'], 'school.create', 'school', $id, array('name' => $name));
        respond(201, array('ok' => true, 'school_id' => $id, 'invite_code' => $invite, 'message' => 'School created. Share the invite code with staff and families.'));
    }

    if ($method === 'POST' && $route === 'schools/join') {
        $body = request_body();
        $code = strtoupper(clean_text(input($body, 'invite_code'), 12));
        if ($code === '') {
            fail(422, 'Enter the school invite code.');
        }
        $school = db_one($BP_DB, 'SELECT id, name FROM schools WHERE invite_code = ? LIMIT 1', 's', array($code));
        if (!$school) {
            fail(404, 'That school invite code was not found.');
        }
        db_exec($BP_DB, 'UPDATE users SET school_id = ? WHERE id = ?', 'ii', array((int)$school['id'], (int)$user['id']));
        if ((string)$user['role'] === 'tutor') {
            db_exec($BP_DB, 'UPDATE tutors SET school_id = ? WHERE user_id = ?', 'ii', array((int)$school['id'], (int)$user['id']));
        }
        respond(200, array('ok' => true, 'school_name' => $school['name'], 'message' => 'You joined ' . $school['name'] . '.'));
    }

    /* ---------------------------------------------------------------------
     * Administrator tools
     * ------------------------------------------------------------------ */

    if ($method === 'GET' && $route === 'admin/users') {
        require_roles($user, array('school_admin', 'admin'));
        $search = clean_text(input($_GET, 'search'), 80);
        $roleFilter = input($_GET, 'role');
        $where = array('1 = 1');
        $types = '';
        $params = array();
        if ((string)$user['role'] === 'school_admin') {
            $where[] = 'u.school_id = ?';
            $types .= 'i';
            $params[] = (int)$user['school_id'];
        }
        if ($search !== '') {
            $where[] = '(u.name LIKE ? OR u.email LIKE ?)';
            $like = '%' . $search . '%';
            $types .= 'ss';
            $params[] = $like;
            $params[] = $like;
        }
        if (in_array($roleFilter, BP_ROLES, true)) {
            $where[] = 'u.role = ?';
            $types .= 's';
            $params[] = $roleFilter;
        }
        $rows = db_all(
            $BP_DB,
            'SELECT u.id, u.name, u.email, u.role, u.grade, u.avatar, u.active, u.must_change_password,
                    u.last_login_at, u.created_at, s.name AS school_name
             FROM users u LEFT JOIN schools s ON s.id = u.school_id
             WHERE ' . implode(' AND ', $where) . ' ORDER BY u.created_at DESC LIMIT 300',
            $types,
            $params
        );
        respond(200, array('ok' => true, 'users' => $rows));
    }

    if ($method === 'POST' && $route === 'admin/users') {
        require_roles($user, array('school_admin', 'admin'));
        $body = request_body();
        $name = clean_text(input($body, 'name'), 120);
        $email = strtolower(clean_text(input($body, 'email'), 190));
        $role = input($body, 'role', 'student');
        $grade = input_int($body, 'grade');
        $password = (string)($body['password'] ?? '');
        $tempPassword = '';
        if ($name === '' || !valid_email($email)) {
            fail(422, 'Add a name and valid email address.');
        }
        if (!in_array($role, array('student', 'parent', 'tutor', 'school_admin'), true)) {
            fail(422, 'Choose a valid account type.');
        }
        if ((string)$user['role'] === 'school_admin' && in_array($role, array('school_admin', 'admin'), true)) {
            fail(403, 'A school administrator cannot create another school administrator.');
        }
        if ($role === 'student' && ($grade === null || $grade < 1 || $grade > 8)) {
            fail(422, 'Choose a grade from 1 to 8 for a student.');
        }
        if ($password === '') {
            $password = temporary_password();
            $tempPassword = $password;
        }
        $problem = password_problem($password);
        if ($problem !== '') {
            fail(422, $problem);
        }
        $schoolId = $user['school_id'] === null ? null : (int)$user['school_id'];
        try {
            $id = db_exec(
                $BP_DB,
                'INSERT INTO users (name, email, password_hash, role, school_id, grade, avatar, family_code,
                                    must_change_password, active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                'ssssiissi',
                array($name, $email, password_hash($password, PASSWORD_DEFAULT), $role, $schoolId,
                      $role === 'student' ? $grade : null, 'star',
                      $role === 'student' ? family_code($BP_DB) : null, $tempPassword !== '' ? 1 : 0)
            );
        } catch (mysqli_sql_exception $error) {
            if ((int)$error->getCode() === 1062) {
                fail(409, 'An account already uses that email.');
            }
            throw $error;
        }
        if ($role === 'tutor') {
            db_exec($BP_DB, 'INSERT IGNORE INTO tutors (user_id, school_id, verified) VALUES (?, ?, 1)', 'ii', array($id, $schoolId));
        }
        audit($BP_DB, (int)$user['id'], 'admin.user.create', 'user', $id, array('role' => $role));
        respond(201, array(
            'ok' => true,
            'user_id' => $id,
            'temp_password' => $tempPassword,
            'message' => $tempPassword !== ''
                ? 'Account created. Share the temporary password privately; it must be changed at first sign-in.'
                : 'Account created.',
        ));
    }

    if ($method === 'POST' && $route === 'admin/users/update') {
        require_roles($user, array('school_admin', 'admin'));
        $body = request_body();
        $id = input_int($body, 'id');
        if ($id === null) {
            fail(422, 'Choose an account.');
        }
        $target = db_one($BP_DB, 'SELECT * FROM users WHERE id = ? LIMIT 1', 'i', array($id));
        if (!$target) {
            fail(404, 'That account was not found.');
        }
        if ((string)$user['role'] === 'school_admin' && ($target['school_id'] === null || (int)$target['school_id'] !== (int)$user['school_id'])) {
            fail(403, 'You can only manage accounts in your school.');
        }
        if ($id === (int)$user['id'] && array_key_exists('active', $body) && empty($body['active'])) {
            fail(422, 'You cannot pause your own account.');
        }
        $active = array_key_exists('active', $body) ? (!empty($body['active']) ? 1 : 0) : (int)$target['active'];
        $role = input($body, 'role', (string)$target['role']);
        $grade = array_key_exists('grade', $body) ? input_int($body, 'grade') : ($target['grade'] === null ? null : (int)$target['grade']);
        $name = clean_text(input($body, 'name', (string)$target['name']), 120);
        if (!in_array($role, BP_ROLES, true) || $name === '') {
            fail(422, 'Choose a valid account type and name.');
        }
        if ($id === (int)$user['id'] && $role !== (string)$target['role']) {
            fail(422, 'You cannot change your own account type.');
        }
        if ((string)$user['role'] === 'school_admin' && in_array($role, array('admin', 'school_admin'), true)) {
            fail(403, 'A school administrator cannot grant administrator access.');
        }
        if ($role === 'student' && ($grade === null || $grade < 1 || $grade > 8)) {
            fail(422, 'A student needs a grade from 1 to 8.');
        }
        db_exec(
            $BP_DB,
            'UPDATE users SET name = ?, role = ?, grade = ?, active = ? WHERE id = ?',
            'ssiii',
            array($name, $role, $role === 'student' ? $grade : null, $active, $id)
        );
        if ($role === 'tutor') {
            db_exec($BP_DB, 'INSERT IGNORE INTO tutors (user_id, school_id, verified) VALUES (?, ?, 1)', 'ii', array($id, $target['school_id']));
        }
        if ($active === 0) {
            db_exec($BP_DB, 'DELETE FROM api_tokens WHERE user_id = ?', 'i', array($id));
        }
        audit($BP_DB, (int)$user['id'], 'admin.user.update', 'user', $id, array('role' => $role, 'active' => $active));
        respond(200, array('ok' => true, 'message' => 'Account updated.'));
    }

    if ($method === 'POST' && $route === 'admin/users/reset') {
        require_roles($user, array('school_admin', 'admin'));
        $body = request_body();
        $id = input_int($body, 'id');
        if ($id === null) {
            fail(422, 'Choose an account.');
        }
        $target = db_one($BP_DB, 'SELECT id, role, school_id, name FROM users WHERE id = ? LIMIT 1', 'i', array($id));
        if (!$target) {
            fail(404, 'That account was not found.');
        }
        if ((string)$user['role'] === 'school_admin' && ($target['school_id'] === null || (int)$target['school_id'] !== (int)$user['school_id'])) {
            fail(403, 'You can only reset accounts in your school.');
        }
        if ((string)$target['role'] === 'admin' && $id !== (int)$user['id']) {
            fail(403, 'Administrator accounts can only be reset by themselves.');
        }
        $temp = temporary_password();
        db_exec(
            $BP_DB,
            'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
            'si',
            array(password_hash($temp, PASSWORD_DEFAULT), $id)
        );
        db_exec($BP_DB, 'DELETE FROM api_tokens WHERE user_id = ?', 'i', array($id));
        audit($BP_DB, (int)$user['id'], 'admin.user.reset', 'user', $id);
        respond(200, array('ok' => true, 'temp_password' => $temp, 'message' => 'Temporary password created. Share it privately and ask the user to change it.'));
    }

    if ($method === 'GET' && $route === 'admin/stats') {
        require_roles($user, array('school_admin', 'admin'));
        $stats = array(
            'users' => (int)db_one($BP_DB, 'SELECT COUNT(*) AS total FROM users')['total'],
            'students' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND active = 1")['total'],
            'parents' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'parent' AND active = 1")['total'],
            'tutors' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'tutor' AND active = 1")['total'],
            'tutors_pending' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM users WHERE role = 'tutor' AND active = 0")['total'],
            'lessons' => (int)db_one($BP_DB, 'SELECT COUNT(*) AS total FROM lessons WHERE published = 1')['total'],
            'assignments' => (int)db_one($BP_DB, 'SELECT COUNT(*) AS total FROM assignments')['total'],
            'submissions_pending' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM submissions WHERE status = 'submitted'")['total'],
            'classes_upcoming' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM classes WHERE status IN ('scheduled','live')")['total'],
            'support_open' => (int)db_one($BP_DB, "SELECT COUNT(*) AS total FROM support_messages WHERE status = 'open'")['total'],
            'sponsors_active' => (int)db_one($BP_DB, 'SELECT COUNT(*) AS total FROM sponsors WHERE active = 1')['total'],
        );
        $stats['grade_counts'] = db_all(
            $BP_DB,
            "SELECT grade, COUNT(*) AS total FROM users WHERE role = 'student' AND active = 1 GROUP BY grade ORDER BY grade"
        );
        $stats['recent_users'] = db_all(
            $BP_DB,
            "SELECT id, name, email, role, grade, created_at FROM users ORDER BY created_at DESC LIMIT 8"
        );
        $stats['recent_support'] = db_all(
            $BP_DB,
            "SELECT id, name, email, page, body, status, created_at FROM support_messages ORDER BY created_at DESC LIMIT 8"
        );
        respond(200, array('ok' => true, 'stats' => $stats));
    }

    if ($method === 'GET' && $route === 'admin/audit') {
        require_roles($user, array('school_admin', 'admin'));
        $rows = db_all(
            $BP_DB,
            'SELECT a.id, a.action, a.entity, a.entity_id, a.details_json, a.created_at, u.name AS actor_name
             FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
             ORDER BY a.id DESC LIMIT 120'
        );
        respond(200, array('ok' => true, 'audit' => $rows));
    }

    if ($method === 'GET' && $route === 'admin/support') {
        require_roles($user, array('school_admin', 'admin'));
        $rows = db_all(
            $BP_DB,
            "SELECT id, user_id, name, email, page, body, status, created_at FROM support_messages
             ORDER BY (status = 'open') DESC, created_at DESC LIMIT 200"
        );
        respond(200, array('ok' => true, 'support' => $rows));
    }

    if ($method === 'POST' && $route === 'admin/support/close') {
        require_roles($user, array('school_admin', 'admin'));
        $body = request_body();
        $id = input_int($body, 'id');
        if ($id === null) {
            fail(422, 'Choose a help request.');
        }
        db_exec($BP_DB, "UPDATE support_messages SET status = 'closed' WHERE id = ?", 'i', array($id));
        respond(200, array('ok' => true, 'message' => 'Help request closed.'));
    }

    if ($method === 'GET' && $route === 'admin/sponsors') {
        require_roles($user, array('admin'));
        $rows = db_all(
            $BP_DB,
            'SELECT s.*,
                    (SELECT COUNT(*) FROM sponsor_events e WHERE e.sponsor_id = s.id AND e.event = \'impression\') AS impressions,
                    (SELECT COUNT(*) FROM sponsor_events e WHERE e.sponsor_id = s.id AND e.event = \'click\') AS clicks
             FROM sponsors s ORDER BY s.active DESC, s.id DESC'
        );
        respond(200, array('ok' => true, 'sponsors' => $rows));
    }

    if ($method === 'POST' && $route === 'admin/sponsors') {
        require_roles($user, array('admin'));
        $body = request_body();
        $id = input_int($body, 'id');
        $title = clean_text(input($body, 'title'), 160);
        $bodyText = clean_text(input($body, 'body'), 500);
        $label = clean_text(input($body, 'label', 'Parent-approved pick'), 60);
        $imageUrl = clean_text(input($body, 'image_url'), 500);
        $targetUrl = clean_text(input($body, 'target_url'), 500);
        $gradeMin = input_int($body, 'grade_min');
        $gradeMax = input_int($body, 'grade_max');
        $active = !empty($body['active']) ? 1 : 0;
        $gradeMin = $gradeMin === null ? 1 : max(1, min($gradeMin, 8));
        $gradeMax = $gradeMax === null ? 8 : max(1, min($gradeMax, 8));
        if ($title === '') {
            fail(422, 'Add a sponsor title.');
        }
        if ($gradeMin > $gradeMax) {
            $swap = $gradeMin;
            $gradeMin = $gradeMax;
            $gradeMax = $swap;
        }
        if ($imageUrl !== '' && !preg_match('#^https://#i', $imageUrl)) {
            fail(422, 'Sponsor images must use an https:// address.');
        }
        if ($targetUrl !== '' && !preg_match('#^https://#i', $targetUrl)) {
            fail(422, 'Sponsor links must use an https:// address.');
        }
        if ($id !== null) {
            db_exec(
                $BP_DB,
                'UPDATE sponsors SET title = ?, body = ?, label = ?, image_url = ?, target_url = ?,
                   grade_min = ?, grade_max = ?, active = ? WHERE id = ?',
                'sssssiiii',
                array($title, $bodyText, $label, $imageUrl, $targetUrl, $gradeMin, $gradeMax, $active, $id)
            );
            audit($BP_DB, (int)$user['id'], 'sponsor.update', 'sponsor', $id);
            respond(200, array('ok' => true, 'message' => 'Sponsor card updated.'));
        }
        $newId = db_exec(
            $BP_DB,
            'INSERT INTO sponsors (title, body, label, image_url, target_url, grade_min, grade_max, active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            'sssssiiii',
            array($title, $bodyText, $label, $imageUrl, $targetUrl, $gradeMin, $gradeMax, $active, (int)$user['id'])
        );
        audit($BP_DB, (int)$user['id'], 'sponsor.create', 'sponsor', $newId);
        respond(201, array('ok' => true, 'sponsor_id' => $newId, 'message' => 'Sponsor card created.'));
    }

    if ($method === 'POST' && $route === 'admin/sponsors/delete') {
        require_roles($user, array('admin'));
        $body = request_body();
        $id = input_int($body, 'id');
        if ($id === null) {
            fail(422, 'Choose a sponsor card.');
        }
        db_exec($BP_DB, 'DELETE FROM sponsors WHERE id = ?', 'i', array($id));
        audit($BP_DB, (int)$user['id'], 'sponsor.delete', 'sponsor', $id);
        respond(200, array('ok' => true, 'message' => 'Sponsor card removed.'));
    }

    if ($method === 'GET' && $route === 'admin/sponsors/stats') {
        require_roles($user, array('admin'));
        $rows = db_all(
            $BP_DB,
            'SELECT s.id, s.title,
                    SUM(CASE WHEN e.event = \'impression\' THEN 1 ELSE 0 END) AS impressions,
                    SUM(CASE WHEN e.event = \'click\' THEN 1 ELSE 0 END) AS clicks
             FROM sponsors s LEFT JOIN sponsor_events e ON e.sponsor_id = s.id
             GROUP BY s.id, s.title ORDER BY s.id DESC'
        );
        respond(200, array('ok' => true, 'sponsors' => $rows));
    }

    if ($method === 'GET' && $route === 'admin/settings') {
        require_roles($user, array('admin'));
        $rows = db_all($BP_DB, 'SELECT setting_key, setting_value, updated_at FROM app_settings ORDER BY setting_key');
        respond(200, array('ok' => true, 'settings' => $rows));
    }

    if ($method === 'POST' && $route === 'admin/settings') {
        require_roles($user, array('admin'));
        $body = request_body();
        $allowed = array('app_name', 'welcome_message', 'support_email', 'jitsi_domain');
        $saved = array();
        foreach ($allowed as $key) {
            if (!array_key_exists($key, $body)) {
                continue;
            }
            $value = clean_text(input($body, $key), $key === 'welcome_message' ? 500 : 190);
            if ($key === 'jitsi_domain' && $value !== '' && !preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $value)) {
                fail(422, 'Enter a valid Jitsi domain, such as meet.jit.si.');
            }
            if ($key === 'support_email' && $value !== '' && !valid_email($value)) {
                fail(422, 'Enter a valid support email or leave it blank.');
            }
            db_exec(
                $BP_DB,
                'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                'ss',
                array($key, $value)
            );
            $saved[] = $key;
        }
        audit($BP_DB, (int)$user['id'], 'admin.settings', 'app_settings', null, array('keys' => $saved));
        respond(200, array('ok' => true, 'message' => 'Settings saved.', 'saved' => $saved));
    }

    if ($method === 'GET' && $route === 'admin/parent-links') {
        require_roles($user, array('admin'));
        $rows = db_all(
            $BP_DB,
            'SELECT p.id, p.status, p.created_at, parent.name AS parent_name, parent.email AS parent_email,
                    student.name AS student_name, student.email AS student_email, student.grade
             FROM parent_child_links p
             JOIN users parent ON parent.id = p.parent_id
             JOIN users student ON student.id = p.student_id
             ORDER BY p.created_at DESC LIMIT 200'
        );
        respond(200, array('ok' => true, 'links' => $rows));
    }

    fail(404, array('ok' => false, 'error' => 'That BrightPath API route was not found.'));
} catch (Throwable $error) {
    error_log('BrightPath API error: ' . $error->getMessage() . ' @ ' . $error->getFile() . ':' . $error->getLine());
    $message = 'The school server could not complete that request. Please try again.';
    if ((bool)config('allow_debug_errors', false)) {
        $message .= ' [' . $error->getMessage() . ']';
    }
    fail(503, $message);
}
