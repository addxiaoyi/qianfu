<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Content-Disposition: attachment; filename="site-backup.json"');

session_start();

function isLoggedIn() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => '未登录'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 数据文件路径
$dataFile = __DIR__ . '/data/content.json';
$systemFile = __DIR__ . '/data/system.json';
$uploadsDir = __DIR__ . '/uploads/';

if (!file_exists($dataFile)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => '数据文件不存在'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 读取数据
$content = json_decode(file_get_contents($dataFile), true);
$system = file_exists($systemFile) ? json_decode(file_get_contents($systemFile), true) : [];

// 收集上传的图片文件
$uploadedImages = [];
if (is_dir($uploadsDir)) {
    $files = scandir($uploadsDir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $filepath = $uploadsDir . $file;
        if (is_file($filepath)) {
            $uploadedImages[] = [
                'name' => $file,
                'path' => $filepath,
                'size' => filesize($filepath),
                'data' => base64_encode(file_get_contents($filepath))
            ];
        }
    }
}

// 导出数据
$export = [
    'version' => '1.0',
    'exportTime' => date('Y-m-d H:i:s'),
    'content' => $content,
    'system' => $system,
    'uploadedImages' => $uploadedImages
];

echo json_encode($export, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
