# UniLMS — Render Deploy Guide

Render is similar to Railway in UX but uses **Blueprints** (`render.yaml`) for
infrastructure-as-code. The Blueprint in the repo root spins up Postgres +
Backend + Frontend in one click.

**Total time: ~20 minutes**. R2 setup (Part 1 in [DEPLOY.md](DEPLOY.md)) is
identical — finish that first if you haven't.

---

## Part 1 — Sign up

1. Open https://dashboard.render.com/register
2. Click **Sign up with GitHub** → authorize Render to read `Olzhik06/relaxed-benz`
3. Free plan is fine for now; you can upgrade per-service later

---

## Part 2 — Create the Blueprint

1. In Render dashboard, click **+ New** (top-right) → **Blueprint**
2. **Connect a repository** → pick `Olzhik06/relaxed-benz`
3. **Branch**: `olzhas/relaxed-benz`
4. Render reads `render.yaml` and shows you the 3 services it's about to create:
   - `aitu-unilms-db` (Postgres, free 90 days)
   - `aitu-unilms-backend` (web service, Docker)
   - `aitu-unilms-frontend` (web service, Docker)
5. Click **Apply**
6. Render starts creating things — this takes 5-8 minutes (first Docker build is slow)

While builds run, jump to Part 3 to prep env vars.

---

## Part 3 — Fill in secret env vars

The Blueprint declared most env vars but left secrets blank for you to paste manually. Open each service and fill them in.

### 3.1 Backend service → Environment

Open **unilms-backend** → **Environment** tab. You'll see some auto-populated values (DATABASE_URL, JWT_SECRET, etc. — Render generated those). Paste **these** values into the empty fields:

| Key                  | Value                                        | Where to get it                                                  |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | `8841...`                                    | @BotFather chat in Telegram                                      |
| `LLM_API_KEY`        | `sk-ant-...`                                 | console.anthropic.com (optional — without it AI is in demo mode) |
| `S3_ENDPOINT`        | `https://<account>.r2.cloudflarestorage.com` | Cloudflare R2 dashboard                                          |
| `S3_BUCKET`          | `unilms-uploads`                             | (the bucket name you picked)                                     |
| `S3_ACCESS_KEY`      | (R2 token's Access Key ID)                   | R2 dashboard → API Tokens                                        |
| `S3_SECRET_KEY`      | (R2 token's Secret)                          | R2 dashboard → API Tokens                                        |
| `S3_PUBLIC_URL`      | `https://pub-<hash>.r2.dev`                  | R2 dashboard → bucket → Settings → Public Access                 |

Click **Save Changes** at the bottom. Render will redeploy the service automatically.

### 3.2 Frontend service → Environment

Open **unilms-frontend** → **Environment** tab. Render needs the backend's public URL here.

Look up the backend service's URL — top of its dashboard, looks like `https://aitu-unilms-backend.onrender.com`. Then in the frontend's env vars:

| Key                   | Value                                          |
| --------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://aitu-unilms-backend.onrender.com/api` |

Click **Save Changes**, then in the top-right click **Manual Deploy** → **Deploy latest commit**. (Next.js bakes `NEXT_PUBLIC_*` into the bundle at build time, so it needs a rebuild for the new value.)

---

## Part 4 — Verify

1. Open the frontend URL — should load the LMS landing page
2. Open `https://aitu-unilms-backend.onrender.com/api/docs` — Swagger UI
3. Open backend service → **Logs** tab. Look for:
   - `[StorageService] Storage initialised in "s3" mode (bucket=unilms-uploads)` ← R2 wired up
   - `[TelegramWebhookController] Telegram webhook registered at https://aitu-unilms-backend.onrender.com/api/telegram/webhook` ← bot inbound ready
4. Check Telegram acknowledged the webhook:
   ```
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
   ```
   Should return `"url":"https://aitu-unilms-backend.onrender.com/api/telegram/webhook"`.

---

## Part 5 — Keep-alive ping (free plan only)

**Skip this if you upgraded backend to Starter ($7/mo).** Free web services on
Render suspend after 15 minutes with no inbound traffic, which kills the bot
between user messages. Workaround: hit `/api/health` from an external cron
every 10 minutes.

### Easy way — cron-job.org (free)

1. Open https://cron-job.org and sign up (free, no card)
2. Click **CREATE CRONJOB**
3. **Title**: `unilms-keep-alive`
4. **URL**: `https://aitu-unilms-backend.onrender.com/api/health`
5. **Schedule**: every 10 minutes
6. **Save**
7. Hit **Run now** once to verify — should return 200 with `{ "status": "ok" }`

Done. Render will keep waking the backend in under 30 sec even if it spun
down between pings, and Telegram won't time out webhook deliveries.

---

## Part 6 — Smoke test

Now jump to [SMOKE-TEST.md](SMOKE-TEST.md) §1 and walk through all sections.
URLs in the doc need substitution:

- `https://unilms-backend.../api/...` → `https://aitu-unilms-backend.onrender.com/api/...`
- `https://unilms-frontend...` → `https://aitu-unilms-frontend.onrender.com`

---

## Troubleshooting

**Build fails: "No start command detected"**
That means Render ignored the Blueprint and is auto-detecting. Open the service's **Settings** → **Build & Deploy** → set **Runtime** = `Docker`. Also confirm **Root Directory** = `apps/backend` (or `apps/frontend`).

**Backend boots but `/api/docs` returns 404**
The service spun up but Nest didn't bind to the port Render expected. Check that the `PORT` env var is being honored — `main.ts` should be reading `process.env.PORT`. (We fixed this in commit `703ea3b`+.)

**Webhook returns 401 from Telegram**
The `TELEGRAM_WEBHOOK_SECRET` Render auto-generated has to match what `setWebhook` called with. Sometimes after rotating env vars, the bot still has the old secret. Force-reset:

```bash
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

Then restart the backend service from Render UI → it'll call `setWebhook` again with the current secret.

**Files upload OK but show 404 in the LMS**
The fileUrl in DB is the S3 URL, but the bucket isn't actually public. Open R2 → bucket → Settings → Public Access → toggle on. Or switch backend to use signed URLs by leaving `S3_PUBLIC_URL` blank.

**Frontend can't reach backend (`net::ERR_FAILED` in browser console)**
CORS or wrong API URL. Check `NEXT_PUBLIC_API_URL` in the frontend's environment — must be the full backend URL including `/api`. Then trigger a manual frontend redeploy (NEXT*PUBLIC*\* needs a rebuild).

**Render redeploys are stuck "in progress" forever**
The free plan throttles concurrent builds. Wait or upgrade.

---

## Cost summary

| Service       | Plan              | Cost                                            |
| ------------- | ----------------- | ----------------------------------------------- |
| Postgres      | Free              | $0 (90 days, then $7/mo Starter)                |
| Backend web   | Free + keep-alive | $0 (suspends if no traffic + cron-job.org dead) |
| Frontend web  | Free              | $0 (same caveat — but rare to lose all traffic) |
| Cloudflare R2 | Free              | $0 (10GB forever)                               |
| cron-job.org  | Free              | $0                                              |

**Total: $0 for the diploma demo period.** After 90 days you'll need Postgres
Starter ($7/mo) unless you migrate to a free Postgres elsewhere (Neon /
Supabase have generous free tiers and you'd just swap `DATABASE_URL`).
