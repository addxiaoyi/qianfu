package cn.exrick.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Swagger2Config {

    private Logger log = LoggerFactory.getLogger(Swagger2Config.class);

    public Swagger2Config() {
        // 本地最小可运行版本：不启用 Springfox/OpenAPI 文档初始化，避免在部分环境启动失败
        log.info("Swagger2Config loaded (docs disabled for local minimal run).");
    }
}
