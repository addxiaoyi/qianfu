#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
NGINX_DIR="${NGINX_DIR:-/www/server/panel/vhost/nginx}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
WEB_DOMAIN_ALT="${WEB_DOMAIN_ALT:-www.mc-u.top}"
WEB_CERT_NAME="${WEB_CERT_NAME:-mc-u.top}"
PAY_DOMAIN="${PAY_DOMAIN:-pay.star-web.top}"
PAY_CERT_NAME="${PAY_CERT_NAME:-$PAY_DOMAIN}"
API_PORT="${API_PORT:-3000}"
XPAY_PORT="${XPAY_PORT:-8889}"
APP_NAME="${APP_NAME:-qianfu-api}"
RUN_PM2="${RUN_PM2:-1}"
RUN_DIAG="${RUN_DIAG:-1}"
RUN_FRONTEND_PROBE="${RUN_FRONTEND_PROBE:-1}"
RUN_EVIDENCE="${RUN_EVIDENCE:-1}"
RUN_BUILD_ARTIFACTS="${RUN_BUILD_ARTIFACTS:-1}"
RUN_PUBLIC_VERIFY="${RUN_PUBLIC_VERIFY:-1}"
STRICT_PUBLIC_VERIFY="${STRICT_PUBLIC_VERIFY:-0}"
RUN_FAILURE_EVIDENCE="${RUN_FAILURE_EVIDENCE:-1}"
VERIFY_ONLY="${VERIFY_ONLY:-0}"
REPAIR_SCOPE="${REPAIR_SCOPE:-all}" # all | web | pay
WEB_ROOT="${WEB_ROOT:-$APP_ROOT/qianfu-liandeng/dist}"
WEB_TEMPLATE="${WEB_TEMPLATE:-$APP_ROOT/deploy/nginx/mc-u.top.conf.example}"
PAY_TEMPLATE="${PAY_TEMPLATE:-$APP_ROOT/deploy/nginx/pay.star-web.top.conf.example}"
HEADERS_SRC="${HEADERS_SRC:-$APP_ROOT/deploy/nginx/qianfu-spa-security-headers.conf.example}"
HEADERS_DST="${HEADERS_DST:-$NGINX_DIR/qianfu-spa-security-headers.conf}"
WEB_CONF="${WEB_CONF:-$NGINX_DIR/$WEB_DOMAIN.conf}"
PAY_CONF="${PAY_CONF:-$NGINX_DIR/$PAY_DOMAIN.conf}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups/edge-repair-$TS}"

log_step() { printf '\n[STEP] %s\n' "$1"; }
log_ok() { printf '[OK]   %s\n' "$1"; }
log_warn() { printf '[WARN] %s\n' "$1"; }
log_fail() { printf '[FAIL] %s\n' "$1"; exit 1; }

case "$REPAIR_SCOPE" in
  all|web|pay) ;;
  *) log_fail "Invalid REPAIR_SCOPE=${REPAIR_SCOPE}; expected all, web, or pay" ;;
esac

should_repair_web() {
  [[ "$REPAIR_SCOPE" == "all" || "$REPAIR_SCOPE" == "web" ]]
}

should_repair_pay() {
  [[ "$REPAIR_SCOPE" == "all" || "$REPAIR_SCOPE" == "pay" ]]
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    log_fail "Please run as root"
  fi
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || log_fail "Missing file: $path"
}

require_cert_pair() {
  local cert_name="$1"
  local label="$2"
  require_file "/etc/letsencrypt/live/${cert_name}/fullchain.pem"
  require_file "/etc/letsencrypt/live/${cert_name}/privkey.pem"
  log_ok "$label certificate pair exists: /etc/letsencrypt/live/${cert_name}/"
}

backup_if_exists() {
  local path="$1"
  if [[ -f "$path" ]]; then
    cp -a "$path" "$BACKUP_DIR/"
  fi
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[\/&]/\\&/g'
}

