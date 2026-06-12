package cn.exrick.controller;

import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.service.QianFuService;
import cn.exrick.service.XpayTenantService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/open/gateway")
public class XpayGatewayNotifyController {

    private final XpayTenantService xpayTenantService;
    private final QianFuService qianFuService;

    @Value("${xpay.gateway.notify-secret:${qianfu.secret-key}}")
    private String gatewayNotifySecret;

    public XpayGatewayNotifyController(XpayTenantService xpayTenantService, QianFuService qianFuService) {
        this.xpayTenantService = xpayTenantService;
        this.qianFuService = qianFuService;
    }

    @PostMapping("/tenants/{tenantKey}/orders/{orderId}/notify")
    public Result<Map<String, Object>> notifyOrderPaid(@PathVariable String tenantKey,
                                                       @PathVariable String orderId,
                                                       @RequestBody Map<String, Object> payload) {
        try {
            String sign = payload.get("sign") == null ? null : String.valueOf(payload.get("sign"));
            Map<String, String> signedFields = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : payload.entrySet()) {
                signedFields.put(entry.getKey(), entry.getValue() == null ? "" : String.valueOf(entry.getValue()));
            }
            if (!qianFuService.verifyTenantGatewaySignature(signedFields, sign, gatewayNotifySecret)) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg(401, "invalid gateway signature");
            }
            if (!qianFuService.verifyTenantGatewayTimestamp(signedFields.get("timestamp"))) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg(400, "gateway timestamp expired");
            }

            String status = payload.get("status") == null ? "" : String.valueOf(payload.get("status")).trim().toUpperCase();
            if (!"SUCCESS".equals(status)) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg(400, "unsupported gateway status");
            }

            XpayTenant tenant = xpayTenantService.requireTenant(tenantKey);
            BigDecimal amount = new BigDecimal(requiredPayloadValue(payload, "amount"));
            String tradeNo = payload.get("tradeNo") == null ? "GATEWAY-" + System.currentTimeMillis() : String.valueOf(payload.get("tradeNo"));
            Map<String, Object> result = qianFuService.markTenantOrderPaid(tenant, orderId, tradeNo, amount);
            result.put("gatewayAccepted", true);
            return new ResultUtil<Map<String, Object>>().setData(result, "gateway notify accepted");
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    private String requiredPayloadValue(Map<String, Object> payload, String key) {
        String value = payload.get(key) == null ? "" : String.valueOf(payload.get(key)).trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }
}
