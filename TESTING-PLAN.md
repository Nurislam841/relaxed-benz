# UniLMS — План критичного тестирования

**Правила:**

- На каждую фичу: Claude пишет/обновляет Jest spec (autotest), пользователь делает manual UI smoke
- Закрываем фазу когда: spec passes + manual smoke passes на проде
- Любой найденный баг → reproduce в spec → fix → verify

**Окружение:**

- Frontend: https://aitu-unilms.vercel.app
- Backend: https://aitu-unilms-backend.onrender.com
- Bot: @uni_lms_bot
- Demo accounts: `admin@uni.kz / Admin123!`, `teacher1@uni.kz / Teacher123!`, `student1@uni.kz / Student123!`

---

## Фаза 1 — AI-фичи (самые "видимые", сейчас не покрыты Jest)

**Endpoints без специальной spec'и:**

- `POST /api/ai/generate-quiz`
- `POST /api/ai/assignment-feedback`
- `POST /api/ai/course-summary`
- `POST /api/ai/student-analysis`
- `POST /api/ai/study-coach`
- `POST /api/ai/class-insights`
- `POST /api/ai/code-review`
- `POST /api/ai/chat` (SSE стрим)

### Claude (auto)

Создать `apps/backend/src/ai/ai.spec.ts`:

- Auth required на все endpoints (401 без токена)
- `generate-quiz` returns `{ questions: [{ question, options, correctIndex, explanation }, ...] }`
- `course-summary` returns `{ summary, keyTopics[], tips[], workload }`
- `study-coach` returns `{ trajectory, weaknesses, studyPlan, mistakePatterns }`
- `class-insights` — teacher-only (403 для student)
- `code-review` returns `{ summary, language, issues[], positiveAspects[] }`
- `assignment-feedback` — student can only request feedback for own submission
- `chat` SSE — connection opens + closes cleanly

### User (manual smoke)

1. Login `teacher1@uni.kz` → курс CS-DB-201 → tab **Quiz**
2. Topic: "SQL JOINs", count 5, difficulty medium → **Generate**
   - ✅ через ~10 сек appear 5 questions с options и correctIndex
3. **Save as draft**
   - ✅ редирект в library, появляется DRAFT badge
4. **/ai-analysis** (sidebar) → как teacher → must see class-insights
   - ✅ at-risk students / high performers
5. Switch to `student1@uni.kz` → `/ai-analysis` → AI Study Coach
   - ✅ предсказанный grade + study plan

---

## Фаза 2 — Quiz library + attempts

### Claude (auto)

Расширить `quiz.spec.ts`:

- `POST /quizzes/:id/questions` — add question to existing quiz (теперь есть в коде, нет в спеке)
- `PATCH /quiz-questions/:id` — edit question
- `DELETE /quiz-questions/:id` — soft-delete + reindex
- `POST /quizzes/:id/broadcast-telegram` — teacher only, returns count of polls sent
- Edge: student cannot edit teacher's quiz (403)

### User (manual smoke)

1. Teacher → /courses/:id/quiz → Library → **Edit** на quiz
2. Добавь question, измени correctIndex, удали другой → **Save changes**
3. Switch student1 → курс → Quiz tab → **Start** quiz → ответь на все → **See results**
4. Score reflected в /grades

---

## Фаза 3 — Kahoot live e2e

### Claude (auto)

Расширить `kahoot.spec.ts`:

- `GET /kahoot/sessions/:id/report` — host-or-admin only
- Returns `{ session, summary, perPlayer[], perQuestion[] }` aggregates
- 403 для student'а который не host

### User (manual smoke)

1. Teacher → Quiz library → **Host live** на published quiz
2. Появится 6-буквенный join code (например `ABCXYZ`)
3. Открой **second browser/incognito** → login `student1@uni.kz` → `/kahoot/play` → ввести код → Join
4. На host → **Start game**
5. Студент видит вопрос → отвечает (быстрые ответы = больше points)
6. Host → **Next question** → ... → **Finish**
7. **View detailed report**
   - ✅ Players table (rank/score/accuracy)
   - ✅ Per-question breakdown (распределение ответов, % correct)
   - ✅ **Export CSV** работает

