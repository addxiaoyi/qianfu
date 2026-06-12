package cn.exrick.service;

import cn.exrick.bean.AdminLoginLog;
import cn.exrick.bean.AdminUser;
import cn.exrick.config.AdminProperties;
import cn.exrick.dao.AdminLoginLogDao;
import cn.exrick.dao.AdminUserDao;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Service
@SuppressWarnings("unused")
public class LoginSecurityService {

    private static final Logger log = LoggerFactory.getLogger(LoginSecurityService.class);
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private static final String LOGIN_FAIL_KEY_PREFIX = "admin:login:fail:";
    private static final String LOGIN_LOCK_KEY_PREFIX = "admin:login:lock:";
    private static final String LOGIN_IP_KEY_PREFIX = "admin:login:ip:";

    private static final int MAX_LOGIN_FAIL_COUNT = 5;
    private static final int MAX_LOGIN_FAIL_WINDOW = 10 * 60 * 1000;
    private static final int LOCK_DURATION = 30 * 60 * 1000;
    private static final int MAX_IP_LOGIN_FAIL_COUNT = 20;
    private static final int MAX_IP_LOGIN_FAIL_WINDOW = 5 * 60 * 1000;

    @Autowired
    private AdminLoginLogDao adminLoginLogDao;

    @Autowired
    private AdminUserDao adminUserDao;

    @Autowired
    private AdminProperties adminProperties;

    @Lazy
    @Autowired
    private WechatMessageService wechatMessageService;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    public boolean isAccountLocked(String openid) {
        if (redisTemplate == null) {
            return checkLockFromDb(openid);
        }
        String lockKey = LOGIN_LOCK_KEY_PREFIX + openid;
        return Boolean.TRUE.equals(redisTemplate.hasKey(lockKey));
    }

    public boolean isIpLocked(String ip) {
        if (redisTemplate == null) {
            return false;
        }
        String lockKey = LOGIN_LOCK_KEY_PREFIX + "ip:" + ip;
        return Boolean.TRUE.equals(redisTemplate.hasKey(lockKey));
    }

    public void recordLoginFail(String openid, String ip, String userAgent, String reason) {
        AdminLoginLog loginLog = new AdminLoginLog();
        loginLog.setOpenid(openid);
        loginLog.setIp(ip);
        loginLog.setUserAgent(userAgent);
        loginLog.setLoginType(AdminLoginLog.LoginType.WECHAT_SCAN);
        loginLog.setStatus(AdminLoginLog.LoginStatus.FAIL);
        loginLog.setFailReason(reason);
        loginLog.setCreatedAt(new Date());
        adminLoginLogDao.save(loginLog);

        if (redisTemplate != null) {
            String failKey = LOGIN_FAIL_KEY_PREFIX + openid;
            redisTemplate.opsForValue().increment(failKey);
            redisTemplate.expire(failKey, MAX_LOGIN_FAIL_WINDOW, TimeUnit.MILLISECONDS);

            if (isBruteForceAttack(openid)) {
                lockAccount(openid);
            }
        }

        log.warn("登录失败 - openid: {}, ip: {}, reason: {}", openid, ip, reason);
    }

    public void recordLoginSuccess(String openid, String ip, String userAgent) {
        AdminLoginLog loginLog = new AdminLoginLog();
        loginLog.setOpenid(openid);
        loginLog.setIp(ip);
        loginLog.setUserAgent(userAgent);
        loginLog.setLoginType(AdminLoginLog.LoginType.WECHAT_SCAN);
        loginLog.setStatus(AdminLoginLog.LoginStatus.SUCCESS);
        loginLog.setCreatedAt(new Date());
        adminLoginLogDao.save(loginLog);

        if (redisTemplate != null) {
            redisTemplate.delete(LOGIN_FAIL_KEY_PREFIX + openid);
        }

        log.info("登录成功 - openid: {}, ip: {}", openid, ip);
    }

    public void recordLoginPending(String openid, String ip, String userAgent) {
        AdminLoginLog loginLog = new AdminLoginLog();
        loginLog.setOpenid(openid);
        loginLog.setIp(ip);
        loginLog.setUserAgent(userAgent);
        loginLog.setLoginType(AdminLoginLog.LoginType.WECHAT_SCAN);
        loginLog.setStatus(AdminLoginLog.LoginStatus.PENDING);
        loginLog.setCreatedAt(new Date());
        adminLoginLogDao.save(loginLog);
    }

    public void recordLoginRejected(String openid, String ip, String userAgent) {
        AdminLoginLog loginLog = new AdminLoginLog();
        loginLog.setOpenid(openid);
        loginLog.setIp(ip);
        loginLog.setUserAgent(userAgent);
        loginLog.setLoginType(AdminLoginLog.LoginType.WECHAT_SCAN);
        loginLog.setStatus(AdminLoginLog.LoginStatus.REJECTED);
        loginLog.setCreatedAt(new Date());
        adminLoginLogDao.save(loginLog);
    }

    private boolean isBruteForceAttack(String openid) {
        if (redisTemplate == null) {
            return checkBruteForceFromDb(openid);
        }
        String failKey = LOGIN_FAIL_KEY_PREFIX + openid;
        String countStr = redisTemplate.opsForValue().get(failKey);
        if (countStr == null) {
            return false;
        }
        return Integer.parseInt(countStr) >= MAX_LOGIN_FAIL_COUNT;
    }

    private boolean checkLockFromDb(String openid) {
        Date windowStart = new Date(System.currentTimeMillis() - LOCK_DURATION);
        int recentFails = adminLoginLogDao.countByOpenidAndStatusAndCreatedAtAfter(
            openid, AdminLoginLog.LoginStatus.FAIL, windowStart);
        return recentFails >= MAX_LOGIN_FAIL_COUNT;
    }

