package cn.exrick.common.handler;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.QianFuRecharge;
import cn.exrick.common.utils.SignatureUtil;
import cn.exrick.dao.QianFuOrderDao;
import cn.exrick.dao.QianFuRechargeDao;
import cn.exrick.service.QianFuService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@SuppressWarnings("unused")
@Component
public class CallbackHandler {

    private static final Logger log = LoggerFactory.getLogger(CallbackHandler.class);
    private static final String CALLBACK_LOCK_PREFIX = "qianfu:callback:lock:";
    private static final int MAX_RETRY_COUNT = 5;

    @Autowired
    private QianFuOrderDao qianFuOrderDao;

    @Autowired
    private QianFuRechargeDao qianFuRechargeDao;

    @Autowired
    private SignatureUtil signatureUtil;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private QianFuService qianFuService;

    private final Map<String, Integer> retryDelays = new ConcurrentHashMap<>();

    public CallbackHandler() {
        retryDelays.put("1", 0);
        retryDelays.put("2", 30);
        retryDelays.put("3", 120);
        retryDelays.put("4", 600);
        retryDelays.put("5", 1800);
    }

    public boolean handlePayCallback(Map<String, String> callbackData, String signature) {
        String orderId = callbackData.get("orderId");
        String qianfuOrderId = callbackData.get("qianfuOrderId");
        String amount = callbackData.get("amount");
        String status = callbackData.get("status");
        String timestamp = callbackData.get("timestamp");

        if (orderId == null || qianfuOrderId == null) {
            log.error("回调参数缺失: orderId={}, qianfuOrderId={}", orderId, qianfuOrderId);
            return false;
        }

        log.debug("处理支付回调: orderId={}, amount={}, status={}, timestamp={}", orderId, amount, status, timestamp);

        if (!acquireLock(orderId)) {
            log.warn("订单正在处理中: {}", orderId);
            return false;
        }

        try {
            QianFuOrder order = qianFuOrderDao.findByOrderId(orderId).orElse(null);
            if (order == null) {
                log.error("订单不存在: {}", orderId);
                return false;
            }

            if (order.getStatus() == 1) {
                log.info("订单已支付, 忽略重复回调: {}", orderId);
                return true;
            }

            if ("SUCCESS".equals(status)) {
                order.setStatus(1);
                order.setPayTime(new Date());
                qianFuOrderDao.save(order);
                log.info("订单支付成功: {}", orderId);
                return true;
            } else if ("CLOSED".equals(status)) {
                order.setStatus(2);
                qianFuOrderDao.save(order);
                log.info("订单已关闭: {}", orderId);
                return true;
            }

            return true;
        } catch (Exception e) {
            log.error("处理支付回调异常: {}", e.getMessage(), e);
            scheduleRetry(orderId, callbackData, signature);
            return false;
        } finally {
            releaseLock(orderId);
        }
    }

    public boolean handleRechargeCallback(Map<String, String> callbackData, String signature) {
        String rechargeId = callbackData.get("rechargeId");
        String qianfuRechargeId = callbackData.get("qianfuRechargeId");
        String amount = callbackData.get("amount");
        String status = callbackData.get("status");

        if (rechargeId == null) {
            log.error("充值回调参数缺失: rechargeId={}", rechargeId);
            return false;
        }

        log.debug("处理充值回调: rechargeId={}, qianfuRechargeId={}, amount={}, status={}", rechargeId, qianfuRechargeId, amount, status);

        if (!acquireLock(rechargeId)) {
            log.warn("充值正在处理中: {}", rechargeId);
            return false;
        }

        try {
            QianFuRecharge recharge = qianFuRechargeDao.findByRechargeId(rechargeId).orElse(null);
            if (recharge == null) {
                log.error("充值记录不存在: {}", rechargeId);
                return false;
            }

            if (recharge.getStatus() == 1) {
                log.info("充值已完成, 忽略重复回调: {}", rechargeId);
                return true;
            }

            if ("SUCCESS".equals(status)) {
                recharge.setStatus(1);
                recharge.setCompleteTime(new Date());
                qianFuRechargeDao.save(recharge);
                log.info("充值成功: {}", rechargeId);
                return true;
            } else if ("FAILED".equals(status)) {
                String failReason = callbackData.get("failReason");
                recharge.setStatus(2);
                recharge.setFailReason(failReason);
                qianFuRechargeDao.save(recharge);
                log.info("充值失败: {}, reason: {}", rechargeId, failReason);
                return true;
            }

            return true;
        } catch (Exception e) {
            log.error("处理充值回调异常: {}", e.getMessage(), e);
            scheduleRetry(rechargeId, callbackData, signature);
            return false;
        } finally {
            releaseLock(rechargeId);
        }
    }

    private boolean acquireLock(String key) {
        String lockKey = CALLBACK_LOCK_PREFIX + key;
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, "1", 30, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(acquired);
    }

    private void releaseLock(String key) {
        String lockKey = CALLBACK_LOCK_PREFIX + key;
        redisTemplate.delete(lockKey);
    }

    public void scheduleRetry(String orderId, Map<String, String> callbackData, String signature) {
        QianFuOrder order = qianFuOrderDao.findByOrderId(orderId).orElse(null);
        if (order == null) {
            return;
        }

        int currentRetry = order.getNotifyCount();
        if (currentRetry >= MAX_RETRY_COUNT) {
            log.error("回调重试次数已达上限, orderId={}, retry={}", orderId, currentRetry);
            return;
        }

        Integer delay = retryDelays.get(String.valueOf(currentRetry + 1));
        if (delay != null && delay > 0) {
            String retryKey = "qianfu:retry:" + orderId;
            redisTemplate.opsForValue().set(retryKey, String.valueOf(currentRetry + 1), delay, TimeUnit.SECONDS);
            log.info("调度回调重试: orderId={}, retry={}, delay={}s", orderId, currentRetry + 1, delay);
        }
    }

    @Scheduled(fixedDelay = 60000)
    public void processRetryQueue() {
        log.debug("处理回调重试队列...");
    }

    public boolean verifyCallbackSignature(Map<String, String> params, String signature, String secretKey) {
        String timestamp = params.get("timestamp");
        if (timestamp != null && !signatureUtil.verifyTimestamp(timestamp)) {
            log.warn("回调时间戳验证失败: {}", timestamp);
            return false;
        }

        if (!signatureUtil.verifySignature(params, signature, secretKey)) {
            log.warn("回调签名验证失败");
            return false;
        }

        return true;
    }
}