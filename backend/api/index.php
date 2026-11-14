<?php
declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function body_json(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($data)) {
        respond(400, ['ok' => false, 'error' => 'Send a valid JSON request.']);
    }
    return $data;
}

function auth_user(mysqli $db): array
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authorization = '';
    foreach ($headers as $key => $value) {
        if (strtolower((string)$key) === 'authorization') {
            $authorization = (string)$value;
            break;
        }
    }
    if (!preg_match('/^Bearer ([A-Za-z0-9_-]{40,64})$/', $authorization, $matches)) {
        respond(401, ['ok' => false, 'error' => 'Sign in to your school account to continue.']);
    }

    $tokenHash = hash('sha256', $matches[1]);
    $stmt = $db->prepare(
        'SELECT u.id, u.name, u.email, u.role, u.grade
         FROM api_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > UTC_TIMESTAMP() AND u.active = 1 LIMIT 1'
    );
    $stmt->bind_param('s', $tokenHash);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$user) {
        respond(401, ['ok' => false, 'error' => 'Your session expired. Please sign in again.']);
    }
    return $user;
}

function require_student(array $user): void
{
    if ($user['role'] !== 'student' || $user['grade'] === null) {
        respond(403, ['ok' => false, 'error' => 'Only a student account can submit student work.']);
    }
}

