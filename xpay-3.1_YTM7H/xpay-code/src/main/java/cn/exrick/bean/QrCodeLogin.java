package cn.exrick.bean;

import javax.persistence.*;
import java.util.Date;

@Entity
@Table(name = "qr_code_login")
public class QrCodeLogin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "qr_token", length = 64, unique = true, nullable = false)
    private String qrToken;

    @Column(name = "scene_code", length = 32, unique = true, nullable = false)
    private String sceneCode;

    @Column(name = "status", nullable = false)
    private Integer status = 0;

    @Column(name = "openid", length = 64)
    private String openid;

    @Column(name = "create_time")
    private Date createTime;

    @Column(name = "expire_time")
    private Date expireTime;

    @Column(name = "scan_time")
    private Date scanTime;

    @Column(name = "confirm_time")
    private Date confirmTime;

    @PrePersist
    protected void onCreate() {
        createTime = new Date();
        expireTime = new Date(System.currentTimeMillis() + 5 * 60 * 1000);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQrToken() {
        return qrToken;
    }

    public void setQrToken(String qrToken) {
        this.qrToken = qrToken;
    }

    public String getSceneCode() {
        return sceneCode;
    }

    public void setSceneCode(String sceneCode) {
        this.sceneCode = sceneCode;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public String getOpenid() {
        return openid;
    }

    public void setOpenid(String openid) {
        this.openid = openid;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public Date getExpireTime() {
        return expireTime;
    }

    public void setExpireTime(Date expireTime) {
        this.expireTime = expireTime;
    }

    public Date getScanTime() {
        return scanTime;
    }

    public void setScanTime(Date scanTime) {
        this.scanTime = scanTime;
    }

    public Date getConfirmTime() {
        return confirmTime;
    }

    public void setConfirmTime(Date confirmTime) {
        this.confirmTime = confirmTime;
    }
}
