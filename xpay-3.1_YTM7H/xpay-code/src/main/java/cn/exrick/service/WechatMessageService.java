package cn.exrick.service;

import cn.exrick.bean.AdminUser;
import cn.exrick.dao.AdminUserDao;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.io.StringReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Service
@SuppressWarnings("unused")
public class WechatMessageService {

    private static final Logger log = LoggerFactory.getLogger(WechatMessageService.class);
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    @Lazy
    @Autowired
    private AdminAuthService adminAuthService;

    @Autowired
    private AdminUserDao adminUserDao;

    /**
     * 处理微信消息
     */
    public String processMessage(String xmlData) {
        try {
            Map<String, String> message = parseXml(xmlData);
            String msgType = message.get("MsgType");
            String fromUser = message.get("FromUserName");
            String toUser = message.get("ToUserName");

            log.info("收到消息 - 类型: {}, 来自: {}", msgType, fromUser);

            if ("event".equals(msgType)) {
                return handleEvent(message, fromUser, toUser);
            } else if ("text".equals(msgType)) {
                return handleText(message, fromUser, toUser);
            }

            return buildTextResponse(toUser, fromUser, "收到您的消息");
        } catch (Exception e) {
            log.error("处理消息失败", e);
            return "";
        }
    }

    /**
     * 处理事件消息
     */
    private String handleEvent(Map<String, String> message, String fromUser, String toUser) {
        String eventType = message.get("Event");

        if ("subscribe".equals(eventType)) {
            // 用户关注公众号
            return handleSubscribe(fromUser, toUser);
        } else if ("SCAN".equals(eventType) || "scancode_push".equals(eventType)) {
            // 用户扫码
            String sceneCode = message.get("EventKey");
            return handleScanLogin(sceneCode, fromUser, toUser);
        } else if ("CLICK".equals(eventType)) {
            // 菜单点击事件
            String eventKey = message.get("EventKey");
            return handleMenuClick(eventKey, fromUser, toUser);
        }

        return buildTextResponse(toUser, fromUser, "欢迎使用StarMC支付网关管理系统");
    }

    /**
     * 处理关注事件
     */
    private String handleSubscribe(String fromUser, String toUser) {
        // 检查是否是超级管理员（第一个用户自动成为超级管理员）
        boolean isSuperAdmin = adminAuthService.isSuperAdmin(fromUser);

        if (isSuperAdmin) {
            return buildTextResponse(toUser, fromUser,
                "🎉 欢迎回来，超级管理员！\n\n" +
                "您可以使用以下命令：\n" +
                "• 查看待审核 - 查看等待审核的用户\n" +
                "• 通过+OpenID - 批准用户登录\n" +
                "• 拒绝+OpenID - 拒绝用户登录\n\n" +
                "当前时间：" + DATE_FORMAT.format(new Date()));
        }

        // 检查用户状态
        Optional<AdminUser> userOpt = adminAuthService.getPendingUsers().stream()
            .filter(u -> u.getOpenid().equals(fromUser))
            .findFirst();

        if (userOpt.isPresent()) {
            return buildTextResponse(toUser, fromUser,
                "⏳ 您的管理员申请正在审核中\n\n" +
                "请耐心等待超级管理员批准。\n" +
                "审核通过后将可以登录管理后台。");
        }

        return buildTextResponse(toUser, fromUser,
            "🎉 欢迎关注StarMC支付网关！\n\n" +
            "如需申请管理员权限，请联系超级管理员。\n\n" +
            "您的OpenID：" + fromUser);
    }

    /**
     * 处理扫码登录
     */
    private String handleScanLogin(String sceneCode, String fromUser, String toUser) {
        // 处理登录请求
        String result = adminAuthService.handleLoginRequest(fromUser, "微信用户");

        if (result.startsWith("APPROVED:")) {
            // 已通过审核，直接登录
            return buildTextResponse(toUser, fromUser,
                "✅ 登录成功！\n\n" +
                "您已通过审核，可以正常登录管理后台。");
        } else if (result.startsWith("PENDING:")) {
            // 需要等待审核
            return buildTextResponse(toUser, fromUser,
                "⏳ 登录申请已提交\n\n" +
                "请等待超级管理员审核。\n" +
                "审核通过后即可登录。");
        } else if (result.equals("REJECTED")) {
            return buildTextResponse(toUser, fromUser,
                "❌ 登录被拒绝\n\n" +
                "您的管理员申请已被拒绝，请联系超级管理员。");
        }

        return buildTextResponse(toUser, fromUser, "登录请求处理中...");
    }