try {
    $configPath = __DIR__ . '/config.php';
    if (!is_file($configPath)) {
        respond(503, ['ok' => false, 'error' => 'API setup is incomplete: upload the server-only config.php beside this index.php file.']);
    }
    $config = require $configPath;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $config['allowed_origins'] ?? [], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 600');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if ($origin !== '' && !in_array($origin, $config['allowed_origins'] ?? [], true)) {
        respond(403, ['ok' => false, 'error' => 'This app origin is not allowed by the school API.']);
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(
        $config['db_host'],
        $config['db_user'],
        $config['db_password'],
        $config['db_name']
    );
    $db->set_charset('utf8mb4');
    $route = trim((string)($_GET['r'] ?? ''), '/');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($route === 'health' && $method === 'GET') {
        respond(200, ['ok' => true, 'database' => 'connected', 'api_version' => '1']);
    }

    if ($route === 'auth/bootstrap' && $method === 'POST') {
        $body = body_json();
        $configuredKey = (string)($config['bootstrap_key'] ?? '');
        if ($configuredKey === '' || !hash_equals($configuredKey, (string)($body['bootstrap_key'] ?? ''))) {
            respond(403, ['ok' => false, 'error' => 'The one-time administrator setup key is invalid.']);
        }
        $count = (int)$db->query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")->fetch_assoc()['total'];
        if ($count > 0) {
            respond(409, ['ok' => false, 'error' => 'An administrator already exists. The one-time setup is closed.']);
        }
        $name = trim((string)($body['name'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if ($name === '' || strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || strlen($password) < 12 || strlen($password) > 128) {
            respond(422, ['ok' => false, 'error' => 'Provide a name, valid email, and a password of at least 12 characters.']);
        }
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')");
        $stmt->bind_param('sss', $name, $email, $passwordHash);
        $stmt->execute();
        $stmt->close();
        respond(201, ['ok' => true, 'message' => 'Administrator created. Remove the bootstrap key from server configuration now.']);
    }

    if ($route === 'auth/login' && $method === 'POST') {
        $body = body_json();
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $password = (string)($body['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 128) {
            respond(422, ['ok' => false, 'error' => 'Enter a valid school email and password.']);
        }
        $stmt = $db->prepare(
            'SELECT id, name, email, password_hash, role, grade
             FROM users WHERE email = ? AND active = 1 LIMIT 1'
        );
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(401, ['ok' => false, 'error' => 'We could not sign you in. Check your details or ask your parent or tutor for help.']);
        }
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $tokenHash = hash('sha256', $token);
        $lifetime = max(900, min((int)($config['token_lifetime_seconds'] ?? 28800), 86400));
        $expiresAt = gmdate('Y-m-d H:i:s', time() + $lifetime);
        $db->query('DELETE FROM api_tokens WHERE expires_at <= UTC_TIMESTAMP()');
        $stmt = $db->prepare('INSERT INTO api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
        $stmt->bind_param('iss', $user['id'], $tokenHash, $expiresAt);
        $stmt->execute();
        $stmt->close();
        unset($user['password_hash']);
        respond(200, ['ok' => true, 'token' => $token, 'user' => $user, 'expires_in' => $lifetime]);
    }

    if ($route === 'auth/logout' && $method === 'POST') {
        $user = auth_user($db);
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authorization = '';
        foreach ($headers as $key => $value) {
            if (strtolower((string)$key) === 'authorization') {
                $authorization = (string)$value;
                break;
            }
        }
        preg_match('/^Bearer ([A-Za-z0-9_-]{40,64})$/', $authorization, $matches);
        $tokenHash = hash('sha256', $matches[1]);
        $stmt = $db->prepare('DELETE FROM api_tokens WHERE user_id = ? AND token_hash = ?');
        $stmt->bind_param('is', $user['id'], $tokenHash);
        $stmt->execute();
        $stmt->close();
        respond(200, ['ok' => true]);
    }

    if ($route === 'assignments' && $method === 'GET') {
        $user = auth_user($db);
        if ($user['role'] === 'student' && $user['grade'] !== null) {
            $stmt = $db->prepare(
                "SELECT a.id, a.title, a.description, DATE_FORMAT(a.due_at, '%Y-%m-%d') AS due_at,
                        IF(s.id IS NULL, 0, 1) AS submitted
                 FROM assignments a
                 LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
                 WHERE a.grade = ? AND a.status = 'published'
                   AND (a.due_at IS NULL OR a.due_at >= UTC_DATE())
                 ORDER BY a.due_at IS NULL, a.due_at, a.id LIMIT 100"
            );
            $stmt->bind_param('ii', $user['id'], $user['grade']);
        } elseif ($user['role'] === 'tutor') {
            $stmt = $db->prepare(
                "SELECT id, title, description, grade, status, DATE_FORMAT(due_at, '%Y-%m-%d') AS due_at
                 FROM assignments WHERE created_by = ? ORDER BY created_at DESC LIMIT 100"
            );
            $stmt->bind_param('i', $user['id']);
        } elseif ($user['role'] === 'admin') {
            $stmt = $db->prepare(
                "SELECT id, title, description, grade, status, DATE_FORMAT(due_at, '%Y-%m-%d') AS due_at
                 FROM assignments ORDER BY created_at DESC LIMIT 100"
            );
        } else {
            respond(403, ['ok' => false, 'error' => 'This account cannot view class assignments.']);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = $row;
        }
        $stmt->close();
        respond(200, ['ok' => true, 'assignments' => $items]);
    }

    if ($route === 'assignments' && $method === 'POST') {
        $user = auth_user($db);
        if (!in_array($user['role'], ['tutor', 'admin'], true)) {
            respond(403, ['ok' => false, 'error' => 'Only a tutor or administrator can create assignments.']);
        }
        $body = body_json();
        $title = trim((string)($body['title'] ?? ''));
        $description = trim((string)($body['description'] ?? ''));
        $grade = filter_var($body['grade'] ?? null, FILTER_VALIDATE_INT);
        $dueAt = trim((string)($body['due_at'] ?? ''));
        if ($title === '' || strlen($title) > 180 || strlen($description) > 5000
            || $grade === false || $grade < 1 || $grade > 8) {
            respond(422, ['ok' => false, 'error' => 'Enter a title, description under 5,000 characters, and grade 1–8.']);
        }
        if ($dueAt !== '') {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $dueAt);
            if (!$date || $date->format('Y-m-d') !== $dueAt) {
                respond(422, ['ok' => false, 'error' => 'Choose a valid due date.']);
            }
        } else {
            $dueAt = null;
        }
        $creatorId = (int)$user['id'];
        $stmt = $db->prepare(
            "INSERT INTO assignments (title, description, grade, due_at, status, created_by)
             VALUES (?, ?, ?, ?, 'published', ?)"
        );
        $stmt->bind_param('ssisi', $title, $description, $grade, $dueAt, $creatorId);
        $stmt->execute();
        $assignmentId = $db->insert_id;
        $stmt->close();
        respond(201, ['ok' => true, 'assignment_id' => $assignmentId]);
    }

    if ($route === 'users' && $method === 'POST') {
        $admin = auth_user($db);
        if ($admin['role'] !== 'admin') {
            respond(403, ['ok' => false, 'error' => 'Only an administrator can create accounts.']);
        }
        $body = body_json();
        $name = trim((string)($body['name'] ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $role = (string)($body['role'] ?? '');
        $grade = isset($body['grade']) ? filter_var($body['grade'], FILTER_VALIDATE_INT) : null;
        $password = (string)($body['password'] ?? '');
        if ($name === '' || strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || !in_array($role, ['student', 'parent', 'tutor'], true)
            || strlen($password) < 12 || strlen($password) > 128
            || ($role === 'student' && ($grade === false || $grade < 1 || $grade > 8))
            || ($role !== 'student' && isset($body['grade']))) {
            respond(422, ['ok' => false, 'error' => 'Check the account details, grade, and 12-character minimum password.']);
        }
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare('INSERT INTO users (name, email, password_hash, role, grade) VALUES (?, ?, ?, ?, ?)');
        $stmt->bind_param('ssssi', $name, $email, $passwordHash, $role, $grade);
        $stmt->execute();
        $newId = $db->insert_id;
        $stmt->close();
        respond(201, ['ok' => true, 'user_id' => $newId]);
    }

    if ($route === 'submissions' && $method === 'POST') {
        $user = auth_user($db);
        require_student($user);
        $assignmentId = filter_var($_POST['assignment_id'] ?? null, FILTER_VALIDATE_INT);
        $notes = trim((string)($_POST['notes'] ?? ''));
        if (!$assignmentId || strlen($notes) > 1000) {
            respond(422, ['ok' => false, 'error' => 'Choose an assignment and keep your note under 1,000 characters.']);
        }
        $stmt = $db->prepare("SELECT id FROM assignments WHERE id = ? AND grade = ? AND status = 'published' LIMIT 1");
        $stmt->bind_param('ii', $assignmentId, $user['grade']);
        $stmt->execute();
        $allowed = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$allowed) {
            respond(404, ['ok' => false, 'error' => 'This assignment is not available for your grade.']);
        }
        $file = $_FILES['file'] ?? null;
        $maxBytes = max(1024, min((int)($config['max_upload_bytes'] ?? 8388608), 8388608));
        if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] < 1 || $file['size'] > $maxBytes) {
            respond(422, ['ok' => false, 'error' => 'Choose a file under 8 MB and try again.']);
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
        if (!isset($extensions[$mime])) {
            respond(415, ['ok' => false, 'error' => 'Only JPG, PNG, WebP, or PDF files are accepted.']);
        }
        $uploadDir = (string)($config['upload_dir'] ?? (__DIR__ . '/storage'));
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0700, true) && !is_dir($uploadDir)) {
            throw new RuntimeException('Upload directory could not be created.');
        }
        $storedName = bin2hex(random_bytes(20)) . '.' . $extensions[$mime];
        $target = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $storedName;
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            throw new RuntimeException('Uploaded file could not be stored.');
        }
        $originalName = function_exists('mb_substr')
            ? mb_substr(basename((string)$file['name']), 0, 180)
            : substr(basename((string)$file['name']), 0, 180);
        $studentId = (int)$user['id'];
        $oldName = null;
        try {
            $stmt = $db->prepare('SELECT stored_filename FROM submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1');
            $stmt->bind_param('ii', $assignmentId, $studentId);
            $stmt->execute();
            $oldSubmission = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            $oldName = $oldSubmission['stored_filename'] ?? null;
            $stmt = $db->prepare(
                'INSERT INTO submissions (assignment_id, student_id, stored_filename, original_filename, mime_type, file_size, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE stored_filename = VALUES(stored_filename),
                   original_filename = VALUES(original_filename), mime_type = VALUES(mime_type),
                   file_size = VALUES(file_size), notes = VALUES(notes), submitted_at = CURRENT_TIMESTAMP'
            );
            $size = (int)$file['size'];
            $stmt->bind_param('iisssis', $assignmentId, $studentId, $storedName, $originalName, $mime, $size, $notes);
            $stmt->execute();
            $stmt->close();
        } catch (Throwable $error) {
            if (is_file($target) && !unlink($target)) {
                error_log('BrightPath API could not remove a failed submission upload.');
            }
            throw $error;
        }
        if ($oldName && preg_match('/^[a-f0-9]{40}\.(jpg|png|webp|pdf)$/', $oldName)) {
            $oldPath = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $oldName;
            if (is_file($oldPath) && !unlink($oldPath)) {
                error_log('BrightPath API could not remove a replaced submission upload.');
            }
        }
        respond(201, ['ok' => true, 'message' => 'Your work was submitted to your teacher.']);
    }

    if ($route === 'submissions' && $method === 'GET') {
        $user = auth_user($db);
        if (!in_array($user['role'], ['tutor', 'admin'], true)) {
            respond(403, ['ok' => false, 'error' => 'Only a tutor or administrator can review student submissions.']);
        }
        if ($user['role'] === 'admin') {
            $stmt = $db->prepare(
                'SELECT s.id, s.assignment_id, a.title, u.name AS student_name, u.grade,
                        s.original_filename, s.mime_type, s.file_size, s.notes, s.submitted_at
                 FROM submissions s
                 JOIN assignments a ON a.id = s.assignment_id
                 JOIN users u ON u.id = s.student_id
                 ORDER BY s.submitted_at DESC LIMIT 100'
            );
        } else {
            $stmt = $db->prepare(
                'SELECT s.id, s.assignment_id, a.title, u.name AS student_name, u.grade,
                        s.original_filename, s.mime_type, s.file_size, s.notes, s.submitted_at
                 FROM submissions s
                 JOIN assignments a ON a.id = s.assignment_id
                 JOIN users u ON u.id = s.student_id
                 WHERE a.created_by = ? ORDER BY s.submitted_at DESC LIMIT 100'
            );
            $stmt->bind_param('i', $user['id']);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = $row;
        }
        $stmt->close();
        respond(200, ['ok' => true, 'submissions' => $items]);
    }

    if ($route === 'submissions/download' && $method === 'GET') {
        $user = auth_user($db);
        if (!in_array($user['role'], ['tutor', 'admin'], true)) {
            respond(403, ['ok' => false, 'error' => 'Only a tutor or administrator can download student submissions.']);
        }
        $submissionId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$submissionId) respond(422, ['ok' => false, 'error' => 'Choose a valid submission.']);
        if ($user['role'] === 'admin') {
            $stmt = $db->prepare(
                'SELECT s.stored_filename, s.original_filename, s.mime_type
                 FROM submissions s WHERE s.id = ? LIMIT 1'
            );
            $stmt->bind_param('i', $submissionId);
        } else {
            $stmt = $db->prepare(
                'SELECT s.stored_filename, s.original_filename, s.mime_type
                 FROM submissions s JOIN assignments a ON a.id = s.assignment_id
                 WHERE s.id = ? AND a.created_by = ? LIMIT 1'
            );
            $stmt->bind_param('ii', $submissionId, $user['id']);
        }
        $stmt->execute();
        $file = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$file || !preg_match('/^[a-f0-9]{40}\.(jpg|png|webp|pdf)$/', $file['stored_filename'])) {
            respond(404, ['ok' => false, 'error' => 'Submission file not found.']);
        }
        $uploadDir = (string)($config['upload_dir'] ?? (__DIR__ . '/storage'));
        $path = rtrim($uploadDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $file['stored_filename'];
        if (!is_file($path)) respond(404, ['ok' => false, 'error' => 'Submission file is no longer available.']);
        $downloadName = str_replace(["\r", "\n", '"', '\\'], '_', basename($file['original_filename']));
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Length: ' . (string)filesize($path));
        header('Content-Disposition: attachment; filename="' . $downloadName . '"');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }

    respond(404, ['ok' => false, 'error' => 'API route not found.']);
} catch (Throwable $error) {
    error_log('BrightPath API error: ' . $error->getMessage());
    respond(503, ['ok' => false, 'error' => 'The school server could not complete this request. Try again later.']);
}
