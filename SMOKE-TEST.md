# UniLMS — Manual Smoke Test Plan

End-to-end checklist exercised against a freshly deployed Railway environment.
Aim for **15-20 minutes** if everything works first try.

Two browser windows side-by-side make it easier:

- Window A: **teacher** account (or admin) — `admin@uni.kz / Admin123!` if you have the seed
- Window B: **student** account

You also need:

- Telegram on your phone
- The bot username: `@uni_lms_bot`

Each section: ✓ pass criteria + ✗ what to check if broken.

---

## §0 — Deployment sanity (1 min)

| #   | Step                                                      | Expected                             | If broken                                                                     |
| --- | --------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| 0.1 | Open `https://unilms-frontend.../`                        | Landing/login page loads             | Check Railway frontend service is deployed (green); `NEXT_PUBLIC_API_URL` set |
| 0.2 | Open `https://unilms-backend.../api/docs`                 | Swagger UI renders, see Telegram tag | Backend service didn't deploy — check logs                                    |
| 0.3 | `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` | `"url":"https://unilms-backend..."`  | Webhook didn't register — see DEPLOY troubleshooting                          |

---

## §1 — Account registration + linking (3 min)

This is the foundation — every other test depends on a linked Telegram chat.

| #   | Window | Step                                           | Expected                                          |
| --- | ------ | ---------------------------------------------- | ------------------------------------------------- |
| 1.1 | A      | Register a teacher account (or login as admin) | Land on `/dashboard`                              |
| 1.2 | A      | Go to `/profile`                               | See "Telegram notifications" card                 |
| 1.3 | A      | Click **🚀 Connect in one tap**                | Browser opens `t.me/uni_lms_bot?start=link_<jwt>` |
| 1.4 | Phone  | Tap **Start** in Telegram                      | Bot replies: "✅ UniLMS linked!"                  |
| 1.5 | A      | Wait ~8s, page refreshes                       | Card now shows green "ON" badge + masked chat_id  |
| 1.6 | A      | Click **Send test**                            | Phone receives "🔔 Test notification"             |
| 1.7 | Phone  | Tap `/help` in bot menu                        | Bot lists all commands                            |

**✗ Common issues:**

- "This link expired" → token TTL is 5min; click "Connect in one tap" again
- Card stays not-linked → check `TELEGRAM_LINK_SECRET` env var is set; check backend logs for JWT verify error

---

## §2 — Core commands (3 min)

All in Telegram DM with `@uni_lms_bot`.

| #   | Command                                  | Expected                                                |
| --- | ---------------------------------------- | ------------------------------------------------------- |
| 2.1 | `/today`                                 | Today's schedule (or "No classes today")                |
| 2.2 | `/schedule`                              | Week-ahead view, grouped by day                         |
| 2.3 | `/grades`                                | "No grades yet" (fresh account) OR list of latest 5     |
| 2.4 | `/upcoming`                              | Assignments due in next 7 days                          |
| 2.5 | `/ask What is SQL?`                      | AI streams a response (message edits as text arrives)   |
| 2.6 | `/coach`                                 | "Generating…" then trajectory + weaknesses + 3-day plan |
| 2.7 | Just type "explain quicksort" (no slash) | Same as /ask but ambient — only in DMs                  |

**✗ If `/ask` returns "AI unavailable":** check `LLM_API_KEY` env var is set in Railway.
**✗ If `/coach` returns "Could not generate":** student has no data yet; create an assignment + submission first.

---

## §3 — Inline button notifications (3 min)

Trigger each notification type and check the buttons that come through.

### 3.1 Assignment notification

- **A**: As teacher, create a new assignment in any course
- **B**: As an enrolled student (linked to TG), wait ~2s
- **Phone**: receive "New: <course title>" with buttons **📝 Open** + **✅ Mark read**
- Tap **Mark read** → bot toasts "✓ Marked as read"

### 3.2 Grade notification

- **A**: Grade an existing student submission
- **Phone (student)**: receive "Grade published" with **📊 View** + **🤖 Ask AI**
- Tap **🤖 Ask AI** → bot replies with AI feedback paragraphs

### 3.3 Announcement

- **A**: Post a course-wide announcement
- **Phone (student)**: receive "📢 New: <course>" with **🔗 Open** button
- Tap → opens browser at `/courses/<id>/overview`

### 3.4 Achievement (Phase 1.7)

- Trigger any badge — e.g. submit your first assignment if you're a fresh student
- **Phone**: receive "🏆 Badge unlocked: Getting Started" with **🏆 View badges**

**✗ No DM received:** student isn't actually linked, or `TELEGRAM_MODE=webhook` but webhook isn't registered.

---

## §4 — Native quiz polls broadcast (Phase 2.1, 2 min)

The headline wow feature.

