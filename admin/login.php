<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_start();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => '不支持的请求方法']);
    exit;
}

$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';
$action = $_POST['action'] ?? 'login';

// 配置文件路径
$configDir = __DIR__ . '/data';
$configFile = $configDir . '/data.json';
$logFile = $configDir . '/login.log';

// 确保 data 目录存在
if (!is_dir($configDir)) {
    mkdir($configDir, 0755, true);
}

// 加载配置
$config = [];
if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true) ?: [];
}

/**
 * 记录密码相关操作日志（不记录密码本身）
 * @param string $event 事件类型
 * @param string $username 用户名
 * @param bool $success 是否成功
 * @param string $detail 详细描述
 */
function logPasswordEvent($event, $username, $success, $detail = '') {
    global $logFile;
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $timestamp = date('Y-m-d H:i:s');
    $status = $success ? 'SUCCESS' : 'FAILED';
    $safeDetail = $detail ? " | {$detail}" : '';
    $logEntry = "[{$timestamp}] {$status} | {$event} | user:{$username} | ip:{$ip}{$safeDetail}" . PHP_EOL;
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * 生成随机密码
 * @param int $length 密码长度
 * @return string 随机密码
 */
function generateRandomPassword($length = 16) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    $password = '';
    $charsLength = strlen($chars);
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[random_int(0, $charsLength - 1)];
    }
    return $password;
}

/**
 * 验证密码强度
 * @param string $password 密码
 * @return array ['valid' => bool, 'errors' => array]
 */
function validatePasswordStrength($password) {
    $errors = [];

    if (strlen($password) < 8) {
        $errors[] = '密码长度至少8位';
    }

    if (!preg_match('/[A-Z]/', $password)) {
        $errors[] = '密码必须包含大写字母';
    }

    if (!preg_match('/[a-z]/', $password)) {
        $errors[] = '密码必须包含小写字母';
    }

    if (!preg_match('/[0-9]/', $password)) {
        $errors[] = '密码必须包含数字';
    }

    if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
        $errors[] = '密码必须包含特殊字符';
    }

    // 检查常见弱密码
    $weakPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'];
    if (in_array(strtolower($password), $weakPasswords)) {
        $errors[] = '密码太简单，请使用更强的密码';
    }

    return [
        'valid' => empty($errors),
        'errors' => $errors
    ];
}

/**
 * 初始化管理员账户（如果不存在）
 * @return array ['username' => string, 'password' => string, 'isFirstTime' => bool]
 */
function initAdminAccount($configFile, &$config) {
    $isFirstTime = false;
    $username = 'admin';
    $password = '';

    // 检查是否已配置管理员密码
    if (empty($config['admin_password'])) {
        $isFirstTime = true;
        // 生成随机密码
        $password = generateRandomPassword(16);

        // 保存到配置
        $config['admin_password'] = password_hash($password, PASSWORD_DEFAULT);
        $config['password_changed'] = false; // 标记首次登录未修改密码
        $config['password_set_at'] = time();

        // 写入配置文件
        file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    return [
        'username' => $username,
        'password' => $isFirstTime ? $password : '', // 首次返回明文密码
        'isFirstTime' => $isFirstTime
    ];
}

// 初始化管理员账户
$adminAccount = initAdminAccount($configFile, $config);
$savedUsername = $config['admin_username'] ?? $adminAccount['username'];

// 处理首次登录初始化
if ($adminAccount['isFirstTime']) {
    logPasswordEvent('PASSWORD_INITIALIZED', $adminAccount['username'], true, 'auto_generated');
    echo json_encode([
        'status' => 'setup_required',
        'message' => '系统未配置管理员密码，请使用以下临时密码登录并立即修改',
        'temp_password' => $adminAccount['password'],
        'username' => $adminAccount['username']
    ]);
    exit;
}

// 根据 action 处理不同请求
switch ($action) {
    case 'login':
        // 验证登录
        $storedPassword = $config['admin_password'] ?? '';

        if ($username === $savedUsername && password_verify($password, $storedPassword)) {
            // 记录成功登录
            logPasswordEvent('LOGIN', $username, true);

            // 检查是否首次登录未修改密码
            if (!isset($config['password_changed']) || $config['password_changed'] === false) {
                $_SESSION['admin_logged_in'] = true;
                $_SESSION['admin_user'] = $username;
                $_SESSION['password_change_required'] = true;
                echo json_encode([
                    'status' => 'password_change_required',
                    'message' => '首次登录必须修改密码',
                    'username' => $username
                ]);
            } else {
                $_SESSION['admin_logged_in'] = true;
                $_SESSION['admin_user'] = $username;
                unset($_SESSION['password_change_required']);
                echo json_encode(['status' => 'success', 'message' => '登录成功', 'username' => $username]);
            }
        } else {
            // 记录登录失败
            logPasswordEvent('LOGIN', $username, false, 'invalid_credentials');
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => '用户名或密码错误']);
        }
        break;

    case 'change_password':
        // 验证是否已登录
        if (empty($_SESSION['admin_logged_in'])) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => '请先登录']);
            exit;
        }

        $currentPassword = $_POST['current_password'] ?? '';
        $newPassword = $_POST['new_password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';

        // 验证当前密码
        $storedPassword = $config['admin_password'] ?? '';
        if (!password_verify($currentPassword, $storedPassword)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => '当前密码错误']);
            exit;
        }

        // 验证新密码
        if (empty($newPassword)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => '请输入新密码']);
            exit;
        }

        if ($newPassword !== $confirmPassword) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => '两次输入的密码不一致']);
            exit;
        }

        // 验证密码强度
        $validation = validatePasswordStrength($newPassword);
        if (!$validation['valid']) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => '密码强度不足',
                'errors' => $validation['errors']
            ]);
            exit;
        }

        // 检查新密码不能与当前密码相同
        if (password_verify($newPassword, $storedPassword)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => '新密码不能与当前密码相同']);
            exit;
        }

        // 更新密码
        $config['admin_password'] = password_hash($newPassword, PASSWORD_DEFAULT);
        $config['password_changed'] = true;
        $config['password_changed_at'] = time();
        $config['password_change_count'] = ($config['password_change_count'] ?? 0) + 1;

        file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // 记录密码修改
        logPasswordEvent('PASSWORD_CHANGED', $_SESSION['admin_user'], true);

        // 清除强制修改密码标记
        unset($_SESSION['password_change_required']);

        echo json_encode([
            'status' => 'success',
            'message' => '密码修改成功',
            'password_strength' => 'strong'
        ]);
        break;

    case 'validate_password':
        // 纯验证密码强度（不登录）
        $testPassword = $_POST['password'] ?? '';
        $validation = validatePasswordStrength($testPassword);

        echo json_encode([
            'status' => $validation['valid'] ? 'valid' : 'invalid',
            'valid' => $validation['valid'],
            'errors' => $validation['errors']
        ]);
        break;

    case 'check_setup':
        // 检查系统是否已完成初始设置
        echo json_encode([
            'status' => 'success',
            'setup_complete' => !empty($config['admin_password']),
            'password_changed' => $config['password_changed'] ?? false
        ]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => '未知操作']);
}