render_web_conf() {
  local web_domain web_domain_alt web_cert_name web_root headers_dst api_port
  web_domain="$(escape_sed_replacement "$WEB_DOMAIN")"
  web_domain_alt="$(escape_sed_replacement "$WEB_DOMAIN_ALT")"
  web_cert_name="$(escape_sed_replacement "$WEB_CERT_NAME")"
  web_root="$(escape_sed_replacement "$WEB_ROOT")"
  headers_dst="$(escape_sed_replacement "$HEADERS_DST")"
  api_port="$(escape_sed_replacement "$API_PORT")"

  sed \
    -e "s/www\\.mc-u\\.top/${web_domain_alt}/g" \
    -e "s/mc-u\\.top/${web_domain}/g" \
    -e "s#/etc/letsencrypt/live/${web_domain}/#/etc/letsencrypt/live/${web_cert_name}/#g" \
    -e "s#/www/wwwroot/qianfu-app/qianfu-liandeng/dist#${web_root}#g" \
    -e "s#/www/server/panel/vhost/nginx/qianfu-spa-security-headers.conf#${headers_dst}#g" \
    -e "s/127\\.0\\.0\\.1:3000/127.0.0.1:${api_port}/g" \
    "$WEB_TEMPLATE"
}

render_pay_conf() {
  local pay_domain pay_cert_name api_port xpay_port
  pay_domain="$(escape_sed_replacement "$PAY_DOMAIN")"
  pay_cert_name="$(escape_sed_replacement "$PAY_CERT_NAME")"
  api_port="$(escape_sed_replacement "$API_PORT")"
  xpay_port="$(escape_sed_replacement "$XPAY_PORT")"

  sed \
    -e "s/pay\\.star-web\\.top/${pay_domain}/g" \
    -e "s#/etc/letsencrypt/live/${pay_domain}/#/etc/letsencrypt/live/${pay_cert_name}/#g" \
    -e "s/127\\.0\\.0\\.1:3000/127.0.0.1:${api_port}/g" \
    -e "s/127\\.0\\.0\\.1:8889/127.0.0.1:${xpay_port}/g" \
    "$PAY_TEMPLATE"
}

run_pm2_restart() {
  if [[ "$RUN_PM2" != "1" ]]; then
    log_warn "Skipping PM2 restart by flag"
    return
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    log_warn "pm2 command not found; skipping PM2 restart"
    return
  fi

  require_file "$APP_ROOT/ecosystem.config.cjs"
  mkdir -p "$APP_ROOT/logs"

  log_step "Restart PM2 app with fixed production port"
  (
    cd "$APP_ROOT"
    APP_NAME="$APP_NAME" \
    PORT="$API_PORT" \
    PORT_STRICT="true" \
    NODE_ENV="production" \
    pm2 startOrRestart ecosystem.config.cjs --only "$APP_NAME" --update-env
    pm2 save >/dev/null 2>&1 || true
  )
  log_ok "PM2 restart complete"
}

run_evidence_capture() {
  if [[ "$RUN_EVIDENCE" != "1" ]]; then
    log_warn "Skipping prod evidence capture by flag"
    return
  fi

  if [[ ! -f "$APP_ROOT/scripts/linux/collect-prod-502-evidence.sh" ]]; then
    log_warn "Evidence script not found; skipping pre-repair evidence capture"
    return
  fi

  log_step "Capture pre-repair production evidence"
  (
    cd "$APP_ROOT"
    WEB_DOMAIN="$WEB_DOMAIN" \
    PAY_DOMAIN="$PAY_DOMAIN" \
    APP_NAME="$APP_NAME" \
    NGINX_DIR="$NGINX_DIR" \
    WEB_CONF="$WEB_CONF" \
    PAY_CONF="$PAY_CONF" \
    bash scripts/linux/collect-prod-502-evidence.sh diagnostics || true
  )
  log_ok "Pre-repair evidence capture completed"
}

run_failure_evidence_capture() {
  local reason="$1"

  if [[ "$RUN_FAILURE_EVIDENCE" != "1" ]]; then
    log_warn "Skipping failure evidence capture by flag"
    return
  fi

  if [[ ! -f "$APP_ROOT/scripts/linux/collect-prod-502-evidence.sh" ]]; then
    log_warn "Evidence script not found; skipping failure evidence capture"
    return
  fi

  log_step "Capture failure evidence"
  log_warn "$reason"
  (
    cd "$APP_ROOT"
    WEB_DOMAIN="$WEB_DOMAIN" \
    PAY_DOMAIN="$PAY_DOMAIN" \
    APP_NAME="$APP_NAME" \
    NGINX_DIR="$NGINX_DIR" \
    WEB_CONF="$WEB_CONF" \
    PAY_CONF="$PAY_CONF" \
    bash scripts/linux/collect-prod-502-evidence.sh diagnostics || true
  )
  log_ok "Failure evidence capture completed"
}

