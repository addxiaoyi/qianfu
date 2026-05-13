#!/bin/bash
# =================================================================
# StarMC Payment System - 环境依赖自动安装脚本
# 版本: 3.1
# 平台: Linux (主流发行版)
# 特性: 多源下载、网络检测、智能回退
# =================================================================

set -euo pipefail

APP_NAME="starmc"
LOG_FILE="/var/log/${APP_NAME}-install.log"
LOCK_FILE="/var/run/${APP_NAME}-install.lock"
RETRY_COUNT=3
RETRY_DELAY=3

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; echo "[OK] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; echo "━━━ $1 ━━━" >> "$LOG_FILE"; }
log_progress() { echo -ne "${MAGENTA}[$1%]${NC} "; echo "[PROGRESS] $1%" >> "$LOG_FILE"; }

progress_bar() {
    local percent=$1
    local width=50
    local completed=$((width * percent / 100))
    local remaining=$((width - completed))
    printf "${GREEN}["
    printf "%${completed}s" | tr ' ' '='
    printf "%${remaining}s" | tr ' ' '-'
    printf "] %3d%%${NC}\r" "$percent"
}

network_test() {
    local host=${1:-8.8.8.8}
    local timeout=${2:-5}

    if command -v ping &>/dev/null; then
        if ping -c 1 -W "$timeout" "$host" &>/dev/null; then
            return 0
        fi
    fi

    if command -v curl &>/dev/null; then
        if curl -s --connect-timeout "$timeout" "https://www.baidu.com" &>/dev/null; then
            return 0
        fi
    fi

    return 1
}

check_network() {
    log_step "网络连通性检测"

    local hosts=("8.8.8.8" "114.114.114.114" "www.baidu.com" "www.aliyun.com")
    local reachable=0

    for host in "${hosts[@]}"; do
        if network_test "$host" 3; then
            log_ok "网络正常 (可访问: $host)"
            reachable=1
            break
        fi
    done

    if [[ $reachable -eq 0 ]]; then
        log_warn "网络可能存在问题，但继续尝试安装..."
    fi

    return 0
}

need_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此操作需要 root 权限"
        exit 1
    fi
}

get_os_info() {
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

update_package_cache() {
    local os=$1
    log "更新软件包缓存..."

    case "$os" in
        debian|ubuntu|linuxmint)
            apt-get update -qq 2>&1 | grep -v "^Hit\|^Get" || true
            ;;
        rhel|centos|rocky|alma)
            yum makecache -q 2>&1 | grep -v "^Loaded" || true
            ;;
        fedora)
            dnf makecache -q 2>&1 || true
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm 2>&1 | grep -v "^Syncing" || true
            ;;
        alpine)
            apk update -q 2>&1 || true
            ;;
        opensuse|suse)
            zypper --quiet refresh 2>&1 || true
            ;;
    esac

    log_ok "软件包缓存已更新"
}

install_package() {
    local package=$1
    local os=$2

    log "安装: $package"

    case "$os" in
        debian|ubuntu|linuxmint)
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$package" 2>&1 | grep -v "^(Reading\|^Selecting\|^Preparing\|^Unpacking\|^Setting up\|^Processing)" || true
            ;;
        rhel|centos|rocky|alma)
            yum install -y -q "$package" 2>&1 | grep -v "^Loaded\|^Package\|^Transaction\|^Complete!" || true
            ;;
        fedora)
            dnf install -y -q "$package" 2>&1 | grep -v "^Last metadata\|^Dependencies resolved\|^Transaction summary" || true
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm "$package" 2>&1 | grep -v "^\[.*\]\s*$" || true
            ;;
        alpine)
            apk add -q "$package" 2>&1 || true
            ;;
        opensuse|suse)
            zypper install -y -q "$package" 2>&1 | grep -v "^Retrieving\|^Installing\|^Committing" || true
            ;;
    esac

    if command -v "$package" &>/dev/null || command -v "${package%%:*}" &>/dev/null; then
        log_ok "$package 安装成功"
        return 0
    else
        log_error "$package 安装失败"
        return 1
    fi
}

install_java() {
    local os=$1
    local java_version=${2:-17}

    log_step "安装 Java JDK ${java_version}"

    case "$os" in
        debian|ubuntu|linuxmint)
            if command -v java &>/dev/null; then
                log_ok "Java 已安装: $(java -version 2>&1 | head -1)"
                return 0
            fi
            apt-get install -y -qq "openjdk-${java_version}-jdk" 2>&1 | grep -v "^(Reading\|^Selecting\|^Preparing\|^Unpacking\|^Setting up\|^Processing)" || true
            ;;
        rhel|centos|rocky|alma)
            if command -v java &>/dev/null; then
                log_ok "Java 已安装: $(java -version 2>&1 | head -1)"
                return 0
            fi
            yum install -y -q "java-${java_version}-openjdk" "java-${java_version}-openjdk-devel" 2>&1 | grep -v "^Loaded\|^Package\|^Transaction\|^Complete!" || true
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm "jdk${java_version}-openjdk" 2>&1 | grep -v "^\[.*\]\s*$" || true
            ;;
        alpine)
            apk add -q "openjdk${java_version}-jre" "openjdk${java_version}-jdk" 2>&1 || true
            ;;
    esac

    if command -v java &>/dev/null; then
        log_ok "Java 安装成功: $(java -version 2>&1 | head -1)"
        export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
        log "JAVA_HOME: $JAVA_HOME"
        return 0
    else
        log_error "Java 安装失败"
        return 1
    fi
}