---

## Фаза 4 — Storage (R2 / disk)

### Claude (auto)

Создать `apps/backend/src/storage/storage.spec.ts`:

- DiskStorageService write/read/delete round-trip (with tmp dir)
- S3StorageService instantiates correctly (mock S3Client)
- Upload returns `{ key, url }` где url builds from S3_PUBLIC_URL

### User (manual smoke)

1. Login `student1@uni.kz` → assignment → **Submit** with photo upload
2. На submission page видна attached file
3. Click file URL → файл откроется (либо из R2 public URL либо signed URL)
4. Switch teacher → see same submission в `/assignments/:id/submissions`

---

## Фаза 5 — Telegram bot handlers (новый код, lite coverage)

### Claude (auto)

Расширить `telegram.spec.ts` для handler-level unit tests:

- Mock `bot.api.sendMessage` через jest spy
- Simulate `/today` update → assert calls `scheduleService.getMySchedule` + `ctx.reply` with formatted output
- Simulate `/grades` → assert calls `gradesService.getMyGrades`
- Simulate `/ask SQL` → assert streams response via `bot.api.editMessageText`
- Simulate `/link 123456` → asserts setChatCommands called with 'linked' mode
- Simulate `/unlink` → asserts clearChatCommands called

### User (manual smoke)

Telegram бот flow — **уже сделано ранее**. Re-check:

1. `/start` → 3 lang buttons → pick Russian
2. /link CODE из Vercel → linked
3. `/today` → расписание на сегодня
4. `/grades` → последние оценки
5. `/ask Что такое JOIN в SQL?` → AI streams ответ
6. `/coach` → study coach (trajectory + plan)
7. `/unlink` → back to state 0

---

## Фаза 6 — Notifications + Group chat

### Claude (auto)

Создать `apps/backend/src/notifications/notifications.spec.ts`:

- `notifications.create()` writes DB row + emits refresh event
- Telegram fanout called when user has telegramChatId
- Inline buttons constructed correctly for each NotificationType
- Group fanout for ANNOUNCEMENT when CourseTelegramGroup exists

### User (manual smoke)

1. Teacher → `/courses/:id/overview` → **Create announcement** → publish
2. Student'у (с залинкованным TG) → должно прийти Telegram сообщение + появиться в `/notifications`
3. Teacher graded student's submission → student получает notification

**Group chat:**

1. Добавь @uni_lms_bot в group chat
2. От teacher'а напиши `/bind CS-DB-201`
3. Publish announcement в этом курсе → должно прийти в group

---

## Фаза 7 — Cron reminders (если время есть)

### Claude (auto)

Создать `apps/backend/src/telegram/reminders.spec.ts`:

- ScheduleReminderService picks items where `startsAt ∈ (now+55min, now+65min)` AND `reminderSentAt = null`
- AssignmentDeadlineService picks assignments due in 24h±1h or 1h±30min
- Both mark sent to avoid duplicate sends

### User (manual smoke)

Сложно протестировать вручную потому что cron — установи `ScheduleItem.startsAt = now+60min` локально, дёрни `/api/health` чтобы прокачать, через 5 мин должен пинг.

---

## Фаза 8 — Финальная: rotate secrets

**Критично перед сдачей диплома:**

- [ ] @BotFather → `/revoke` → новый Telegram bot token → Render env
- [ ] Cloudflare R2 → API Tokens → revoke + new → Render env
- [ ] Anthropic console → rotate LLM_API_KEY → Render env
- [ ] Render DB → Reset password → обновить DATABASE_URL
- [ ] Force-pull последний commit чтобы убедиться что в репо ничего не утекло

---

## Прогресс трекинг

- [ ] **Фаза 1**: AI features
- [ ] **Фаза 2**: Quiz library + attempts
- [ ] **Фаза 3**: Kahoot live e2e
- [ ] **Фаза 4**: Storage (R2/disk)
- [ ] **Фаза 5**: Telegram bot handler-level coverage
- [ ] **Фаза 6**: Notifications + group chat
- [ ] **Фаза 7**: Cron reminders (опционально)
- [ ] **Фаза 8**: Rotate secrets
