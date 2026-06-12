package cn.exrick.service;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.XpayTenantPaymentMethod;
import cn.exrick.common.utils.StringUtils;
import cn.exrick.common.utils.WXPayUtil;
import com.alipay.api.AlipayClient;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.internal.util.AlipaySignature;
import com.alipay.api.request.AlipayTradePrecreateRequest;
import com.alipay.api.response.AlipayTradePrecreateResponse;
import com.google.gson.Gson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class XpayOfficialProviderService {

    private static final Logger log = LoggerFactory.getLogger(XpayOfficialProviderService.class);

    @Value("${server.url}")
    private String serverUrl;

    @Value("${xpay.provider.alipay.enabled:false}")
    private boolean alipayEnabled;

    @Value("${xpay.provider.alipay.app-id:}")
    private String alipayAppId;

    @Value("${xpay.provider.alipay.private-key:}")
    private String alipayPrivateKey;

    @Value("${xpay.provider.alipay.public-key:}")
    private String alipayPublicKey;

    @Value("${xpay.provider.alipay.gateway-url:https://openapi.alipay.com/gateway.do}")
    private String alipayGatewayUrl;

    @Value("${xpay.provider.alipay.charset:UTF-8}")
    private String alipayCharset;

    @Value("${xpay.provider.alipay.sign-type:RSA2}")
    private String alipaySignType;

    @Value("${xpay.provider.wechat.enabled:false}")
    private boolean wechatEnabled;

    @Value("${xpay.provider.wechat.api-key:}")
    private String wechatApiKey;

    @Value("${xpay.provider.wechat.mch-id:}")
    private String wechatMchId;

    @Value("${xpay.provider.wechat.app-id:}")
    private String wechatAppId;

    @Value("${xpay.provider.wechat.unified-order-url:https://api.mch.weixin.qq.com/pay/unifiedorder}")
    private String wechatUnifiedOrderUrl;

    @Value("${xpay.provider.wechat.spbill-create-ip:127.0.0.1}")
    private String wechatSpbillCreateIp;

    private final Gson gson = new Gson();

    public Optional<OfficialPaymentPayload> createOfficialPayment(XpayTenant tenant,
                                                                  QianFuOrder order,
                                                                  XpayTenantPaymentMethod method) {
        if (tenant == null || order == null || method == null) {
            return Optional.empty();
        }
        try {
            if ("alipay".equals(method.getPayType()) && isAlipayConfigured()) {
                return Optional.of(createAlipayPayload(tenant, order));
            }
            if ("wechat".equals(method.getPayType()) && isWechatConfigured()) {
                return Optional.of(createWechatPayload(tenant, order));
            }
            return Optional.empty();
        } catch (Exception ex) {
            log.error("官方支付下单失败, tenantKey={}, orderId={}, payType={}, error={}",
                tenant.getTenantKey(), order.getOrderId(), method.getPayType(), ex.getMessage());
            return Optional.empty();
        }
    }

    public boolean verifyAlipayNotify(Map<String, String> form) {
        if (!isAlipayVerifyConfigured() || form == null || StringUtils.isBlank(form.get("sign"))) {
            return false;
        }
        try {
            return AlipaySignature.rsaCheckV1(form, alipayPublicKey, alipayCharset, alipaySignType);
        } catch (Exception ex) {
            log.warn("支付宝回调验签失败: {}", ex.getMessage());
            return false;
        }
    }

    public boolean verifyWechatNotify(Map<String, String> form) {
        if (!isWechatVerifyConfigured() || form == null || StringUtils.isBlank(form.get("sign"))) {
            return false;
        }
        String providedSign = form.get("sign");
        StringBuilder signBase = new StringBuilder();
        form.keySet().stream()
            .filter(key -> !"sign".equals(key))
            .sorted()
            .forEach(key -> {
                String value = form.get(key);
                if (StringUtils.isBlank(value)) {
                    return;
                }
                if (signBase.length() > 0) {
                    signBase.append("&");
                }
                signBase.append(key).append("=").append(value);
            });
        signBase.append("&key=").append(wechatApiKey);
        String expected = WXPayUtil.MD5(signBase.toString());
        return expected != null && expected.equalsIgnoreCase(providedSign);
    }

    public boolean isAlipayVerifyConfigured() {
        return alipayEnabled && StringUtils.isNotBlank(alipayPublicKey);
    }

    public boolean isWechatVerifyConfigured() {
        return wechatEnabled && StringUtils.isNotBlank(wechatApiKey) && StringUtils.isNotBlank(wechatMchId) && StringUtils.isNotBlank(wechatAppId);
    }

    public Map<String, Object> buildStatusSnapshot() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("publicUrl", serverUrl);
        result.put("alipayEnabled", alipayEnabled);
        result.put("alipayConfigured", isAlipayConfigured());
        result.put("alipayVerifyConfigured", isAlipayVerifyConfigured());
        result.put("wechatEnabled", wechatEnabled);
        result.put("wechatConfigured", isWechatConfigured());
        result.put("wechatVerifyConfigured", isWechatVerifyConfigured());
        return result;
    }

    private boolean isAlipayConfigured() {
        return alipayEnabled
            && StringUtils.isNotBlank(alipayAppId)
            && StringUtils.isNotBlank(alipayPrivateKey)
            && StringUtils.isNotBlank(alipayPublicKey);
    }

    private boolean isWechatConfigured() {
        return wechatEnabled
            && StringUtils.isNotBlank(wechatApiKey)
            && StringUtils.isNotBlank(wechatMchId)
            && StringUtils.isNotBlank(wechatAppId);
    }

    private OfficialPaymentPayload createAlipayPayload(XpayTenant tenant, QianFuOrder order) throws Exception {
        AlipayClient alipayClient = new DefaultAlipayClient(
            alipayGatewayUrl,
            alipayAppId,
            alipayPrivateKey,
            "json",
            alipayCharset,
            alipayPublicKey,
            alipaySignType
        );

        AlipayTradePrecreateRequest request = new AlipayTradePrecreateRequest();
        Map<String, Object> biz = new LinkedHashMap<>();
        biz.put("out_trade_no", order.getOrderId());
        biz.put("total_amount", order.getAmount().toPlainString());
        biz.put("subject", defaultSubject(order, tenant));
        if (StringUtils.isNotBlank(order.getBody())) {
            biz.put("body", order.getBody());
        }
        request.setBizContent(gson.toJson(biz));
        request.setNotifyUrl(buildAlipayNotifyUrl(tenant.getTenantKey(), order.getOrderId()));

        AlipayTradePrecreateResponse response = alipayClient.execute(request);
        if (response == null || !response.isSuccess() || StringUtils.isBlank(response.getQrCode())) {
            throw new IllegalStateException(response == null ? "empty alipay response" : response.getSubMsg());
        }

        Map<String, Object> providerMeta = new LinkedHashMap<>();
        providerMeta.put("mode", "official");
        providerMeta.put("provider", "alipay");
        providerMeta.put("notifyUrl", buildAlipayNotifyUrl(tenant.getTenantKey(), order.getOrderId()));
        providerMeta.put("responseBody", response.getBody());

        return new OfficialPaymentPayload(
            "alipay",
            response.getQrCode(),
            buildPayPageUrl(tenant.getTenantKey(), order.getOrderId()),
            providerMeta
        );
    }

    private OfficialPaymentPayload createWechatPayload(XpayTenant tenant, QianFuOrder order) {
        String nonceStr = String.valueOf(System.currentTimeMillis());
        BigDecimal totalFeeDecimal = order.getAmount().multiply(new BigDecimal("100")).setScale(0);
        String totalFee = totalFeeDecimal.toPlainString();
        String notifyUrl = buildWechatNotifyUrl(tenant.getTenantKey(), order.getOrderId());

        String signBase =
            "appid=" + wechatAppId +
            "&body=" + defaultSubject(order, tenant) +
            "&mch_id=" + wechatMchId +
            "&nonce_str=" + nonceStr +
            "&notify_url=" + notifyUrl +
            "&out_trade_no=" + order.getOrderId() +
            "&spbill_create_ip=" + wechatSpbillCreateIp +
            "&total_fee=" + totalFee +
            "&trade_type=NATIVE" +
            "&key=" + wechatApiKey;
        String sign = WXPayUtil.MD5(signBase);

        String body = "<xml>\n" +
            "   <appid>" + wechatAppId + "</appid>\n" +
            "   <mch_id>" + wechatMchId + "</mch_id>\n" +
            "   <nonce_str>" + nonceStr + "</nonce_str>\n" +
            "   <body>" + defaultSubject(order, tenant) + "</body>\n" +
            "   <out_trade_no>" + order.getOrderId() + "</out_trade_no>\n" +
            "   <total_fee>" + totalFee + "</total_fee>\n" +
            "   <spbill_create_ip>" + wechatSpbillCreateIp + "</spbill_create_ip>\n" +
            "   <notify_url>" + notifyUrl + "</notify_url>\n" +
            "   <trade_type>NATIVE</trade_type>\n" +
            "   <sign>" + sign + "</sign>\n" +
            "</xml>";

        RestTemplate restTemplate = new RestTemplate();
        restTemplate.getMessageConverters().set(1, new StringHttpMessageConverter(StandardCharsets.UTF_8));
        ResponseEntity<String> response = restTemplate.postForEntity(wechatUnifiedOrderUrl, body, String.class);
        Map<String, String> map = WXPayUtil.xmlToMap(response.getBody());
        if (map == null || !"SUCCESS".equals(map.get("return_code")) || StringUtils.isBlank(map.get("code_url"))) {
            throw new IllegalStateException(map == null ? "invalid wechat xml" : map.get("return_msg"));
        }

        Map<String, Object> providerMeta = new LinkedHashMap<>();
        providerMeta.put("mode", "official");
        providerMeta.put("provider", "wechat");
        providerMeta.put("notifyUrl", notifyUrl);
        providerMeta.put("nonceStr", nonceStr);
        providerMeta.put("codeUrl", map.get("code_url"));

        return new OfficialPaymentPayload(
            "wechat",
            map.get("code_url"),
            buildPayPageUrl(tenant.getTenantKey(), order.getOrderId()),
            providerMeta
        );
    }

    private String defaultSubject(QianFuOrder order, XpayTenant tenant) {
        if (StringUtils.isNotBlank(order.getSubject())) {
            return order.getSubject();
        }
        return tenant.getDisplayName() + " payment";
    }

    private String buildPayPageUrl(String tenantKey, String orderId) {
        return serverUrl.replaceAll("/+$", "") + "/open/tenants/" + tenantKey + "/orders/" + orderId + "/pay";
    }

    private String buildAlipayNotifyUrl(String tenantKey, String orderId) {
        return serverUrl.replaceAll("/+$", "") + "/open/provider/alipay/tenants/" + tenantKey + "/orders/" + orderId + "/notify";
    }

    private String buildWechatNotifyUrl(String tenantKey, String orderId) {
        return serverUrl.replaceAll("/+$", "") + "/open/provider/wechat/tenants/" + tenantKey + "/orders/" + orderId + "/notify";
    }

    public static class OfficialPaymentPayload {
        private final String provider;
        private final String qrCodeContent;
        private final String paymentPageUrl;
        private final Map<String, Object> metadata;

        public OfficialPaymentPayload(String provider, String qrCodeContent, String paymentPageUrl, Map<String, Object> metadata) {
            this.provider = provider;
            this.qrCodeContent = qrCodeContent;
            this.paymentPageUrl = paymentPageUrl;
            this.metadata = metadata;
        }

        public String getProvider() {
            return provider;
        }

        public String getQrCodeContent() {
            return qrCodeContent;
        }

        public String getPaymentPageUrl() {
            return paymentPageUrl;
        }

        public Map<String, Object> getMetadata() {
            return metadata;
        }
    }
}
