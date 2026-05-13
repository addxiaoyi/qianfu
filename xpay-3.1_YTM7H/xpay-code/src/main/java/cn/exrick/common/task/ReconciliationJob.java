package cn.exrick.common.task;

import cn.exrick.bean.Pay;
import cn.exrick.bean.dto.Count;
import cn.exrick.service.PayService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Component
public class ReconciliationJob {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationJob.class);

    private static final SimpleDateFormat DATE_FORMATTER = new SimpleDateFormat("yyyy-MM-dd");

    @Autowired
    private PayService payService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Scheduled(cron = "0 30 0 * * ?")
    public void dailyReconciliation() {
        log.info("开始执行日对账任务");
        try {
            String yesterday = DATE_FORMATTER.format(new Date(System.currentTimeMillis() - 86400000L));
            ReconciliationReport report = reconcile(yesterday);
            saveReconciliationReport(report);
            log.info("日对账任务完成: {}", report);
        } catch (Exception e) {
            log.error("日对账任务执行失败", e);
        }
    }

    @Scheduled(cron = "0 0 1 * * ?")
    public void checkAbnormalOrders() {
        log.info("开始检查异常订单");
        try {
            List<AbnormalOrder> abnormalOrders = findAbnormalOrders();
            handleAbnormalOrders(abnormalOrders);
            log.info("异常订单检查完成, 发现 {} 个异常订单", abnormalOrders.size());
        } catch (Exception e) {
            log.error("异常订单检查失败", e);
        }
    }

    public ReconciliationReport reconcile(String date) {
        ReconciliationReport report = new ReconciliationReport();
        report.setDate(date);
        report.setStartTime(System.currentTimeMillis());

        try {
            Count count = payService.statistic(1, date, date);

            report.setTotalCount(count.getAmount() != null ? count.getAmount().intValue() : 0);
            report.setSuccessCount(count.getAmount() != null ? count.getAmount().intValue() : 0);
            report.setFailedCount(0);
            report.setPendingCount(0);
            report.setClosedCount(0);
            report.setTotalAmount(count.getAmount() != null ? count.getAmount().doubleValue() : 0.0);

            List<AbnormalOrder> exceptions = new ArrayList<>();
            List<Pay> pendingPays = payService.getPayList(0);
            for (Pay order : pendingPays) {
                if (order.getCreateTime() != null) {
                    long createTime = order.getCreateTime().getTime();
                    if ((System.currentTimeMillis() - createTime) > 30 * 60 * 1000) {
                        exceptions.add(new AbnormalOrder(order.getId(), "TIMEOUT", "支付超时未完成"));
                    }
                }
                if (order.getMoney() != null && order.getMoney().compareTo(new java.math.BigDecimal("0")) <= 0) {
                    exceptions.add(new AbnormalOrder(order.getId(), "AMOUNT_ERROR", "订单金额异常"));
                }
            }

            report.setExceptions(exceptions);
        } catch (Exception e) {
            log.error("对账时发生错误", e);
        }

        report.setEndTime(System.currentTimeMillis());
        report.setDuration(report.getEndTime() - report.getStartTime());

        return report;
    }

    private List<AbnormalOrder> findAbnormalOrders() {
        List<AbnormalOrder> abnormalOrders = new ArrayList<>();

        try {
            String timeoutKey = "xpay:orders:timeout";
            Set<String> timeoutOrderIds = redisTemplate.opsForZSet().rangeByScore(timeoutKey, 0, System.currentTimeMillis());

            if (timeoutOrderIds != null) {
                for (String orderId : timeoutOrderIds) {
                    abnormalOrders.add(new AbnormalOrder(orderId, "TIMEOUT", "支付超时"));
                }
            }
        } catch (Exception e) {
            log.error("查找异常订单失败", e);
        }

        return abnormalOrders;
    }

    private void handleAbnormalOrders(List<AbnormalOrder> abnormalOrders) {
        for (AbnormalOrder order : abnormalOrders) {
            try {
                switch (order.getType()) {
                    case "TIMEOUT":
                        handleTimeoutOrder(order);
                        break;
                    case "AMOUNT_ERROR":
                        handleAmountMismatch(order);
                        break;
                    default:
                        log.warn("未知异常类型: {}", order.getType());
                }
            } catch (Exception e) {
                log.error("处理异常订单失败: {}", order.getOrderNo(), e);
            }
        }
    }

    private void handleTimeoutOrder(AbnormalOrder order) {
        try {
            payService.changePayState(order.getOrderNo(), 4);
            log.info("超时订单已关闭: {}", order.getOrderNo());
        } catch (Exception e) {
            log.error("关闭超时订单失败: {}", order.getOrderNo(), e);
        }
    }

    private void handleAmountMismatch(AbnormalOrder order) {
        log.warn("金额异常订单: {}, 金额: {}", order.getOrderNo(), order.getRemark());
    }

    private void saveReconciliationReport(ReconciliationReport report) {
        try {
            String key = "xpay:reconciliation:" + report.getDate();
            String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(report);
            redisTemplate.opsForValue().set(key, json, 90, TimeUnit.DAYS);
        } catch (Exception e) {
            log.error("保存对账报告失败", e);
        }
    }

    public ReconciliationReport getReport(String date) {
        try {
            String key = "xpay:reconciliation:" + date;
            String json = redisTemplate.opsForValue().get(key);
            if (json != null) {
                return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, ReconciliationReport.class);
            }
        } catch (Exception e) {
            log.error("获取对账报告失败: " + date, e);
        }
        return null;
    }

    public List<ReconciliationReport> getRecentReports(int days) {
        List<ReconciliationReport> reports = new ArrayList<>();
        for (int i = 1; i <= days; i++) {
            String date = DATE_FORMATTER.format(new Date(System.currentTimeMillis() - 86400000L * i));
            ReconciliationReport report = getReport(date);
            if (report != null) {
                reports.add(report);
            }
        }
        return reports;
    }

    public static class ReconciliationReport {
        private String date;
        private int totalCount;
        private int successCount;
        private int failedCount;
        private int pendingCount;
        private int closedCount;
        private double totalAmount;
        private List<AbnormalOrder> exceptions;
        private long startTime;
        private long endTime;
        private long duration;

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }
        public int getTotalCount() { return totalCount; }
        public void setTotalCount(int totalCount) { this.totalCount = totalCount; }
        public int getSuccessCount() { return successCount; }
        public void setSuccessCount(int successCount) { this.successCount = successCount; }
        public int getFailedCount() { return failedCount; }
        public void setFailedCount(int failedCount) { this.failedCount = failedCount; }
        public int getPendingCount() { return pendingCount; }
        public void setPendingCount(int pendingCount) { this.pendingCount = pendingCount; }
        public int getClosedCount() { return closedCount; }
        public void setClosedCount(int closedCount) { this.closedCount = closedCount; }
        public double getTotalAmount() { return totalAmount; }
        public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }
        public List<AbnormalOrder> getExceptions() { return exceptions; }
        public void setExceptions(List<AbnormalOrder> exceptions) { this.exceptions = exceptions; }
        public long getStartTime() { return startTime; }
        public void setStartTime(long startTime) { this.startTime = startTime; }
        public long getEndTime() { return endTime; }
        public void setEndTime(long endTime) { this.endTime = endTime; }
        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }

        @Override
        public String toString() {
            return "ReconciliationReport{" +
                    "date='" + date + '\'' +
                    ", totalCount=" + totalCount +
                    ", successCount=" + successCount +
                    ", failedCount=" + failedCount +
                    ", pendingCount=" + pendingCount +
                    ", totalAmount=" + totalAmount +
                    ", exceptions=" + (exceptions != null ? exceptions.size() : 0) +
                    '}';
        }
    }

    public static class AbnormalOrder {
        private String orderNo;
        private String type;
        private String remark;

        public AbnormalOrder(String orderNo, String type, String remark) {
            this.orderNo = orderNo;
            this.type = type;
            this.remark = remark;
        }

        public String getOrderNo() { return orderNo; }
        public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
    }
}