| #   | Window                 | Step                                                                                   | Expected                                                                        |
| --- | ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 4.1 | A (teacher)            | Go to a course → Quiz Studio → generate or open a published quiz                       | See it in the library                                                           |
| 4.2 | A                      | Click **📡 Broadcast to Telegram** (Phase 2.1 button — add to quiz-library if missing) | Toast: "Sent to N students"                                                     |
| 4.3 | Phone (linked student) | Wait ~2s                                                                               | Receive intro msg + N native quiz polls in sequence                             |
| 4.4 | Phone                  | Tap any answer                                                                         | Telegram shows ✅ green check OR ❌ red on the choice. **Confetti on correct.** |
| 4.5 | A                      | Check `/quizzes/<id>` attempts                                                         | New attempt row from this student                                               |

**Note**: the **📡 Broadcast to Telegram** button is described in the plan but not yet wired into the frontend `quiz-library.tsx` — call the endpoint manually for now:

```bash
curl -X POST https://unilms-backend.../api/quizzes/<QUIZ_ID>/broadcast-telegram \
  -H "Authorization: Bearer <teacher-jwt>"
```

(Get the JWT by logging in via web → DevTools → Application → Cookies → `access_token`.)

---

## §5 — Live Kahoot from Telegram (Phase 2.2, 4 min)

Most complex flow — requires the WebSocket Kahoot session.

| #    | Window                 | Step                                                  | Expected                                                                    |
| ---- | ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| 5.1  | A (teacher)            | Quiz library → published quiz → **Host live**         | Lands on `/kahoot/host/<id>` with join code displayed                       |
| 5.2  | Note the 6-letter code | e.g. `ABC123`                                         | —                                                                           |
| 5.3  | Phone (linked student) | Send `/join ABC123` to the bot                        | Bot: "✅ Joined "<quiz>" lobby. Wait for the host."                         |
| 5.4  | A                      | See lobby update (the student appears in player list) | If WebSocket gateway works, yes                                             |
| 5.5  | A                      | Click **Start game**                                  | Both web players AND TG-joined players get question 1                       |
| 5.6  | Phone                  | See native quiz poll arrive                           | Same options + open period = secondsPerQuestion                             |
| 5.7  | Phone                  | Tap an answer fast                                    | Score updates in host's live leaderboard                                    |
| 5.8  | A                      | Click **Next** through all questions                  | Each broadcast hits TG too                                                  |
| 5.9  | A                      | Click **Finish** (or auto-finish at last question)    | Phone receives "🏁 Game over!" + final rank + **📊 Detailed report** button |
| 5.10 | Phone                  | Tap report button                                     | Opens web report page in browser, signed in                                 |

**✗ Bot says "Could not join"**: quiz isn't published, or wrong code, or session already finished.
**✗ Polls don't arrive in TG during play:** check backend logs for "TG poll fan-out failed" — usually means `KahootTelegramSubscription` insertion didn't happen on `/join`.

---

## §6 — Photo / PDF submission (Phase 4.3, 2 min)

| #   | Window | Step                                                           | Expected                                                                 |
| --- | ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 6.1 | A      | Create an assignment, copy its ID from URL `/assignments/<ID>` | —                                                                        |
| 6.2 | Phone  | `/submit <ASSIGNMENT_ID>`                                      | Bot: "📎 Ready to submit. Send a photo or PDF (10 min)."                 |
| 6.3 | Phone  | Take a photo of anything, send to bot                          | Bot: "✅ Submitted! Your teacher will see it shortly."                   |
| 6.4 | A      | Open the assignment's submissions tab                          | See new submission with attachment from this student                     |
| 6.5 | A      | Click the attachment                                           | Photo opens — **served from R2 if STORAGE_MODE=s3**, from disk otherwise |

**✗ "Submission failed: unknown error"**: storage misconfigured. Check Railway logs for S3 errors.

---

## §7 — Group chat binding (Phase 4.2, 3 min)

| #   | Window           | Step                                                | Expected                                           |
| --- | ---------------- | --------------------------------------------------- | -------------------------------------------------- |
| 7.1 | Phone            | Create a test group chat in Telegram                | —                                                  |
| 7.2 | Phone            | Add `@uni_lms_bot` to the group                     | Bot welcomes                                       |
| 7.3 | Phone            | In group, send `/bind CS101` (use real course code) | Bot: "✅ This group is now bound to CS101 — …"     |
| 7.4 | A (teacher)      | Post an announcement to CS101                       | Group receives "📢 New: …" with **🔗 Open** button |
| 7.5 | Phone (in group) | Send `/unbind`                                      | Bot: "🔌 Group unbound"                            |
| 7.6 | A                | Post another announcement                           | Group does NOT receive it                          |

**✗ `/bind` doesn't work in group:** bot needs to be ADMIN of the group (or at least see all messages — depends on Telegram privacy mode). Use BotFather → `/setprivacy` → **Disable**.

---

