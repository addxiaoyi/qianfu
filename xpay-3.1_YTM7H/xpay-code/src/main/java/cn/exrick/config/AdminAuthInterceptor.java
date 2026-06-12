package cn.exrick.config;

import cn.exrick.bean.AdminUser;
import cn.exrick.common.utils.JwtUtil;
import cn.exrick.service.AdminAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    @Autowired
    private AdminAuthService adminAuthService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String requestUri = request.getRequestURI();

        if (requestUri.startsWith("/admin/auth/")) {
            return true;
        }

        if ("/admin/login".equals(requestUri)) {
            return true;
        }

        if (!requestUri.startsWith("/admin/")) {
            return true;
        }

        String token = extractToken(request);

        if (token == null) {
            writeErrorResponse(response, 401, "未提供认证令牌");
            return false;
        }

        if (!JwtUtil.validateToken(token)) {
            writeErrorResponse(response, 401, "登录已过期，请重新登录");
            return false;
        }

        if (!JwtUtil.isAdminToken(token)) {
            writeErrorResponse(response, 403, "无权访问管理后台");
            return false;
        }

        String openid = JwtUtil.getOpenidFromToken(token);
        AdminUser admin = adminAuthService.getAdminByOpenid(openid);

        if (admin == null) {
            writeErrorResponse(response, 401, "管理员账号不存在");
            return false;
        }

        if (!admin.getEnabled()) {
            writeErrorResponse(response, 403, "管理员账号已禁用");
            return false;
        }

        request.setAttribute("adminOpenid", openid);
        request.setAttribute("adminRole", admin.getRole());

        return true;
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private void writeErrorResponse(HttpServletResponse response, int code, String message) throws Exception {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(code);

        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("message", message);
        result.put("code", code);

        response.getWriter().write(objectMapper.writeValueAsString(result));
    }
}
