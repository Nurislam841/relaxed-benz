# UniLMS — Production Deploy Guide

Step-by-step: Cloudflare R2 (file storage) + Railway (backend + frontend + Postgres).

Total time: **~25 minutes** if you have GitHub auth ready.

---

## Part 1 — Cloudflare R2 (file storage, 10GB free forever)

### 1.1 Sign up for Cloudflare

1. Open https://dash.cloudflare.com/sign-up
2. Use your email + a password (no card needed for signup, but R2 will ask for one — won't be charged on free tier)
3. Verify email

### 1.2 Enable R2

1. After login, on the left sidebar click **R2 Object Storage**
2. Click **Purchase R2 Plan** → free tier auto-selected. You'll be asked for a card (anti-abuse only — billing alerts at $1 if you ever cross 10GB)
3. Accept ToS

### 1.3 Create a bucket

1. Click **Create bucket**
2. Name: `unilms-uploads` (or anything — lowercase, no spaces)
3. Location: **Automatic** (cheapest)
4. Click **Create bucket**

### 1.4 Make it public-read (so frontend can show files without signed URLs)

1. Open your bucket → **Settings** tab → **Public access**
2. Click **Allow Access** under **R2.dev subdomain**
3. Copy the public URL — looks like `https://pub-abc123def456.r2.dev`
4. Save this URL — you'll need it in **Part 2** as `S3_PUBLIC_URL`

> ⚠️ If you'd rather keep the bucket private, skip this step — the backend will generate short-lived signed URLs automatically (slightly slower reads, but no public-access risk).

### 1.5 Generate API token

1. Top-right → **R2 → Manage R2 API Tokens** (or **Account API Tokens** in some accounts)
2. Click **Create API token**
3. Name: `unilms-backend`
4. Permissions: **Object Read & Write**
5. Specify bucket: **unilms-uploads** (the one you just created)
6. TTL: **Forever** (or however long suits you)
7. Click **Create API Token**
8. Copy the **Access Key ID** and **Secret Access Key** — these are shown ONCE, save them right now
9. Also copy your **Endpoint** — looks like `https://abc123.r2.cloudflarestorage.com`

You now have 5 values to set as Railway env vars:

```
STORAGE_MODE=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=unilms-uploads
S3_REGION=auto
S3_ACCESS_KEY=<access-key-id>
S3_SECRET_KEY=<secret-access-key>
S3_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev  (only if you made the bucket public)
```

### 1.6 (Optional) Verify locally first

Before deploying, you can test R2 works:

```bash
# 1. paste the values into apps/backend/.env (use docker-compose host network IP)
# 2. restart backend
docker compose restart backend

# 3. log in to the web app, go to an assignment, upload a file
# 4. check the bucket in Cloudflare — you should see your file there
# 5. open the file URL from the assignment — it should load
```

---

## Part 2 — Railway (backend + frontend + Postgres)

### 2.1 Sign up

1. https://railway.com/login → **Sign in with GitHub**
2. Authorize Railway to read your repos
3. Free **Hobby** plan gives you $5 credit/month — plenty for this project

### 2.2 Create the project (Postgres first)

1. Click **+ New** → **Project**
2. Pick **Provision PostgreSQL**
3. Railway spins up a Postgres instance. Open it → **Variables** tab → note the **DATABASE_URL** Railway auto-generates (`postgresql://postgres:...@viaduct.proxy.rlwy.net:.../railway`)

### 2.3 Deploy the backend service

1. In the same project, click **+ New** → **GitHub Repo** → pick `Olzhik06/relaxed-benz`
2. Railway detects multiple services — pick **Empty Service**
3. Open the new service → **Settings** tab
   - **Root Directory**: `apps/backend`
   - **Build**: Railway auto-detects Dockerfile (from `apps/backend/railway.json`)
4. **Variables** tab → click **Reference Variable** → select Postgres → **DATABASE_URL** (copies it across automatically)
5. Add the remaining env vars (paste these — replace placeholders):

```env
# Required
JWT_SECRET=<run: openssl rand -hex 48>
JWT_REFRESH_SECRET=<run: openssl rand -hex 48>
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
NODE_ENV=production

# Telegram bot
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_BOT_USERNAME=uni_lms_bot
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_SECRET=<run: openssl rand -hex 16>
TELEGRAM_LINK_SECRET=<run: openssl rand -hex 32>

# AI (optional — set to enable real Claude responses)
LLM_API_KEY=<from console.anthropic.com>

# Storage — paste R2 values from Part 1.5
STORAGE_MODE=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_BUCKET=unilms-uploads
S3_REGION=auto
S3_ACCESS_KEY=<from R2>
S3_SECRET_KEY=<from R2>
S3_PUBLIC_URL=https://pub-xxxxxx.r2.dev

# Railway sets this for you, but you need it visible in the app:
# BACKEND_PUBLIC_URL set below after first deploy
```

6. **Networking** tab → **Generate Domain** → Railway gives you `unilms-backend-production-xxxx.up.railway.app`
7. Go back to **Variables**, add:

```env
BACKEND_PUBLIC_URL=https://unilms-backend-production-xxxx.up.railway.app
FRONTEND_URL=https://unilms-frontend-production-yyyy.up.railway.app  # placeholder; you'll set the real one after frontend deploys
```

8. Click **Deploy** (or wait — it auto-deploys on env var changes). First build takes ~3-5 min.
9. When the deploy turns green, open the URL — you should see Swagger at `/api/docs`

### 2.4 Deploy the frontend service

1. Same project → **+ New** → **GitHub Repo** → pick the same repo → **Empty Service**
2. **Settings** → **Root Directory**: `apps/frontend`
3. **Variables**:

```env
NEXT_PUBLIC_API_URL=https://unilms-backend-production-xxxx.up.railway.app/api
NODE_ENV=production
```

4. **Networking** → **Generate Domain** → get `unilms-frontend-production-yyyy.up.railway.app`
5. Go back to **backend service → Variables** → update `FRONTEND_URL` to the real frontend URL
6. Backend will auto-redeploy with the new value

### 2.5 Telegram webhook auto-registers

On backend boot, the app calls `bot.api.setWebhook(BACKEND_PUBLIC_URL + '/api/telegram/webhook', ...)` automatically. Watch the backend deploy logs — you should see:

```
[TelegramWebhookController] Telegram webhook registered at https://unilms-backend-.../api/telegram/webhook
```

If you don't see that line, check:

- `TELEGRAM_BOT_TOKEN` is set
- `TELEGRAM_MODE=webhook` is set
- `BACKEND_PUBLIC_URL` is set to the Railway-generated domain (no trailing slash)

You can verify the webhook is live by hitting Telegram's API:

```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

Should return `"url":"https://unilms-backend-.../api/telegram/webhook"`.

### 2.6 Run database migrations

The backend's `docker-entrypoint.sh` already runs `prisma db push --accept-data-loss` on boot, so your schema is auto-synced. No manual step needed.

---

## Part 3 — Verification

Open `https://unilms-frontend-production-yyyy.up.railway.app` and:

1. **Register a new account** (or login with seeded admin)
2. Go to `/profile`
3. Click **🚀 Connect in one tap** under Telegram notifications
4. Telegram should open with `@uni_lms_bot` → tap **Start** → bot replies "✅ UniLMS linked!"
5. In the bot DM, type `/today` — you should get an answer back (probably "No classes today")
6. Run through the full smoke checklist in [SMOKE-TEST.md](SMOKE-TEST.md)

---

## Troubleshooting

**Backend won't start**: check Railway logs for migrations failing — usually a missing `DATABASE_URL` reference variable. Re-link Postgres in the Variables tab.

**Webhook returns 401**: `TELEGRAM_WEBHOOK_SECRET` must match what was set when `setWebhook` was called. Easiest fix: delete the webhook and redeploy backend:

```bash
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

Then trigger a redeploy in Railway (env var change or push a commit).

**Files in S3 but old web pages still 404**: existing DB rows still point at `/uploads/<file>` paths that don't exist on the new container. Run the migration:

```bash
# locally, with R2 creds set:
cd apps/backend
STORAGE_MODE=s3 \
S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_PUBLIC_URL=... \
DATABASE_URL=<railway production URL> \
pnpm migrate:uploads-to-s3
```

(This reads from your **local** `./uploads` dir and uploads everything that's still on disk into S3 + updates Railway's DB to point at the new URLs.)

**Bot doesn't respond at all**: check `/api/telegram/webhook` is reachable:

```bash
curl -X POST https://unilms-backend-.../api/telegram/webhook -H "X-Telegram-Bot-Api-Secret-Token: <secret>" -d '{}'
```

Should return 200. If 401, secret mismatch. If 404, route not deployed (check Railway logs).

**Frontend can't reach backend**: check `NEXT_PUBLIC_API_URL` matches the backend's Railway URL. After changing this, the frontend needs to **rebuild**, not just restart — push any commit to trigger a redeploy.

---

## What's NOT in this guide (intentionally)

- **CDN / custom domain** — Railway's `*.up.railway.app` domain has a working SSL cert out of the box. Adding `unilms.example.com` is a separate Cloudflare DNS step.
- **Production scaling** — Railway free tier handles ~100 concurrent users without trouble. Beyond that you'd pin a `replicas` count in `railway.json`.
- **Backups** — Postgres in Railway is auto-snapshotted; you can also `pg_dump` periodically via a one-off task. Not needed for a diploma demo.
- **Telegram BotFather polish** — descriptions, profile pic, command menu (the latter we set programmatically via `setMyCommands` in TelegramUpdatesService).
