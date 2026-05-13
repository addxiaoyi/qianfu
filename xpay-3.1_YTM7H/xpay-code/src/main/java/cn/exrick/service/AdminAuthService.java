package cn.exrick.service;

import cn.exrick.bean.AdminUser;
import cn.exrick.bean.QrCodeLogin;
import cn.exrick.common.utils.JwtUtil;
import cn.exrick.config.AdminProperties;
import cn.exrick.dao.AdminUserDao;
import cn.exrick.dao.QrCodeLoginDao;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@SuppressWarnings("unused")
public class AdminAuthService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthService.class);

    @Autowired
    private AdminUserDao adminUserDao;

    @Autowired
    private QrCodeLoginDao qrCodeLoginDao;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AdminProperties adminProperties;

    @Autowired(required = false)
    private LoginSecurityService loginSecurityService;

    private static final long QR_CODE_EXPIRE_TIME = 5 * 60 * 1000;

    /**
     * 生成二维码
     */
    public Map<String, String> generateQrCode() {
        String qrToken = UUID.randomUUID().toString().replace("-", "");
        String sceneCode = String.valueOf(System.currentTimeMillis());

        QrCodeLogin qrCodeLogin = new QrCodeLogin();
        qrCodeLogin.setQrToken(qrToken);
        qrCodeLogin.setSceneCode(sceneCode);
        qrCodeLogin.setStatus(0);
        qrCodeLoginDao.save(qrCodeLogin);

        Map<String, String> result = new HashMap<>();
        result.put("qrToken", qrToken);
        result.put("sceneCode", sceneCode);
        return result;
    }

    /**
     * 检查二维码状态
     */
    public Map<String, Object> checkQrStatus(String qrToken) {
        Map<String, Object> result = new HashMap<>();

        Optional<QrCodeLogin> qrOpt = qrCodeLoginDao.findByQrToken(qrToken);
        if (!qrOpt.isPresent()) {
            result.put("status", -1);
            result.put("message", "二维码不存在");
            return result;
        }

        QrCodeLogin qrCodeLogin = qrOpt.get();

        if (qrCodeLogin.getExpireTime().getTime() < System.currentTimeMillis()) {
            result.put("status", -2);
            result.put("message", "二维码已过期");
            return result;
        }

        if (qrCodeLogin.getStatus() == 2) {
            String token = JwtUtil.generateToken(qrCodeLogin.getOpenid(), "ADMIN");
            result.put("status", 2);
            result.put("token", token);
            result.put("message", "登录成功");
        } else {
            result.put("status", qrCodeLogin.getStatus());
            result.put("message", getStatusMessage(qrCodeLogin.getStatus()));
        }

        return result;
    }

    private String getStatusMessage(Integer status) {
        switch (status) {
            case 0: return "等待扫码";
            case 1: return "已扫码，等待审核";
            case 2: return "审核通过";
            case 3: return "审核被拒绝";
            default: return "未知状态";
        }
    }

    /**
     * 处理扫码
     */
    public boolean scanQrCode(String sceneCode, String openid, String nickname, String avatarUrl) {
        Optional<QrCodeLogin> qrOpt = qrCodeLoginDao.findBySceneCode(sceneCode);
        if (!qrOpt.isPresent()) {
            return false;
        }

        QrCodeLogin qrCodeLogin = qrOpt.get();

        if (qrCodeLogin.getExpireTime().getTime() < System.currentTimeMillis()) {
            return false;
        }

        if (qrCodeLogin.getStatus() != 0) {
            return false;
        }

        qrCodeLogin.setOpenid(openid);
        qrCodeLogin.setScanTime(new Date());
        qrCodeLogin.setStatus(1);
        qrCodeLoginDao.save(qrCodeLogin);

        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(openid);
        if (userOpt.isPresent()) {
            AdminUser user = userOpt.get();
            user.setNickname(nickname);
            user.setAvatarUrl(avatarUrl);
            user.setUpdatedAt(new Date());
            adminUserDao.save(user);
        } else {
            AdminUser newUser = new AdminUser();
            newUser.setOpenid(openid);
            newUser.setNickname(nickname);
            newUser.setAvatarUrl(avatarUrl);
            newUser.setStatus(0);
            newUser.setRole("ADMIN");
            adminUserDao.save(newUser);

            if (adminUserDao.count() == 1) {
                newUser.setStatus(1);
                newUser.setApprovedBy("SYSTEM");
                newUser.setApprovedAt(new Date());
                adminUserDao.save(newUser);

                qrCodeLogin.setStatus(2);
                qrCodeLogin.setConfirmTime(new Date());
                qrCodeLoginDao.save(qrCodeLogin);
            }
        }

        return true;
    }

    /**
     * 确认登录
     */
    public boolean confirmQrLogin(String sceneCode, String openid) {
        Optional<QrCodeLogin> qrOpt = qrCodeLoginDao.findBySceneCode(sceneCode);
        if (!qrOpt.isPresent()) {
            return false;
        }

        QrCodeLogin qrCodeLogin = qrOpt.get();

        if (qrCodeLogin.getExpireTime().getTime() < System.currentTimeMillis()) {
            return false;
        }

        if (qrCodeLogin.getStatus() != 1) {
            return false;
        }

        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(openid);
        if (!userOpt.isPresent()) {
            return false;
        }

        AdminUser user = userOpt.get();

        if (!isSuperAdmin(openid)) {
            if (user.getStatus() != 1) {
                return false;
            }
        }

        qrCodeLogin.setStatus(2);
        qrCodeLogin.setConfirmTime(new Date());
        qrCodeLoginDao.save(qrCodeLogin);

        return true;
    }

    /**
     * 处理微信登录请求
     */
    public String handleLoginRequest(String openid, String nickname) {
        Optional<AdminUser> existingUser = adminUserDao.findByOpenid(openid);

        if (existingUser.isPresent()) {
            AdminUser user = existingUser.get();
            user.setNickname(nickname);
            user.setUpdatedAt(new Date());
            adminUserDao.save(user);

            if (user.getStatus() == 1) {
                return "APPROVED:" + openid;
            } else if (user.getStatus() == 2) {
                return "REJECTED";
            } else {
                return "PENDING:" + openid;
            }
        } else {
            AdminUser newUser = new AdminUser();
            newUser.setOpenid(openid);
            newUser.setNickname(nickname);
            newUser.setStatus(0);
            newUser.setRole("ADMIN");
            adminUserDao.save(newUser);

            if (adminUserDao.count() == 1) {
                newUser.setStatus(1);
                newUser.setApprovedBy("SYSTEM");
                newUser.setApprovedAt(new Date());
                adminUserDao.save(newUser);
                log.info("第一个管理员已自动通过: {}", openid);
                return "APPROVED:" + openid;
            }

            notifySuperAdmin(newUser);
            return "PENDING:" + openid;
        }
    }

    /**
     * 超级管理员批准用户
     */
    public boolean approveUser(String approverOpenid, String targetOpenid) {
        if (!isSuperAdmin(approverOpenid)) {
            log.warn("非超级管理员尝试审批用户: {}", approverOpenid);
            return false;
        }

        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(targetOpenid);
        if (!userOpt.isPresent()) {
            return false;
        }

        AdminUser user = userOpt.get();
        user.setStatus(1);
        user.setApprovedBy(approverOpenid);
        user.setApprovedAt(new Date());
        adminUserDao.save(user);

        Optional<QrCodeLogin> qrOpt = qrCodeLoginDao.findByOpenidAndStatus(targetOpenid, 1);
        if (qrOpt.isPresent()) {
            QrCodeLogin qr = qrOpt.get();
            qr.setStatus(2);
            qr.setConfirmTime(new Date());
            qrCodeLoginDao.save(qr);
        }

        if (loginSecurityService != null) {
            loginSecurityService.notifyUserApproved(targetOpenid);
        }

        log.info("用户 {} 已被 {} 批准", targetOpenid, approverOpenid);
        return true;
    }

    /**
     * 超级管理员拒绝用户
     */
    public boolean rejectUser(String approverOpenid, String targetOpenid) {
        if (!isSuperAdmin(approverOpenid)) {
            log.warn("非超级管理员尝试拒绝用户: {}", approverOpenid);
            return false;
        }

        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(targetOpenid);
        if (!userOpt.isPresent()) {
            return false;
        }

        AdminUser user = userOpt.get();
        user.setStatus(2);
        user.setApprovedBy(approverOpenid);
        user.setApprovedAt(new Date());
        adminUserDao.save(user);

        Optional<QrCodeLogin> qrOpt = qrCodeLoginDao.findByOpenidAndStatus(targetOpenid, 1);
        if (qrOpt.isPresent()) {
            QrCodeLogin qr = qrOpt.get();
            qr.setStatus(3);
            qrCodeLoginDao.save(qr);
        }

        if (loginSecurityService != null) {
            loginSecurityService.notifyUserRejected(targetOpenid);
        }

        log.info("用户 {} 已被 {} 拒绝", targetOpenid, approverOpenid);
        return true;
    }

    /**
     * 检查是否是超级管理员
     */
    public boolean isSuperAdmin(String openid) {
        if (openid.equals(adminProperties.getSuperAdminOpenid())) {
            return true;
        }

        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(openid);
        if (userOpt.isPresent()) {
            AdminUser user = userOpt.get();
            if (user.getStatus() == 1) {
                List<AdminUser> approvedUsers = adminUserDao.findByStatusOrderByApprovedAtAsc(1);
                if (!approvedUsers.isEmpty() && approvedUsers.get(0).getOpenid().equals(openid)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 获取待审核用户列表
     */
    public List<AdminUser> getPendingUsers() {
        return adminUserDao.findByStatus(0);
    }

    /**
     * 根据OpenID获取管理员
     */
    public AdminUser getAdminByOpenid(String openid) {
        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(openid);
        return userOpt.orElse(null);
    }

    /**
     * 验证令牌
     */
    public boolean validateToken(String token) {
        return JwtUtil.validateToken(token);
    }

    /**
     * 从令牌获取OpenID
     */
    public String getOpenidFromToken(String token) {
        return JwtUtil.getOpenidFromToken(token);
    }

    private void notifySuperAdmin(AdminUser newUser) {
        if (loginSecurityService != null) {
            loginSecurityService.notifySuperAdminNewUser(newUser);
        }
        log.info("新用户 {} 等待审核，已通知超级管理员", newUser.getOpenid());
    }
}
