package cn.exrick.service;

import cn.exrick.bean.XpayTenant;
import cn.exrick.bean.XpayTenantPaymentMethod;
import cn.exrick.common.utils.SecretCryptoUtil;
import cn.exrick.dao.XpayTenantDao;
import cn.exrick.dao.XpayTenantPaymentMethodDao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;

@Service
public class XpayTenantService {

    @Autowired
    private XpayTenantDao xpayTenantDao;

    @Autowired
    private XpayTenantPaymentMethodDao paymentMethodDao;

    @Value("${xpay.secret.encryption-key:${jwt.secret}}")
    private String encryptionKey;

    @Value("${user.dir}")
    private String workingDirectory;

    public CreatedTenant createTenant(Long ownerAdminUserId, Map<String, Object> payload) {
        String tenantKey = normalizeTenantKey(String.valueOf(payload.get("tenantKey")));
        if (!StringUtils.hasText(tenantKey)) {
            throw new IllegalArgumentException("tenantKey is required");
        }
        if (xpayTenantDao.existsByTenantKey(tenantKey)) {
            throw new IllegalArgumentException("tenantKey already exists");
        }

        XpayTenant tenant = new XpayTenant();
        tenant.setTenantKey(tenantKey);
        tenant.setDisplayName(StringUtils.hasText((String) payload.get("displayName")) ? String.valueOf(payload.get("displayName")).trim() : tenantKey);
        tenant.setOwnerAdminUserId(ownerAdminUserId);
        tenant.setCallbackUrl(normalizeOptionalText(payload.get("callbackUrl")));

        String callbackSecret = SecretCryptoUtil.randomToken(32);
        String accessToken = SecretCryptoUtil.randomToken(32);
        tenant.setCallbackSecretHash(SecretCryptoUtil.sha256(callbackSecret));
        tenant.setAccessTokenHash(SecretCryptoUtil.sha256(accessToken));
        tenant.setCallbackSecretCipher(SecretCryptoUtil.encrypt(callbackSecret, encryptionKey));
        tenant.setAccessTokenCipher(SecretCryptoUtil.encrypt(accessToken, encryptionKey));
        tenant = xpayTenantDao.save(tenant);

        syncPaymentMethods(tenant.getId(), payload.get("paymentMethods"));
        return new CreatedTenant(tenant, accessToken, callbackSecret, paymentMethodDao.findByTenantIdOrderByIdAsc(tenant.getId()));
    }