## §8 — Teacher dashboard commands (Phase 2.3, 1 min)

DM the bot as the teacher account.

| #   | Command                   | Expected                                                                            |
| --- | ------------------------- | ----------------------------------------------------------------------------------- |
| 8.1 | `/at_risk CS101`          | "Generating class insights…" then list of at-risk students (or "🎉 Nobody at risk") |
| 8.2 | `/today_attendance CS101` | "✅ Present: N · ❌ Absent: N · ⏰ Late: N · X% of N students"                      |

**✗ "Teachers/admins only":** the linked account isn't a TEACHER/ADMIN role.

---

## §9 — Telegram Mini App (Phase 4.1, 1 min)

| #   | Phone              | Step                                                    | Expected           |
| --- | ------------------ | ------------------------------------------------------- | ------------------ |
| 9.1 | Send `/app` to bot | Bot replies with **🚀 Open UniLMS** WebApp button       | —                  |
| 9.2 | Tap the button     | Full LMS opens **inside Telegram**, no separate browser | —                  |
| 9.3 | —                  | You're auto-logged in (no email/password prompt)        | —                  |
| 9.4 | —                  | Navigate to /grades, /schedule, etc.                    | All works normally |

**✗ "Mini App not configured":** `BACKEND_PUBLIC_URL` not set.
**✗ Mini App opens but you're at /login:** auto-login failed. Check backend logs for "initData signature mismatch" or "initData expired".

---

## §10 — Cron reminders (Phase 3, 5 min — patient!)

These are time-based. To test without waiting an hour:

### Quick way (manual cron trigger)

- SSH into Railway: `railway run --service backend node -e "require('./dist/main')"` (or use Railway's exec shell)
- Run the cron handlers manually:

```js
// Once you have an interactive shell:
const app = await NestFactory.createApplicationContext(AppModule);
const reminders = app.get(TelegramRemindersService);
await reminders.classReminderTick();
await reminders.deadlineReminderTick();
```

### Or the slow way:

- 10.1 Create a ScheduleItem starting in 60 min from now (use Admin → Schedule)
- 10.2 Wait until ~5 min ticks pass with `now + 60min` in the 55-65min window
- 10.3 Phone receives "🕐 Class in 1 hour" notification

For **deadline reminders**: create an assignment due in 24 hours, wait an hour, you should see "⚠️ Due in 24 hours".

---

## §11 — Webhook security (1 min)

| #    | Command                                                                                                                                | Expected                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 11.1 | `curl -X POST https://unilms-backend.../api/telegram/webhook -d '{}'`                                                                  | **401 Unauthorized**          |
| 11.2 | `curl -X POST https://unilms-backend.../api/telegram/webhook -H "X-Telegram-Bot-Api-Secret-Token: <YOUR_SECRET>" -d '{"update_id":1}'` | **200 OK** with `{"ok":true}` |

---

## §12 — Storage sanity (R2 verification, 1 min)

| #    | Step                                                  | Expected                                                                   |
| ---- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| 12.1 | Submit a file via web (any assignment)                | Upload succeeds                                                            |
| 12.2 | Open Cloudflare R2 dashboard → bucket                 | New object listed with timestamp matching upload                           |
| 12.3 | Click the object → **Object URL**                     | File downloads correctly                                                   |
| 12.4 | In LMS, click the attachment link from teacher's view | Opens (same R2 URL)                                                        |
| 12.5 | (Optional) Redeploy backend on Railway                | After restart, the old upload is **still accessible** (proves persistence) |

---

## §13 — Quiet hours / mute (NOT IMPLEMENTED yet)

The plan mentions `/quiet 22:00-08:00` but we skipped it as scope creep. If you want it later, add a `notificationQuietHoursStart/End` columns to User + a check in `fanOutToTelegram`.

---

## Aggregate scorecard

After running through everything, count:

- ✅ §0 (deploy sanity) — all 3
- ✅ §1 (linking) — all 7
- ✅ §2 (commands) — all 7
- ✅ §3 (notifications) — all 4 types
- ✅ §4 (quiz broadcast) — full flow
- ✅ §5 (live Kahoot from TG) — full flow
- ✅ §6 (photo submission) — full flow
- ✅ §7 (group binding) — full flow
- ✅ §8 (teacher dashboard) — both commands
- ✅ §9 (Mini App) — auto-login
- ✅ §10 (cron) — at least one trigger fired
- ✅ §11 (webhook security) — both
- ✅ §12 (storage) — file persisted across restart

**13/13 passing** = diploma-ready production deploy ✨

---

## Quick log inspection

To watch backend logs live while running these tests:

```bash
# Railway CLI (install via npm i -g @railway/cli)
railway login
railway link  # link to your project
railway logs --service backend
```

Filter for telegram-related logs:

```bash
railway logs --service backend | grep -i "telegram\|bot\|webhook"
```
