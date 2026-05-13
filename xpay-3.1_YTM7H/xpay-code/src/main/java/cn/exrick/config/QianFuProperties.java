package cn.exrick.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "qianfu")
public class QianFuProperties {

    private boolean enabled = false;
    private boolean sandbox = false;
    private String appId;
    private String secretKey;
    private String apiUrl;
    private String callbackUrl;
    private String signAlgorithm = "HmacSHA256";
    private int timeout = 30000;
    private int retryCount = 3;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isSandbox() {
        return sandbox;
    }

    public void setSandbox(boolean sandbox) {
        this.sandbox = sandbox;
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getApiUrl() {
        return apiUrl;
    }

    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public void setCallbackUrl(String callbackUrl) {
        this.callbackUrl = callbackUrl;
    }

    public String getSignAlgorithm() {
        return signAlgorithm;
    }

    public void setSignAlgorithm(String signAlgorithm) {
        this.signAlgorithm = signAlgorithm;
    }

    public int getTimeout() {
        return timeout;
    }

    public void setTimeout(int timeout) {
        this.timeout = timeout;
    }

    public int getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }

    @Override
    public String toString() {
        return "QianFuProperties{" +
                "enabled=" + enabled +
                ", appId='" + appId + '\'' +
                ", apiUrl='" + apiUrl + '\'' +
                ", callbackUrl='" + callbackUrl + '\'' +
                ", signAlgorithm='" + signAlgorithm + '\'' +
                ", timeout=" + timeout +
                ", retryCount=" + retryCount +
                '}';
    }
}
