#!/usr/bin/env bash
# VoiceLink deploy — push to GitHub, server git pulls, npm install, pm2 restart.
#
# Run from repo root:
#   ./scripts/deploy.sh [1|2]
#     1 = code only (default): git push → server git pull → npm install → build → pm2 restart
#     2 = code + DB:           same as 1, then run PostgreSQL schema sync
#
# Usage:
#   ./scripts/deploy.sh          # interactive menu
#   ./scripts/deploy.sh 1        # code only, no prompt
#   ./scripts/deploy.sh 2        # code + DB schema sync
#   SKIP_CLIENT_BUILD=1 ./scripts/deploy.sh 1   # skip React build (fast re-deploy)
#   SKIP_GIT_PUSH=1   ./scripts/deploy.sh 1     # skip git push (already pushed)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ══════════════════════════════════════════════════════════════
#  DEPLOY CONFIG
# ══════════════════════════════════════════════════════════════
DEPLOY_HOST="root@72.61.227.155"
DEPLOY_PASSWORD="Hostinger@2502"
DEPLOY_PATH="/var/www/voicelink"
GITHUB_REPO="https://github.com/snehalpchauhan/audio-video-screenshare.git"
GIT_BRANCH="main"
PM2_APP="voicelink"
# ══════════════════════════════════════════════════════════════

# ── SSH/rsync helpers ────────────────────────────────────────
_SSH_OPTS="-o StrictHostKeyChecking=no -o BatchMode=no -o ConnectTimeout=20"

run_ssh() {
  export SSHPASS="$DEPLOY_PASSWORD"
  sshpass -e ssh $_SSH_OPTS "$DEPLOY_HOST" "$@"
}

run_rsync() {
  export SSHPASS="$DEPLOY_PASSWORD"
  sshpass -e rsync -az --delete \
    -e "ssh $_SSH_OPTS" \
    "$@"
}

check_deps() {
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "ERROR: sshpass not installed — run: brew install sshpass"
    exit 1
  fi
}
# ─────────────────────────────────────────────────────────────

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "VoiceLink deploy → $DEPLOY_HOST:$DEPLOY_PATH (git: $GITHUB_REPO)"
  echo ""
  echo "  ./scripts/deploy.sh [1|2]"
  echo "    1  Code only (default)"
  echo "    2  Code + PostgreSQL schema sync"
  echo ""
  echo "  Env overrides:"
  echo "    SKIP_GIT_PUSH=1       don't git push (if already pushed)"
  echo "    SKIP_CLIENT_BUILD=1   skip React build (faster re-deploy)"
  echo "    SKIP_RESTART=1        skip pm2 restart"
  exit 0
fi

if [[ -n "${1:-}" && "$1" != "1" && "$1" != "2" ]]; then
  echo "ERROR: Unknown argument '$1'. Use 1 or 2, or --help"
  exit 1
fi

DEPLOY_MODE="${1:-}"
if [[ -z "$DEPLOY_MODE" && -t 0 ]]; then
  echo ""
  echo "VoiceLink deploy → $DEPLOY_HOST:$DEPLOY_PATH"
  echo "  [1] Code only  — git push, server pull, npm install, pm2 restart  (default)"
  echo "  [2] Code + DB  — same as 1 + PostgreSQL schema sync"
  read -r -n 1 -p "Choose 1 or 2 [1]: " _choice || true
  echo ""
  case "${_choice:-1}" in
    2) DEPLOY_MODE=2 ;;
    *) DEPLOY_MODE=1 ;;
  esac
fi
DEPLOY_MODE="${DEPLOY_MODE:-1}"

echo ""
echo "==> Deploy mode $DEPLOY_MODE: $([[ "$DEPLOY_MODE" == "2" ]] && echo 'code + DB schema' || echo 'code only')"
echo "    repo:   $GITHUB_REPO ($GIT_BRANCH)"
echo "    server: $DEPLOY_HOST:$DEPLOY_PATH"
echo ""

check_deps

# ── 1. Build client locally ──────────────────────────────────
if [[ "${SKIP_CLIENT_BUILD:-}" == "1" ]]; then
  echo "==> SKIP_CLIENT_BUILD=1 — skipping React build"
else
  echo "==> Client — npm install + build"
  cd "$ROOT/client"
  [[ -f package-lock.json ]] && npm ci || npm install
  npm run build
  echo "==> Client build done → client/build/"
fi

# ── 2. Git push to GitHub ────────────────────────────────────
cd "$ROOT"
if [[ "${SKIP_GIT_PUSH:-}" == "1" ]]; then
  echo "==> SKIP_GIT_PUSH=1 — skipping git push"
else
  echo "==> Git — push to GitHub ($GIT_BRANCH)"
  if git diff --quiet && git diff --cached --quiet; then
    echo "    (nothing to commit, pushing existing commits)"
  else
    echo "    Uncommitted changes detected — committing all before deploy"
    git add -A
    git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')"
  fi
  git push origin "$GIT_BRANCH"
  echo "==> Pushed to $GITHUB_REPO"
fi

# ── 3. Server: git pull ──────────────────────────────────────
echo "==> Server — git pull origin $GIT_BRANCH"
run_ssh "
  cd $DEPLOY_PATH
  git fetch origin $GIT_BRANCH
  git reset --hard origin/$GIT_BRANCH
  echo 'Latest commit:' && git log --oneline -1
"

# ── 4. Rsync client build ────────────────────────────────────
# client/build is gitignored — must be pushed separately
if [[ "${SKIP_CLIENT_BUILD:-}" != "1" ]]; then
  echo "==> Rsync client/build/ → $DEPLOY_HOST:$DEPLOY_PATH/client/build/"
  run_rsync \
    "$ROOT/client/build/" \
    "$DEPLOY_HOST:$DEPLOY_PATH/client/build/"
fi

# ── 5. Server: npm install ───────────────────────────────────
echo "==> Server — npm install (production)"
run_ssh "cd $DEPLOY_PATH/server && npm install --omit=dev --prefer-offline 2>&1 | tail -5"

# ── 6. DB schema sync (mode 2) ───────────────────────────────
if [[ "$DEPLOY_MODE" == "2" ]]; then
  echo "==> DB — sync schema (idempotent)"
  run_ssh "cd $DEPLOY_PATH/server && SKIP_DB_INIT_ON_REQUIRE=1 node scripts/sync-db-schema.js"
fi

# ── 7. PM2 restart ───────────────────────────────────────────
if [[ "${SKIP_RESTART:-}" == "1" ]]; then
  echo "==> SKIP_RESTART=1 — skipping restart"
else
  echo "==> PM2 — restart $PM2_APP"
  run_ssh "pm2 restart $PM2_APP && pm2 save" \
    || { echo "WARN: pm2 restart failed — trying pm2 start"; \
         run_ssh "cd $DEPLOY_PATH/server && pm2 start index.js --name $PM2_APP && pm2 save"; }
fi

echo ""
echo "==> Deploy done (mode $DEPLOY_MODE)"
echo "    API:  http://72.61.227.155:5001"
echo "    PM2:  ssh $DEPLOY_HOST 'pm2 status'"
echo "    Logs: ssh $DEPLOY_HOST 'pm2 logs $PM2_APP --lines 50'"
