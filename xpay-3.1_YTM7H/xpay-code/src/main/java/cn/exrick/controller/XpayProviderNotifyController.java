package cn.exrick.controller;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.common.utils.StringUtils;
import cn.exrick.common.utils.WXPayUtil;
import cn.exrick.service.QianFuService;
import cn.exrick.service.XpayOfficialProviderService;
import cn.exrick.service.XpayTenantService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/open/provider")
public class XpayProviderNotifyController {

    private final QianFuService qianFuService;
    private final XpayTenantService xpayTenantService;
    private final XpayOfficialProviderService xpayOfficialProviderService;

    @Value("${xpay.provider.alipay.verify-enabled:false}")
    private boolean alipayVerifyEnabled;

    @Value("${xpay.provider.alipay.public-key:}")
    private String alipayPublicKey;

    @Value("${xpay.provider.wechat.verify-enabled:false}")
    private boolean wechatVerifyEnabled;

    @Value("${xpay.provider.wechat.api-key:}")
    private String wechatApiKey;

    public XpayProviderNotifyController(QianFuService qianFuService,
                                        XpayTenantService xpayTenantService,
                                        XpayOfficialProviderService xpayOfficialProviderService) {
        this.qianFuService = qianFuService;
        this.xpayTenantService = xpayTenantService;
        this.xpayOfficialProviderService = xpayOfficialProviderService;
    }

    @PostMapping("/alipay/tenants/{tenantKey}/orders/{orderId}/notify")
    public Result<Map<String, Object>> alipayNotify(@PathVariable String tenantKey,
                                                    @PathVariable String orderId,
                                                    @RequestParam Map<String, String> form) {
        try {
            String tradeStatus = form.get("trade_status");
            if (!"TRADE_SUCCESS".equals(tradeStatus) && !"TRADE_FINISHED".equals(tradeStatus)) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg(400, "unsupported trade status");
            }
            if (alipayVerifyEnabled) {
                if (StringUtils.isBlank(alipayPublicKey) || !xpayOfficialProviderService.isAlipayVerifyConfigured()) {
                    return new ResultUtil<Map<String, Object>>().setErrorMsg(500, "alipay verify enabled but public key missing");
                }
                if (!xpayOfficialProviderService.verifyAlipayNotify(form)) {
                    return new ResultUtil<Map<String, Object>>().setErrorMsg(401, "invalid alipay sign");
                }
            }
            XpayTenant tenant = xpayTenantService.requireTenant(tenantKey);
            String tradeNo = form.getOrDefault("trade_no", "ALIPAY-" + System.currentTimeMillis());
            BigDecimal amount = new BigDecimal(requiredFormValue(form, "total_amount"));
            Map<String, Object> result = qianFuService.markTenantOrderPaid(tenant, orderId, tradeNo, amount);
            result.put("provider", "alipay");
            result.put("providerPayload", new LinkedHashMap<>(form));
            return new ResultUtil<Map<String, Object>>().setData(result, "alipay notify accepted");
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    @PostMapping(value = "/wechat/tenants/{tenantKey}/orders/{orderId}/notify", produces = "application/xml;charset=UTF-8")
    public String wechatNotify(@PathVariable String tenantKey,
                               @PathVariable String orderId,
                               HttpServletRequest request) {
        try {
            StringBuilder xml = new StringBuilder();
            BufferedReader reader = request.getReader();
            String line;
            while ((line = reader.readLine()) != null) {
                xml.append(line);
            }
            Map<String, String> map = WXPayUtil.xmlToMap(xml.toString());
            if (map == null || !"SUCCESS".equals(map.get("result_code"))) {
                return failXml("invalid result");
            }
            if (wechatVerifyEnabled) {
                if (StringUtils.isBlank(wechatApiKey) || !xpayOfficialProviderService.isWechatVerifyConfigured()) {
                    return failXml("wechat api key missing");
                }
                if (!xpayOfficialProviderService.verifyWechatNotify(map)) {
                    return failXml("invalid wechat sign");
                }
            }
            XpayTenant tenant = xpayTenantService.requireTenant(tenantKey);
            String tradeNo = map.getOrDefault("transaction_id", "WECHAT-" + System.currentTimeMillis());
            BigDecimal amount = new BigDecimal(requiredFormValue(map, "total_fee")).divide(new BigDecimal("100"));
            qianFuService.markTenantOrderPaid(tenant, orderId, tradeNo, amount);
            return successXml();
        } catch (Exception ex) {
            return failXml(ex.getMessage());
        }
    }

    @GetMapping("/orders/{orderId}")
    public Result<Map<String, Object>> resolveOrder(@PathVariable String orderId) {
        QianFuOrder order = qianFuService.getOrder(orderId);
        if (order == null) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(404, "order not found");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getOrderId());
        result.put("tenantKey", order.getTenantKey());
        result.put("payType", order.getPayType());
        result.put("status", order.getStatus());
        result.put("alipayNotifyUrl", "/open/provider/alipay/tenants/" + order.getTenantKey() + "/orders/" + order.getOrderId() + "/notify");
        result.put("wechatNotifyUrl", "/open/provider/wechat/tenants/" + order.getTenantKey() + "/orders/" + order.getOrderId() + "/notify");
        return new ResultUtil<Map<String, Object>>().setData(result);
    }

    private String successXml() {
        return "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>";
    }

    private String failXml(String message) {
        String safe = message == null ? "FAIL" : message;
        return "<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[" + safe + "]]></return_msg></xml>";
    }

    private String requiredFormValue(Map<String, String> form, String key) {
        String value = form.get(key) == null ? "" : form.get(key).trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }
}
