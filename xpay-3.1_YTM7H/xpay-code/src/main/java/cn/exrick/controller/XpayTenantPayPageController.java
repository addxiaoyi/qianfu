package cn.exrick.controller;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.XpayTenantPaymentMethod;
import cn.exrick.service.QianFuService;
import cn.exrick.service.XpayTenantService;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Controller
public class XpayTenantPayPageController {

    private final QianFuService qianFuService;
    private final XpayTenantService xpayTenantService;
    private final Gson gson = new Gson();

    public XpayTenantPayPageController(QianFuService qianFuService, XpayTenantService xpayTenantService) {
        this.qianFuService = qianFuService;
        this.xpayTenantService = xpayTenantService;
    }

    @GetMapping("/open/tenants/{tenantKey}/orders/{orderId}/pay")
    public String payPage(@PathVariable String tenantKey,
                          @PathVariable String orderId,
                          Model model) {
        try {
            XpayTenant tenant = xpayTenantService.requireTenant(tenantKey);
            QianFuOrder order = qianFuService.getTenantOrder(tenant.getTenantKey(), orderId);
            if (order == null) {
                model.addAttribute("message", "订单不存在");
                return "tenant-pay-error";
            }

            Optional<XpayTenantPaymentMethod> method = xpayTenantService.findEnabledPaymentMethod(tenant.getId(), order.getPayType());
            Map<String, Object> metadata = parseMetadata(order.getMetadataJson());
            model.addAttribute("tenant", tenant);
            model.addAttribute("order", order);
            model.addAttribute("paymentMethod", method.orElse(null));
            model.addAttribute("statusText", statusText(order.getStatus()));
            model.addAttribute("paymentQrContent", metadata.get("paymentQrContent"));
            model.addAttribute("paymentProviderMode", metadata.get("paymentProviderMode"));
            model.addAttribute("paymentProvider", metadata.get("paymentProvider"));
            return "tenant-pay";
        } catch (IllegalArgumentException ex) {
            model.addAttribute("message", ex.getMessage());
            return "tenant-pay-error";
        }
    }

    private Map<String, Object> parseMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.trim().isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> parsed = gson.fromJson(
                metadataJson,
                new TypeToken<LinkedHashMap<String, Object>>() {}.getType()
            );
            return parsed == null ? new LinkedHashMap<>() : parsed;
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    private String statusText(Integer status) {
        if (Integer.valueOf(1).equals(status)) {
            return "已支付";
        }
        if (Integer.valueOf(2).equals(status)) {
            return "已关闭";
        }
        return "待支付";
    }
}