install_maven() {
    local os=$1

    log_step "安装 Maven"

    if command -v mvn &>/dev/null; then
        log_ok "Maven 已安装: $(mvn -version 2>&1 | head -1)"
        return 0
    fi

    local MAVEN_VERSION="3.9.6"
    local MAVEN_DIR="/opt/apache-maven"
    local DOWNLOAD_URLS=(
        "https://dlcdn.apache.org/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
        "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
        "https://mirrors.aliyun.com/apache/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
        "https://mirrors.tencent.com/apache/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
    )

    if [[ -d "$MAVEN_DIR" ]]; then
        log_ok "Maven 已安装: $MAVEN_DIR"
        return 0
    fi

    log "下载 Maven ${MAVEN_VERSION}..."

    local downloaded=false
    for url in "${DOWNLOAD_URLS[@]}"; do
        log "尝试: $url"
        if curl -L --connect-timeout 30 --max-time 300 -o "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" "$url" 2>&1; then
            if [[ -f "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" ]]; then
                local size=$(stat -c%s "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" 2>/dev/null || stat -f%z "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" 2>/dev/null || echo "0")
                if [[ ${size:-0} -gt 1000000 ]]; then
                    downloaded=true
                    log_ok "下载完成 ($(numfmt --to=iec $size 2>/dev/null || echo "${size} bytes"))"

                    tar -xzf "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz" -C /opt
                    mv "/opt/apache-maven-${MAVEN_VERSION}" "$MAVEN_DIR"
                    rm -f "/tmp/apache-maven-${MAVEN_VERSION}-bin.tar.gz"

                    export PATH="$MAVEN_DIR/bin:$PATH"
                    log_ok "Maven 安装完成: $MAVEN_DIR"
                    return 0
                fi
            fi
        fi
        log_warn "下载失败，尝试下一个源..."
    done

    if ! $downloaded; then
        log_error "Maven 下载失败"
        return 1
    fi
}

install_mysql() {
    local os=$1

    log_step "安装 MySQL"

    case "$os" in
        debian|ubuntu|linuxmint)
            if command -v mysql &>/dev/null; then
                log_ok "MySQL 已安装"
                return 0
            fi
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server 2>&1 | grep -v "^(Reading\|^Selecting\|^Preparing\|^Unpacking\|^Setting up\|^Processing)" || true
            systemctl start mysql 2>/dev/null || true
            systemctl enable mysql 2>/dev/null || true
            ;;
        rhel|centos|rocky|alma)
            if command -v mysql &>/dev/null; then
                log_ok "MySQL 已安装"
                return 0
            fi
            yum install -y -q mysql-server 2>&1 | grep -v "^Loaded\|^Package\|^Transaction\|^Complete!" || true
            systemctl start mysqld 2>/dev/null || true
            systemctl enable mysqld 2>/dev/null || true
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm mysql 2>&1 | grep -v "^\[.*\]\s*$" || true
            ;;
        alpine)
            apk add -q mysql mysql-client 2>&1 || true
            ;;
    esac

    log_ok "MySQL 安装完成"
}

install_redis() {
    local os=$1

    log_step "安装 Redis"

    case "$os" in
        debian|ubuntu|linuxmint)
            if command -v redis-server &>/dev/null; then
                log_ok "Redis 已安装"
                return 0
            fi
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server 2>&1 | grep -v "^(Reading\|^Selecting\|^Preparing\|^Unpacking\|^Setting up\|^Processing)" || true
            systemctl start redis-server 2>/dev/null || true
            systemctl enable redis-server 2>/dev/null || true
            ;;
        rhel|centos|rocky|alma)
            if command -v redis-server &>/dev/null; then
                log_ok "Redis 已安装"
                return 0
            fi
            yum install -y -q redis 2>&1 | grep -v "^Loaded\|^Package\|^Transaction\|^Complete!" || true
            systemctl start redis 2>/dev/null || true
            systemctl enable redis 2>/dev/null || true
            ;;
        arch|manjaro)
            pacman -Sy --noconfirm redis 2>&1 | grep -v "^\[.*\]\s*$" || true
            ;;
        alpine)
            apk add -q redis 2>&1 || true
            ;;
    esac

    log_ok "Redis 安装完成"
}

