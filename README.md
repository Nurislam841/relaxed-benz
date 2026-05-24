# UniLMS — Academic Management Platform

Full-stack Learning Management System built with **Next.js 14**, **NestJS**, **Prisma**, **PostgreSQL**, and **Tailwind CSS**.

## Features

- **Authentication** — JWT (access + refresh tokens via cookies), RBAC (Admin / Teacher / Student)
- **Courses** — create, enroll, browse with pagination and per-student progress bar
- **Assignments** — create, submit (with file upload), grade; due-date tracking
- **Grades** — per-student grade book, teacher grading UI
- **Course Materials** — teachers/admins add links, files, or text content per course
- **Attendance** — teachers mark Present / Late / Absent; students view their own record
- **Schedule** — color-coded timetable with day and course filters
- **Notifications** — in-app bell + full notifications page; mark read / mark all read
- **Global Search** — search courses, materials, and assignments from the sidebar
- **Dashboard** — upcoming assignments widget for students
- **Admin Panel** — platform-wide stats (users, courses, enrollments, submissions, grades)
- **Activity Log** — automatic logging of create/submit/grade events
- **Email Notifications** — nodemailer (graceful no-op when SMTP not configured)
- **Security** — Helmet headers, rate limiting (100 req/min global, 5/min on `/auth/login`, 3/min on `/auth/register`)
- **Swagger** — full API docs at `/api/docs`
- **Tests** — 56 Jest + Supertest e2e specs across 12 files: auth, courses, assignments, quiz (classic + adaptive), kahoot, plagiarism, achievements, two-factor (incl. TOTP login flow), telegram (with no-bot fallback), calendar-export (incl. RFC 5545 builder unit tests), health
- **AI Module** — Claude-powered features: assignment feedback, quiz generator, course summary, study coach, class insights, streaming chat assistant
- **Quizzes & Kahoot Live** — persistent quiz library (create / publish / attempt / autoscore) + real-time WebSocket-driven Kahoot-style sessions with 6-char join codes, host controls, live leaderboard, per-question timer, and speed-bonus scoring
- **Adaptive Quiz mode** — AI tags every generated question with EASY/MEDIUM/HARD; in adaptive practice the server picks the next question based on the student's correct/wrong streak (2-in-a-row up, 2-in-a-row down), with a cap of 15 questions per session
- **AI Plagiarism Detection** — Jaccard 3-gram similarity on submission text, badges on suspect submissions in the teacher view
- **Health endpoints** — `/api/health`, `/api/health/ready` (DB ping), `/api/health/version` for k8s/docker readiness/liveness probes
- **iCalendar export** — students/teachers can subscribe to `/api/me/schedule.ics` in Google Calendar, Apple Calendar, or Outlook (lectures + assignment deadlines combined, RFC 5545 compliant)
- **Achievements / gamification** — 12 badges across 4 tiers (Bronze → Platinum) automatically granted on submit / grade / quiz / attendance events; dashboard widget + dedicated `/achievements` page
- **Two-factor authentication (TOTP)** — opt-in 2FA per user via Google Authenticator / Authy / 1Password compatible RFC 6238 codes; QR-code enrolment in profile, 6-digit second step at login
- **Telegram notifications** — opt-in: users paste their chat_id from `@userinfobot`, every in-app notification (assignment / grade / announcement) is also delivered to Telegram via Bot API. Graceful no-op when `TELEGRAM_BOT_TOKEN` is unset; batches multi-update fan-outs to avoid spam
- **Markdown editor + viewer** — `react-markdown` + GFM (tables, task lists, autolinks) on assignment descriptions, student text answers, and announcements; toolbar with bold/italic/link/list shortcuts and live preview tab
- **Postgres tsvector full-text search** — generated tsvector columns on courses / materials / assignments / announcements / users, GIN-indexed and ranked via `ts_rank`; automatic fallback to ILIKE for very short queries and pre-migration test databases
- **PDF reports** — server-side PDF generation with `pdfkit`: course gradebook with per-assignment breakdown, attendance summary with present/late/absent totals, and personal academic transcript across all enrolled courses (A4, multi-page, paginated headers)
- **SEO & Open Graph** — site-wide metadata template, public auth pages indexable, robots.txt + sitemap.xml served by Next.js metadata route handlers
- **Polish details** — canvas-confetti celebration on perfect quiz scores and new achievement unlocks (respects `prefers-reduced-motion`), `next/dynamic` lazy loading for AI chat / Markdown editor / Code Review panel (cut /courses/[id]/overview First Load from 186 → 138 KB), and a print stylesheet that strips chrome and adds link URLs for Ctrl+P-friendly hardcopy
- **Keyboard shortcuts & UX chrome** — global shortcuts (`?` cheatsheet · `/` search · `g d/c/s/g/a/k/n/p` chord navigation à la GitHub/Linear), reusable Tooltip primitive with hover + focus + Esc support, and a unified EmptyState component applied across notifications, search, and dashboard widgets

