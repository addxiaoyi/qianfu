<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_start();

function jsonResponse($status, $message = '', $data = []) {
    echo json_encode(array_merge(['status' => $status, 'message' => $message], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function isLoggedIn() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

if (!isLoggedIn()) {
    http_response_code(401);
    jsonResponse('error', '未登录');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse('error', '不支持的请求方法');
}

// 检查是否有文件
if (!isset($_FILES['backup']) || $_FILES['backup']['error'] === UPLOAD_ERR_NO_FILE) {
    jsonResponse('error', '没有选择文件');
}

$file = $_FILES['backup'];

// 检查上传错误
if ($file['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => '文件大小超出服务器限制',
        UPLOAD_ERR_FORM_SIZE => '文件大小超出表单限制',
        UPLOAD_ERR_PARTIAL => '文件只有部分被上传',
        UPLOAD_ERR_NO_TMP_DIR => '服务器临时目录不存在',
        UPLOAD_ERR_CANT_WRITE => '文件写入失败',
        UPLOAD_ERR_EXTENSION => '文件上传被扩展阻止'
    ];
    $message = $errorMessages[$file['error']] ?? '未知上传错误';
    jsonResponse('error', $message);
}

// 读取并解析 JSON
$content = file_get_contents($file['tmp_name']);
$data = json_decode($content, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    jsonResponse('error', '无效的 JSON 文件格式');
}

// 验证版本
if (!isset($data['version']) || !isset($data['content'])) {
    jsonResponse('error', '无效的备份文件格式');
}

// 数据文件路径
$dataFile = __DIR__ . '/data/content.json';
$systemFile = __DIR__ . '/data/system.json';
$uploadsDir = __DIR__ . '/uploads/';

// 创建上传目录（如果不存在）
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0755, true);
}

// 备份当前数据（添加时间戳）
$backupDir = __DIR__ . '/data/backups/';
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}
$backupFile = $backupDir . 'backup_' . date('Y-m-d_H-i-s') . '.json';
file_put_contents($backupFile, json_encode([
    'content' => json_decode(file_get_contents($dataFile), true),
    'system' => file_exists($systemFile) ? json_decode(file_get_contents($systemFile), true) : []
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

// 恢复内容数据
if (isset($data['content'])) {
    file_put_contents($dataFile, json_encode($data['content'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

// 恢复系统数据
if (isset($data['system'])) {
    file_put_contents($systemFile, json_encode($data['system'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

// 恢复上传的图片
$restoredImages = 0;
if (isset($data['uploadedImages']) && is_array($data['uploadedImages'])) {
    foreach ($data['uploadedImages'] as $img) {
        if (isset($img['name']) && isset($img['data'])) {
            $imgData = base64_decode($img['data']);
            if ($imgData !== false) {
                $imgPath = $uploadsDir . $img['name'];
                file_put_contents($imgPath, $imgData);
                $restoredImages++;
            }
        }
    }
}

jsonResponse('success', '导入成功', [
    'restoredImages' => $restoredImages,
    'backupFile' => basename($backupFile)
]);