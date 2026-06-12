package cn.exrick.controller;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.XpayTenantPaymentMethod;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.service.QianFuService;
import cn.exrick.service.XpayOfficialProviderService;
import cn.exrick.service.XpayTenantService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/open/tenants")
public class XpayOpenController {

    @Autowired
    private XpayTenantService xpayTenantService;

    @Autowired
    private QianFuService qianFuService;

    @Autowired
    private XpayOfficialProviderService xpayOfficialProviderService;

    @GetMapping("/{tenantKey}")
    public Result<Map<String, Object>> getTenantProfile(@PathVariable String tenantKey) {
        try {
            XpayTenant tenant = xpayTenantService.requireTenant(tenantKey);
            List<XpayTenantPaymentMethod> methods = xpayTenantService.listEnabledPaymentMethods(tenant.getId());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("tenantKey", tenant.getTenantKey());
            result.put("displayName", tenant.getDisplayName());
            result.put("paymentMethods", methods);
            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(404, ex.getMessage());
        }
    }

    @PostMapping("/{tenantKey}/orders")
    public Result<Map<String, Object>> createOrder(@PathVariable String tenantKey,
                                                   @RequestBody Map<String, Object> payload,
                                                   HttpServletRequest request) {
        try {
            XpayTenant tenant = xpayTenantService.requireTenantAccess(tenantKey, extractBearerToken(request));
            String payType = readRequiredString(payload, "payType");
            Optional<XpayTenantPaymentMethod> methodOpt = xpayTenantService.findEnabledPaymentMethod(tenant.getId(), payType);
            if (!methodOpt.isPresent()) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg(400, "payment method unavailable");
            }
            String orderId = payload.containsKey("orderId") ? String.valueOf(payload.get("orderId")).trim() : UUID.randomUUID().toString().replace("-", "");
            String outOrderId = payload.containsKey("outOrderId") ? String.valueOf(payload.get("outOrderId")).trim() : null;
            String subject = readRequiredString(payload, "subject");
            String body = payload.get("body") == null ? null : String.valueOf(payload.get("body")).trim();
            BigDecimal amount = new BigDecimal(readRequiredString(payload, "amount"));
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = payload.get("metadata") instanceof Map ? (Map<String, Object>) payload.get("metadata") : null;

            Map<String, Object> result = qianFuService.createTenantOrder(tenant, methodOpt.get(), orderId, outOrderId, amount, subject, body, metadata);
            QianFuOrder order = qianFuService.getTenantOrder(tenant.getTenantKey(), orderId);
            xpayOfficialProviderService.createOfficialPayment(tenant, order, methodOpt.get()).ifPresent(officialPayment -> {
                Map<String, Object> providerMeta = new LinkedHashMap<>();
                providerMeta.put("paymentProviderMode", "official");
                providerMeta.put("paymentProvider", officialPayment.getProvider());
                providerMeta.put("paymentQrContent", officialPayment.getQrCodeContent());
                providerMeta.put("paymentPageUrl", officialPayment.getPaymentPageUrl());
                providerMeta.put("officialProviderMeta", officialPayment.getMetadata());
                qianFuService.mergeTenantOrderMetadata(tenant.getTenantKey(), orderId, providerMeta);
                result.put("providerMode", "official");
                result.put("provider", officialPayment.getProvider());
                result.put("paymentQrContent", officialPayment.getQrCodeContent());
                result.put("payUrl", officialPayment.getPaymentPageUrl());
            });

            return new ResultUtil<Map<String, Object>>().setData(result, "订单已创建");
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    @GetMapping("/{tenantKey}/orders/{orderId}")
    public Result<Map<String, Object>> queryOrder(@PathVariable String tenantKey,
                                                  @PathVariable String orderId,
                                                  HttpServletRequest request) {
        try {
            xpayTenantService.requireTenantAccess(tenantKey, extractBearerToken(request));
            QianFuOrder order = qianFuService.getTenantOrder(tenantKey, orderId);
            if (order == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg(404, "order not found");
            }
            return new ResultUtil<Map<String, Object>>().setData(qianFuService.buildTenantOrderResult(order));
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    @PostMapping("/{tenantKey}/orders/{orderId}/paid")
    public Result<Map<String, Object>> markPaid(@PathVariable String tenantKey,
                                                @PathVariable String orderId,
                                                @RequestBody(required = false) Map<String, Object> payload,
                                                HttpServletRequest request) {
        try {
            XpayTenant tenant = xpayTenantService.requireTenantAccess(tenantKey, extractBearerToken(request));
            String tradeNo = payload != null && payload.get("tradeNo") != null
                ? String.valueOf(payload.get("tradeNo")).trim()
                : "MOCK-" + System.currentTimeMillis();
            return new ResultUtil<Map<String, Object>>().setData(
                qianFuService.markTenantOrderPaid(tenant, orderId, tradeNo),
                "订单已标记支付并触发回调"
            );
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    private String readRequiredString(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return text;
    }
}