    private boolean checkBruteForceFromDb(String openid) {
        Date windowStart = new Date(System.currentTimeMillis() - MAX_LOGIN_FAIL_WINDOW);
        int recentFails = adminLoginLogDao.countByOpenidAndStatusAndCreatedAtAfter(
            openid, AdminLoginLog.LoginStatus.FAIL, windowStart);
        return recentFails >= MAX_LOGIN_FAIL_COUNT;
    }

    public void lockAccount(String openid) {
        if (redisTemplate != null) {
            String lockKey = LOGIN_LOCK_KEY_PREFIX + openid;
            redisTemplate.opsForValue().set(lockKey, "1", LOCK_DURATION, TimeUnit.MILLISECONDS);
        }
        log.warn("账号已被锁定 - openid: {}", openid);
    }

    public void unlockAccount(String openid) {
        if (redisTemplate != null) {
            redisTemplate.delete(LOGIN_FAIL_KEY_PREFIX + openid);
            redisTemplate.delete(LOGIN_LOCK_KEY_PREFIX + openid);
        }
        log.info("账号已解锁 - openid: {}", openid);
    }

    public void notifySuperAdminNewUser(AdminUser newUser) {
        String superAdminOpenid = adminProperties.getSuperAdminOpenid();
        if (superAdminOpenid == null || superAdminOpenid.isEmpty()) {
            Optional<AdminUser> firstAdmin = adminUserDao.findFirstByStatusOrderByApprovedAtAsc(1);
            if (firstAdmin.isPresent()) {
                superAdminOpenid = firstAdmin.get().getOpenid();
            }
        }

        if (superAdminOpenid != null && !superAdminOpenid.isEmpty()) {
            String message = String.format(
                "🔔 新管理员申请通知\n\n" +
                "用户：%s\n" +
                "OpenID：%s\n" +
                "申请时间：%s\n\n" +
                "请在公众号回复：\n" +
                "• 通过 %s - 批准该用户\n" +
                "• 拒绝 %s - 拒绝该用户",
                newUser.getNickname() != null ? newUser.getNickname() : "未命名",
                newUser.getOpenid(),
                DATE_FORMAT.format(new Date()),
                newUser.getOpenid(),
                newUser.getOpenid()
            );
            sendWechatMessage(superAdminOpenid, message);
            log.info("已通知超级管理员有新用户申请: {}", newUser.getOpenid());
        }
    }

    public void notifySuperAdminApproved(String openid, String nickname) {
        String superAdminOpenid = adminProperties.getSuperAdminOpenid();
        if (superAdminOpenid == null || superAdminOpenid.isEmpty()) {
            Optional<AdminUser> firstAdmin = adminUserDao.findFirstByStatusOrderByApprovedAtAsc(1);
            if (firstAdmin.isPresent()) {
                superAdminOpenid = firstAdmin.get().getOpenid();
            }
        }

        if (superAdminOpenid != null && !superAdminOpenid.isEmpty()) {
            String message = String.format(
                "✅ 用户已批准登录\n\n" +
                "用户：%s\n" +
                "OpenID：%s\n" +
                "批准时间：%s",
                nickname != null ? nickname : openid,
                openid,
                DATE_FORMAT.format(new Date())
            );
            sendWechatMessage(superAdminOpenid, message);
        }
    }

    public void notifyUserApproved(String openid) {
        String message = String.format(
            "🎉 恭喜！您的管理员申请已通过！\n\n" +
            "您现在可以登录管理后台了。\n" +
            "请使用微信扫码登录。"
        );
        sendWechatMessage(openid, message);
    }

    public void notifyUserRejected(String openid) {
        String message = String.format(
            "❌ 抱歉，您的管理员申请已被拒绝。\n\n" +
            "如有疑问，请联系超级管理员。"
        );
        sendWechatMessage(openid, message);
    }

    private void sendWechatMessage(String openid, String content) {
        try {
            wechatMessageService.sendTextMessage(openid, content);
        } catch (Exception e) {
            log.error("发送微信消息失败: {}", e.getMessage());
        }
    }

    public boolean isIpBruteForce(String ip) {
        if (redisTemplate == null) {
            Date windowStart = new Date(System.currentTimeMillis() - MAX_IP_LOGIN_FAIL_WINDOW);
            int recentFails = adminLoginLogDao.countByOpenidAndStatusAndCreatedAtAfter(
                null, AdminLoginLog.LoginStatus.FAIL, windowStart);
            return recentFails >= MAX_IP_LOGIN_FAIL_COUNT;
        }
        String failKey = LOGIN_IP_KEY_PREFIX + ip;
        String countStr = redisTemplate.opsForValue().get(failKey);
        if (countStr == null) {
            return false;
        }
        return Integer.parseInt(countStr) >= MAX_IP_LOGIN_FAIL_COUNT;
    }

    public void recordIpFail(String ip) {
        if (redisTemplate != null) {
            String failKey = LOGIN_IP_KEY_PREFIX + ip;
            redisTemplate.opsForValue().increment(failKey);
            redisTemplate.expire(failKey, MAX_IP_LOGIN_FAIL_WINDOW, TimeUnit.MILLISECONDS);

            if (isIpBruteForce(ip)) {
                String lockKey = LOGIN_LOCK_KEY_PREFIX + "ip:" + ip;
                redisTemplate.opsForValue().set(lockKey, "1", LOCK_DURATION, TimeUnit.MILLISECONDS);
                log.warn("IP已被临时锁定: {}", ip);
            }
        }
    }
}
