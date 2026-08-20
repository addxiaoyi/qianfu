<?php
/**
 * 操作日志 API
 */
require_once 'auth.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // 获取日志列表
    $logFile = __DIR__ . '/data/operation_logs.json';
    $logs = [];
    
    if (file_exists($logFile)) {
        $content = file_get_contents($logFile);
        $logs = json_decode($content, true) ?: [];
    }
    
    // 按时间倒序
    usort($logs, function($a, $b) {
        return ($b['timestamp'] ?? 0) - ($a['timestamp'] ?? 0);
    });
    
    // 分页
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? min(100, max(10, intval($_GET['limit']))) : 20;
    $offset = ($page - 1) * $limit;
    
    $total = count($logs);
    $paginatedLogs = array_slice($logs, $offset, $limit);
    
    echo json_encode([
        'success' => true,
        'data' => $paginatedLogs,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => ceil($total / $limit)
    ]);
    
} elseif ($method === 'POST') {
    // 添加日志
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['action'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => '缺少 action 参数']);
        exit;
    }
    
    $logFile = __DIR__ . '/data/operation_logs.json';
    $logs = [];
    
    if (file_exists($logFile)) {
        $content = file_get_contents($logFile);
        $logs = json_decode($content, true) ?: [];
    }
    
    $logEntry = [
        'id' => uniqid('log_'),
        'timestamp' => time(),
        'action' => $input['action'],
        'module' => $input['module'] ?? 'unknown',
        'detail' => $input['detail'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user' => $_SESSION['username'] ?? 'admin'
    ];
    
    // 保留最近1000条
    array_unshift($logs, $logEntry);
    if (count($logs) > 1000) {
        $logs = array_slice($logs, 0, 1000);
    }
    
    file_put_contents($logFile, json_encode($logs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    
    echo json_encode(['success' => true, 'data' => $logEntry]);
    
} elseif ($method === 'DELETE') {
    // 清除所有日志
    $logFile = __DIR__ . '/data/operation_logs.json';
    
    if (file_exists($logFile)) {
        unlink($logFile);
    }
    
    echo json_encode(['success' => true, 'message' => '日志已清除']);
}