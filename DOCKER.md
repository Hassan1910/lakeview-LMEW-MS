# Run LMEW with Docker

Docker starts the Supabase project already in this repo (Postgres, Auth, Storage, Realtime, and Edge Functions) and serves the admin and staff web apps. The mobile app stays on the host because it needs Expo Go or an emulator.

You need Docker Engine and Docker Compose v2. Plan on about 4 GB of free RAM. The first start downloads the Supabase images and can take several minutes.

The Supabase service mounts the Docker socket so the CLI can start its own containers. That socket lets the container control Docker. Use this on a private machine. Put a firewall and TLS in front of the host before anyone else can reach it, and do not publish Postgres (`54322`) to the internet. The service-role key never goes into the web image or the browser.

## Configure

`docker compose up` works with no `.env` file. Studio, both web apps, and the seeded demo logins come up on localhost.

Copy `.env.example` to `.env` only when you need one of these:

- Paystack (`PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CALLBACK_URL`)
- Expo push (`EXPO_ACCESS_TOKEN`)
- A public API URL other than `http://localhost:54321` (`PUBLIC_SUPABASE_URL`)

Placeholder values such as `your-...` and `xxxx` are ignored. Paystack and Expo secrets are written to `supabase/functions/.env` for the Edge Functions. They are not baked into the web images.

## Start

From this directory:

```bash
docker compose up -d --build
```

When the containers are healthy:

| Service | URL |
| --- | --- |
| Admin web | http://localhost:3000 |
| Staff web | http://localhost:3001 |
| API | http://localhost:54321 |
| Studio | http://localhost:54323 |
| Mailpit (local email) | http://localhost:54324 |

Demo password for every seeded user: `LmewDemo123`

- Admin: `kevin@lakeviewmarine.co.ke` (administrator; also allowed into the staff portal)
- Staff: `george@lakeviewmarine.co.ke` (store manager)

Other accounts are in `supabase/seed.sql`.

Host `pnpm dev` is unchanged. It still reads `VITE_*` and `EXPO_PUBLIC_*` from `.env`. Stop the Docker web containers first if you want Vite on ports 3000 and 3001, or leave Docker up and point `.env` at the local API using `docker/runtime/public.env`.

## Mobile

After the stack is healthy, `docker/runtime/public.env` holds the local API URL and anon key. Copy the `EXPO_PUBLIC_*` lines into `.env`, then from this directory:

```bash
pnpm --filter @lmew/mobile dev
```

A phone cannot use `localhost`. Set `PUBLIC_SUPABASE_URL` to this machine's LAN address (for example `http://192.168.1.20:54321`), recreate the stack, and copy the new `EXPO_PUBLIC_*` values.

## Stop

```bash
docker compose down
```

This stops the web apps and the Supabase containers. Database and storage volumes are kept. The next `docker compose up -d` reuses them.

Do not run `supabase stop --no-backup` unless you mean to delete that data.

## Update

Rebuild the web apps after application changes:

```bash
docker compose up -d --build
```

New SQL files in `supabase/migrations` are applied the next time the Supabase container starts. To pick up a newer CLI, change `SUPABASE_CLI_VERSION` in `docker/supabase.Dockerfile` and the image tag in `docker-compose.yml`, then rebuild.

## Reset demo data

This wipes the local database and loads the migrations and seed again:

```bash
docker compose exec supabase lmew-supabase db reset
```

## Troubleshooting

**Port already in use.** Something else is bound to 3000, 3001, or 54321–54327. A host `pnpm dev` or a host `supabase start` is the usual cause. Stop that process, then `docker compose up -d` again.

**Permission denied on the Docker socket.** Your user must be able to run `docker`. On Linux, that usually means membership in the `docker` group. Log in again after that group change.

**Supabase container exits and restarts.** `docker compose logs supabase` shows the CLI error. If a previous CLI stack is still running, stop it with `supabase stop` on the host, or `docker compose down` and try again.

**`docker compose down` left API containers running.** The Supabase container should trap shutdown and run `supabase stop`. If the container was killed, run `docker compose up -d` once so the entrypoint can stop a stale stack, or from this directory run `supabase stop` with the same CLI version.

**Web app has no data or "Set VITE_SUPABASE_URL".** Wait until `docker compose ps` shows `supabase` as healthy. `curl -fsS http://localhost:54321/auth/v1/health` should succeed, and http://localhost:3000/env.js should mention `http://localhost:54321` (or your `PUBLIC_SUPABASE_URL`) and an anon key.

**Payments fail.** Add real Paystack keys to `.env` and recreate the Supabase container so it rewrites `supabase/functions/.env`: `docker compose up -d --force-recreate supabase`.

**Stale `docker/runtime/env.js` directory.** If that path is a directory instead of a file, remove `docker/runtime` and start again.