    public List<Map<String, Object>> listTenants(Long requesterAdminUserId, boolean superAdmin) {
        List<XpayTenant> tenants = superAdmin
            ? xpayTenantDao.findAll()
            : xpayTenantDao.findByOwnerAdminUserIdOrderByIdDesc(requesterAdminUserId);

        List<Map<String, Object>> result = new ArrayList<>();
        for (XpayTenant tenant : tenants) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", tenant.getId());
            item.put("tenantKey", tenant.getTenantKey());
            item.put("displayName", tenant.getDisplayName());
            item.put("ownerAdminUserId", tenant.getOwnerAdminUserId());
            item.put("callbackUrl", tenant.getCallbackUrl());
            item.put("status", tenant.getStatus());
            item.put("paymentMethods", paymentMethodDao.findByTenantIdOrderByIdAsc(tenant.getId()));
            item.put("createdAt", tenant.getCreatedAt());
            item.put("updatedAt", tenant.getUpdatedAt());
            result.add(item);
        }
        return result;
    }

    public Map<String, String> rotateSecrets(Long tenantId) {
        XpayTenant tenant = xpayTenantDao.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        String callbackSecret = SecretCryptoUtil.randomToken(32);
        String accessToken = SecretCryptoUtil.randomToken(32);
        tenant.setCallbackSecretHash(SecretCryptoUtil.sha256(callbackSecret));
        tenant.setAccessTokenHash(SecretCryptoUtil.sha256(accessToken));
        tenant.setCallbackSecretCipher(SecretCryptoUtil.encrypt(callbackSecret, encryptionKey));
        tenant.setAccessTokenCipher(SecretCryptoUtil.encrypt(accessToken, encryptionKey));
        xpayTenantDao.save(tenant);

        Map<String, String> result = new LinkedHashMap<>();
        result.put("accessToken", accessToken);
        result.put("callbackSecret", callbackSecret);
        return result;
    }

    public Map<String, Object> updateTenant(Long tenantId, Long requesterAdminUserId, boolean superAdmin, Map<String, Object> payload) {
        XpayTenant tenant = xpayTenantDao.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        if (!superAdmin && !tenant.getOwnerAdminUserId().equals(requesterAdminUserId)) {
            throw new IllegalArgumentException("forbidden");
        }

        String displayName = normalizeOptionalText(payload.get("displayName"));
        if (displayName != null) {
            tenant.setDisplayName(displayName);
        }
        if (payload.containsKey("callbackUrl")) {
            tenant.setCallbackUrl(normalizeOptionalText(payload.get("callbackUrl")));
        }
        if (payload.containsKey("status")) {
            tenant.setStatus(Integer.parseInt(String.valueOf(payload.get("status"))));
        }
        xpayTenantDao.save(tenant);

        if (payload.containsKey("paymentMethods")) {
            syncPaymentMethods(tenant.getId(), payload.get("paymentMethods"));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenant", tenant);
        result.put("paymentMethods", paymentMethodDao.findByTenantIdOrderByIdAsc(tenant.getId()));
        return result;
    }

    public XpayTenant requireTenant(String tenantKey) {
        String normalized = normalizeTenantKey(tenantKey);
        XpayTenant tenant = xpayTenantDao.findByTenantKey(normalized)
            .orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        if (!Integer.valueOf(1).equals(tenant.getStatus())) {
            throw new IllegalArgumentException("tenant disabled");
        }
        return tenant;
    }

    public XpayTenant requireTenantAccess(String tenantKey, String accessToken) {
        XpayTenant tenant = requireTenant(tenantKey);
        if (!StringUtils.hasText(accessToken)) {
            throw new IllegalArgumentException("missing access token");
        }
        if (!SecretCryptoUtil.sha256(accessToken).equals(tenant.getAccessTokenHash())) {
            throw new IllegalArgumentException("invalid access token");
        }
        return tenant;
    }

    public List<XpayTenantPaymentMethod> listEnabledPaymentMethods(Long tenantId) {
        List<XpayTenantPaymentMethod> methods = paymentMethodDao.findByTenantIdOrderByIdAsc(tenantId);
        List<XpayTenantPaymentMethod> enabled = new ArrayList<>();
        for (XpayTenantPaymentMethod method : methods) {
            if (Boolean.TRUE.equals(method.getEnabled())) {
                enabled.add(method);
            }
        }
        return enabled;
    }

    public Optional<XpayTenantPaymentMethod> findEnabledPaymentMethod(Long tenantId, String payType) {
        if (!StringUtils.hasText(payType)) {
            return Optional.empty();
        }
        return paymentMethodDao.findByTenantIdAndPayType(tenantId, payType.trim().toLowerCase(Locale.ROOT))
            .filter(method -> Boolean.TRUE.equals(method.getEnabled()));
    }

    public String decryptCallbackSecret(XpayTenant tenant) {
        return SecretCryptoUtil.decrypt(tenant.getCallbackSecretCipher(), encryptionKey);
    }

    public Map<String, Object> uploadPaymentQr(Long tenantId,
                                               Long requesterAdminUserId,
                                               boolean superAdmin,
                                               String payType,
                                               MultipartFile file) {
        XpayTenant tenant = xpayTenantDao.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        if (!superAdmin && !tenant.getOwnerAdminUserId().equals(requesterAdminUserId)) {
            throw new IllegalArgumentException("forbidden");
        }
        String normalizedPayType = normalizeTenantKey(payType);
        if (!"alipay".equals(normalizedPayType) && !"wechat".equals(normalizedPayType) && !"qqpay".equals(normalizedPayType) && !"unipay".equals(normalizedPayType)) {
            throw new IllegalArgumentException("unsupported pay type");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file is required");
        }
        String originalName = file.getOriginalFilename();
        String extension = detectAllowedImageExtension(originalName, file.getContentType());
        String safeTenantKey = tenant.getTenantKey().replaceAll("[^a-z0-9_-]", "");
        String generatedName = safeTenantKey + "-" + normalizedPayType + "-" + System.currentTimeMillis() + extension;

        Path root = Paths.get(workingDirectory, "src", "main", "resources", "static", "assets", "qr", "tenants", safeTenantKey, normalizedPayType);
        try {
            Files.createDirectories(root);
            Path target = root.resolve(generatedName).normalize();
            if (!target.startsWith(root)) {
                throw new IllegalArgumentException("invalid file path");
            }
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            }

            XpayTenantPaymentMethod method = paymentMethodDao.findByTenantIdAndPayType(tenantId, normalizedPayType)
                .orElseGet(XpayTenantPaymentMethod::new);
            method.setTenantId(tenantId);
            method.setPayType(normalizedPayType);
            if (!StringUtils.hasText(method.getDisplayName())) {
                method.setDisplayName(defaultDisplayName(normalizedPayType));
            }
            method.setQrImagePath("/assets/qr/tenants/" + safeTenantKey + "/" + normalizedPayType + "/" + generatedName);
            method.setEnabled(true);
            paymentMethodDao.save(method);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("tenantId", tenantId);
            result.put("tenantKey", tenant.getTenantKey());
            result.put("payType", normalizedPayType);
            result.put("qrImagePath", method.getQrImagePath());
            result.put("paymentMethod", method);
            return result;
        } catch (IOException ex) {
            throw new IllegalArgumentException("upload failed");
        }
    }

    @SuppressWarnings("unchecked")
    private void syncPaymentMethods(Long tenantId, Object rawMethods) {
        if (!(rawMethods instanceof List)) {
            return;
        }
        List<Map<String, Object>> methods = (List<Map<String, Object>>) rawMethods;
        for (Map<String, Object> item : methods) {
            String payType = normalizeTenantKey(String.valueOf(item.get("payType")));
            if (!StringUtils.hasText(payType)) {
                continue;
            }
            XpayTenantPaymentMethod method = paymentMethodDao.findByTenantIdAndPayType(tenantId, payType)
                .orElseGet(XpayTenantPaymentMethod::new);
            method.setTenantId(tenantId);
            method.setPayType(payType);
            method.setDisplayName(normalizeOptionalText(item.get("displayName")));
            method.setQrImagePath(normalizeOptionalText(item.get("qrImagePath")));
            method.setEnabled(!Boolean.FALSE.equals(item.get("enabled")));
            paymentMethodDao.save(method);
        }
    }

    private String normalizeTenantKey(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("^[a-z0-9][a-z0-9_-]{0,63}$")) {
            throw new IllegalArgumentException("invalid key");
        }
        return normalized;
    }

    private String normalizeOptionalText(Object value) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return StringUtils.hasText(text) ? text : null;
    }

    private String detectAllowedImageExtension(String originalName, String contentType) {
        String name = originalName == null ? "" : originalName.toLowerCase(Locale.ROOT);
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (name.endsWith(".png") || type.contains("png")) {
            return ".png";
        }
        if (name.endsWith(".jpg") || name.endsWith(".jpeg") || type.contains("jpeg") || type.contains("jpg")) {
            return ".jpg";
        }
        if (name.endsWith(".webp") || type.contains("webp")) {
            return ".webp";
        }
        throw new IllegalArgumentException("only png/jpg/webp supported");
    }

    private String defaultDisplayName(String payType) {
        if ("alipay".equals(payType)) {
            return "支付宝";
        }
        if ("wechat".equals(payType)) {
            return "微信";
        }
        if ("qqpay".equals(payType)) {
            return "QQ";
        }
        if ("unipay".equals(payType)) {
            return "银联";
        }
        return payType;
    }

    public static class CreatedTenant {
        private final XpayTenant tenant;
        private final String accessToken;
        private final String callbackSecret;
        private final List<XpayTenantPaymentMethod> paymentMethods;

        public CreatedTenant(XpayTenant tenant, String accessToken, String callbackSecret, List<XpayTenantPaymentMethod> paymentMethods) {
            this.tenant = tenant;
            this.accessToken = accessToken;
            this.callbackSecret = callbackSecret;
            this.paymentMethods = paymentMethods;
        }

        public XpayTenant getTenant() {
            return tenant;
        }

        public String getAccessToken() {
            return accessToken;
        }

        public String getCallbackSecret() {
            return callbackSecret;
        }

        public List<XpayTenantPaymentMethod> getPaymentMethods() {
            return paymentMethods;
        }
    }
}