    /**
     * 处理菜单点击
     */
    private String handleMenuClick(String eventKey, String fromUser, String toUser) {
        // 检查是否是超级管理员
        if (!adminAuthService.isSuperAdmin(fromUser)) {
            return buildTextResponse(toUser, fromUser, "⚠️ 您没有权限执行此操作");
        }

        switch (eventKey) {
            case "VIEW_PENDING":
                return handleViewPending(fromUser, toUser);
            case "APPROVE_USER":
                return buildTextResponse(toUser, fromUser,
                    "请回复：通过+用户的OpenID\n例如：通过oXXXXXXXXXXXXXXXX");
            case "REJECT_USER":
                return buildTextResponse(toUser, fromUser,
                    "请回复：拒绝+用户的OpenID\n例如：拒绝oXXXXXXXXXXXXXXXX");
            default:
                return buildTextResponse(toUser, fromUser, "未知菜单");
        }
    }

    /**
     * 处理文本消息
     */
    private String handleText(Map<String, String> message, String fromUser, String toUser) {
        String content = message.get("Content");

        if (content == null) {
            return buildTextResponse(toUser, fromUser, "收到您的消息");
        }

        content = content.trim();

        // 检查是否是超级管理员命令
        if (adminAuthService.isSuperAdmin(fromUser)) {
            if (content.equals("查看待审核") || content.equalsIgnoreCase("pending")) {
                return handleViewPending(fromUser, toUser);
            } else if (content.startsWith("通过 ") || content.startsWith("通过")) {
                String targetOpenid = content.replace("通过 ", "").replace("通过", "").trim();
                return handleApproveUser(fromUser, targetOpenid, toUser);
            } else if (content.startsWith("拒绝 ") || content.startsWith("拒绝")) {
                String targetOpenid = content.replace("拒绝 ", "").replace("拒绝", "").trim();
                return handleRejectUser(fromUser, targetOpenid, toUser);
            } else if (content.equals("帮助") || content.equalsIgnoreCase("help")) {
                return buildTextResponse(toUser, fromUser,
                    "📋 超级管理员命令列表：\n\n" +
                    "• 查看待审核 - 查看等待审核的用户列表\n" +
                    "• 通过 OpenID - 批准指定用户\n" +
                    "• 拒绝 OpenID - 拒绝指定用户\n" +
                    "• 帮助 - 显示此帮助信息\n\n" +
                    "您的OpenID：" + fromUser);
            }
        }

        // 普通用户帮助
        if (content.equals("帮助") || content.equalsIgnoreCase("help")) {
            return buildTextResponse(toUser, fromUser,
                "📋 可用命令：\n\n" +
                "• 帮助 - 显示此帮助信息\n" +
                "• 状态 - 查看审核状态\n\n" +
                "您的OpenID：" + fromUser);
        } else if (content.equals("状态") || content.equalsIgnoreCase("status")) {
            return handleCheckStatus(fromUser, toUser);
        }

        return buildTextResponse(toUser, fromUser,
            "收到您的消息：" + content + "\n\n" +
            "回复「帮助」查看可用命令");
    }

