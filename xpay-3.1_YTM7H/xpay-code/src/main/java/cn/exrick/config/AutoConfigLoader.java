package cn.exrick.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.core.io.support.PropertySourceFactory;

import java.io.IOException;
import java.util.*;

@Configuration
@EnableConfigurationProperties(QianFuProperties.class)
public class AutoConfigLoader {

    public static class EnvPropertySourceFactory implements PropertySourceFactory {
        @Override
        public PropertySource<?> createPropertySource(String name, EncodedResource resource) throws IOException {
            Properties props = new Properties();
            props.load(resource.getInputStream());
            Map<String, Object> map = new HashMap<>();
            for (String key : props.stringPropertyNames()) {
                map.put(key, props.getProperty(key));
            }
            String sourceName = name != null ? name : resource.getResource().getFilename();
            return new MapPropertySource(sourceName, map);
        }
    }

    public static Map<String, Object> loadEnvConfig() {
        Map<String, Object> envConfig = new HashMap<>();

        List<String> configPaths = Arrays.asList(
            ".env",
            "../.env",
            "../../.env",
            System.getProperty("user.home") + "/.starmc/.env"
        );

        for (String path : configPaths) {
            try {
                Resource resource = new FileSystemResource(path);
                if (resource.exists()) {
                    Properties props = new Properties();
                    props.load(resource.getInputStream());
                    for (String key : props.stringPropertyNames()) {
                        envConfig.put(key, props.getProperty(key));
                    }
                    break;
                }
            } catch (IOException e) {
            }
        }

        return envConfig;
    }

    public static Map<String, String> detectEnvironment() {
        Map<String, String> env = new HashMap<>();

        env.put("java.version", System.getProperty("java.version", "unknown"));
        env.put("os.name", System.getProperty("os.name", "unknown"));
        env.put("user.dir", System.getProperty("user.dir", "unknown"));
        env.put("maven.home", System.getenv().getOrDefault("MAVEN_HOME",
            System.getenv().getOrDefault("M2_HOME", "unknown")));
        env.put("java.home", System.getProperty("java.home", "unknown"));

        String dbHost = System.getenv("DB_HOST");
        if (dbHost == null) dbHost = "127.0.0.1";
        env.put("db.host", dbHost);

        String redisHost = System.getenv("REDIS_HOST");
        if (redisHost == null) redisHost = "127.0.0.1";
        env.put("redis.host", redisHost);

        return env;
    }

    public static boolean checkDatabaseConnection() {
        String dbHost = System.getProperty("db.host", "127.0.0.1");
        int dbPort = Integer.parseInt(System.getProperty("db.port", "3306"));
        return checkPort(dbHost, dbPort);
    }

    public static boolean checkRedisConnection() {
        String redisHost = System.getProperty("redis.host", "127.0.0.1");
        int redisPort = Integer.parseInt(System.getProperty("redis.port", "6379"));
        return checkPort(redisHost, redisPort);
    }

    private static boolean checkPort(String host, int port) {
        try {
            java.net.Socket socket = new java.net.Socket();
            socket.connect(new java.net.InetSocketAddress(host, port), 2000);
            socket.close();
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    public static String getOptimalDriverClass() {
        String dbType = System.getProperty("db.type", "mysql");
        switch (dbType.toLowerCase()) {
            case "mysql":
                return "com.mysql.cj.jdbc.Driver";
            case "mariadb":
                return "org.mariadb.jdbc.Driver";
            case "postgresql":
                return "org.postgresql.Driver";
            default:
                return "com.mysql.cj.jdbc.Driver";
        }
    }
}
