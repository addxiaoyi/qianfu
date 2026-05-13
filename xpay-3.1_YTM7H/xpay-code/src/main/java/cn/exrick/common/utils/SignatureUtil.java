package cn.exrick.common.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;
import java.util.TreeMap;

@Component
public class SignatureUtil {

    private static final Logger log = LoggerFactory.getLogger(SignatureUtil.class);
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final long TIMESTAMP_TOLERANCE = 5 * 60 * 1000L;

    public String generateSignature(Map<String, String> params, String secretKey) {
        try {
            String data = buildSignatureString(params);
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                secretKey.getBytes(StandardCharsets.UTF_8),
                HMAC_SHA256
            );
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hmacBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("签名生成失败: {}", e.getMessage());
            return null;
        }
    }

    public String buildSignatureString(Map<String, String> params) {
        TreeMap<String, String> sortedParams = new TreeMap<>(params);
        StringBuilder sb = new StringBuilder();
        sortedParams.forEach((key, value) -> {
            if (sb.length() > 0) {
                sb.append("&");
            }
            sb.append(key).append("=").append(value != null ? value : "");
        });
        return sb.toString();
    }

    public boolean verifySignature(Map<String, String> params, String signature, String secretKey) {
        String expectedSignature = generateSignature(params, secretKey);
        if (expectedSignature == null || signature == null) {
            return false;
        }
        return expectedSignature.equals(signature);
    }

    public boolean verifyTimestamp(String timestamp) {
        try {
            long requestTime = Long.parseLong(timestamp);
            long currentTime = System.currentTimeMillis();
            return Math.abs(currentTime - requestTime) <= TIMESTAMP_TOLERANCE;
        } catch (NumberFormatException e) {
            log.error("时间戳格式错误: {}", timestamp);
            return false;
        }
    }

    public boolean verifySignatureWithTimestamp(Map<String, String> params, String signature, String timestamp, String secretKey) {
        if (!verifyTimestamp(timestamp)) {
            log.warn("时间戳验证失败: {}", timestamp);
            return false;
        }
        return verifySignature(params, signature, secretKey);
    }

    public String generateNonce() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }
}