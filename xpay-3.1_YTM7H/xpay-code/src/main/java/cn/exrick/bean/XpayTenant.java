package cn.exrick.bean;

import javax.persistence.*;
import java.util.Date;

@Entity
@Table(name = "t_xpay_tenant")
public class XpayTenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_key", nullable = false, unique = true, length = 64)
    private String tenantKey;

    @Column(name = "display_name", nullable = false, length = 128)
    private String displayName;

    @Column(name = "owner_admin_user_id", nullable = false)
    private Long ownerAdminUserId;

    @Column(name = "callback_url", length = 512)
    private String callbackUrl;

    @Column(name = "callback_secret_hash", length = 255)
    private String callbackSecretHash;

    @Column(name = "access_token_hash", length = 255)
    private String accessTokenHash;

    @Column(name = "callback_secret_cipher", length = 1024)
    private String callbackSecretCipher;

    @Column(name = "access_token_cipher", length = 1024)
    private String accessTokenCipher;

    @Column(name = "status", nullable = false)
    private Integer status = 1;

    @Column(name = "created_at")
    private Date createdAt;

    @Column(name = "updated_at")
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        updatedAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTenantKey() {
        return tenantKey;
    }

    public void setTenantKey(String tenantKey) {
        this.tenantKey = tenantKey;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public Long getOwnerAdminUserId() {
        return ownerAdminUserId;
    }

    public void setOwnerAdminUserId(Long ownerAdminUserId) {
        this.ownerAdminUserId = ownerAdminUserId;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public void setCallbackUrl(String callbackUrl) {
        this.callbackUrl = callbackUrl;
    }

    public String getCallbackSecretHash() {
        return callbackSecretHash;
    }

    public void setCallbackSecretHash(String callbackSecretHash) {
        this.callbackSecretHash = callbackSecretHash;
    }

    public String getAccessTokenHash() {
        return accessTokenHash;
    }

    public void setAccessTokenHash(String accessTokenHash) {
        this.accessTokenHash = accessTokenHash;
    }

    public String getCallbackSecretCipher() {
        return callbackSecretCipher;
    }

    public void setCallbackSecretCipher(String callbackSecretCipher) {
        this.callbackSecretCipher = callbackSecretCipher;
    }

    public String getAccessTokenCipher() {
        return accessTokenCipher;
    }

    public void setAccessTokenCipher(String accessTokenCipher) {
        this.accessTokenCipher = accessTokenCipher;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }
}
