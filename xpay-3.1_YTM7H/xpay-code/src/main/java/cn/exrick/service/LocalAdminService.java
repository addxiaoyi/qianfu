package cn.exrick.service;

import cn.exrick.bean.AdminLocalAccount;
import cn.exrick.bean.AdminUser;
import cn.exrick.common.utils.SecretCryptoUtil;
import cn.exrick.config.LocalAdminProperties;
import cn.exrick.dao.AdminLocalAccountDao;
import cn.exrick.dao.AdminUserDao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Service
public class LocalAdminService {

    private static final String LOCAL_OPENID_PREFIX = "local:";

    @Autowired
    private LocalAdminProperties localAdminProperties;

    @Autowired
    private AdminUserDao adminUserDao;

    @Autowired
    private AdminLocalAccountDao adminLocalAccountDao;

    @PostConstruct
    public void ensureBootstrapSuperAdmin() {
        if (!localAdminProperties.isEnabled()) {
            return;
        }
        String username = normalizeUsername(localAdminProperties.getBootstrapUsername());
        String password = localAdminProperties.getBootstrapPassword();
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            return;
        }
        if (adminLocalAccountDao.existsByUsername(username)) {
            return;
        }

        AdminUser adminUser = new AdminUser();
        adminUser.setOpenid(LOCAL_OPENID_PREFIX + username);
        adminUser.setNickname("Local Super Admin");
        adminUser.setRole("SUPER_ADMIN");
        adminUser.setStatus(1);
        adminUser.setEnabled(true);
        adminUser.setApprovedBy("SYSTEM");
        adminUser.setApprovedAt(new Date());
        adminUser = adminUserDao.save(adminUser);

        AdminLocalAccount account = new AdminLocalAccount();
        account.setAdminUserId(adminUser.getId());
        account.setUsername(username);
        account.setPasswordHash(SecretCryptoUtil.hashPassword(password));
        account.setMustResetPassword(false);
        adminLocalAccountDao.save(account);
    }

    public AdminUser authenticate(String usernameRaw, String password) {
        String username = normalizeUsername(usernameRaw);
        Optional<AdminLocalAccount> accountOpt = adminLocalAccountDao.findByUsername(username);
        if (!accountOpt.isPresent()) {
            return null;
        }

        AdminLocalAccount account = accountOpt.get();
        if (!SecretCryptoUtil.verifyPassword(password, account.getPasswordHash())) {
            return null;
        }

        Optional<AdminUser> userOpt = adminUserDao.findById(account.getAdminUserId());
        if (!userOpt.isPresent()) {
            return null;
        }

        AdminUser adminUser = userOpt.get();
        account.setLastLoginAt(new Date());
        adminLocalAccountDao.save(account);
        return adminUser;
    }

    public boolean isLocalSuperAdmin(AdminUser adminUser) {
        return adminUser != null && "SUPER_ADMIN".equalsIgnoreCase(adminUser.getRole());
    }

    public CreatedLocalAdmin createManagedAdmin(String creatorOpenid, String usernameRaw, String nickname) {
        String username = normalizeUsername(usernameRaw);
        if (!StringUtils.hasText(username)) {
            throw new IllegalArgumentException("username is required");
        }
        if (adminLocalAccountDao.existsByUsername(username)) {
            throw new IllegalArgumentException("username already exists");
        }

        AdminUser adminUser = new AdminUser();
        adminUser.setOpenid(LOCAL_OPENID_PREFIX + username + ":" + UUID.randomUUID());
        adminUser.setNickname(StringUtils.hasText(nickname) ? nickname.trim() : username);
        adminUser.setRole("ADMIN");
        adminUser.setStatus(1);
        adminUser.setEnabled(true);
        adminUser.setApprovedBy(creatorOpenid);
        adminUser.setApprovedAt(new Date());
        adminUser = adminUserDao.save(adminUser);

        String password = SecretCryptoUtil.randomToken(24);
        AdminLocalAccount account = new AdminLocalAccount();
        account.setAdminUserId(adminUser.getId());
        account.setUsername(username);
        account.setPasswordHash(SecretCryptoUtil.hashPassword(password));
        account.setMustResetPassword(true);
        adminLocalAccountDao.save(account);

        return new CreatedLocalAdmin(adminUser, username, password);
    }

    private String normalizeUsername(String usernameRaw) {
        return usernameRaw == null ? "" : usernameRaw.trim().toLowerCase();
    }

    public static class CreatedLocalAdmin {
        private final AdminUser adminUser;
        private final String username;
        private final String generatedPassword;

        public CreatedLocalAdmin(AdminUser adminUser, String username, String generatedPassword) {
            this.adminUser = adminUser;
            this.username = username;
            this.generatedPassword = generatedPassword;
        }

        public AdminUser getAdminUser() {
            return adminUser;
        }

        public String getUsername() {
            return username;
        }

        public String getGeneratedPassword() {
            return generatedPassword;
        }
    }
}
