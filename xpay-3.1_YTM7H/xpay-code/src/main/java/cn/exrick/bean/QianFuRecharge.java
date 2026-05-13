package cn.exrick.bean;

import javax.persistence.*;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "qianfu_recharge")
public class QianFuRecharge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recharge_id", length = 64, nullable = false, unique = true)
    private String rechargeId;

    @Column(name = "amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "status", nullable = false)
    private Integer status = 0;

    @Column(name = "qianfu_recharge_id", length = 64)
    private String qianfuRechargeId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "callback_url", length = 512)
    private String callbackUrl;

    @Column(name = "fail_reason", length = 256)
    private String failReason;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "create_time", nullable = false)
    private Date createTime;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "complete_time")
    private Date completeTime;

    @PrePersist
    protected void onCreate() {
        createTime = new Date();
    }

    public QianFuRecharge() {
    }

    public QianFuRecharge(String rechargeId, BigDecimal amount) {
        this.rechargeId = rechargeId;
        this.amount = amount;
        this.status = 0;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRechargeId() {
        return rechargeId;
    }

    public void setRechargeId(String rechargeId) {
        this.rechargeId = rechargeId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public String getQianfuRechargeId() {
        return qianfuRechargeId;
    }

    public void setQianfuRechargeId(String qianfuRechargeId) {
        this.qianfuRechargeId = qianfuRechargeId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public void setCallbackUrl(String callbackUrl) {
        this.callbackUrl = callbackUrl;
    }

    public String getFailReason() {
        return failReason;
    }

    public void setFailReason(String failReason) {
        this.failReason = failReason;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public Date getCompleteTime() {
        return completeTime;
    }

    public void setCompleteTime(Date completeTime) {
        this.completeTime = completeTime;
    }
}