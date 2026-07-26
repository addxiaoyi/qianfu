SET NAMES utf8mb4;

DELIMITER //

DROP PROCEDURE IF EXISTS paypro_migrate_002//
CREATE PROCEDURE paypro_migrate_002()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'match_mode'
  ) THEN
    ALTER TABLE `t_order`
      ADD COLUMN `match_mode` varchar(20) NOT NULL DEFAULT 'REMARK'
        COMMENT '匹配模式: REMARK=备注匹配, DECREMENT=减额匹配'
        AFTER `pay_qr_num`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'actual_amount'
  ) THEN
    ALTER TABLE `t_order`
      ADD COLUMN `actual_amount` decimal(19, 2) NULL DEFAULT NULL
        COMMENT '实际支付金额'
        AFTER `match_mode`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'decrement_index'
  ) THEN
    ALTER TABLE `t_order`
      ADD COLUMN `decrement_index` int NULL DEFAULT NULL
        COMMENT '减额槽位索引'
        AFTER `actual_amount`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'order_source'
  ) THEN
    ALTER TABLE `t_order`
      ADD COLUMN `order_source` varchar(20) NULL DEFAULT 'PRODUCT'
        COMMENT '订单来源'
        AFTER `decrement_index`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'notify_url'
  ) THEN
    ALTER TABLE `t_order`
      ADD COLUMN `notify_url` varchar(512) NULL DEFAULT NULL
        COMMENT '通知地址'
        AFTER `order_source`;
  ELSEIF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'notify_url'
      AND (DATA_TYPE <> 'varchar' OR CHARACTER_MAXIMUM_LENGTH < 512)
  ) THEN
    ALTER TABLE `t_order`
      MODIFY COLUMN `notify_url` varchar(512) NULL DEFAULT NULL COMMENT '通知地址';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND COLUMN_NAME = 'expire_time'
  ) THEN
    ALTER TABLE `t_order`
      ADD COLUMN `expire_time` datetime NULL DEFAULT NULL
        AFTER `notify_url`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND INDEX_NAME = 'idx_actual_amount_state'
  ) THEN
    ALTER TABLE `t_order`
      ADD INDEX `idx_actual_amount_state` (`actual_amount`, `state`);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_order' AND INDEX_NAME = 'idx_pay_num_create_time'
  ) THEN
    ALTER TABLE `t_order`
      ADD INDEX `idx_pay_num_create_time` (`pay_num`, `create_time`);
  END IF;
END//

CALL paypro_migrate_002()//
DROP PROCEDURE paypro_migrate_002//

DELIMITER ;
