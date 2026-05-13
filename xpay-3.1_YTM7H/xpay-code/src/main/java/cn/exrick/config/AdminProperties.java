package cn.exrick.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "admin")
public class AdminProperties {

    private String superAdminOpenid;
    private boolean requireApproval = true;

    public String getSuperAdminOpenid() {
        return superAdminOpenid;
    }

    public void setSuperAdminOpenid(String superAdminOpenid) {
        this.superAdminOpenid = superAdminOpenid;
    }

    public boolean isRequireApproval() {
        return requireApproval;
    }

    public void setRequireApproval(boolean requireApproval) {
        this.requireApproval = requireApproval;
    }
}
