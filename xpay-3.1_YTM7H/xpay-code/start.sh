#!/bin/bash
# =================================================================
# StarMC Payment System - 一键部署启动脚本
# 版本: 3.1
# 平台: Linux (主流发行版)
# 功能: 环境检测 -> 依赖安装 -> 端口清理 -> 编译部署 -> 启动运行
# =================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="xpay"
APP_VERSION="3.1.0"
APP_PORT=${APP_PORT:-8888}
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/start_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "${LOG_DIR}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"; }
ok() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] $1" >> "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1" >> "$LOG_FILE"; }
fail() { echo -e "${RED}[FAIL]${NC} $(date '+%H:%M:%S') $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [FAIL] $1" >> "$LOG_FILE"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; echo "━━━ $1 ━━━" >> "$LOG_FILE"; }

get_os() {
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        echo "$ID"
    elif [[ -f /etc/redhat-release ]]; then
        echo "rhel"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

need_root() {
    if [[ $EUID -ne 0 ]]; then
        warn "此操作需要 root 权限，请使用 sudo 运行"
        exit 1
    fi
}

check_network() {
    log "检测网络连通性..."
    local hosts=("8.8.8.8" "114.114.114.114" "www.baidu.com")
    for host in "${hosts[@]}"; do
        if ping -c 1 -W 3 "$host" &>/dev/null; then
            ok "网络正常"
            return 0
        fi
    done
    warn "网络可能存在问题"
    return 0
}

check_java() {
    if command -v java &>/dev/null; then
        local version=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
        ok "Java 已安装: $version"
        return 0
    fi
    return 1
}

check_maven() {
    if command -v mvn &>/dev/null; then
        ok "Maven 已安装"
        return 0
    fi
    if [[ -x "/opt/apache-maven/bin/mvn" ]]; then
        ok "Maven 已安装"
        return 0
    fi
    return 1
}

check_port() {
    if ss -tlnp 2>/dev/null | grep -q ":${1} "; then
        return 0
    elif netstat -tlnp 2>/dev/null | grep -q ":${1} "; then
        return 0
    fi
    return 1
}

check_mysql() {
    if command -v mysql &>/dev/null; then
        if mysql -u root -e "SELECT 1" &>/dev/null; then
            ok "MySQL 运行中"
            return 0
        fi
    fi
    if pgrep -x mysqld &>/dev/null; then
        ok "MySQL 进程运行中"
        return 0
    fi
    return 1
}

check_redis() {
    if command -v redis-cli &>/dev/null; then
        if redis-cli ping &>/dev/null; then
            ok "Redis 运行中"
            return 0
        fi
    fi
    if pgrep -x redis-server &>/dev/null; then
        ok "Redis 进程运行中"
        return 0
    fi
    return 1
}

install_java() {
    local os=$1
    log "安装 OpenJDK 17..."
    case "$os" in
        debian|ubuntu|linuxmint)
            DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jdk 2>&1 | tail -3
            ;;
        rhel|centos|rocky|alma)
            yum install -y java-17-openjdk java-17-openjdk-devel 2>&1 | tail -3
            ;;
        fedora)
            dnf install -y java-17-openjdk java-17-openjdk-devel 2>&1 | tail -3
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm jdk17-openjdk 2>&1 | tail -3
            ;;
        alpine)
            apk add openjdk17-jre openjdk17-jdk 2>&1 | tail -3
            ;;
    esac
}

install_maven() {
    local os=$1
    log "安装 Maven..."

    if [[ -d "/opt/apache-maven" ]]; then
        ok "Maven 已安装"
        return 0
    fi

    local MAVEN_VERSION="3.9.6"
    local urls=(
        "https://dlcdn.apache.org/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
        "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
        "https://mirrors.aliyun.com/apache/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
    )

    for url in "${urls[@]}"; do
        log "尝试: $(echo $url | sed 's|https://||' | cut -d/ -f1)"
        if curl -L --connect-timeout 30 --max-time 300 -o "/tmp/maven.tar.gz" "$url" 2>&1; then
            if [[ -f "/tmp/maven.tar.gz" && $(stat -c%s /tmp/maven.tar.gz 2>/dev/null || stat -f%z /tmp/maven.tar.gz 2>/dev/null || echo 0) -gt 5000000 ]]; then
                tar -xzf /tmp/maven.tar.gz -C /opt
                mv /opt/apache-maven-${MAVEN_VERSION} /opt/apache-maven
                rm -f /tmp/maven.tar.gz
                export PATH="/opt/apache-maven/bin:$PATH"
                ok "Maven 安装完成"
                return 0
            fi
        fi
    done

    fail "Maven 安装失败"
    return 1
}

