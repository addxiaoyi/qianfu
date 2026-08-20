<?php
session_start();

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => '未登录']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => '不支持的请求方法']);
    exit;
}

$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';

$configFile = __DIR__ . '/data/config.json';
$config = [];

if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true) ?: [];
}

if ($username) {
    $config['admin_username'] = $username;
}

if ($password) {
    $config['admin_password'] = $password;
}

$result = file_put_contents($configFile, json_encode($config, JSON_UNESCAPED_UNICODE), LOCK_EX);

if ($result === false) {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => '保存失败']);
    exit;
}

header('Content-Type: application/json');
echo json_encode(['status' => 'success', 'message' => '设置已更新']);