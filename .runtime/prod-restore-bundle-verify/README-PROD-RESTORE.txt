Qianfu production restore bundle
Generated: 20260609-082602

This bundle is intended for Baota/manual upload when SSH is unavailable.

Install on production:

  cd /www/wwwroot/qianfu-app
  tar -xzf /path/to/qianfu-prod-restore-20260609-082602.tar.gz -C /www/wwwroot/qianfu-app
  bash scripts/linux/restore-prod-public.sh --preflight-only
  bash scripts/linux/restore-prod-public.sh --dry-run
  sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh

Notes:
- RUN_BUILD_ARTIFACTS=0 is recommended when using this bundle because the
  package already includes qianfu-liandeng/dist if INCLUDE_FRONTEND_DIST=1.
- If you want production to rebuild from source instead, omit
  RUN_BUILD_ARTIFACTS=0 and make sure dependencies are installed.
- Final success still requires public checks to pass:
  main API health, frontend bundle/manifest/files, and pay-domain TLS/vhost.
