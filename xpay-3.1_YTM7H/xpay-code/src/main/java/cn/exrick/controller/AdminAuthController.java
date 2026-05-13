package cn.exrick.controller;

import cn.exrick.bean.AdminUser;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.JwtUtil;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.service.AdminAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin/auth")
public class AdminAuthController {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthController.class);

    @Autowired
    private AdminAuthService adminAuthService;

    @GetMapping("/qr/generate")
    public Result<Map<String, Object>> generateQrCode() {
        try {
            Map<String, String> qrData = adminAuthService.generateQrCode();

            Map<String, Object> result = new HashMap<>();
            result.put("qrToken", qrData.get("qrToken"));
            result.put("sceneCode", qrData.get("sceneCode"));

            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("生成二维码失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("生成二维码失败");
        }
    }

    @GetMapping("/qr/status")
    public Result<Map<String, Object>> checkQrStatus(@RequestParam String qrToken) {
        try {
            Map<String, Object> status = adminAuthService.checkQrStatus(qrToken);
            return new ResultUtil<Map<String, Object>>().setData(status);
        } catch (Exception e) {
            log.error("检查二维码状态失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("检查状态失败");
        }
    }

    @PostMapping("/qr/scan")
    public Result<Map<String, Object>> scanQrCode(@RequestBody Map<String, String> params) {
        try {
            String sceneCode = params.get("sceneCode");
            String openid = params.get("openid");
            String nickname = params.get("nickname");
            String avatarUrl = params.get("avatarUrl");

            if (sceneCode == null || openid == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("参数缺失");
            }

            boolean success = adminAuthService.scanQrCode(sceneCode, openid, nickname, avatarUrl);

            Map<String, Object> result = new HashMap<>();
            result.put("success", success);

            if (success) {
                return new ResultUtil<Map<String, Object>>().setData(result);
            } else {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("扫码失败，二维码可能已过期");
            }
        } catch (Exception e) {
            log.error("扫码处理失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("扫码处理失败");
        }
    }

    @PostMapping("/qr/confirm")
    public Result<Map<String, Object>> confirmLogin(@RequestBody Map<String, String> params) {
        try {
            String sceneCode = params.get("sceneCode");
            String openid = params.get("openid");

            if (sceneCode == null || openid == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("参数缺失");
            }

            boolean success = adminAuthService.confirmQrLogin(sceneCode, openid);

            Map<String, Object> result = new HashMap<>();
            result.put("success", success);

            if (success) {
                return new ResultUtil<Map<String, Object>>().setData(result);
            } else {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("确认登录失败");
            }
        } catch (Exception e) {
            log.error("确认登录失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("确认登录失败");
        }
    }

    @GetMapping("/check")
    public Result<Map<String, Object>> checkAuth(HttpServletRequest request) {
        try {
            String token = extractToken(request);

            if (token == null || !JwtUtil.validateToken(token)) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("未登录或登录已过期");
            }

            if (!JwtUtil.isAdminToken(token)) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("无权访问");
            }

            String openid = JwtUtil.getOpenidFromToken(token);
            AdminUser admin = adminAuthService.getAdminByOpenid(openid);

            if (admin == null || !admin.getEnabled()) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("管理员账号已禁用");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("authenticated", true);
            result.put("openid", openid);
            result.put("nickname", admin.getNickname());
            result.put("role", admin.getRole());

            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("验证登录状态失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("验证失败");
        }
    }

    @PostMapping("/logout")
    public Result<Map<String, Object>> logout(HttpServletRequest request) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "已退出登录");
        return new ResultUtil<Map<String, Object>>().setData(result);
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
