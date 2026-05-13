package cn.exrick.common.utils;

import io.jsonwebtoken.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    @Value("${jwt.secret:StarMCAdminSecretKey2026}")
    private String secret;

    @Value("${jwt.expiration:86400}")
    private Long expiration;

    private static String STATIC_SECRET;
    private static Long STATIC_EXPIRATION;

    @PostConstruct
    public void init() {
        STATIC_SECRET = secret;
        STATIC_EXPIRATION = expiration;
    }

    public static String generateToken(String openid, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("openid", openid);
        claims.put("role", role);
        claims.put("type", "admin");

        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + STATIC_EXPIRATION * 1000);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(openid)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(SignatureAlgorithm.HS512, STATIC_SECRET)
                .compact();
    }

    public static Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .setSigningKey(STATIC_SECRET)
                    .parseClaimsJws(token)
                    .getBody();
        } catch (ExpiredJwtException e) {
            log.warn("JWT token 已过期");
            return null;
        } catch (UnsupportedJwtException e) {
            log.warn("不支持的 JWT token");
            return null;
        } catch (MalformedJwtException e) {
            log.warn("JWT token 格式错误");
            return null;
        } catch (SignatureException e) {
            log.warn("JWT token 签名验证失败");
            return null;
        } catch (IllegalArgumentException e) {
            log.warn("JWT token 为空或非法");
            return null;
        }
    }

    public static boolean validateToken(String token) {
        return parseToken(token) != null;
    }

    public static String getOpenidFromToken(String token) {
        Claims claims = parseToken(token);
        return claims != null ? claims.get("openid", String.class) : null;
    }

    public static String getRoleFromToken(String token) {
        Claims claims = parseToken(token);
        return claims != null ? claims.get("role", String.class) : null;
    }

    public static boolean isAdminToken(String token) {
        Claims claims = parseToken(token);
        if (claims == null) return false;
        return "admin".equals(claims.get("type"));
    }
}
