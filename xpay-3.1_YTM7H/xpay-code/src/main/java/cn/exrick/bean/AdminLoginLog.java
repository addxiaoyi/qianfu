package cn.exrick.bean;

import javax.persistence.*;
import java.util.Date;

@Entity
@Table(name = "t_admin_login_log")
public class AdminLoginLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "openid")
    private String openid;

    @Column(name = "nickname")
    private String nickname;

    @Column(name = "ip")
    private String ip;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "login_type")
    private Integer loginType;

    @Column(name = "status")
    private Integer status;

    @Column(name = "fail_reason")
    private String failReason;

    @Column(name = "created_at")
    private Date createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOpenid() {
        return openid;
    }

    public void setOpenid(String openid) {
        this.openid = openid;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getIp() {
        return ip;
    }

    public void setIp(String ip) {
        this.ip = ip;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public Integer getLoginType() {
        return loginType;
    }

    public void setLoginType(Integer loginType) {
        this.loginType = loginType;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public String getFailReason() {
        return failReason;
    }

    public void setFailReason(String failReason) {
        this.failReason = failReason;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public static class LoginType {
        public static final int WECHAT_SCAN = 1;
        public static final int TOKEN_REFRESH = 2;
        public static final int PASSWORD_LOGIN = 3;
    }

    public static class LoginStatus {
        public static final int SUCCESS = 1;
        public static final int FAIL = 2;
        public static final int PENDING = 0;
        public static final int REJECTED = 3;
    }
}