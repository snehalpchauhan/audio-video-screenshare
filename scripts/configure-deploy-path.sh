#!/usr/bin/env bash
# Discover repo root on the VPS (directory containing scripts/deploy.sh) via SSH
# using credentials from repo root KEYS (same as deploy.sh), then set
# _DEPLOY_PATH_DEFAULT=... in scripts/deploy.sh.
#
# Requires: KEYS with DEPLOY_SSH and SSH_PASSWORD or SSH_PASSWORD_FILE (optional
#           fallbacks: _DEPLOY_* in deploy.sh DEPLOY CONFIG), and sshpass.
# Run from repo root:  ./scripts/configure-deploy-path.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SH="$ROOT/scripts/deploy.sh"

if [[ ! -f "$DEPLOY_SH" ]]; then
  echo "ERROR: $DEPLOY_SH not found."
  exit 1
fi

_tmp="$(mktemp)"
trap 'rm -f "$_tmp"' EXIT
sed -n '/^# --- DEPLOY CONFIG ---/,/^# --- END DEPLOY CONFIG ---/p' "$DEPLOY_SH" \
  | sed '/^#/d' > "$_tmp"

set -a
# shellcheck source=/dev/null
source "$_tmp"
set +a

# shellcheck source=/dev/null
source "$ROOT/scripts/load-credentials-from-keys.sh"
deploy_load_credentials

GIT_PULL="${GIT_PULL:-1}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-}"
PM2_APP="${PM2_APP:-voicelink}"
DEPLOY_SSH="${DEPLOY_SSH:-$_DEPLOY_SSH_TARGET}"
DEPLOY_PATH="${DEPLOY_PATH:-$_DEPLOY_PATH_DEFAULT}"
SSH_PASSWORD="${SSH_PASSWORD:-$_DEPLOY_SSH_PASSWORD}"

if [[ -n "${SSH_PASSWORD:-}" ]]; then
  SSH_PASSWORD="${SSH_PASSWORD//$'\r'/}"
  SSH_PASSWORD="${SSH_PASSWORD//$'\n'/}"
fi

if [[ -z "${DEPLOY_SSH:-}" ]]; then
  echo "ERROR: Set DEPLOY_SSH in KEYS (see KEYS.example), or _DEPLOY_SSH_TARGET in deploy.sh, or export DEPLOY_SSH."
  exit 1
fi

if [[ -z "${SSH_PASSWORD:-}" && -z "${SSH_PASSWORD_FILE:-}" ]]; then
  echo "ERROR: Set SSH_PASSWORD or SSH_PASSWORD_FILE in KEYS, or _DEPLOY_SSH_PASSWORD in deploy.sh, or export those vars."
  exit 1
fi

if [[ ! -f "$ROOT/KEYS" ]]; then
  echo "WARN: $ROOT/KEYS not found — using only deploy.sh fallbacks / environment."
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "ERROR: sshpass not installed. Run: brew install sshpass"
  exit 1
fi

SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=25
  -o StrictHostKeyChecking=no
)
run_ssh() {
  local -a _cmd
  if [[ -n "${SSH_PASSWORD_FILE:-}" ]]; then
    _cmd=(sshpass -f "${SSH_PASSWORD_FILE/#\~/$HOME}" ssh)
  elif [[ -n "${SSH_PASSWORD:-}" ]]; then
    _cmd=(sshpass -e ssh)
  else
    _cmd=(ssh)
  fi
  if [[ -n "${SSH_PORT:-}" && "${SSH_PORT:-22}" != "22" ]]; then
    _cmd+=(-p "${SSH_PORT}")
  fi
  _cmd+=("${SSH_OPTS[@]}" "$DEPLOY_SSH" "$@")
  if [[ -n "${SSH_PASSWORD_FILE:-}" ]]; then
    "${_cmd[@]}"
  elif [[ -n "${SSH_PASSWORD:-}" ]]; then
    env "SSHPASS=$SSH_PASSWORD" "${_cmd[@]}"
  else
    "${_cmd[@]}"
  fi
}

echo "==> Searching $DEPLOY_SSH for scripts/deploy.sh (prefer /var/www/) ..."

files=()
while IFS= read -r line; do
  [[ -n "$line" ]] && files+=("$line")
done < <(run_ssh "bash -s" <<'REMOTE'
set +e
find /var/www /root /home -maxdepth 16 -type f -path '*/scripts/deploy.sh' 2>/dev/null | sort -u
REMOTE
)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "ERROR: No scripts/deploy.sh on the server under /var/www, /root, or /home."
  echo "       Clone this repo on the VPS first, then re-run this script."
  exit 1
fi

choose_repo_root() {
  local f repo
  for f in "$@"; do
    [[ -z "$f" ]] && continue
    repo="$(dirname "$(dirname "$f")")"
    if [[ "$repo" == /var/www/* ]] && [[ "$repo" == *audio-video-screenshare* ]]; then
      echo "$repo"
      return 0
    fi
  done
  for f in "$@"; do
    [[ -z "$f" ]] && continue
    repo="$(dirname "$(dirname "$f")")"
    if [[ "$repo" == /var/www/* ]]; then
      echo "$repo"
      return 0
    fi
  done
  f="${1:-}"
  [[ -n "$f" ]] || return 1
  echo "$(dirname "$(dirname "$f")")"
}

CHOSEN="$(choose_repo_root "${files[@]}")"
echo "==> Detected repo root: $CHOSEN"
echo "    (found ${#files[@]} deploy script path(s))"

if [[ ! "$CHOSEN" =~ ^/ ]]; then
  echo "ERROR: Invalid path: $CHOSEN"
  exit 1
fi

if ! run_ssh "test -d $(printf '%q' "$CHOSEN")/server"; then
  echo "WARN: $CHOSEN/server not found on remote; still updating scripts/deploy.sh."
fi

python3 - "$DEPLOY_SH" "$CHOSEN" <<'PY'
import re
import sys
import shlex

deploy_sh, chosen = sys.argv[1], sys.argv[2]
with open(deploy_sh, "r", encoding="utf-8") as f:
    text = f.read()
line = "_DEPLOY_PATH_DEFAULT=" + shlex.quote(chosen)
new_text, n = re.subn(r"^_DEPLOY_PATH_DEFAULT=.*$", line, text, count=1, flags=re.M)
if n == 0:
    print("ERROR: _DEPLOY_PATH_DEFAULT= line not found in scripts/deploy.sh", file=sys.stderr)
    sys.exit(1)
with open(deploy_sh, "w", encoding="utf-8") as f:
    f.write(new_text)
print(f"==> Updated {deploy_sh}: {line}")
PY

echo "==> Done. Run: ./scripts/deploy.sh"
