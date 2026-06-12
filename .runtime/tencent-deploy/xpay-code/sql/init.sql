-- StarMC支付系统 v3.1 数据库初始化脚本
-- 数据库: xpay
-- 执行: mysql -u root -p xpay < sql/init.sql

CREATE DATABASE IF NOT EXISTS xpay DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xpay;

-- 管理员用户表
CREATE TABLE IF NOT EXISTS t_admin_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    openid VARCHAR(128) NOT NULL UNIQUE COMMENT '微信OpenID',
    nickname VARCHAR(100) COMMENT '昵称',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    role VARCHAR(20) DEFAULT 'ADMIN' COMMENT '角色',
    status INT DEFAULT 0 COMMENT '状态: 0-待审核, 1-已通过, 2-已拒绝',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    approved_by VARCHAR(128) COMMENT '审批人OpenID',
    approved_at DATETIME COMMENT '审批时间',
    INDEX idx_openid (openid),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员用户表';

CREATE TABLE IF NOT EXISTS t_admin_local_account (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    admin_user_id BIGINT NOT NULL UNIQUE COMMENT '管理员用户ID',
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '本地登录用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    must_reset_password BOOLEAN DEFAULT TRUE COMMENT '是否强制首次改密',
    last_login_at DATETIME COMMENT '上次登录时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_admin_user_id (admin_user_id),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='本地管理员账号';

-- 二维码登录记录表
CREATE TABLE IF NOT EXISTS t_qr_code_login (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    qr_token VARCHAR(64) NOT NULL UNIQUE COMMENT '二维码Token',
    scene_code VARCHAR(64) NOT NULL COMMENT '场景码',
    openid VARCHAR(128) COMMENT '扫码用户OpenID',
    status INT DEFAULT 0 COMMENT '状态: 0-待扫, 1-已扫待审核, 2-已通过, 3-已拒绝',
    expire_time DATETIME NOT NULL COMMENT '过期时间',
    scan_time DATETIME COMMENT '扫码时间',
    confirm_time DATETIME COMMENT '确认时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_qr_token (qr_token),
    INDEX idx_scene_code (scene_code),
    INDEX idx_openid (openid),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='二维码登录记录表';

-- 登录日志表
CREATE TABLE IF NOT EXISTS t_admin_login_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    openid VARCHAR(128) COMMENT '用户OpenID',
    nickname VARCHAR(100) COMMENT '昵称',
    ip VARCHAR(50) COMMENT 'IP地址',
    user_agent VARCHAR(500) COMMENT 'UserAgent',
    login_type INT COMMENT '登录类型: 1-微信扫码, 2-Token刷新, 3-密码登录',
    status INT COMMENT '状态: 0-待审核, 1-成功, 2-失败, 3-已拒绝',
    fail_reason VARCHAR(500) COMMENT '失败原因',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_openid (openid),
    INDEX idx_ip (ip),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表';

-- 支付订单表
CREATE TABLE IF NOT EXISTS t_pay (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    order_id VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
    pay_type VARCHAR(20) COMMENT '支付类型: alipay/wechat/qq/unipay',
    subject VARCHAR(200) COMMENT '商品名称',
    body VARCHAR(500) COMMENT '商品描述',
    total_amount DECIMAL(10,2) COMMENT '支付金额',
    status INT DEFAULT 0 COMMENT '支付状态: 0-待支付, 1-已支付, 2-已关闭',
   qr_code VARCHAR(500) COMMENT '二维码链接',
    qr_path VARCHAR(200) COMMENT '二维码本地路径',
    pay_time DATETIME COMMENT '支付时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    callback_time DATETIME COMMENT '回调时间',
    callback_count INT DEFAULT 0 COMMENT '回调次数',
    extend VARCHAR(1000) COMMENT '扩展数据',
    notify_url VARCHAR(200) COMMENT '异步通知地址',
    return_url VARCHAR(200) COMMENT '同步返回地址',
    extra_param VARCHAR(500) COMMENT '额外参数',
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_pay_type (pay_type),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付订单表';

-- 千服充值记录表
CREATE TABLE IF NOT EXISTS qianfu_recharge (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    recharge_id VARCHAR(64) NOT NULL UNIQUE COMMENT '充值ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '充值金额',
    status INT DEFAULT 0 COMMENT '状态: 0-处理中, 1-成功, 2-失败',
    qianfu_recharge_id VARCHAR(64) COMMENT '千服充值单号',
    user_id BIGINT COMMENT '用户ID',
    callback_url VARCHAR(512) COMMENT '回调地址',
    fail_reason VARCHAR(500) COMMENT '失败原因',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    complete_time DATETIME COMMENT '完成时间',
    INDEX idx_recharge_id (recharge_id),
    INDEX idx_qianfu_recharge_id (qianfu_recharge_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='千服充值记录表';

-- 千服订单表
CREATE TABLE IF NOT EXISTS qianfu_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    order_id VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
    out_order_id VARCHAR(64) COMMENT '商户侧订单号',
    amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
    subject VARCHAR(256) COMMENT '订单标题',
    body TEXT COMMENT '订单描述',
    status INT DEFAULT 0 COMMENT '状态: 0-待支付, 1-已支付, 2-已关闭',
    pay_type VARCHAR(32) COMMENT '支付类型',
    qianfu_order_id VARCHAR(64) COMMENT '千服订单号',
    tenant_key VARCHAR(64) COMMENT '租户标识',
    callback_url VARCHAR(512) COMMENT '业务回调地址',
    metadata_json TEXT COMMENT '业务元数据',
    callback_status VARCHAR(32) COMMENT '业务回调状态',
    callback_last_response TEXT COMMENT '业务回调最后响应',
    notify_count INT DEFAULT 0 COMMENT '业务回调次数',
    expire_time DATETIME COMMENT '过期时间',
    pay_time DATETIME COMMENT '支付时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_order_id (order_id),
    INDEX idx_out_order_id (out_order_id),
    INDEX idx_qianfu_order_id (qianfu_order_id),
    INDEX idx_tenant_key (tenant_key),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='千服订单表';

CREATE TABLE IF NOT EXISTS t_xpay_tenant (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_key VARCHAR(64) NOT NULL UNIQUE COMMENT '租户标识',
    display_name VARCHAR(128) NOT NULL COMMENT '展示名称',
    owner_admin_user_id BIGINT NOT NULL COMMENT '所属管理员ID',
    callback_url VARCHAR(512) COMMENT '业务回调地址',
    callback_secret_hash VARCHAR(255) COMMENT '业务回调密钥哈希',
    access_token_hash VARCHAR(255) COMMENT '租户访问令牌哈希',
    callback_secret_cipher VARCHAR(1024) COMMENT '业务回调密钥密文',
    access_token_cipher VARCHAR(1024) COMMENT '租户访问令牌密文',
    status INT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_tenant_key (tenant_key),
    INDEX idx_owner_admin_user_id (owner_admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='XPay租户';

CREATE TABLE IF NOT EXISTS t_xpay_tenant_payment_method (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id BIGINT NOT NULL COMMENT '租户ID',
    pay_type VARCHAR(32) NOT NULL COMMENT '支付类型',
    display_name VARCHAR(64) COMMENT '展示名称',
    qr_image_path VARCHAR(512) COMMENT '二维码路径',
    enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_tenant_pay_type (tenant_id, pay_type),
    INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户支付方式';

-- 初始化超级管理员（可选）
-- INSERT INTO t_admin_user (openid, nickname, role, status, enabled, approved_by, approved_at)
-- VALUES ('YOUR_OPENID', '超级管理员', 'SUPER_ADMIN', 1, TRUE, 'SYSTEM', NOW());
