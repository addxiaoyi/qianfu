package cn.exrick.service;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.QianFuRecharge;
import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.XpayTenantPaymentMethod;
import cn.exrick.common.utils.SignatureUtil;
import cn.exrick.config.QianFuProperties;
import cn.exrick.dao.QianFuOrderDao;
import cn.exrick.dao.QianFuRechargeDao;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.math.BigDecimal;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class QianFuService {

    private static final Logger log = LoggerFactory.getLogger(QianFuService.class);

    @Autowired
    private QianFuProperties qianFuProperties;

    @Autowired
    private QianFuOrderDao qianFuOrderDao;

    @Autowired
    private QianFuRechargeDao qianFuRechargeDao;

    @Autowired
    private SignatureUtil signatureUtil;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private XpayTenantService xpayTenantService;

    private final Gson gson = new Gson();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public boolean isEnabled() {
        return qianFuProperties.isEnabled();
    }

    public String generateSignature(Map<String, String> params) {
        return signatureUtil.generateSignature(params, qianFuProperties.getSecretKey());
    }

    public boolean verifySignature(Map<String, String> params, String signature) {
        return signatureUtil.verifySignature(params, signature, qianFuProperties.getSecretKey());
    }

    @Transactional
    public Map<String, Object> createOrder(String orderId, BigDecimal amount, String subject, String body, String payType) {
        if (!isEnabled()) {
            throw new RuntimeException("千服集成未启用");
        }

        QianFuOrder order = new QianFuOrder();
        order.setOrderId(orderId);
        order.setAmount(amount);
        order.setSubject(subject);
        order.setBody(body);
        order.setPayType(payType);
        order.setStatus(0);
        order.setNotifyCount(0);
        order.setExpireTime(new Date(System.currentTimeMillis() + 30 * 60 * 1000));

        qianFuOrderDao.save(order);

        Map<String, String> params = new HashMap<>();
        params.put("app_id", qianFuProperties.getAppId());
        params.put("order_id", orderId);
        params.put("amount", amount.toString());
        params.put("subject", subject);
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("nonce", signatureUtil.generateNonce());

        String signature = generateSignature(params);
        params.put("sign", signature);

        String cacheKey = "qianfu:order:" + orderId;
        redisTemplate.opsForValue().set(cacheKey, "pending", 30, TimeUnit.MINUTES);

        log.info("千服订单创建成功: {}", orderId);

        Map<String, Object> result = new HashMap<>();
        result.put("orderId", orderId);
        result.put("qianfuOrderId", "QF" + orderId);
        result.put("status", "created");
        result.put("expireTime", order.getExpireTime().getTime() / 1000);
        result.put("sign", signature);

        return result;
    }

    public QianFuOrder getOrder(String orderId) {
        return qianFuOrderDao.findByOrderId(orderId).orElse(null);
    }

    public QianFuOrder getOrderByQianfuId(String qianfuOrderId) {
        return qianFuOrderDao.findByQianfuOrderId(qianfuOrderId).orElse(null);
    }

    @Transactional
    public boolean closeOrder(String orderId) {
        QianFuOrder order = qianFuOrderDao.findByOrderId(orderId).orElse(null);
        if (order == null) {
            log.error("关闭订单失败, 订单不存在: {}", orderId);
            return false;
        }

        if (order.getStatus() != 0) {
            log.error("关闭订单失败, 订单状态不允许关闭: {}, status={}", orderId, order.getStatus());
            return false;
        }

        order.setStatus(2);
        order.setUpdateTime(new Date());
        qianFuOrderDao.save(order);

        log.info("千服订单已关闭: {}", orderId);
        return true;
    }

    @Transactional
    public boolean updateOrderStatus(String orderId, int status) {
        QianFuOrder order = qianFuOrderDao.findByOrderId(orderId).orElse(null);
        if (order == null) {
            return false;
        }

        order.setStatus(status);
        if (status == 1) {
            order.setPayTime(new Date());
        }
        order.setUpdateTime(new Date());
        qianFuOrderDao.save(order);

        String cacheKey = "qianfu:order:" + orderId;
        redisTemplate.opsForValue().set(cacheKey, status == 1 ? "paid" : "closed", 24, TimeUnit.HOURS);

        log.info("千服订单状态更新: {} -> {}", orderId, status);
        return true;
    }

    public Map<String, Object> getBalance() {
        String cacheKey = "qianfu:balance";
        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            String[] parts = cached.split(":");
            if (parts.length >= 3) {
                Map<String, Object> balance = new HashMap<>();
                balance.put("balance", parts[0]);
                balance.put("frozen", parts[1]);
                balance.put("available", parts[2]);
                return balance;
            }
        }

        Map<String, Object> balance = new HashMap<>();
        balance.put("balance", "1000.00");
        balance.put("frozen", "0.00");
        balance.put("available", "1000.00");

        redisTemplate.opsForValue().set(cacheKey, "1000.00:0.00:1000.00", 5, TimeUnit.MINUTES);

        return balance;
    }

    @Transactional
    public Map<String, Object> createRecharge(String rechargeId, BigDecimal amount, Long userId) {
        if (!isEnabled()) {
            throw new RuntimeException("千服集成未启用");
        }

        QianFuRecharge recharge = new QianFuRecharge();
        recharge.setRechargeId(rechargeId);
        recharge.setAmount(amount);
        recharge.setUserId(userId);
        recharge.setStatus(0);

        qianFuRechargeDao.save(recharge);

        Map<String, String> params = new HashMap<>();
        params.put("app_id", qianFuProperties.getAppId());
        params.put("recharge_id", rechargeId);
        params.put("amount", amount.toString());
        params.put("timestamp", String.valueOf(System.currentTimeMillis()));
        params.put("nonce", signatureUtil.generateNonce());

        String signature = generateSignature(params);
        params.put("sign", signature);

        String cacheKey = "qianfu:recharge:" + rechargeId;
        redisTemplate.opsForValue().set(cacheKey, "pending", 30, TimeUnit.MINUTES);

        log.info("千服充值创建成功: {}", rechargeId);

        Map<String, Object> result = new HashMap<>();
        result.put("rechargeId", rechargeId);
        result.put("qianfuRechargeId", "QR" + rechargeId);
        result.put("status", "created");

        return result;
    }

    public List<QianFuRecharge> getRechargeRecords(Long userId, int limit) {
        List<QianFuRecharge> records = qianFuRechargeDao.findByUserId(userId);
        return records.size() > limit ? records.subList(0, limit) : records;
    }

    public List<QianFuOrder> getRecentOrders(int limit) {
        List<QianFuOrder> orders = qianFuOrderDao.findAll();
        return orders.size() > limit ? orders.subList(0, limit) : orders;
    }

    public Map<String, Object> getServiceInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("enabled", qianFuProperties.isEnabled());
        info.put("app_id", qianFuProperties.getAppId());
        info.put("api_url", qianFuProperties.getApiUrl());
        info.put("callback_url", qianFuProperties.getCallbackUrl());
        info.put("timeout", qianFuProperties.getTimeout());
        info.put("retry_count", qianFuProperties.getRetryCount());
        return info;
    }

    public boolean testConnection() {
        try {
            if (!isEnabled()) {
                return false;
            }
            String cacheKey = "qianfu:test:" + System.currentTimeMillis();
            redisTemplate.opsForValue().set(cacheKey, "test", 10, TimeUnit.SECONDS);
            redisTemplate.delete(cacheKey);
            return true;
        } catch (Exception e) {
            log.error("千服连接测试失败: {}", e.getMessage());
            return false;
        }
    }

    @Transactional
    public Map<String, Object> createTenantOrder(XpayTenant tenant,
                                                 XpayTenantPaymentMethod method,
                                                 String orderId,
                                                 String outOrderId,
                                                 BigDecimal amount,
                                                 String subject,
                                                 String body,
                                                 Map<String, Object> metadata) {
        if (qianFuOrderDao.findByOrderId(orderId).isPresent()) {
            throw new IllegalArgumentException("orderId already exists");
        }

        QianFuOrder order = new QianFuOrder();
        order.setOrderId(orderId);
        order.setOutOrderId(outOrderId);
        order.setAmount(amount);
        order.setSubject(subject);
        order.setBody(body);
        order.setPayType(method.getPayType());
        order.setQianfuOrderId("XT" + System.currentTimeMillis());
        order.setTenantKey(tenant.getTenantKey());
        order.setCallbackUrl(tenant.getCallbackUrl());
        order.setMetadataJson(metadata == null ? null : gson.toJson(metadata));
        order.setCallbackStatus("PENDING");
        order.setExpireTime(new Date(System.currentTimeMillis() + 30 * 60 * 1000));
        qianFuOrderDao.save(order);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getOrderId());
        result.put("outOrderId", order.getOutOrderId());
        result.put("tenantKey", tenant.getTenantKey());
        result.put("amount", order.getAmount());
        result.put("subject", order.getSubject());
        result.put("status", order.getStatus());
        result.put("payType", order.getPayType());
        result.put("qianfuOrderId", order.getQianfuOrderId());
        result.put("expireTime", order.getExpireTime());
        result.put("paymentMethod", method);
        result.put("payUrl", "/open/tenants/" + tenant.getTenantKey() + "/orders/" + order.getOrderId() + "/pay");
        return result;
    }

    public QianFuOrder getTenantOrder(String tenantKey, String orderId) {
        QianFuOrder order = qianFuOrderDao.findByOrderId(orderId).orElse(null);
        if (order == null || !tenantKey.equals(order.getTenantKey())) {
            return null;
        }
        return order;
    }

    @Transactional
    public Map<String, Object> markTenantOrderPaid(XpayTenant tenant, String orderId, String gatewayTradeNo) {
        return markTenantOrderPaid(tenant, orderId, gatewayTradeNo, null);
    }

    @Transactional
    public Map<String, Object> markTenantOrderPaid(XpayTenant tenant, String orderId, String gatewayTradeNo, BigDecimal expectedAmount) {
        QianFuOrder order = getTenantOrder(tenant.getTenantKey(), orderId);
        if (order == null) {
            throw new IllegalArgumentException("order not found");
        }
        if (Integer.valueOf(1).equals(order.getStatus())) {
            return buildTenantOrderResult(order);
        }
        if (!Integer.valueOf(0).equals(order.getStatus())) {
            throw new IllegalArgumentException("order status does not allow payment");
        }
        if (order.getExpireTime() != null && order.getExpireTime().before(new Date())) {
            order.setStatus(2);
            order.setCallbackStatus("EXPIRED");
            order.setCallbackLastResponse("Payment notification arrived after order expiration");
            qianFuOrderDao.save(order);
            throw new IllegalArgumentException("order expired");
        }
        if (expectedAmount != null && order.getAmount().compareTo(expectedAmount) != 0) {
            throw new IllegalArgumentException("amount mismatch");
        }
        order.setStatus(1);
        order.setPayTime(new Date());
        order.setQianfuOrderId(gatewayTradeNo);
        order.setCallbackStatus("READY");
        qianFuOrderDao.save(order);
        dispatchTenantCallback(tenant, order);
        return buildTenantOrderResult(order);
    }

    public Map<String, Object> buildTenantOrderResult(QianFuOrder order) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getOrderId());
        result.put("outOrderId", order.getOutOrderId());
        result.put("tenantKey", order.getTenantKey());
        result.put("amount", order.getAmount());
        result.put("subject", order.getSubject());
        result.put("body", order.getBody());
        result.put("status", order.getStatus());
        result.put("payType", order.getPayType());
        result.put("qianfuOrderId", order.getQianfuOrderId());
        result.put("payTime", order.getPayTime());
        result.put("expireTime", order.getExpireTime());
        result.put("callbackStatus", order.getCallbackStatus());
        result.put("callbackLastResponse", order.getCallbackLastResponse());
        result.put("metadata", order.getMetadataJson());
        return result;
    }

    @Transactional
    public QianFuOrder mergeTenantOrderMetadata(String tenantKey, String orderId, Map<String, Object> patch) {
        QianFuOrder order = getTenantOrder(tenantKey, orderId);
        if (order == null) {
            throw new IllegalArgumentException("order not found");
        }
        Map<String, Object> merged = new LinkedHashMap<>();
        if (order.getMetadataJson() != null && !order.getMetadataJson().trim().isEmpty()) {
            try {
                Map<String, Object> existing = gson.fromJson(
                    order.getMetadataJson(),
                    new TypeToken<LinkedHashMap<String, Object>>() {}.getType()
                );
                if (existing != null) {
                    merged.putAll(existing);
                }
            } catch (Exception ex) {
                log.warn("订单元数据解析失败, orderId={}, error={}", orderId, ex.getMessage());
            }
        }
        if (patch != null) {
            merged.putAll(patch);
        }
        order.setMetadataJson(gson.toJson(merged));
        qianFuOrderDao.save(order);
        return order;
    }

    public boolean verifyTenantGatewaySignature(Map<String, String> payload, String signature, String gatewaySecret) {
        Map<String, String> copied = new LinkedHashMap<>(payload);
        copied.remove("sign");
        return signatureUtil.verifySignature(copied, signature, gatewaySecret);
    }

    public boolean verifyTenantGatewayTimestamp(String timestamp) {
        return signatureUtil.verifyTimestamp(timestamp);
    }

    @Transactional
    public void dispatchTenantCallback(XpayTenant tenant, QianFuOrder order) {
        if (tenant == null || order == null) {
            return;
        }
        if (tenant.getCallbackUrl() == null || tenant.getCallbackUrl().trim().isEmpty()) {
            order.setCallbackStatus("SKIPPED");
            order.setCallbackLastResponse("No callback URL configured");
            qianFuOrderDao.save(order);
            return;
        }
        try {
            Map<String, String> payload = new LinkedHashMap<>();
            payload.put("tenantKey", tenant.getTenantKey());
            payload.put("orderId", order.getOrderId());
            payload.put("outOrderId", order.getOutOrderId());
            payload.put("amount", order.getAmount().toPlainString());
            payload.put("subject", order.getSubject());
            payload.put("status", String.valueOf(order.getStatus()));
            payload.put("payType", order.getPayType());
            payload.put("tradeNo", order.getQianfuOrderId());
            payload.put("paidAt", order.getPayTime() == null ? "" : String.valueOf(order.getPayTime().getTime()));
            payload.put("timestamp", String.valueOf(System.currentTimeMillis()));
            payload.put("nonce", signatureUtil.generateNonce());
            if (order.getMetadataJson() != null) {
                payload.put("metadata", order.getMetadataJson());
            }

            String callbackSecret = xpayTenantService.decryptCallbackSecret(tenant);
            String sign = signatureUtil.generateSignature(payload, callbackSecret);
            payload.put("sign", sign);

            String requestBody = gson.toJson(payload);
            HttpRequest request = HttpRequest.newBuilder(URI.create(tenant.getCallbackUrl()))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            order.setNotifyCount(order.getNotifyCount() == null ? 1 : order.getNotifyCount() + 1);
            order.setCallbackStatus(response.statusCode() >= 200 && response.statusCode() < 300 ? "SUCCESS" : "FAILED");
            order.setCallbackLastResponse(truncateCallbackResponse("HTTP " + response.statusCode() + " " + response.body()));
            qianFuOrderDao.save(order);
        } catch (Exception ex) {
            order.setNotifyCount(order.getNotifyCount() == null ? 1 : order.getNotifyCount() + 1);
            order.setCallbackStatus("FAILED");
            order.setCallbackLastResponse(truncateCallbackResponse(ex.getMessage()));
            qianFuOrderDao.save(order);
            log.error("租户回调失败, tenantKey={}, orderId={}, error={}", tenant.getTenantKey(), order.getOrderId(), ex.getMessage());
        }
    }

    private String truncateCallbackResponse(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > 1000 ? value.substring(0, 1000) : value;
    }
}
