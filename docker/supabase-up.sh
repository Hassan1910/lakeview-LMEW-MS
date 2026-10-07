#!/bin/bash
# Starts the existing Supabase CLI project and keeps it in the foreground.
# SIGTERM (docker compose down) runs `supabase stop`, which keeps database volumes.
set -euo pipefail

PUBLIC_SUPABASE_URL="${PUBLIC_SUPABASE_URL:-http://localhost:54321}"
PUBLIC_SUPABASE_URL="${PUBLIC_SUPABASE_URL%/}"
PROJECT_DIR=""
STARTED=0
CLEANED=0

# shellcheck disable=SC1091
source /usr/local/bin/resolve-project.sh

cleanup() {
  if [ "$CLEANED" -eq 1 ]; then
    return
  fi
  CLEANED=1
  if [ "$STARTED" -eq 1 ] && [ -n "$PROJECT_DIR" ]; then
    echo "Stopping Supabase. Database and storage volumes are kept."
    (cd "$PROJECT_DIR" && supabase stop) || true
  fi
}

trap 'cleanup; exit 0' TERM INT
trap 'code=$?; cleanup; exit "$code"' EXIT


# Read one KEY from a dotenv file. Prints nothing when missing.
read_dotenv() {
  local file="$1" key="$2" line val
  [ -f "$file" ] || return 0
  line=$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)
  [ -n "$line" ] || return 0
  val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  val="${val%$'\r'}"
  if [ "${val#\"}" != "$val" ] && [ "${val%\"}" != "$val" ]; then
    val="${val#\"}"
    val="${val%\"}"
  elif [ "${val#\'}" != "$val" ] && [ "${val%\'}" != "$val" ]; then
    val="${val#\'}"
    val="${val%\'}"
  fi
  printf '%s' "$val"
}

is_placeholder() {
  local val="$1"
  [ -z "$val" ] && return 0
  case "$val" in
    your-*|your_*|*xxxxxxxx*) return 0 ;;
  esac
  return 1
}

write_function_secrets() {
  local src="$PROJECT_DIR/.env"
  local dest="$PROJECT_DIR/supabase/functions/.env"
  local key val tmp wrote
  wrote=0
  tmp=$(mktemp)
  # Only app secrets. The CLI injects SUPABASE_URL, the anon key, and the service role.
  for key in PAYSTACK_SECRET_KEY PAYSTACK_WEBHOOK_SECRET PAYSTACK_CALLBACK_URL EXPO_ACCESS_TOKEN LMEW_HOTLINE LMEW_LOCATION; do
    val=$(read_dotenv "$src" "$key")
    if is_placeholder "$val"; then
      continue
    fi
    printf '%s=%s\n' "$key" "$(jq -rn --arg v "$val" '$v | @json')" >> "$tmp"
    wrote=$((wrote + 1))
    echo "Function secret set: $key"
  done
  chmod 600 "$tmp"
  mv "$tmp" "$dest"
  chmod 600 "$dest"
  if [ "$wrote" -eq 0 ]; then
    echo "No function secrets in .env. Paystack and push notifications stay unconfigured until you add them."
  fi
}

write_public_env() {
  local status_file anon runtime
  status_file=$(mktemp)
  # stdout only. stderr from the CLI can include notices; the JSON itself holds secrets.
  supabase status -o json > "$status_file"
  anon=$(jq -r '.ANON_KEY // empty' "$status_file" 2>/dev/null || true)
  rm -f "$status_file"
  if [ -z "$anon" ]; then
    echo "supabase status did not return ANON_KEY." >&2
    exit 1
  fi

  runtime="$PROJECT_DIR/docker/runtime"
  mkdir -p "$runtime"
  chmod 1777 "$runtime"

  local env_js public_env api_base
  env_js="$runtime/env.js"
  public_env="$runtime/public.env"
  api_base="${PUBLIC_SUPABASE_URL}/functions/v1"

  # Temp files live next to the destination so mv is atomic on the bind mount.
  local tmp_js tmp_env
  tmp_js=$(mktemp "$runtime/env.js.XXXXXX")
  tmp_env=$(mktemp "$runtime/public.env.XXXXXX")
  jq -rn --arg url "$PUBLIC_SUPABASE_URL" --arg key "$anon" \
    '"window.__LMEW_PUBLIC_ENV__ = " + ({VITE_SUPABASE_URL:$url, VITE_SUPABASE_ANON_KEY:$key} | tojson) + ";\n"' \
    > "$tmp_js"
  jq -rn --arg url "$PUBLIC_SUPABASE_URL" --arg key "$anon" --arg api "$api_base" \
    '"VITE_SUPABASE_URL=" + ($url | @json) + "\n" +
     "VITE_SUPABASE_ANON_KEY=" + ($key | @json) + "\n" +
     "EXPO_PUBLIC_SUPABASE_URL=" + ($url | @json) + "\n" +
     "EXPO_PUBLIC_SUPABASE_ANON_KEY=" + ($key | @json) + "\n" +
     "EXPO_PUBLIC_API_BASE=" + ($api | @json) + "\n"' \
    > "$tmp_env"
  # @json wraps values in quotes, which dotenv and Expo both accept.
  mv "$tmp_js" "$env_js"
  mv "$tmp_env" "$public_env"
  chmod 644 "$env_js" "$public_env"
  echo "Wrote public client config for ${PUBLIC_SUPABASE_URL}"
}

resolve_project_dir
echo "Project directory: $PROJECT_DIR"
write_function_secrets

echo "Starting Supabase. The first run downloads images and can take several minutes."
supabase start
STARTED=1
write_public_env

echo "Supabase API is published on the host at ${PUBLIC_SUPABASE_URL}"
echo "Studio: http://localhost:54323"
while true; do
  sleep 3600 &
  wait $! || true
done
