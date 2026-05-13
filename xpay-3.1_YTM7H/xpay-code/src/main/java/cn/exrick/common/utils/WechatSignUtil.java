package cn.exrick.common.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.MessageDigest;
import java.util.Arrays;

public class WechatSignUtil {

    private static final Logger log = LoggerFactory.getLogger(WechatSignUtil.class);

    public static boolean checkSignature(String token, String signature, String timestamp, String nonce) {
        String[] arr = new String[]{token, timestamp, nonce};
        Arrays.sort(arr);
        StringBuilder content = new StringBuilder();
        for (String s : arr) {
            content.append(s);
        }
        String tmpStr = sha1(content.toString());
        return tmpStr != null && tmpStr.equals(signature);
    }

    private static String sha1(String str) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA1");
            byte[] digest = md.digest(str.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            log.error("SHA1加密失败", e);
            return null;
        }
    }
}
