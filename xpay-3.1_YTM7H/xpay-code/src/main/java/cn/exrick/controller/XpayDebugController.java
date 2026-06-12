package cn.exrick.controller;

import cn.exrick.bean.dto.Result;
import cn.exrick.common.utils.ResultUtil;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping("/open/debug")
public class XpayDebugController {

    private final AtomicReference<Map<String, Object>> lastCallback = new AtomicReference<>();

    @PostMapping("/callback-echo")
    public Result<Map<String, Object>> callbackEcho(@RequestBody Map<String, Object> payload) {
        lastCallback.set(new LinkedHashMap<>(payload));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("received", true);
        result.put("payload", payload);
        return new ResultUtil<Map<String, Object>>().setData(result, "callback received");
    }

    @GetMapping("/callback-echo")
    public Result<Map<String, Object>> lastCallback() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("lastCallback", lastCallback.get());
        return new ResultUtil<Map<String, Object>>().setData(result);
    }
}