install_basic_tools() {
    local os=$1
    log "安装基础工具..."
    case "$os" in
        debian|ubuntu|linuxmint)
            apt-get update -qq && apt-get install -y curl wget net-tools lsof iproute2 procps 2>&1 | tail -2
            ;;
        rhel|centos|rocky|alma)
            yum install -y curl wget net-tools lsof iproute procps-ng 2>&1 | tail -2
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm curl wget net-tools lsof iproute2 procps-ng 2>&1 | tail -2
            ;;
        alpine)
            apk add curl wget net-tools lsof iproute2 procps 2>&1 | tail -2
            ;;
    esac
}

kill_port() {
    local port=$1
    log "清理端口 $port..."

    if ! check_port "$port"; then
        ok "端口 $port 空闲"
        return 0
    fi

    local pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | sed -r 's/.*pid=([0-9]+).*/\1/' | sort -u)
    [[ -z "$pids" ]] && pids=$(netstat -tlnp 2>/dev/null | grep ":${port} " | sed -r 's/.*pid=([0-9]+).*/\1/' | sort -u)

    for pid in $pids; do
        [[ -z "$pid" || ! "$pid" =~ ^[0-9]+$ ]] && continue
        local pname=$(cat "/proc/$pid/comm" 2>/dev/null || echo "unknown")
        log "终止 PID $pid ($pname)..."
        kill "$pid" 2>/dev/null || true
        sleep 1
        kill -9 "$pid" 2>/dev/null || true
    done

    sleep 2

    if check_port "$port"; then
        fail "端口 $port 清理失败"
        return 1
    fi
    ok "端口 $port 清理完成"
    return 0
}

install_mysql() {
    local os=$1
    log "安装 MySQL 8..."

    case "$os" in
        debian|ubuntu|linuxmint)
            DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server 2>&1 | tail -5
            service mysql start || systemctl start mysql || true
            ;;
        rhel|centos|rocky|alma)
            yum install -y mysql-server 2>&1 | tail -5
            systemctl start mysqld || systemctl start mysql || true
            ;;
        fedora)
            dnf install -y mysql-server 2>&1 | tail -5
            systemctl start mysqld || true
            ;;
        alpine)
            apk add mysql mysql-client 2>&1 | tail -5
            ;;
    esac
}

install_redis_server() {
    local os=$1
    log "安装 Redis..."

    case "$os" in
        debian|ubuntu|linuxmint)
            DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server 2>&1 | tail -5
            service redis-server start || systemctl start redis || true
            ;;
        rhel|centos|rocky|alma)
            yum install -y redis 2>&1 | tail -5
            systemctl start redis || true
            ;;
        fedora)
            dnf install -y redis 2>&1 | tail -5
            systemctl start redis || true
            ;;
        alpine)
            apk add redis 2>&1 | tail -5
            ;;
    esac
}

init_database() {
    log "初始化数据库..."

    local sql_file="${SCRIPT_DIR}/sql/init.sql"
    if [[ ! -f "$sql_file" ]]; then
        warn "数据库初始化脚本不存在: $sql_file"
        return 1
    fi

    local db_host="${DB_HOST:-127.0.0.1}"
    local db_user="root"
    local db_pass="${DB_PASSWORD:-}"
    local db_name="${DB_NAME:-xpay}"

    if mysql -h "$db_host" -u "$db_user" ${db_pass:+-p"$db_pass"} -e "USE $db_name;" 2>/dev/null; then
        ok "数据库 $db_name 已存在"
    else
        log "创建数据库 $db_name..."
        if mysql -h "$db_host" -u "$db_user" ${db_pass:+-p"$db_pass"} -e "CREATE DATABASE IF NOT EXISTS $db_name DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null; then
            ok "数据库创建成功"
        else
            warn "数据库创建失败，尝试无密码连接..."
            mysql -h "$db_host" -u "$db_user" -e "CREATE DATABASE IF NOT EXISTS $db_name DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
        fi
    fi

    log "执行表结构初始化..."
    if mysql -h "$db_host" -u "$db_user" ${db_pass:+-p"$db_pass"} "$db_name" < "$sql_file" 2>/dev/null; then
        ok "表结构初始化成功"
    else
        warn "表结构初始化失败，尝试无密码连接..."
        mysql -h "$db_host" -u "$db_user" "$db_name" < "$sql_file" 2>/dev/null || warn "表结构可能已存在"
    fi

    return 0
}

