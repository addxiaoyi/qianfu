package cn.exrick.controller;

import cn.exrick.bean.AdminUser;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.service.AdminAuthService;
import cn.exrick.service.LocalAdminService;
import cn.exrick.service.XpayTenantService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminTenantController {

    @Autowired
    private AdminAuthService adminAuthService;

    @Autowired
    private LocalAdminService localAdminService;

    @Autowired
    private XpayTenantService tenantService;

    @PostMapping("/local-admins")
    public Result<Map<String, Object>> createLocalAdmin(HttpServletRequest request, @RequestBody Map<String, String> payload) {
        AdminUser actor = currentAdmin(request);
        if (!localAdminService.isLocalSuperAdmin(actor)) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(403, "仅超级管理员可创建账号");
        }
        try {
            LocalAdminService.CreatedLocalAdmin created = localAdminService.createManagedAdmin(
                actor.getOpenid(),
                payload.get("username"),
                payload.get("nickname")
            );
            Map<String, Object> result = new HashMap<>();
            result.put("id", created.getAdminUser().getId());
            result.put("username", created.getUsername());
            result.put("password", created.getGeneratedPassword());
            result.put("mustResetPassword", true);
            result.put("role", created.getAdminUser().getRole());
            return new ResultUtil<Map<String, Object>>().setData(result, "账号已创建，请立即保存密码");
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    @GetMapping("/tenants")
    public Result<List<Map<String, Object>>> listTenants(HttpServletRequest request) {
        AdminUser actor = currentAdmin(request);
        boolean superAdmin = localAdminService.isLocalSuperAdmin(actor);
        return new ResultUtil<List<Map<String, Object>>>().setData(
            tenantService.listTenants(actor.getId(), superAdmin)
        );
    }

    @PostMapping("/tenants")
    public Result<Map<String, Object>> createTenant(HttpServletRequest request, @RequestBody Map<String, Object> payload) {
        AdminUser actor = currentAdmin(request);
        try {
            XpayTenantService.CreatedTenant created = tenantService.createTenant(actor.getId(), payload);
            Map<String, Object> result = new HashMap<>();
            result.put("tenant", created.getTenant());
            result.put("paymentMethods", created.getPaymentMethods());
            result.put("accessToken", created.getAccessToken());
            result.put("callbackSecret", created.getCallbackSecret());
            return new ResultUtil<Map<String, Object>>().setData(result, "租户已创建，请立即保存密钥");
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, Object>>().setErrorMsg(400, ex.getMessage());
        }
    }

    @PostMapping("/tenants/{tenantId}/rotate-secrets")
    public Result<Map<String, String>> rotateTenantSecrets(HttpServletRequest request, @PathVariable Long tenantId) {
        currentAdmin(request);
        try {
            return new ResultUtil<Map<String, String>>().setData(
                tenantService.rotateSecrets(tenantId),
                "密钥已轮换，请立即保存新值"
            );
        } catch (IllegalArgumentException ex) {
            return new ResultUtil<Map<String, String>>().setErrorMsg(400, ex.getMessage());
        }
    }

    @PutMapping("/tenants/{tenantId}")
    public Result<Map<String, Object>> updateTenant(HttpServletRequest request,
                                                    @PathVariable Long tenantId,
                                                    @RequestBody Map<String, Object> payload) {
        AdminUser actor = currentAdmin(request);
        boolean superAdmin = localAdminService.isLocalSuperAdmin(actor);
        try {
            return new ResultUtil<Map<String, Object>>().setData(
                tenantService.updateTenant(tenantId, actor.getId(), superAdmin, payload),
                "租户配置已更新"
            );
        } catch (IllegalArgumentException ex) {
            int code = "forbidden".equals(ex.getMessage()) ? 403 : 400;
            return new ResultUtil<Map<String, Object>>().setErrorMsg(code, ex.getMessage());
        }
    }

    @PostMapping("/tenants/{tenantId}/payment-methods/{payType}/qr")
    public Result<Map<String, Object>> uploadTenantPaymentQr(HttpServletRequest request,
                                                             @PathVariable Long tenantId,
                                                             @PathVariable String payType,
                                                             @RequestParam("file") MultipartFile file) {
        AdminUser actor = currentAdmin(request);
        boolean superAdmin = localAdminService.isLocalSuperAdmin(actor);
        try {
            return new ResultUtil<Map<String, Object>>().setData(
                tenantService.uploadPaymentQr(tenantId, actor.getId(), superAdmin, payType, file),
                "二维码已上传"
            );
        } catch (IllegalArgumentException ex) {
            int code = "forbidden".equals(ex.getMessage()) ? 403 : 400;
            return new ResultUtil<Map<String, Object>>().setErrorMsg(code, ex.getMessage());
        }
    }

    private AdminUser currentAdmin(HttpServletRequest request) {
        String openid = String.valueOf(request.getAttribute("adminOpenid"));
        return adminAuthService.getAdminByOpenid(openid);
    }
}
