package cn.exrick.controller;

import cn.exrick.bean.Pay;
import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import cn.exrick.common.utils.StringUtils;
import cn.exrick.service.PayService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.Set;

/**
 * StarMC Payment Gateway Controller
 * Modernized payment interface with Glassmorphism UI design
 * 
 * @author StarMC Team
 * @version 1.0.0
 */
@Controller
@RequestMapping("/starmc")
public class StarMCController {

    private static final Logger log = LoggerFactory.getLogger(StarMCController.class);

    @Autowired
    private PayService payService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    /**
     * Main payment page with modern Glassmorphism UI
     */
    @GetMapping("/pay")
    public String starmcPay() {
        log.info("Accessing StarMC Payment Gateway");
        return "starmc-pay";
    }

    /**
     * WeChat Pay QR code display page
     */
    @GetMapping("/wechat")
    public String starmcWechat(@RequestParam(required = false) String amount,
                               @RequestParam(required = false) String id,
                               HttpServletRequest request) {
        log.info("Accessing StarMC WeChat Pay - Amount: {}, ID: {}", amount, id);
        return "starmc-wechat";
    }

    /**
     * Alipay QR code display page
     */
    @GetMapping("/alipay")
    public String starmcAlipay(@RequestParam(required = false) String amount,
                               @RequestParam(required = false) String id,
                               HttpServletRequest request) {
        log.info("Accessing StarMC Alipay - Amount: {}, ID: {}", amount, id);
        return "starmc-alipay";
    }

    /**
     * Payment confirmation page
     */
    @GetMapping("/confirm")
    public String starmcConfirm() {
        log.info("Accessing StarMC Payment Confirmation");
        return "starmc-confirm";
    }

    /**
     * Payment success page
     */
    @GetMapping("/success")
    public String starmcSuccess() {
        log.info("Payment completed successfully");
        return "starmc-success";
    }

    /**
     * Settings page
     */
    @GetMapping("/settings")
    public String starmcSettings() {
        log.info("Accessing StarMC Settings");
        return "starmc-settings";
    }

    /**
     * API endpoint to get payment status
     */
    @GetMapping("/api/status/{payId}")
    @ResponseBody
    public Result<Object> getPaymentStatus(@PathVariable String payId) {
        try {
            Pay pay = payService.getPay(payId);
            int state = pay != null ? pay.getState() : -1;
            return new ResultUtil<Object>().setData(state);
        } catch (Exception e) {
            log.error("Error getting payment status: {}", e.getMessage());
            return new ResultUtil<Object>().setErrorMsg("Failed to get payment status");
        }
    }

    /**
     * Legacy redirect for backward compatibility
     */
    @RequestMapping("/{page}")
    public String showPage(@PathVariable String page,
                           HttpServletRequest request) {
        if (page.contains("pay-success") || page.contains("sendwxcode") || page.contains("sendxboot")) {
            return "redirect:/starmc/pay";
        }
        
        String id = request.getParameter("id");
        if ("openAlipay".equals(page) && StringUtils.isNotBlank(id)) {
            try {
                payService.changePayState(id, 4);
                Set<String> keys = redisTemplate.keys("xpay:*");
                if (keys != null && !keys.isEmpty()) {
                    redisTemplate.delete(keys);
                }
            } catch (Exception e) {
                log.error("Error updating payment state: {}", e.getMessage());
            }
        }
        
        return page;
    }
}