---

## AI Setup (Claude / Anthropic)

The AI module integrates with the Anthropic API (`claude-opus-4-6`). All AI features work in **demo mode** (structured placeholder responses) when no API key is set — the backend never crashes.

### Getting an API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-api03-...`)

### Docker

Add to the root `.env` file (same directory as `docker-compose.yml`):

```env
LLM_API_KEY=sk-ant-api03-your-key-here
```

Then restart: `docker compose down && docker compose up`

### Local development

Add to `apps/backend/.env`:

```env
LLM_API_KEY=sk-ant-api03-your-key-here
```

### AI Features by Role

| Feature                | Student                 | Teacher           | Admin |
| ---------------------- | ----------------------- | ----------------- | ----- |
| Assignment AI Feedback | ✅ own submissions only | ✅ any submission | ✅    |
| AI Quiz Generator      | ❌                      | ✅                | ✅    |
| AI Course Summary      | ✅                      | ✅                | ✅    |
| Student Analysis       | ✅ own profile only     | ✅ any student    | ✅    |
| AI Chat Assistant      | ✅                      | ✅                | ✅    |

### Where to find AI features in the UI

- **Chat** — floating purple button in the bottom-right corner (all pages)
- **Assignment Feedback** — "AI Feedback" button next to each assignment (students, after submitting)
- **Quiz Generator** — "✨ AI Quiz" tab inside any course
- **Course Summary** — "AI Course Summary" button on the course Overview tab
- **Student Analysis** — available via API (`POST /api/ai/student-analysis`)

### Demo mode

When `LLM_API_KEY` is not set, all endpoints return a structured response with `_demo: true` flag. The frontend renders these responses normally with a "demo" badge. No errors are thrown.

---

## Quick start — Docker (recommended)

> **Requires:** Docker Desktop running.

```bash
docker compose up --build
```

Wait ~2 minutes for the first build. Then open:

| Service     | URL                            |
| ----------- | ------------------------------ |
| Frontend    | http://localhost:3000          |
| Backend API | http://localhost:4000/api      |
| Swagger     | http://localhost:4000/api/docs |

Docker will automatically:

1. Start PostgreSQL 15
2. Run `prisma migrate deploy` (applies all migrations)
3. Run `prisma db seed` (creates demo users, courses, assignments, etc.)
4. Start the NestJS backend on port 4000
5. Build and start the Next.js frontend on port 3000

---

## Local development (without Docker)

**Requires:** Node 20+, pnpm 8+, PostgreSQL 15 on `localhost:5432`.

### 1. Database

Create the database:

```sql
CREATE DATABASE unilms;
```

### 2. Environment

Copy the template and fill in real values:

```bash
cp .env.example apps/backend/.env
```

