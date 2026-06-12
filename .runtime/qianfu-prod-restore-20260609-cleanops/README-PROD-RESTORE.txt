Qianfu production restore bundle
Generated: 20260609-192424

This bundle is intended for Baota/manual upload when SSH is unavailable.

Install on production:

  cd /www/wwwroot/qianfu-app
  tar -xzf /path/to/qianfu-prod-restore-20260609-cleanops.tar.gz -C /www/wwwroot/qianfu-app
  bash scripts/linux/prod-terminal-snapshot.sh
  bash scripts/linux/prod-terminal-minimal-repair.sh --preflight-only
  bash scripts/linux/prod-terminal-minimal-repair.sh --dry-run --no-strict
  sudo bash scripts/linux/prod-terminal-minimal-repair.sh

Notes:
- RUN_BUILD_ARTIFACTS=0 is recommended when using this bundle because the
  package already includes qianfu-liandeng/dist if INCLUDE_FRONTEND_DIST=1.
- By default the bundle does not overwrite package.json/package-lock.json.
  Use --include-package-files only when you intentionally want that.
- The bundle includes scripts/prod-restore-runners/*.mjs so public diagnosis
  and frontend freshness checks do not require tsx/devDependencies on production.
- If you want production to rebuild from source instead, omit
  RUN_BUILD_ARTIFACTS=0 and make sure dependencies are installed.
- Final success still requires public checks to pass:
  main API health, frontend bundle/manifest/files, and pay-domain TLS/vhost.
- See docs/PROD-OPERATOR-CHECKLIST-2026-06-09.md for the short manual runbook.
