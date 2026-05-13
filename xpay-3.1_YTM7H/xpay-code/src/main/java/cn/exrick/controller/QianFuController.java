package cn.exrick.controller;

import cn.exrick.bean.QianFuOrder;
import cn.exrick.bean.QianFuRecharge;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.config.QianFuProperties;
import cn.exrick.service.QianFuService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/qianfu")
public class QianFuController {

    private static final Logger log = LoggerFactory.getLogger(QianFuController.class);

    @Autowired
    private QianFuService qianFuService;

    @Autowired
    private QianFuProperties qianFuProperties;

    @GetMapping("/config")
    public Result<Map<String, Object>> getConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("enabled", qianFuProperties.isEnabled());
        config.put("appId", qianFuProperties.getAppId());
        config.put("apiUrl", qianFuProperties.getApiUrl());
        config.put("callbackUrl", qianFuProperties.getCallbackUrl());
        config.put("sandbox", qianFuProperties.isSandbox());
        return new ResultUtil<Map<String, Object>>().setData(config);
    }

    @PostMapping("/config/test")
    public Result<Map<String, Object>> testConnection() {
        boolean success = qianFuService.testConnection();
        Map<String, Object> result = new HashMap<>();
        result.put("success", success);
        result.put("message", success ? "连接成功" : "连接失败");
        if (success) {
            return new ResultUtil<Map<String, Object>>().setData(result);
        }
        return new ResultUtil<Map<String, Object>>().setErrorMsg("连接测试失败");
    }

    @PostMapping("/config/save")
    public Result<Map<String, Object>> saveConfig(@RequestBody Map<String, Object> config) {
        try {
            if (config.containsKey("enabled")) {
                qianFuProperties.setEnabled((Boolean) config.get("enabled"));
            }
            if (config.containsKey("sandbox")) {
                qianFuProperties.setSandbox((Boolean) config.get("sandbox"));
            }
            if (config.containsKey("appId")) {
                qianFuProperties.setAppId((String) config.get("appId"));
            }
            if (config.containsKey("secretKey")) {
                qianFuProperties.setSecretKey((String) config.get("secretKey"));
            }
            if (config.containsKey("apiUrl")) {
                qianFuProperties.setApiUrl((String) config.get("apiUrl"));
            }
            if (config.containsKey("callbackUrl")) {
                qianFuProperties.setCallbackUrl((String) config.get("callbackUrl"));
            }

            Map<String, Object> result = new HashMap<>();
            result.put("saved", true);
            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("保存配置失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("保存配置失败: " + e.getMessage());
        }
    }

    @GetMapping("/info")
    public Result<Map<String, Object>> getServiceInfo() {
        try {
            Map<String, Object> info = qianFuService.getServiceInfo();
            return new ResultUtil<Map<String, Object>>().setData(info);
        } catch (Exception e) {
            log.error("获取服务信息失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("获取服务信息失败");
        }
    }

    @PostMapping("/pay/create")
    public Result<Map<String, Object>> createOrder(@RequestBody Map<String, Object> params) {
        try {
            String orderId = (String) params.get("orderId");
            String amountStr = (String) params.get("amount");
            String subject = (String) params.get("subject");
            String body = (String) params.get("body");
            String payType = (String) params.get("payType");

            if (orderId == null || amountStr == null || subject == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("缺少必要参数");
            }

            BigDecimal amount = new BigDecimal(amountStr);
            Map<String, Object> result = qianFuService.createOrder(orderId, amount, subject, body, payType);
            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("创建订单失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("创建订单失败: " + e.getMessage());
        }
    }

    @GetMapping("/pay/query/{orderId}")
    public Result<Map<String, Object>> queryOrder(@PathVariable String orderId) {
        try {
            QianFuOrder order = qianFuService.getOrder(orderId);
            if (order == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("订单不存在");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("orderId", order.getOrderId());
            result.put("qianfuOrderId", order.getQianfuOrderId());
            result.put("amount", order.getAmount());
            result.put("subject", order.getSubject());
            result.put("status", order.getStatus());
            result.put("payType", order.getPayType());
            result.put("createTime", order.getCreateTime());
            result.put("payTime", order.getPayTime());
            result.put("expireTime", order.getExpireTime());

            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("查询订单失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("查询订单失败");
        }
    }

    @PostMapping("/pay/close/{orderId}")
    public Result<Map<String, Object>> closeOrder(@PathVariable String orderId) {
        try {
            boolean success = qianFuService.closeOrder(orderId);
            if (success) {
                Map<String, Object> result = new HashMap<>();
                result.put("orderId", orderId);
                result.put("closed", true);
                return new ResultUtil<Map<String, Object>>().setData(result);
            }
            return new ResultUtil<Map<String, Object>>().setErrorMsg("关闭订单失败");
        } catch (Exception e) {
            log.error("关闭订单失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("关闭订单失败: " + e.getMessage());
        }
    }

    @GetMapping("/pay/qr/{orderId}")
    public Result<Map<String, Object>> getQRCode(@PathVariable String orderId) {
        try {
            QianFuOrder order = qianFuService.getOrder(orderId);
            if (order == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("订单不存在");
            }

            String qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=qianfu://pay?orderId=" + orderId;

            Map<String, Object> result = new HashMap<>();
            result.put("orderId", orderId);
            result.put("qrCode", qrUrl);
            result.put("expireTime", order.getExpireTime() != null ? order.getExpireTime().getTime() / 1000 : 0);

            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("获取二维码失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("获取二维码失败");
        }
    }

    @PostMapping("/callback/pay")
    public Result<Map<String, Object>> payCallback(@RequestBody Map<String, String> callbackData,
                                                    @RequestParam(required = false) String signature) {
        try {
            log.info("收到支付回调: {}", callbackData);

            Map<String, Object> result = new HashMap<>();
            result.put("received", true);
            result.put("orderId", callbackData.get("orderId"));

            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("处理支付回调失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("处理回调失败");
        }
    }

    @PostMapping("/callback/recharge")
    public Result<Map<String, Object>> rechargeCallback(@RequestBody Map<String, String> callbackData,
                                                         @RequestParam(required = false) String signature) {
        try {
            log.info("收到充值回调: {}", callbackData);

            Map<String, Object> result = new HashMap<>();
            result.put("received", true);
            result.put("rechargeId", callbackData.get("rechargeId"));

            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("处理充值回调失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("处理回调失败");
        }
    }

    @GetMapping("/account/balance")
    public Result<Map<String, Object>> getBalance() {
        try {
            Map<String, Object> balance = qianFuService.getBalance();
            return new ResultUtil<Map<String, Object>>().setData(balance);
        } catch (Exception e) {
            log.error("获取余额失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("获取余额失败");
        }
    }

    @PostMapping("/account/recharge")
    public Result<Map<String, Object>> createRecharge(@RequestBody Map<String, Object> params) {
        try {
            String rechargeId = (String) params.get("rechargeId");
            String amountStr = (String) params.get("amount");
            Long userId = params.containsKey("userId") ? ((Number) params.get("userId")).longValue() : null;

            if (rechargeId == null || amountStr == null) {
                return new ResultUtil<Map<String, Object>>().setErrorMsg("缺少必要参数");
            }

            BigDecimal amount = new BigDecimal(amountStr);
            Map<String, Object> result = qianFuService.createRecharge(rechargeId, amount, userId);
            return new ResultUtil<Map<String, Object>>().setData(result);
        } catch (Exception e) {
            log.error("创建充值失败: {}", e.getMessage());
            return new ResultUtil<Map<String, Object>>().setErrorMsg("创建充值失败: " + e.getMessage());
        }
    }

    @GetMapping("/account/records")
    public Result<List<QianFuRecharge>> getRechargeRecords(@RequestParam(required = false, defaultValue = "1") Long userId,
                                                            @RequestParam(required = false, defaultValue = "20") int limit) {
        try {
            List<QianFuRecharge> records = qianFuService.getRechargeRecords(userId, limit);
            return new ResultUtil<List<QianFuRecharge>>().setData(records);
        } catch (Exception e) {
            log.error("获取充值记录失败: {}", e.getMessage());
            return new ResultUtil<List<QianFuRecharge>>().setErrorMsg("获取充值记录失败");
        }
    }
}