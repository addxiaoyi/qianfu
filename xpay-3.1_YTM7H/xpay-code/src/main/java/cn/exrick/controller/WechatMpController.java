package cn.exrick.controller;

import cn.exrick.common.utils.WechatSignUtil;
import cn.exrick.config.WechatMpProperties;
import cn.exrick.service.AdminAuthService;
import cn.exrick.service.WechatMessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;

@RestController
@RequestMapping("/wechat")
@SuppressWarnings("unused")
public class WechatMpController {

    private static final Logger log = LoggerFactory.getLogger(WechatMpController.class);

    @Autowired
    private WechatMpProperties wechatMpProperties;

    @Autowired
    private WechatMessageService wechatMessageService;

    @Autowired
    private AdminAuthService adminAuthService;

    @GetMapping("/callback")
    public void verifyUrl(
            @RequestParam("signature") String signature,
            @RequestParam("timestamp") String timestamp,
            @RequestParam("nonce") String nonce,
            @RequestParam("echostr") String echostr,
            HttpServletResponse response) throws IOException {

        log.info("收到微信服务器验证请求: signature={}, timestamp={}, nonce={}", signature, timestamp, nonce);

        PrintWriter out = response.getWriter();

        if (WechatSignUtil.checkSignature(wechatMpProperties.getToken(), signature, timestamp, nonce)) {
            log.info("微信服务器验证成功");
            out.print(echostr);
        } else {
            log.warn("微信服务器验证失败");
            out.print("fail");
        }
        out.flush();
        out.close();
    }

    @PostMapping("/callback")
    public void handleMessage(
            @RequestParam("signature") String signature,
            @RequestParam("timestamp") String timestamp,
            @RequestParam("nonce") String nonce,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {

        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        if (!WechatSignUtil.checkSignature(wechatMpProperties.getToken(), signature, timestamp, nonce)) {
            log.warn("消息签名验证失败");
            out.print("fail");
            out.flush();
            out.close();
            return;
        }

        StringBuilder sb = new StringBuilder();
        BufferedReader reader = request.getReader();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }
        String xmlData = sb.toString();

        log.debug("收到微信消息: {}", xmlData);

        String responseXml = wechatMessageService.processMessage(xmlData);

        out.print(responseXml);
        out.flush();
        out.close();
    }
}