Generate strong JWT secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
```

Paste them into `apps/backend/.env`. Without correct JWT secrets the server will fall back to weak defaults (only safe for dev).

Create `apps/backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unilms?schema=public"
JWT_SECRET="change-me-super-secret-jwt-key-at-least-32-chars"
JWT_REFRESH_SECRET="change-me-super-secret-refresh-key-at-least-32"
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Optional — email notifications (skip to disable silently)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=you@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM="UniLMS <no-reply@uni.kz>"
```

### 3. Backend

```bash
cd apps/backend
pnpm install
npx prisma generate        # generate Prisma client
npx prisma migrate deploy  # apply DB migrations
npx prisma db seed         # seed demo data
pnpm dev                   # start on http://localhost:4000
```

### 4. Frontend

```bash
# In a second terminal
cd apps/frontend
pnpm install
pnpm dev                   # start on http://localhost:3000
```

---

## Demo credentials

| Role    | Email           | Password    |
| ------- | --------------- | ----------- |
| Admin   | admin@uni.kz    | Admin123!   |
| Teacher | teacher1@uni.kz | Teacher123! |
| Teacher | teacher2@uni.kz | Teacher123! |
| Student | student1@uni.kz | Student123! |
| Student | student2@uni.kz | Student123! |
| Student | student3@uni.kz | Student123! |
| Student | student4@uni.kz | Student123! |
| Student | student5@uni.kz | Student123! |

---

## Running tests

```bash
cd apps/backend
pnpm install
npx jest
```

Covers: auth (register/login), courses (list/create), assignments (list/search/admin stats).

---

## Environment variables reference

| Variable                 | Required | Default | Description                                       |
| ------------------------ | -------- | ------- | ------------------------------------------------- |
| `DATABASE_URL`           | ✅       | —       | PostgreSQL connection string                      |
| `JWT_SECRET`             | ✅       | —       | Access token signing secret                       |
| `JWT_REFRESH_SECRET`     | ✅       | —       | Refresh token signing secret                      |
| `JWT_EXPIRATION`         | ✅       | `15m`   | Access token TTL                                  |
| `JWT_REFRESH_EXPIRATION` | ✅       | `7d`    | Refresh token TTL                                 |
| `SMTP_HOST`              | ❌       | —       | SMTP server (emails skipped if unset)             |
| `SMTP_PORT`              | ❌       | `587`   | SMTP port                                         |
| `SMTP_USER`              | ❌       | —       | SMTP username                                     |
| `SMTP_PASS`              | ❌       | —       | SMTP password                                     |
| `SMTP_FROM`              | ❌       | —       | From address for emails                           |
| `LLM_API_KEY`            | ❌       | —       | Anthropic API key — AI runs in demo mode if unset |

---

## Project structure

```
uni-lms/
├── docker-compose.yml
├── README.md
├── pnpm-workspace.yaml
├── apps/
│   ├── backend/                        # NestJS API (port 4000)
│   │   ├── Dockerfile
│   │   ├── docker-entrypoint.sh
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # 12 models
│   │   │   ├── seed.ts                 # demo data
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── ai/                     # Claude AI — feedback, quiz, summary, analysis, chat
│   │       ├── activity-log/           # event logging
│   │       ├── admin/                  # stats + course progress
│   │       ├── announcements/
│   │       ├── assignments/            # CRUD, file upload, grading
│   │       ├── attendance/             # mark/view attendance
│   │       ├── auth/                   # JWT, refresh tokens
│   │       ├── courses/                # CRUD, enrollment, pagination
│   │       ├── enrollments/
│   │       ├── grades/
│   │       ├── groups/
│   │       ├── mail/                   # nodemailer (optional SMTP)
│   │       ├── materials/              # course materials CRUD
│   │       ├── notifications/          # in-app notifications
│   │       ├── prisma/                 # PrismaService
│   │       ├── schedule/
│   │       ├── search/                 # global full-text search
│   │       └── users/
│   └── frontend/                       # Next.js 14 App Router (port 3000)
│       ├── Dockerfile
│       ├── next.config.js              # /api/* proxy to backend
│       └── src/
│           ├── app/(app)/
│           │   ├── admin/              # platform stats
│           │   ├── calendar/
│           │   ├── courses/
│           │   │   └── [id]/
│           │   │       ├── assignments/
│           │   │       ├── attendance/
│           │   │       ├── grades/
│           │   │       ├── materials/
│           │   │       └── participants/
│           │   ├── dashboard/
│           │   ├── notifications/
│           │   ├── profile/
│           │   ├── schedule/
│           │   └── search/
│           ├── components/
│           │   ├── layout/             # sidebar, header
│           │   └── ui/                 # button, card, badge, input…
│           └── lib/
│               ├── api.ts              # fetch wrapper
│               ├── types.ts            # shared TypeScript types
│               └── utils.ts
```

---

## Tech stack

| Layer       | Technology                                                          |
| ----------- | ------------------------------------------------------------------- |
| Frontend    | Next.js 14, React 18, Tailwind CSS, TanStack Query, Lucide icons    |
| Backend     | NestJS 10, Passport JWT, class-validator                            |
| ORM         | Prisma 5 + PostgreSQL 15                                            |
| Auth        | JWT access + refresh tokens (httpOnly cookies)                      |
| Security    | Helmet, @nestjs/throttler (100 req/min)                             |
| Email       | Nodemailer (optional)                                               |
| File upload | Multer (local disk → `/uploads`)                                    |
| AI          | Anthropic Claude (`claude-opus-4-6`), SSE streaming, Zod validation |
| Testing     | Jest + Supertest                                                    |
| Packaging   | pnpm workspaces (monorepo)                                          |
