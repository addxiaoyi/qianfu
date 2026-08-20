UPDATE "SystemConfig"
SET value = json_set(
      json_set(
        value,
        '$.message',
        '平台现已切换为个人备案模式，提供服务器展示、资料发布、新闻和工单支持；不提供支付、钱包、商城或推广交易服务。'
      ),
      '$.updatedAt',
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    description = 'Public announcement: 个人备案模式服务说明'
WHERE key LIKE 'PUBLIC_ANNOUNCEMENT:%'
  AND json_valid(value) = 1
  AND json_extract(value, '$.status') = 'PUBLISHED'
  AND (
    instr(coalesce(json_extract(value, '$.message'), ''), '支付') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '充值') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '钱包') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '商城') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '推广') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '返利') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '交易') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '订单') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '退款') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '账单') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '收费') > 0
    OR instr(coalesce(json_extract(value, '$.message'), ''), '付款') > 0
  );
