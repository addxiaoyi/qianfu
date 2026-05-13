package cn.exrick.common.task;

import cn.exrick.bean.QianFuConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.DelayQueue;
import java.util.concurrent.Delayed;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@SuppressWarnings("unused")
@Component
public class CallbackQueue {

    private static final Logger log = LoggerFactory.getLogger(CallbackQueue.class);

    private static final String QUEUE_KEY = "xpay:callback:queue";
    private static final String RETRY_KEY = "xpay:callback:retry";

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired(required = false)
    private QianFuConfig qianFuConfig;

    private final BlockingQueue<CallbackTask> callbackQueue = new DelayQueue<>();
    private volatile boolean running = true;

    @PostConstruct
    public void init() {
        if (qianFuConfig != null && qianFuConfig.isEnabled()) {
            startConsumer();
            log.info("回调队列初始化完成");
        }
    }

    public void addCallback(CallbackTask task) {
        if (task == null) return;
        callbackQueue.offer(task);
        log.info("回调任务已加入队列: {}", task.getTaskId());
    }

    public void addCallback(String url, String payload, int priority) {
        CallbackTask task = new CallbackTask(url, payload, priority);
        addCallback(task);
    }

    public void retryCallback(CallbackTask task) {
        task.incrementRetryCount();
        int attempt = task.getRetryCount();
        long delay = getRetryDelay(attempt);
        task.setDelay(delay);
        callbackQueue.offer(task);
        log.info("回调任务重试: {}, 第{}次, 延迟{}ms", task.getTaskId(), attempt, delay);
    }

    private long getRetryDelay(int attempt) {
        if (qianFuConfig == null || qianFuConfig.getRetry() == null) {
            long[] defaultDelays = {0, 30000, 120000, 600000, 1800000};
            if (attempt < 0 || attempt >= defaultDelays.length) {
                return defaultDelays[defaultDelays.length - 1];
            }
            return defaultDelays[attempt];
        }
        return qianFuConfig.getRetry().getDelay(attempt);
    }

    private void startConsumer() {
        Thread consumerThread = new Thread(() -> {
            log.info("回调队列消费线程启动");
            while (running) {
                try {
                    CallbackTask task = callbackQueue.poll(5, TimeUnit.SECONDS);
                    if (task != null) {
                        processCallback(task);
                    }
                } catch (InterruptedException e) {
                    log.warn("回调队列消费线程被中断");
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("处理回调任务时发生错误", e);
                }
            }
            log.info("回调队列消费线程退出");
        }, "callback-queue-consumer");
        consumerThread.setDaemon(true);
        consumerThread.start();
    }

    private void processCallback(CallbackTask task) {
        try {
            boolean success = executeCallback(task);

            if (success) {
                log.info("回调成功: {}", task.getTaskId());
                recordCallbackSuccess(task);
            } else {
                handleCallbackFailure(task);
            }
        } catch (Exception e) {
            log.error("执行回调失败: {}", task.getTaskId(), e);
            handleCallbackFailure(task);
        }
    }

    private boolean executeCallback(CallbackTask task) {
        try {
            java.net.HttpURLConnection connection = null;
            try {
                java.net.URL url = new java.net.URL(task.getUrl());
                connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("X-Callback-Id", task.getTaskId());
                connection.setRequestProperty("X-Callback-Attempt", String.valueOf(task.getRetryCount()));

                if (task.getPayload() != null) {
                    try (java.io.OutputStream os = connection.getOutputStream()) {
                        os.write(task.getPayload().getBytes("UTF-8"));
                    }
                }

                int responseCode = connection.getResponseCode();
                return responseCode >= 200 && responseCode < 300;
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        } catch (Exception e) {
            log.error("发送回调请求异常: {}", e.getMessage());
            return false;
        }
    }

    private void handleCallbackFailure(CallbackTask task) {
        int maxAttempts = 5;
        if (qianFuConfig != null && qianFuConfig.getRetry() != null) {
            maxAttempts = qianFuConfig.getRetry().getMaxAttempts();
        }

        if (task.getRetryCount() < maxAttempts) {
            retryCallback(task);
        } else {
            log.error("回调任务最终失败: {}, 已重试{}次", task.getTaskId(), task.getRetryCount());
            recordCallbackFailure(task);
        }
    }

    private void recordCallbackSuccess(CallbackTask task) {
        try {
            String key = "xpay:callback:success:" + task.getTaskId();
            redisTemplate.opsForValue().set(key, "1", 7, TimeUnit.DAYS);
        } catch (Exception e) {
            log.warn("记录回调成功状态失败", e);
        }
    }

    private void recordCallbackFailure(CallbackTask task) {
        try {
            String key = "xpay:callback:failed:" + task.getTaskId();
            redisTemplate.opsForValue().set(key, task.getPayload(), 30, TimeUnit.DAYS);
        } catch (Exception e) {
            log.warn("记录回调失败状态失败", e);
        }
    }

    public void shutdown() {
        running = false;
    }

    public static class CallbackTask implements Delayed {
        private final String taskId;
        private final String url;
        private final String payload;
        private final int priority;
        private final long createTime;
        private long delay;
        private AtomicInteger retryCount;

        public CallbackTask(String url, String payload, int priority) {
            this.taskId = java.util.UUID.randomUUID().toString();
            this.url = url;
            this.payload = payload;
            this.priority = priority;
            this.createTime = System.currentTimeMillis();
            this.delay = 0;
            this.retryCount = new AtomicInteger(0);
        }

        public String getTaskId() {
            return taskId;
        }

        public String getUrl() {
            return url;
        }

        public String getPayload() {
            return payload;
        }

        public int getPriority() {
            return priority;
        }

        public int getRetryCount() {
            return retryCount.get();
        }

        public void incrementRetryCount() {
            retryCount.incrementAndGet();
        }

        public void setDelay(long delay) {
            this.delay = delay;
        }

        @Override
        public long getDelay(TimeUnit unit) {
            return unit.convert(delay, TimeUnit.MILLISECONDS);
        }

        @Override
        public int compareTo(Delayed o) {
            CallbackTask other = (CallbackTask) o;
            if (this.priority != other.priority) {
                return Integer.compare(other.priority, this.priority);
            }
            return Long.compare(this.createTime, other.createTime);
        }
    }
}