compile_project() {
    log "编译项目 (可能需要几分钟)..."

    cd "${SCRIPT_DIR}"

    local mvn_cmd="mvn"
    if ! command -v mvn &>/dev/null && [[ -x "/opt/apache-maven/bin/mvn" ]]; then
        mvn_cmd="/opt/apache-maven/bin/mvn"
    fi

    if ! command -v mvn &>/dev/null && [[ ! -x "/opt/apache-maven/bin/mvn" ]]; then
        fail "Maven 未安装"
        return 1
    fi

    if $mvn_cmd clean package -DskipTests 2>&1 | tail -20; then
        ok "编译成功"
        return 0
    else
        fail "编译失败"
        return 1
    fi
}

start_app() {
    log "启动应用..."

    local jar_file=$(find "${SCRIPT_DIR}/target" -name "${APP_NAME}-${APP_VERSION}.jar" 2>/dev/null | head -1)
    [[ -z "$jar_file" ]] && jar_file=$(find "${SCRIPT_DIR}/target" -name "*.jar" 2>/dev/null | head -1)

    if [[ -z "$jar_file" ]]; then
        fail "未找到 JAR 文件"
        return 1
    fi

    ok "启动: $(basename "$jar_file")"

    local java_opts="-Xms256m -Xmx512m"

    [[ -n "${DB_PASSWORD:-}" ]] && java_opts="$java_opts -Dspring.datasource.password=$DB_PASSWORD"
    [[ -n "${DB_HOST:-}" ]] && java_opts="$java_opts -Dspring.datasource.url=jdbc:mysql://$DB_HOST:3306/xpay"
    [[ -n "${REDIS_PASSWORD:-}" ]] && java_opts="$java_opts -Dspring.redis.password=$REDIS_PASSWORD"
    [[ -n "${SERVER_URL:-}" ]] && java_opts="$java_opts -Dserver.url=$SERVER_URL"
    [[ -n "${APP_PORT:-}" ]] && java_opts="$java_opts -Dserver.port=$APP_PORT"

    nohup java $java_opts -jar "$jar_file" \
        --spring.config.location="${SCRIPT_DIR}/src/main/resources/application.properties" \
        > "${LOG_DIR}/app.log" 2>&1 &

    local app_pid=$!
    echo "$app_pid" > "${LOG_DIR}/app.pid"

    ok "应用 PID: $app_pid"
    log "等待启动 (最多60秒)..."

    for i in {1..60}; do
        if check_port "$APP_PORT"; then
            ok "应用启动成功!"
            return 0
        fi
        sleep 1
        [[ $((i % 10)) -eq 0 ]] && log "已等待 ${i} 秒..."
    done

    warn "启动超时，请检查日志: ${LOG_DIR}/app.log"
    return 1
}

show_help() {
    cat << EOF
${CYAN}StarMC Payment System 一键部署脚本 v${APP_VERSION}${NC}

${GREEN}用法:${NC}
  ./start.sh              一键部署并启动 (完整流程)
  ./start.sh deploy       同上
  ./start.sh only-start   仅启动已编译的应用
  ./start.sh only-compile 仅编译项目
  ./start.sh status       查看服务状态
  ./start.sh stop         停止应用
  ./start.sh clean        清理占用端口
  ./start.sh log          查看应用日志
  ./start.sh help         显示帮助信息

${GREEN}部署流程:${NC}
  1. 环境检测 - 检查 Java/Maven/MySQL/Redis
  2. 安装依赖 - 自动安装缺失的组件
  3. 数据库初始化 - 自动创建数据库和表
  4. 清理端口 - 释放 3306/6379/${APP_PORT} 端口
  5. 编译项目 - Maven 打包
  6. 启动应用 - 运行 JAR

${GREEN}环境变量配置:${NC}
  DB_PASSWORD=xxx    MySQL密码 (默认: 空)
  DB_HOST=xxx        数据库地址 (默认: 127.0.0.1)
  DB_NAME=xpay       数据库名 (默认: xpay)
  REDIS_PASSWORD=xxx Redis密码 (默认: 空)
  SERVER_URL=http://domain:8888  服务器URL
  APP_PORT=8888      应用端口 (默认: 8888)

${GREEN}示例:${NC}
  DB_PASSWORD=mysecret ./start.sh

${GREEN}访问地址:${NC}
  支付页面: http://localhost:${APP_PORT}/starmc/pay
  管理后台: http://localhost:${APP_PORT}/starmc/settings

${GREEN}支持系统:${NC}
  Debian/Ubuntu, RHEL/CentOS/Rocky/Alma, Arch/Manjaro, Alpine, Fedora, openSUSE

${GREEN}注意事项:${NC}
  - clean/stop 等操作需要 root 权限，请使用 sudo
  - 首次运行会自动下载并安装 Maven (约 10MB)
  - 编译可能需要 3-5 分钟，请耐心等待
  - 数据库会自动创建，无需手动执行SQL

EOF
}