install_basic_tools() {
    local os=$1

    log_step "安装基础工具"

    local tools=()

    case "$os" in
        debian|ubuntu|linuxmint)
            tools=(curl wget git vim net-tools lsof iproute2 procps sudo)
            ;;
        rhel|centos|rocky|alma)
            tools=(curl wget git vim net-tools lsof iproute procps-ng sudo)
            ;;
        arch|manjaro)
            tools=(curl wget git vim net-tools lsof iproute2 procps-ng sudo)
            ;;
        alpine)
            tools=(curl wget git vim net-tools lsof iproute2 procps sudo)
            ;;
    esac

    local total=${#tools[@]}
    local current=0

    for tool in "${tools[@]}"; do
        current=$((current + 1))
        local percent=$((current * 100 / total))
        progress_bar "$percent"
        install_package "$tool" "$os" || true
    done

    echo
    log_ok "基础工具安装完成"
}

check_installed() {
    local cmd=$1
    if command -v "$cmd" &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $cmd"
        return 0
    else
        echo -e "  ${RED}✗${NC} $cmd"
        return 1
    fi
}

verify_installation() {
    log_step "验证安装"

    local all_ok=true

    echo -e "${CYAN}检查命令:${NC}"
    check_installed "java" || all_ok=false
    check_installed "mvn" || all_ok=false
    check_installed "mysql" || all_ok=false
    check_installed "redis-server" || all_ok=false
    check_installed "curl" || all_ok=false
    check_installed "wget" || all_ok=false

    if $all_ok; then
        log_ok "所有依赖安装成功"
        return 0
    else
        log_warn "部分依赖可能未正确安装"
        return 1
    fi
}

show_help() {
    cat << EOF
${CYAN}StarMC 环境依赖安装脚本 v3.1${NC}

${GREEN}用法:${NC}
  $0 [选项] [组件]

${GREEN}选项:${NC}
  --java-version <版本>    Java 版本 (默认: 17)
  --no-java               跳过 Java 安装
  --no-maven              跳过 Maven 安装
  --no-mysql              跳过 MySQL 安装
  --no-redis              跳过 Redis 安装
  --no-tools              跳过基础工具安装
  --all                   安装所有组件 (默认)
  --check                 仅检查已安装组件
  --help                  显示帮助

${GREEN}示例:${NC}
  $0                      安装所有依赖
  $0 --java-version 11    安装 Java 11
  $0 --no-mysql           跳过 MySQL
  $0 --check              检查已安装组件

${GREEN}支持的发行版:${NC}
  Debian/Ubuntu, RHEL/CentOS, Arch, Alpine, openSUSE

EOF
}

main() {
    local install_java=true
    local install_maven=true
    local install_mysql=true
    local install_redis=true
    local install_tools=true
    local java_version=17
    local just_check=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --java-version)
                java_version="$2"
                shift 2
                ;;
            --no-java)
                install_java=false
                shift
                ;;
            --no-maven)
                install_maven=false
                shift
                ;;
            --no-mysql)
                install_mysql=false
                shift
                ;;
            --no-redis)
                install_redis=false
                shift
                ;;
            --no-tools)
                install_tools=false
                shift
                ;;
            --all)
                install_java=true
                install_maven=true
                install_mysql=true
                install_redis=true
                install_tools=true
                shift
                ;;
            --check)
                just_check=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    need_root

    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

    echo -e "${CYAN}"
    echo "============================================================"
    echo "  StarMC 环境依赖安装脚本 v3.1"
    echo "============================================================"
    echo -e "${NC}"

    log_step "开始安装"

    local os=$(get_os_info)
    log "检测到操作系统: $os"

    check_network || true

    if $just_check; then
        verify_installation
        exit 0
    fi

    update_package_cache "$os"

    local total_steps=0
    $install_tools && total_steps=$((total_steps + 1))
    $install_java && total_steps=$((total_steps + 1))
    $install_maven && total_steps=$((total_steps + 1))
    $install_mysql && total_steps=$((total_steps + 1))
    $install_redis && total_steps=$((total_steps + 1))

    local current_step=0

    if $install_tools; then
        current_step=$((current_step + 1))
        progress_bar $((current_step * 100 / total_steps))
        install_basic_tools "$os"
    fi

    if $install_java; then
        current_step=$((current_step + 1))
        progress_bar $((current_step * 100 / total_steps))
        install_java "$os" "$java_version"
    fi

    if $install_maven; then
        current_step=$((current_step + 1))
        progress_bar $((current_step * 100 / total_steps))
        install_maven "$os"
    fi

    if $install_mysql; then
        current_step=$((current_step + 1))
        progress_bar $((current_step * 100 / total_steps))
        install_mysql "$os"
    fi

    if $install_redis; then
        current_step=$((current_step + 1))
        progress_bar $((current_step * 100 / total_steps))
        install_redis "$os"
    fi

    progress_bar 100
    echo

    log_step "安装完成"
    verify_installation

    echo -e "${GREEN}"
    echo "============================================================"
    echo "  安装完成!"
    echo "============================================================"
    echo -e "${NC}"

    echo -e "${CYAN}后续步骤:${NC}"
    echo "  1. 运行: cd /path/to/xpay-code"
    echo "  2. 运行: ./portclean.sh clean"
    echo "  3. 运行: ./startup.sh deploy"
    echo ""
}

main "$@"
