@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

set "APP_NAME=xpay"
set "APP_VERSION=3.1.0"
set "APP_PORT=8888"
set "APP_DIR=%~dp0"
set "LOG_FILE=%APP_DIR%logs\install_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log"

set "JAVA_OK=0"
set "MAVEN_OK=0"
set "MYSQL_OK=0"
set "REDIS_OK=0"

echo.
echo ============================================================
echo   StarMC Payment System 一键安装脚本 v%APP_VERSION%
echo ============================================================
echo.

if not exist "%APP_DIR%logs" mkdir "%APP_DIR%logs"
if not exist "%APP_DIR%backups" mkdir "%APP_DIR%backups"
if not exist "%APP_DIR%config" mkdir "%APP_DIR%config"

:log
echo [%date% %time:~0,8%] [%~1] %~2 >> "%LOG_FILE%"
goto :eof

:check_java
where java >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr /i "version"') do set "JAVA_VER=%%i"
    echo [OK] Java 已安装: !JAVA_VER!
    call :log OK "Java 已安装: !JAVA_VER!"
    set "JAVA_OK=1"
    goto :eof
)
echo [FAIL] Java 未安装
call :log FAIL "Java 未安装"
goto :eof

:check_maven
where mvn >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('mvn -version 2^>^&1 ^| findstr /i "apache"') do set "MVN_VER=%%i"
    echo [OK] Maven 已安装: !MVN_VER!
    call :log OK "Maven 已安装"
    set "MAVEN_OK=1"
    goto :eof
)
echo [WARN] Maven 未安装
call :log WARN "Maven 未安装"
goto :eof

:check_mysql
where mysql >nul 2>&1
if %errorlevel% equ 0 (
    mysql -u root -e "SELECT 1" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] MySQL 已运行
        call :log OK "MySQL 已运行"
        set "MYSQL_OK=1"
        goto :eof
    )
)
net start | findstr /i "mysql" >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] MySQL 服务运行中
    call :log OK "MySQL 服务运行中"
    set "MYSQL_OK=1"
    goto :eof
)
echo [WARN] MySQL 未运行
call :log WARN "MySQL 未运行"
goto :eof

:check_redis
where redis-cli >nul 2>&1
if %errorlevel% equ 0 (
    redis-cli ping >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Redis 已运行
        call :log OK "Redis 已运行"
        set "REDIS_OK=1"
        goto :eof
    )
)
net start | findstr /i "redis" >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Redis 服务运行中
    call :log OK "Redis 服务运行中"
    set "REDIS_OK=1"
    goto :eof
)
echo [WARN] Redis 未运行
call :log WARN "Redis 未运行"
goto :eof

:check_port
netstat -an | findstr ":%~1.*LISTEN" >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARN] 端口 %~1 被占用
    call :log WARN "端口 %~1 被占用"
    goto :eof
)
echo [OK] 端口 %~1 可用
call :log OK "端口 %~1 可用"
goto :eof

:install_java
echo.
echo ============================================================
echo  安装 Java
echo ============================================================
echo.
call :log INFO "开始安装 Java"

echo 正在检测 Chocolatey...
where choco >nul 2>&1
if !errorlevel! equ 0 (
    echo 使用 Chocolatey 安装 OpenJDK 17...
    call :log INFO "使用 Chocolatey 安装 OpenJDK 17"
    choco install openjdk17 -y
) else (
    echo.
    echo 请手动安装 JDK 17:
    echo   1. 访问 https://adoptium.net/
    echo   2. 下载 JDK 17 (Temurin 17)
    echo   3. 安装并设置 JAVA_HOME 环境变量
    echo.
    call :log WARN "Chocolatey 未安装，请手动安装 Java"
    set "JAVA_OK=0"
    goto :eof
)

where java >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Java 安装成功
    call :log OK "Java 安装成功"
    set "JAVA_OK=1"
) else (
    echo [FAIL] Java 安装失败
    call :log FAIL "Java 安装失败"
)
goto :eof

:install_maven
echo.
echo ============================================================
echo  安装 Maven
echo ============================================================
echo.
call :log INFO "开始安装 Maven"

echo 正在检测 Chocolatey...
where choco >nul 2>&1
if !errorlevel! equ 0 (
    echo 使用 Chocolatey 安装 Maven...
    call :log INFO "使用 Chocolatey 安装 Maven"
    choco install maven -y
) else (
    echo.
    echo 请手动安装 Maven:
    echo   1. 访问 https://maven.apache.org/download.cgi
    echo   2. 下载 Apache Maven 3.9.x
    echo   3. 解压到 C:\Apache\maven
    echo   4. 设置 MAVEN_HOME 环境变量
    echo.
    call :log WARN "Chocolatey 未安装，请手动安装 Maven"
)
goto :eof

:generate_config
echo.
echo ============================================================
echo  生成配置文件
echo ============================================================
echo.
call :log INFO "生成配置文件"

set "CONFIG_FILE=%APP_DIR%config\app.properties"

