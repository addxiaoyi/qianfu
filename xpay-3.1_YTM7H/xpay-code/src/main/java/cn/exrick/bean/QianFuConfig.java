package cn.exrick.bean;

import java.io.Serializable;
import java.util.List;

public class QianFuConfig implements Serializable {

    private static final long serialVersionUID = 1L;

    private boolean enabled;
    private String appId;
    private String secretKey;
    private String apiUrl;
    private String callbackUrl;
    private List<String> ipWhitelist;
    private RetryConfig retry;
    private long createdAt;
    private long updatedAt;

    public QianFuConfig() {
        this.retry = new RetryConfig();
        this.ipWhitelist = List.of("127.0.0.1");
        this.enabled = false;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
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

    public List<String> getIpWhitelist() {
        return ipWhitelist;
    }

    public void setIpWhitelist(List<String> ipWhitelist) {
        this.ipWhitelist = ipWhitelist;
    }

    public RetryConfig getRetry() {
        return retry;
    }

    public void setRetry(RetryConfig retry) {
        this.retry = retry;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public static class RetryConfig implements Serializable {
        private static final long serialVersionUID = 1L;

        private int maxAttempts = 5;
        private long[] delays = {0, 30000, 120000, 600000, 1800000};

        public int getMaxAttempts() {
            return maxAttempts;
        }

        public void setMaxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public long[] getDelays() {
            return delays;
        }

        public void setDelays(long[] delays) {
            this.delays = delays;
        }

        public long getDelay(int attempt) {
            if (attempt < 0 || attempt >= delays.length) {
                return delays[delays.length - 1];
            }
            return delays[attempt];
        }
    }

    @Override
    public String toString() {
        return "QianFuConfig{" +
                "enabled=" + enabled +
                ", appId='" + appId + '\'' +
                ", apiUrl='" + apiUrl + '\'' +
                ", callbackUrl='" + callbackUrl + '\'' +
                '}';
    }
}