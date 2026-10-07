# Pinned Supabase CLI. Bump this tag, then rebuild, when upgrading the local stack.
# https://github.com/supabase/cli/releases
FROM debian:bookworm-slim

ARG SUPABASE_CLI_VERSION=2.120.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl jq mount tini \
  && rm -rf /var/lib/apt/lists/* \
  && arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
       amd64) cli_arch=amd64 ;; \
       arm64) cli_arch=arm64 ;; \
       *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
     esac \
  && curl -fsSL -o /tmp/supabase.tar.gz \
       "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_linux_${cli_arch}.tar.gz" \
  && tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase \
  && chmod 755 /usr/local/bin/supabase \
  && rm /tmp/supabase.tar.gz \
  && supabase --version

COPY docker/resolve-project.sh /usr/local/bin/resolve-project.sh
COPY docker/lmew-supabase.sh /usr/local/bin/lmew-supabase
COPY docker/supabase-up.sh /usr/local/bin/supabase-up.sh
RUN chmod 755 /usr/local/bin/resolve-project.sh /usr/local/bin/lmew-supabase /usr/local/bin/supabase-up.sh

WORKDIR /workspace
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/supabase-up.sh"]