    /**
     * 查看待审核用户
     */
    private String handleViewPending(String fromUser, String toUser) {
        List<AdminUser> pendingUsers = adminAuthService.getPendingUsers();

        if (pendingUsers.isEmpty()) {
            return buildTextResponse(toUser, fromUser, "✅ 当前没有待审核的用户");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("📋 待审核用户列表（").append(pendingUsers.size()).append("人）：\n\n");

        for (int i = 0; i < pendingUsers.size(); i++) {
            AdminUser user = pendingUsers.get(i);
            sb.append(i + 1).append(". ")
              .append(user.getNickname() != null ? user.getNickname() : "未命名")
              .append("\n")
              .append("   OpenID: ").append(user.getOpenid())
              .append("\n")
              .append("   申请时间: ").append(DATE_FORMAT.format(user.getCreatedAt()))
              .append("\n\n");
        }

        sb.append("回复「通过 OpenID」批准用户\n");
        sb.append("回复「拒绝 OpenID」拒绝用户");

        return buildTextResponse(toUser, fromUser, sb.toString());
    }

    /**
     * 批准用户
     */
    private String handleApproveUser(String approverOpenid, String targetOpenid, String toUser) {
        if (targetOpenid.isEmpty()) {
            return buildTextResponse(toUser, approverOpenid, "❌ 请提供用户OpenID\n格式：通过 oXXXXXXXXXXXXXXXX");
        }

        boolean success = adminAuthService.approveUser(approverOpenid, targetOpenid);

        if (success) {
            return buildTextResponse(toUser, approverOpenid,
                "✅ 已批准用户：" + targetOpenid + "\n\n该用户现在可以登录管理后台。");
        } else {
            return buildTextResponse(toUser, approverOpenid,
                "❌ 批准失败，请检查OpenID是否正确");
        }
    }

    /**
     * 拒绝用户
     */
    private String handleRejectUser(String approverOpenid, String targetOpenid, String toUser) {
        if (targetOpenid.isEmpty()) {
            return buildTextResponse(toUser, approverOpenid, "❌ 请提供用户OpenID\n格式：拒绝 oXXXXXXXXXXXXXXXX");
        }

        boolean success = adminAuthService.rejectUser(approverOpenid, targetOpenid);

        if (success) {
            return buildTextResponse(toUser, approverOpenid,
                "❌ 已拒绝用户：" + targetOpenid);
        } else {
            return buildTextResponse(toUser, approverOpenid,
                "❌ 拒绝失败，请检查OpenID是否正确");
        }
    }

    /**
     * 检查用户状态
     */
    private String handleCheckStatus(String fromUser, String toUser) {
        Optional<AdminUser> userOpt = adminUserDao.findByOpenid(fromUser);

        if (!userOpt.isPresent()) {
            return buildTextResponse(toUser, fromUser,
                "⚠️ 您还不是管理员\n\n" +
                "请联系超级管理员申请权限。");
        }

        AdminUser user = userOpt.get();
        String statusText;
        switch (user.getStatus()) {
            case 0:
                statusText = "⏳ 待审核 - 请等待超级管理员批准";
                break;
            case 1:
                statusText = "✅ 已通过 - 您可以正常登录管理后台";
                break;
            case 2:
                statusText = "❌ 已拒绝 - 请联系超级管理员了解原因";
                break;
            default:
                statusText = "❓ 未知状态";
        }

        return buildTextResponse(toUser, fromUser,
            "📊 您的审核状态：\n\n" +
            statusText + "\n\n" +
            "申请时间：" + DATE_FORMAT.format(user.getCreatedAt()));
    }

    /**
     * 解析XML消息
     */
    private Map<String, String> parseXml(String xmlData) throws Exception {
        Map<String, String> map = new java.util.HashMap<>();

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document document = builder.parse(new InputSource(new StringReader(xmlData)));

        Element root = document.getDocumentElement();
        NodeList nodeList = root.getChildNodes();

        for (int i = 0; i < nodeList.getLength(); i++) {
            Node node = nodeList.item(i);
            if (node.getNodeType() == Node.ELEMENT_NODE) {
                map.put(node.getNodeName(), node.getTextContent());
            }
        }

        return map;
    }

    /**
     * 发送模板消息（需要微信API权限）
     * 注意：微信只能被动回复消息，此方法用于记录通知日志
     */
    public void sendTextMessage(String openid, String content) {
        log.info("发送通知给用户 {}: {}", openid, content);
    }

    /**
     * 记录通知到数据库供后续处理
     */
    public void recordNotification(String openid, String title, String content) {
        log.info("记录通知 - 用户: {}, 标题: {}, 内容: {}", openid, title, content);
    }

    /**
     * 构建文本响应消息
     */
    private String buildTextResponse(String toUser, String fromUser, String content) {
        long createTime = System.currentTimeMillis() / 1000;
        return String.format(
            "<xml>" +
            "<ToUserName><![CDATA[%s]]></ToUserName>" +
            "<FromUserName><![CDATA[%s]]></FromUserName>" +
            "<CreateTime>%d</CreateTime>" +
            "<MsgType><![CDATA[text]]></MsgType>" +
            "<Content><![CDATA[%s]]></Content>" +
            "</xml>",
            toUser, fromUser, createTime, content
        );
    }
}
