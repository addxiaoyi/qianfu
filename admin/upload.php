<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

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

// 允许的图片类型
$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp'
];

// 最大文件大小 5MB
$maxFileSize = 5 * 1024 * 1024;

// 上传目录
$uploadDir = __DIR__ . '/uploads/';

// 创建上传目录（如果不存在）
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse('error', '不支持的请求方法');
}

// 检查是否有文件上传
if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) {
    jsonResponse('error', '没有选择文件');
}

$file = $_FILES['image'];

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

// 检查文件大小
if ($file['size'] > $maxFileSize) {
    jsonResponse('error', '文件大小不能超过 5MB');
}

// 检查文件类型
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!isset($allowedTypes[$mimeType])) {
    jsonResponse('error', '不支持的图片格式，仅支持 JPG、PNG、GIF、WebP');
}

// 生成唯一文件名
$extension = $allowedTypes[$mimeType];
$filename = uniqid('img_', true) . '.' . $extension;
$targetPath = $uploadDir . $filename;

// 移动文件
if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    jsonResponse('error', '文件保存失败');
}

// 返回访问路径
$requestScheme = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
$requestUri = dirname($_SERVER['REQUEST_URI']);
$baseUrl = $requestScheme . '://' . $_SERVER['HTTP_HOST'] . $requestUri;
$imageUrl = $baseUrl . '/uploads/' . $filename;

jsonResponse('success', '上传成功', [
    'url' => $imageUrl,
    'filename' => $filename
]);
