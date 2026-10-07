#!/bin/bash
# Maps /workspace back to the host path and cd's there.
# The Supabase CLI bind-mounts sibling containers using os.Getwd(), which
# resolves symlinks, so this has to be a real bind mount.

resolve_project_dir() {
  local cid host_path
  cid=$(hostname)
  host_path=$(curl -fsS --unix-socket /var/run/docker.sock \
    "http://localhost/v1.44/containers/${cid}/json" \
    | jq -r '[.Mounts[] | select(.Destination=="/workspace") | .Source][0] // empty')
  if [ -z "$host_path" ] || [ "$host_path" = "null" ]; then
    echo "Could not resolve the host path mounted at /workspace." >&2
    exit 1
  fi
  if [ "$host_path" != "/workspace" ]; then
    mkdir -p "$host_path"
    if ! mountpoint -q "$host_path"; then
      if ! mount --bind /workspace "$host_path"; then
        echo "Could not bind-mount the project at $host_path." >&2
        exit 1
      fi
    fi
  fi
  cd "$host_path"
  PROJECT_DIR=$host_path
}
