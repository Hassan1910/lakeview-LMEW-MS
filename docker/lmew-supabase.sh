#!/bin/bash
# Run a Supabase CLI command from the host project path.
# Example: docker compose exec supabase lmew-supabase db reset
set -euo pipefail
# shellcheck disable=SC1091
source /usr/local/bin/resolve-project.sh
resolve_project_dir
exec supabase "$@"