build_artifacts() {
  if [[ "$RUN_BUILD_ARTIFACTS" != "1" ]]; then
    log_warn "Skipping server/frontend rebuild by flag"
    return
  fi

  require_file "$APP_ROOT/package.json"
  if ! command -v npm >/dev/null 2>&1; then
    log_fail "npm command not found; cannot rebuild production artifacts"
  fi

  log_step "Build latest server and frontend artifacts"
  (
    cd "$APP_ROOT"
    npm run server:build
    if [[ "$REPAIR_SCOPE" != "pay" ]]; then
      RUN_NGINX_RELOAD=0 \
      RUN_PUBLIC_VERIFY=0 \
      WEB_ROOT="$WEB_ROOT" \
      WEB_DOMAIN="$WEB_DOMAIN" \
      bash scripts/linux/deploy-frontend-dist.sh
    else
      log_warn "Skipping frontend dist deployment because REPAIR_SCOPE=pay"
    fi
  )
  if should_repair_web; then
    require_file "$WEB_ROOT/index.html"
    require_file "$WEB_ROOT/qianfu-dist-manifest.json"
  fi
  log_ok "Latest production artifacts built; frontend root is $WEB_ROOT"
}

preflight_edge_inputs() {
  log_step "Validate edge repair inputs"
  if should_repair_web; then
    require_file "$HEADERS_SRC"
    require_file "$WEB_TEMPLATE"
    require_file "$WEB_ROOT/index.html"
    require_file "$WEB_ROOT/qianfu-dist-manifest.json"
    require_cert_pair "$WEB_CERT_NAME" "Web"
  fi
  if should_repair_pay; then
    require_file "$PAY_TEMPLATE"
    require_cert_pair "$PAY_CERT_NAME" "Pay"
  fi
  log_ok "Edge repair inputs validated"
}

extract_kv() {
  local key="$1"
  sed -n "s/^${key}=//p" | tail -n 1
}

run_public_verify() {
  if [[ "$RUN_PUBLIC_VERIFY" != "1" ]]; then
    log_warn "Skipping public verification by flag"
    return
  fi

  if [[ ! -f "$APP_ROOT/package.json" ]] || ! command -v npm >/dev/null 2>&1; then
    if [[ "$STRICT_PUBLIC_VERIFY" == "1" ]]; then
      log_fail "Cannot run strict public verification: package.json or npm is missing"
    fi
    log_warn "Skipping public verification because package.json or npm is missing"
    return
  fi

  log_step "Validate public production state"
  local output main_diagnosis frontend_diagnosis pay_diagnosis finding_count recommended_actions reason
  if ! output="$(
    cd "$APP_ROOT"
    QIANFU_BASE_URL="https://${WEB_DOMAIN}" \
    PAY_DOMAIN_HOST="$PAY_DOMAIN" \
    PAY_MAIN_SITE_HOST="$WEB_DOMAIN" \
    npm run --silent prod:diagnose:public -- --report-only --kv
  )"; then
    reason="Public verification command failed"
    if [[ "$STRICT_PUBLIC_VERIFY" == "1" ]]; then
      run_failure_evidence_capture "$reason"
      log_fail "$reason"
    fi
    log_warn "$reason"
    return
  fi
  printf '%s\n' "$output" | sed 's/^/[PUBLIC-DIAG] /'

  main_diagnosis="$(printf '%s\n' "$output" | extract_kv main_diagnosis)"
  frontend_diagnosis="$(printf '%s\n' "$output" | extract_kv frontend_diagnosis)"
  pay_diagnosis="$(printf '%s\n' "$output" | extract_kv pay_diagnosis)"
  finding_count="$(printf '%s\n' "$output" | extract_kv finding_count)"
  recommended_actions="$(printf '%s\n' "$output" | extract_kv recommended_actions)"
  if [[ -n "$recommended_actions" ]]; then
    printf '%s\n' "$recommended_actions" | sed 's/ | /\n/g' | sed 's/^/[NEXT] /'
  fi

  local scope_pass="0"
  if [[ "$REPAIR_SCOPE" == "all" && "$main_diagnosis" == "ok" && "$frontend_diagnosis" == "ok" && "$pay_diagnosis" == "ok" && "${finding_count:-0}" == "0" ]]; then
    scope_pass="1"
  elif [[ "$REPAIR_SCOPE" == "web" && "$main_diagnosis" == "ok" && "$frontend_diagnosis" == "ok" ]]; then
    scope_pass="1"
  elif [[ "$REPAIR_SCOPE" == "pay" && "$pay_diagnosis" == "ok" ]]; then
    scope_pass="1"
  fi

  if [[ "$scope_pass" == "1" ]]; then
    log_ok "Public production verification passed for scope=${REPAIR_SCOPE}"
    return
  fi

  reason="Public verification still reports issues for scope=${REPAIR_SCOPE}: main=${main_diagnosis:-unknown}, frontend=${frontend_diagnosis:-unknown}, pay=${pay_diagnosis:-unknown}, findings=${finding_count:-unknown}"
  if [[ "$STRICT_PUBLIC_VERIFY" == "1" ]]; then
    run_failure_evidence_capture "$reason"
    log_fail "$reason"
  fi

  log_warn "$reason"
}

