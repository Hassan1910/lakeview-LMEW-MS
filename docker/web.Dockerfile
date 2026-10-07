# Shared production image for the Vite web apps.
# Public Supabase settings are not baked in. nginx serves /env.js from a mount.
FROM node:22-alpine AS build

ENV CI=true \
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

ARG APP_FILTER
RUN test -n "$APP_FILTER"
RUN pnpm --filter @lmew/shared-types build \
  && pnpm --filter @lmew/supabase-client build \
  && pnpm --filter @lmew/ui-tokens build \
  && pnpm --filter "$APP_FILTER" build

FROM nginx:1.27-alpine

ARG APP_DIR
RUN test -n "$APP_DIR"

RUN apk add --no-cache wget

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/${APP_DIR}/dist /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
