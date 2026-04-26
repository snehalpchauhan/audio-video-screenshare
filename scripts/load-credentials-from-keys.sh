# shellcheck shell=bash
# Sourced by deploy.sh and configure-deploy-path.sh after ROOT is set.

deploy_load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  if grep -qE '^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=|export[[:space:]]+[A-Za-z_])' "$f"; then
    set -a
    # shellcheck source=/dev/null
    source "$f"
    set +a
  fi
}

# Legacy one-line: "ssh user@host /optional/path notes…"
deploy_parse_legacy_keys_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local line
  line=$(head -1 "$f" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [[ -n "$line" ]] || return 0
  if [[ "$line" =~ ^ssh[[:space:]]+([^[:space:]]+)(.*)$ ]]; then
    DEPLOY_SSH="${BASH_REMATCH[1]}"
    local tail="${BASH_REMATCH[2]}"
    tail=$(echo "$tail" | sed 's/^[[:space:]]*//')
    if [[ -n "$tail" ]]; then
      local p
      p=$(echo "$tail" | awk '{print $1}')
      if [[ "$p" == /* && "$p" != "/" ]]; then
        DEPLOY_PATH="$p"
      fi
    fi
  elif [[ "$line" =~ ^([^[:space:]]+@[^[:space:]]+)[[:space:]]+(.+)$ ]] && [[ ! "$line" =~ = ]]; then
    DEPLOY_SSH="${BASH_REMATCH[1]}"
    local maybe="${BASH_REMATCH[2]}"
    maybe=$(echo "$maybe" | awk '{print $1}')
    if [[ "$maybe" == /* && "$maybe" != "/" ]]; then
      DEPLOY_PATH="$maybe"
    fi
  fi
}

# deploy.local.env first; KEYS wins for DEPLOY_SSH, SSH_PASSWORD, DEPLOY_PATH, etc.
deploy_load_credentials() {
  deploy_load_env_file "$ROOT/scripts/deploy.local.env"
  local keys="$ROOT/KEYS"
  if [[ -f "$keys" ]]; then
    if head -1 "$keys" | grep -qE '^[[:space:]]*ssh[[:space:]]+'; then
      deploy_parse_legacy_keys_file "$keys"
    elif grep -qE '^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=|export[[:space:]]+[A-Za-z_])' "$keys"; then
      set -a
      # shellcheck source=/dev/null
      source "$keys"
      set +a
    else
      deploy_parse_legacy_keys_file "$keys"
    fi
  fi
}