run_validation() {
  log_step "Validate nginx config and reload"
  nginx -t
  systemctl reload nginx
  log_ok "Nginx reload complete"

  log_step "Validate local API health"
  curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null
  curl -fsS "http://127.0.0.1:${API_PORT}/api/ready" >/dev/null || true
  log_ok "Local API health checked on ${API_PORT}"

  if should_repair_pay; then
    log_step "Validate pay-domain root marker"
    curl -kfsS "https://${PAY_DOMAIN}/" | grep -q 'qianfu-pay-gateway'
    log_ok "Pay-domain root marker matched"
  else
    log_warn "Skipping pay-domain root marker validation because REPAIR_SCOPE=${REPAIR_SCOPE}"
  fi

  if should_repair_web && [[ "$RUN_FRONTEND_PROBE" == "1" && -f "$APP_ROOT/package.json" ]] && command -v npm >/dev/null 2>&1; then
    log_step "Validate deployed frontend freshness"
    (
      cd "$APP_ROOT"
      if QIANFU_BASE_URL="https://${WEB_DOMAIN}" npm run --silent probe:frontend-deploy; then
        log_ok "Frontend deploy freshness matched current build"
      else
        log_warn "Frontend deploy freshness probe failed. The static site may still be serving an older bundle or stale SEO markers."
      fi
    )
  fi

  if [[ "$RUN_DIAG" == "1" && -f "$APP_ROOT/scripts/linux/diagnose-prod-502.sh" ]]; then
    log_step "Run production diagnosis summary"
    (
      cd "$APP_ROOT"
      bash scripts/linux/diagnose-prod-502.sh --summary || true
    )
  fi

  run_public_verify
}

if [[ "$VERIFY_ONLY" == "1" ]]; then
  run_public_verify
  exit 0
fi

require_root
mkdir -p "$BACKUP_DIR"

run_evidence_capture
build_artifacts
preflight_edge_inputs

log_step "Backup current nginx edge files"
if should_repair_web; then
  backup_if_exists "$WEB_CONF"
  backup_if_exists "$HEADERS_DST"
fi
if should_repair_pay; then
  backup_if_exists "$PAY_CONF"
fi
log_ok "Backups stored in $BACKUP_DIR"

if should_repair_web; then
  log_step "Install static security headers include"
  cp "$HEADERS_SRC" "$HEADERS_DST"
  log_ok "Installed $HEADERS_DST"
else
  log_warn "Skipping static security headers include because REPAIR_SCOPE=${REPAIR_SCOPE}"
fi

if should_repair_web; then
  log_step "Render and install web nginx config"
  render_web_conf > "$WEB_CONF"
  log_ok "Installed $WEB_CONF"
else
  log_warn "Skipping web nginx config install because REPAIR_SCOPE=${REPAIR_SCOPE}"
fi

if should_repair_pay; then
  log_step "Render and install pay nginx config"
  render_pay_conf > "$PAY_CONF"
  log_ok "Installed $PAY_CONF"
else
  log_warn "Skipping pay nginx config install because REPAIR_SCOPE=${REPAIR_SCOPE}"
fi

run_pm2_restart
run_validation

cat <<EOF

[DONE] Production edge repair finished.
Scope:
  $REPAIR_SCOPE
Backups:
  $BACKUP_DIR

Primary files:
  $WEB_CONF
  $PAY_CONF
  $HEADERS_DST
EOF
