DO $$
DECLARE
  row_record RECORD;
  payload JSONB;
  repaired_message TEXT := '平台现已切换为个人备案模式，提供服务器展示、资料发布、新闻和工单支持；不提供支付、钱包、商城或推广交易服务。';
  repaired_at TEXT := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  FOR row_record IN
    SELECT key, value
    FROM "SystemConfig"
    WHERE key LIKE 'PUBLIC_ANNOUNCEMENT:%'
  LOOP
    BEGIN
      payload := row_record.value::JSONB;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF payload ->> 'status' = 'PUBLISHED'
      AND coalesce(payload ->> 'message', '') ~ '(支付|充值|钱包|商城|推广|返利|交易|订单|退款|账单|收费|付款)'
    THEN
      payload := jsonb_set(payload, '{message}', to_jsonb(repaired_message), true);
      payload := jsonb_set(payload, '{updatedAt}', to_jsonb(repaired_at), true);

      UPDATE "SystemConfig"
      SET value = payload::TEXT,
          description = 'Public announcement: 个人备案模式服务说明'
      WHERE key = row_record.key;
    END IF;
  END LOOP;
END $$;