(
echo # StarMC Payment System Configuration
echo # 生成时间: %date% %time%
echo.
echo # 数据库配置
echo spring.datasource.url=jdbc:mysql^:^/^/localhost^:3306^/xpay^?useUnicode^=true^&characterEncoding^=utf8^&useSSL^=false^&serverTimezone^=Asia^/Shanghai
echo spring.datasource.username=root
echo spring.datasource.password=
echo spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
echo.
echo # Druid 连接池
echo spring.datasource.druid.initial-size=5
echo spring.datasource.druid.max-active=20
echo spring.datasource.druid.min-idle=5
echo.
echo # Redis 配置
echo spring.redis.host=localhost
echo spring.redis.port=6379
echo spring.redis.password=
echo spring.redis.database=0
echo.
echo # 应用配置
echo server.port=%APP_PORT%
echo spring.application.name=xpay
echo.
echo # 日志配置
echo logging.path=%APP_DIR%logs
echo logging.level.cn.exrick=DEBUG
) > "%CONFIG_FILE%"

echo [OK] 配置文件已生成: %CONFIG_FILE%
call :log OK "配置文件已生成: %CONFIG_FILE%"
goto :eof

:compile_project
echo.
echo ============================================================
echo  编译项目
echo ============================================================
echo.
call :log INFO "开始编译项目"

if not exist "%APP_DIR%pom.xml" (
    echo [FAIL] pom.xml 不存在
    call :log FAIL "pom.xml 不存在"
    goto :eof
)

cd /d "%APP_DIR%"

where mvn >nul 2>&1
if !errorlevel! equ 0 (
    echo 编译中 (首次可能需要几分钟)...
    call :log INFO "执行 mvn clean package -DskipTests"
    call mvn clean package -DskipTests
    if !errorlevel! equ 0 (
        echo [OK] 编译成功
        call :log OK "编译成功"
    ) else (
        echo [FAIL] 编译失败
        call :log FAIL "编译失败"
    )
) else (
    echo [WARN] Maven 未安装，跳过编译
    call :log WARN "Maven 未安装，跳过编译"
    dir /s /b "%APP_DIR%target\*.jar" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [FAIL] 未找到 JAR 文件
        call :log FAIL "未找到 JAR 文件"
    )
)
goto :eof

:start_app
echo.
echo ============================================================
echo  启动应用
echo ============================================================
echo.
call :log INFO "启动应用"

for /r "%APP_DIR%target" %%f in (xpay-*.jar) do set "JAR_FILE=%%f"

if not defined JAR_FILE (
    echo [FAIL] 未找到 JAR 文件
    call :log FAIL "未找到 JAR 文件"
    goto :eof
)

echo 启动: %JAR_FILE%
call :log INFO "启动: %JAR_FILE%"

start "StarMC Payment" cmd /c "java -Xms256m -Xmx512m -jar \"%JAR_FILE%\" --spring.config.location=\"%APP_DIR%src\main\resources\application.properties\""

echo 等待应用启动 (最多60秒)...
call :log INFO "等待应用启动"

set "STARTUP_WAIT=0"
:wait_loop
ping -n 2 localhost >nul 2>&1
curl -s http://localhost:%APP_PORT%/starmc/pay >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] 应用启动成功!
    call :log OK "应用启动成功"
    goto :eof
)
set /a STARTUP_WAIT+=1
if !STARTUP_WAIT! lss 30 goto :wait_loop

echo [WARN] 启动超时，请检查日志
call :log WARN "启动超时"
goto :eof

:main
echo.
echo ============================================================
echo 第一步: 环境检测
echo ============================================================
echo.

call :check_java
call :check_maven
call :check_mysql
call :check_redis
call :check_port %APP_PORT%

echo.
if "!JAVA_OK!"=="0" (
    set /p INSTALL_JAVA="是否安装 Java? (y/N): "
    if /i "!INSTALL_JAVA!"=="y" call :install_java
)

if "!MAVEN_OK!"=="0" (
    set /p INSTALL_MAVEN="是否安装 Maven? (y/N): "
    if /i "!INSTALL_MAVEN!"=="y" call :install_maven
)

if "!MYSQL_OK!"=="0" (
    set /p INSTALL_MYSQL="是否安装 MySQL? (y/N): "
    if /i "!INSTALL_MYSQL!"=="y" call :install_mysql
)

if "!REDIS_OK!"=="0" (
    set /p INSTALL_REDIS="是否安装 Redis? (y/N): "
    if /i "!INSTALL_REDIS!"=="y" call :install_redis
)

echo.
echo ============================================================
echo 第二步: 配置项目
echo ============================================================
echo.
call :generate_config

echo.
echo ============================================================
echo 第三步: 编译打包
echo ============================================================
echo.
call :compile_project

echo.
echo ============================================================
echo 第四步: 启动应用
echo ============================================================
echo.
call :start_app

echo.
echo ============================================================
echo 安装完成!
echo ============================================================
echo.
echo   访问地址: http://localhost:%APP_PORT%/starmc/pay
echo   管理后台: http://localhost:%APP_PORT%/starmc/settings
echo   安装日志: %LOG_FILE%
echo.
echo 按任意键退出...
pause >nul