main() {
    echo -e "${CYAN}"
    echo "============================================================"
    echo "  StarMC Payment System 一键部署 v${APP_VERSION}"
    echo "============================================================"
    echo -e "${NC}"

    step "第一步: 环境检测"
    local os=$(get_os)
    log "操作系统: $os"

    check_network

    check_java || warn "Java 未安装"
    check_maven || warn "Maven 未安装"
    check_mysql || warn "MySQL 未运行 (可选)"
    check_redis || warn "Redis 未运行 (可选)"

    if check_port "$APP_PORT"; then
        warn "端口 ${APP_PORT} 被占用"
    else
        ok "端口 ${APP_PORT} 可用"
    fi

    step "第二步: 安装依赖"

    if ! check_java; then
        need_root
        install_basic_tools "$os"
        install_java "$os"
    fi

    if ! check_maven; then
        need_root
        install_basic_tools "$os"
        install_maven "$os"
    fi

    step "第二步半: 数据库和缓存服务"

    need_root

    if ! check_mysql; then
        warn "MySQL 未运行，正在安装..."
        install_basic_tools "$os"
        install_mysql "$os"
    fi

    if ! check_redis; then
        warn "Redis 未运行，正在安装..."
        install_basic_tools "$os"
        install_redis_server "$os"
    fi

    log "初始化数据库..."
    init_database

    step "第三步: 清理端口"

    need_root
    kill_port 3306
    kill_port 6379
    kill_port "$APP_PORT"

    step "第四步: 编译项目"

    if [[ -f "${SCRIPT_DIR}/target/${APP_NAME}-${APP_VERSION}.jar" ]]; then
        ok "JAR 文件已存在，跳过编译"
    else
        compile_project || { fail "编译失败"; exit 1; }
    fi

    step "第五步: 启动应用"

    start_app || { fail "启动失败"; exit 1; }

    step "部署完成!"

    echo -e "${GREEN}"
    echo "============================================================"
    echo "  访问地址: http://localhost:${APP_PORT}/starmc/pay"
    echo "  管理后台: http://localhost:${APP_PORT}/starmc/settings"
    echo "  应用日志: ${LOG_DIR}/app.log"
    echo "============================================================"
    echo -e "${NC}"
}

case "${1:-deploy}" in
    deploy|"")
        main
        ;;
    only-start)
        start_app
        ;;
    only-compile)
        compile_project
        ;;
    status)
        step "服务状态"
        check_java && true || true
        check_maven && true || true
        check_mysql || warn "MySQL 未运行"
        check_redis || warn "Redis 未运行"
        if check_port "$APP_PORT"; then
            ok "应用端口 ${APP_PORT} 已被占用"
        else
            warn "应用端口 ${APP_PORT} 空闲"
        fi
        ;;
    stop)
        step "停止应用"
        local pids=$(pgrep -f "${APP_NAME}-${APP_VERSION}.jar" 2>/dev/null || true)
        if [[ -z "$pids" ]]; then
            ok "应用未运行"
        else
            for pid in $pids; do
                kill "$pid" 2>/dev/null || true
                sleep 1
                kill -9 "$pid" 2>/dev/null || true
            done
            ok "应用已停止"
        fi
        ;;
    clean)
        need_root
        step "清理端口"
        kill_port 3306
        kill_port 6379
        kill_port "$APP_PORT"
        ;;
    log)
        if [[ -f "${LOG_DIR}/app.log" ]]; then
            tail -50 "${LOG_DIR}/app.log"
        else
            fail "日志文件不存在"
        fi
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        fail "未知命令: $1"
        show_help
        exit 1
        ;;
esac
