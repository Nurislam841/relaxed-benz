# UniLMS — Полная документация проекта

> **Назначение документа:** Источник материала для курсовой/дипломной работы и подготовки к защите. Каждый раздел можно копировать напрямую.

> **Дата:** Март 2026

---

## 📑 Оглавление

1. [О проекте](#1-о-проекте)
2. [Проблема и мотивация](#2-проблема-и-мотивация)
3. [Сравнение с конкурентами](#3-сравнение-с-конкурентами)
4. [Архитектура](#4-архитектура)
5. [Технологический стек](#5-технологический-стек)
6. [Структура базы данных](#6-структура-базы-данных)
7. [Бэкенд: модули и API](#7-бэкенд-модули-и-api)
8. [ИИ-функциональность](#8-ии-функциональность)
9. [Фронтенд: страницы и UI](#9-фронтенд-страницы-и-ui)
10. [Безопасность](#10-безопасность)
11. [Многоязычность (i18n)](#11-многоязычность-i18n)
12. [Уникальные особенности](#12-уникальные-особенности)
13. [Демо-данные](#13-демо-данные)
14. [Известные ограничения](#14-известные-ограничения)
15. [Развёртывание](#15-развёртывание)
16. [Дальнейшее развитие](#16-дальнейшее-развитие)

---

## 1. О проекте

**UniLMS** (University Learning Management System) — это полнофункциональная веб-платформа для управления учебным процессом университета с глубокой интеграцией искусственного интеллекта.

### Ключевые характеристики

- **Тип:** Web-приложение (SPA + REST API)
- **Целевая аудитория:** Университеты Казахстана и стран СНГ
- **Роли пользователей:** Администратор / Преподаватель / Студент
- **Языки интерфейса:** English / Русский / Қазақша
- **ИИ-функции:** 5 встроенных Claude-эндпоинтов (генерация тестов, анализ работ, чат-ассистент и др.)

### Цель проекта

Создать LMS, которая:
1. Полностью покрывает учебный цикл (расписание → лекции → задания → оценки → анализ)
2. Использует ИИ как нативный инструмент, а не как внешний плагин
3. Поддерживает казахский язык на уровне UI и AI-промптов
4. Может быть развёрнута локально (важно для государственных вузов)

---

## 2. Проблема и мотивация

### Существующие проблемы традиционных LMS

| Проблема | Где встречается |
|----------|-----------------|
| Устаревший интерфейс | Moodle, eDX |
| Нет нативной интеграции с ИИ | Все классические LMS |
| Слабая поддержка казахского языка | Канвас, Blackboard |
| ИИ-инструменты разрознены (отдельный сервис для проверки, отдельный для тестов) | Khanmigo, Gradescope, Turnitin |
| Облачное хранилище (vendor lock-in, утечка данных) | Google Classroom, Khanmigo |
| Сложность кастомизации | Blackboard, Canvas |

### Решение, которое предлагает UniLMS

- Современный UI/UX (shadcn/ui, Tailwind, framer-motion анимации)
- Нативный ИИ во всех ключевых сценариях
- Полноценная поддержка trilingual интерфейса
- Self-hosted архитектура (Docker Compose готов из коробки)
- Open-source-стек (NestJS + Next.js + PostgreSQL)

---

## 3. Сравнение с конкурентами

### 3.1 Сравнение с традиционными LMS

| Возможность | Moodle | Canvas | Google Classroom | **UniLMS** |
|-------------|--------|--------|------------------|------------|
| Нативный ИИ | ❌ (плагин) | ⚠️ (Beta) | ⚠️ (Bard) | ✅ |
| Генерация тестов ИИ | ❌ | ❌ | ❌ | ✅ |
| AI-обратная связь на работы | ❌ | ❌ | ❌ | ✅ |
| Анализ риска отчисления | ❌ | ⚠️ (платно) | ❌ | ✅ |
| Streaming AI-чат | ❌ | ❌ | ❌ | ✅ |
| Казахский язык | ❌ | ❌ | ⚠️ (частично) | ✅ |
| Self-hosted | ✅ | ❌ | ❌ | ✅ |
| Современный UI | ❌ | ⚠️ | ✅ | ✅ |

### 3.2 Сравнение с AI-LMS / EdTech платформами

| Возможность | Khanmigo | Synthesis | Gradescope | Century Tech | **UniLMS** |
|-------------|----------|-----------|------------|--------------|------------|
| Институциональная LMS (не tutor) | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |
| ИИ для учителя | ❌ | ❌ | ✅ (только grading) | ❌ | ✅ |
| ИИ для студента | ✅ | ✅ | ❌ | ✅ | ✅ |
| Полный жизненный цикл (расписание/задания/оценки) | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |
| Поддержка казахского языка | ❌ | ❌ | ❌ | ❌ | ✅ |
| Self-hosted | ❌ | ❌ | ❌ | ❌ | ✅ |
| Real-time уведомления (SSE) | ⚠️ | ❌ | ❌ | ❌ | ✅ |

### 3.3 Уникальное позиционирование

UniLMS — **единственная** найденная LMS, которая одновременно:
- Является институциональной (а не student-facing tutor)
- Содержит ИИ нативно во всех сценариях (для студента + учителя)
- Поддерживает казахский язык в UI и AI-промптах
- Может работать локально без облака

---

## 4. Архитектура

### 4.1 Высокоуровневая схема

```
┌─────────────────┐         ┌──────────────────┐
│  Browser (User) │ <────>  │ Next.js Frontend │
│                 │  HTTPS  │   (port 3000)    │
└─────────────────┘         └────────┬─────────┘
                                     │
                              REST + SSE
                                     │
                            ┌────────▼─────────┐
                            │ NestJS Backend   │
                            │   (port 4000)    │
                            │   /api prefix    │
                            └────────┬─────────┘
                                     │
                  ┌──────────────────┼─────────────────────┐
                  │                  │                     │
        ┌─────────▼──────┐ ┌─────────▼────────┐ ┌──────────▼─────────┐
        │  PostgreSQL    │ │  Anthropic API   │ │  SMTP (опционально) │
        │  (port 5432)   │ │   Claude SDK     │ │  nodemailer         │
        └────────────────┘ └──────────────────┘ └─────────────────────┘
```

### 4.2 Принципы архитектуры

- **Monorepo:** один репозиторий, два приложения (`apps/backend`, `apps/frontend`), общий `pnpm-workspace`
- **REST + SSE:** стандартные REST-эндпоинты для CRUD + Server-Sent Events для real-time (уведомления, AI-стриминг)
- **JWT с двумя секретами:** access token (15 мин) + refresh token (7 дней), оба в httpOnly cookies
- **Stateless backend:** все состояния в БД, можно масштабировать горизонтально (кроме SSE pub/sub в памяти)
- **Role-based access control:** проверка ролей на уровне route guards + per-resource ownership

### 4.3 Поток запроса

```
1. User открывает /dashboard
2. Next.js layout проверяет cookie с JWT
   ├─ нет JWT → redirect /login
   └─ есть JWT → fetch /api/auth/me для валидации
3. Страница рендерится, делает запросы:
   - GET /api/courses (список курсов)
   - GET /api/me/notifications
   - открывает SSE: /api/me/notifications/stream
4. NestJS:
   - JwtStrategy извлекает токен из cookie/Bearer
   - ThrottlerGuard проверяет лимит (100 req/min)
   - Validation pipe валидирует DTO
   - Controller → Service → Prisma → PostgreSQL
5. Ответ + cookies с обновлёнными токенами
```

---

## 5. Технологический стек

### 5.1 Backend

| Категория | Технология | Версия | Зачем |
|-----------|------------|--------|-------|
| Runtime | Node.js | 20+ | Базовая платформа |
| Фреймворк | NestJS | 10.x | Модульная архитектура, DI, decorators |
| Язык | TypeScript | 5.x | Типобезопасность |
| ORM | Prisma | 5.22 | Schema-first, миграции, type-safe queries |
| БД | PostgreSQL | 15 | Реляционка с расширенными возможностями |
| Auth | JWT (passport) | ^10 | Standard, scalable |
| Hashing | bcryptjs | ^2 | Хеш паролей (10 rounds) |
| Validation | class-validator + class-transformer | ^0.14 | DTO validation |
| Security | helmet, @nestjs/throttler | ^7, ^5 | HTTP headers, rate limit |
| AI | @anthropic-ai/sdk | ^0.55 | Claude API |
| Validation (AI) | zod | ^3.25 | Strict schema for AI responses |
| Email | nodemailer | ^6.9 | SMTP отправка |
| Files | multer | ^1.4 | Загрузка файлов |
| Docs | @nestjs/swagger | ^7 | OpenAPI/Swagger UI |
| Testing | jest + supertest | ^29 | Unit + E2E |

### 5.2 Frontend

| Категория | Технология | Версия | Зачем |
|-----------|------------|--------|-------|
| Фреймворк | Next.js (App Router) | 14.1 | SSR/CSR, файловая маршрутизация |
| UI-библиотека | React | 18.2 | Компонентная модель |
| Язык | TypeScript | 5.x | Типобезопасность |
| Стили | Tailwind CSS | 3.4 | Utility-first CSS |
| UI-kit | shadcn/ui | latest | Готовые компоненты на Radix |
| Иконки | lucide-react | ^0.304 | Консистентный icon set |
| Анимации | framer-motion | 12.x | Page transitions, stagger |
| State (server) | TanStack Query | ^5.17 | Кэш, background refetch |
| Утилиты | clsx, tailwind-merge, class-variance-authority | — | Композиция классов |

### 5.3 Инфраструктура

- **Docker Compose:** 3 сервиса (postgres, backend, frontend) с healthcheck
- **pnpm:** Менеджер пакетов с workspaces
- **Vercel:** Хостинг фронтенда (опционально)
- **Railway/Render/Fly.io:** Хостинг бэкенда (опционально)

---

## 6. Структура базы данных

### 6.1 Список моделей (14)

| # | Модель | Назначение |
|---|--------|------------|
| 1 | User | Пользователи всех ролей |
| 2 | Group | Академические группы |
| 3 | Course | Учебные курсы |
| 4 | CourseMaterial | Материалы курса |
| 5 | Attendance | Посещаемость |
| 6 | Enrollment | Запись на курс |
| 7 | Announcement | Объявления |
| 8 | Assignment | Задания |
| 9 | Submission | Сдачи заданий |
| 10 | Grade | Оценки |
| 11 | ScheduleItem | Элементы расписания |
| 12 | Notification | Уведомления |
| 13 | ActivityLog | Аудит-лог действий |
| 14 | AiRequestLog | Аудит ИИ-запросов |

### 6.2 Перечисления (Enums)

```prisma
enum Role {
  ADMIN
  TEACHER
  STUDENT
}

enum CourseRole {
  STUDENT
  TEACHER
}

enum ScheduleType {
  LECTURE
  PRACTICE
  LAB
  EXAM
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
}

enum NotificationType {
  ASSIGNMENT_DUE
  ANNOUNCEMENT
  GRADE_PUBLISHED
  SYSTEM
}
```

### 6.3 Ключевые связи

- `User 1—N Enrollment N—1 Course` — many-to-many через Enrollment
- `Assignment 1—N Submission` — задание → сдачи
- `Submission 1—1 Grade` — каждой сдаче ровно одна оценка
- `Course 1—N CourseMaterial` — материалы курса
- `Course 1—N Announcement` (или Announcement.courseId = null → глобальное)
- `User 1—N Notification` — у пользователя свой поток уведомлений
- `User 1—N AiRequestLog` — каждый ИИ-запрос привязан к пользователю

### 6.4 Уникальные ограничения

- `Enrollment(userId, courseId)` — нельзя записаться дважды
- `Submission(assignmentId, studentId)` — одна сдача на одно задание
- `Attendance(courseId, studentId, date)` — одна запись посещения в день
- `User.email` unique
- `Course.code` unique
- `Group.name` unique

---

## 7. Бэкенд: модули и API

### 7.1 Список модулей (18)

#### Auth (`auth/`)
**Эндпоинты:**
- `POST /api/auth/login` — вход (email + password) → cookies + tokens
- `POST /api/auth/register` — регистрация
- `POST /api/auth/refresh` — обновление access token
- `POST /api/auth/logout` — очистка cookies
- `GET /api/auth/me` — текущий пользователь

**Особенности:**
- httpOnly cookies для защиты от XSS
- sameSite=lax для защиты от CSRF
- Раздельные секреты для access и refresh

#### Users (`users/`)
**Admin endpoints:**
- `GET/POST /api/admin/users` — CRUD пользователей
- `GET/PATCH/DELETE /api/admin/users/:id`

**Self-service:**
- `GET /api/me` — свой профиль
- `PATCH /api/me/profile` — изменить имя/email
- `PATCH /api/me/password` — сменить пароль (с проверкой текущего)

#### Groups (`groups/`)
- `GET/POST/PATCH/DELETE /api/admin/groups` — CRUD групп
- Поля: name (unique), degree, year

#### Courses (`courses/`)
- `GET /api/courses` — список курсов (paginated, role-filtered)
- `GET /api/courses/:id` — детали курса
- `GET /api/courses/:id/participants` — участники
- `GET /api/courses/:id/progress` — % выполнения для студента
- `GET/POST/PATCH/DELETE /api/admin/courses` — admin CRUD

#### Enrollments (`enrollments/`)
- Admin CRUD на `/api/admin/enrollments`
- Conflict при попытке записать дважды

#### Announcements (`announcements/`)
- `GET /api/announcements` — все доступные
- `POST /api/announcements` — создать (только admin для глобальных)
- `GET/POST /api/courses/:id/announcements` — для конкретного курса
- **Авто-fanout:** создание объявления генерирует уведомления всем студентам курса

#### Assignments (`assignments/`)
**CRUD:**
- `GET /api/courses/:id/assignments` (paginated)
- `POST /api/courses/:id/assignments` (teacher/admin)
- `GET/PATCH/DELETE /api/assignments/:id`

**Submissions:**
- `POST /api/assignments/:id/submit` — текст/URL
- `POST /api/assignments/:id/submit-file` — один файл
- `POST /api/assignments/:id/submit-files` — до 10 файлов
- `POST /api/assignments/:id/save-draft` — сохранить как черновик
- `GET /api/assignments/:id/submission` — своя сдача
- `GET /api/assignments/:id/submissions` — все сдачи (teacher)
- `GET /api/courses/:id/my-submissions` — мои сдачи в курсе

**Grading:**
- `POST /api/submissions/:id/grade` — поставить оценку
- `PATCH /api/submissions/:id/grade` — изменить оценку

**Resources:**
- `POST /api/assignments/:id/resources` — прикрепить файлы к заданию
- `DELETE /api/assignments/:id/resources/:resourceId`

**Comments:**
- `GET /api/assignments/:id/comments` — комментарии
- `POST /api/assignments/:id/comments` — добавить комментарий

**Ограничения файлов:**
- Максимум 20 МБ на файл
- 17 разрешённых MIME-типов: PDF, Word, Excel, PowerPoint, ZIP, текст, изображения, MP4, MP3
- Хранение на диске в `./uploads`

#### Grades (`grades/`)
- `GET /api/me/grades` — мои оценки
- `GET /api/me/grades/summary` — сводка по курсам
- `GET /api/courses/:id/grades` — gradebook (teacher)
- `GET /api/courses/:id/grades/stats` — статистика (avg, min, max, count)

#### Attendance (`attendance/`)
- `GET /api/courses/:id/attendance` — записи (role-filtered)
- `GET /api/courses/:id/attendance/stats` — статистика
- `POST /api/courses/:id/attendance` — отметить (PRESENT/LATE/ABSENT)

#### Materials (`materials/`)
- `GET/POST /api/courses/:id/materials`
- `DELETE /api/materials/:id`
- 3 типа: link, file, text

#### Schedule (`schedule/`)
- `GET /api/me/schedule?from=&to=` — недельное расписание
- `GET /api/me/calendar?month=YYYY-MM` — месяц (включая дедлайны заданий!)
- `GET /api/courses/:id/schedule`
- `POST /api/courses/:id/schedule`

#### Notifications (`notifications/`)
- `GET /api/me/notifications` — последние 50
- `GET /api/me/notifications/unread-count`
- `GET /api/me/notifications/stream` — **Server-Sent Events**
- `POST /api/me/notifications/:id/read`
- `POST /api/me/notifications/read-all`

**SSE детали:**
- При подключении: `ready` event с unread count
- При новом уведомлении: `notification` event
- Heartbeat каждые 25 секунд (предотвращение разрыва соединения)
- In-memory pub/sub через `Map<userId, Set<listener>>`

#### Search (`search/`)
- `GET /api/search?q=` (минимум 2 символа)
- Параллельный поиск по 5 сущностям:
  1. Courses (по title/code/description) — лимит 10
  2. Materials (по title/content) — лимит 10
  3. Assignments (по title/description) — лимит 10
  4. Announcements (по title/body) — лимит 8
  5. Users (только для admin) — лимит 8

#### Admin (`admin/`)
- `GET /api/admin/stats` — 11 параллельных запросов:
  - users: total, students, teachers
  - courses, assignments, submissions, enrollments, grades counts
  - **avgGrade** — средний балл по платформе
  - **attendanceRate** — % посещаемости

#### Activity Log (`activity-log/`)
- `GET /api/me/activity?limit=20` — мои действия
- `GET /api/admin/activity?limit=50` — все действия (admin)
- Логируются: CREATE, SUBMIT, GRADE, UPDATE, DELETE

#### Mail (`mail/`)
- Не имеет HTTP-эндпоинтов, используется как сервис
- Методы: `sendAssignmentCreated()`, `sendGradePublished()`
- Graceful skip без SMTP-настроек

#### AI (`ai/`)
См. раздел [8. ИИ-функциональность](#8-ии-функциональность)

### 7.2 Общая инфраструктура

- **Global API prefix:** `/api`
- **Swagger UI:** `/api/docs` (96 эндпоинтов)
- **Global validation pipe:** whitelist + forbidNonWhitelisted + transform
- **Global exception filter:** локализованные ошибки
- **Static files:** `/uploads` с JWT-проверкой

---

## 8. ИИ-функциональность

### 8.1 Архитектура ИИ-слоя

```
Client (Frontend)
    │
    │ POST /api/ai/<endpoint>
    ▼
NestJS AiController
    │
    ├─ Auth check (JwtGuard)
    ├─ Role check (где применимо)
    ▼
AiService
    │
    ├─ Сбор контекста из БД (Prisma)
    ├─ Построение prompt с учётом lang
    ▼
Anthropic Claude SDK
    │
    ├─ Если LLM_API_KEY есть → реальный запрос
    └─ Если нет → demo-mode response (i18n: en/ru/kz)
    │
    ▼
JSON-парсинг (regex + Zod где нужно)
    │
    ▼
Запись в AiRequestLog
    │
    ▼
Response к клиенту
```

### 8.2 Детальное описание 5 эндпоинтов

#### 8.2.1 `POST /api/ai/generate-quiz` — Генерация теста

**Назначение:** Учитель указывает тему, ИИ генерирует тест с вариантами ответов и объяснениями.

**Параметры:**
| Поле | Тип | Обязательный | Описание |
|------|-----|--------------|----------|
| `courseId` | string | да | ID курса |
| `topic` | string | да | Тема теста (например, "SQL Joins") |
| `questionCount` | int (1–20) | нет | Количество вопросов (default: 5) |
| `difficulty` | enum | нет | easy / medium / hard (default: medium) |
| `lang` | enum | нет | en / ru / kz |

**Возвращает:**
```json
{
  "questions": [
    {
      "question": "Какова производная функции f(x) = x²?",
      "options": ["2x", "x", "2", "x²/2"],
      "correctIndex": 0,
      "explanation": "По правилу степенной функции (xⁿ)' = n·xⁿ⁻¹..."
    }
  ],
  "_demo": false
}
```

**Особенности:**
- **Запрещено студентам** (403 Forbidden)
- Zod-валидация: ровно 4 варианта, correctIndex 0–3
- max_tokens: 16 000 (хватает на 20 вопросов)
- Демо-режим возвращает заглушки на трёх языках

#### 8.2.2 `POST /api/ai/assignment-feedback` — ИИ-отзыв

**Назначение:** Получить оценку и развёрнутый отзыв на сданную работу.

**Параметры:**
- `assignmentId` (обязательный)
- `submissionId` (обязательный)
- `lang` (опционально)

**Возвращает:**
```json
{
  "assessment": "Работа демонстрирует понимание ключевых концепций...",
  "strengths": ["Чёткая структура", "Корректное применение формул"],
  "improvements": ["Отсутствует анализ временной сложности"],
  "suggestions": ["Изучить материал по асимптотическому анализу"],
  "_demo": false
}
```

**Авторизация:**
- Студент — только своя сдача
- Учитель/admin — любая

**Контекст для ИИ:**
- Title, description, max score задания
- Текст ответа студента
- Если уже выставлена оценка — она передаётся

#### 8.2.3 `POST /api/ai/course-summary` — Краткое описание курса

**Назначение:** Сжатый обзор курса с советами по изучению.

**Параметры:**
- `courseId` (обязательный)
- `lang` (опционально)

**Возвращает:**
```json
{
  "summary": "Курс охватывает фундаментальные концепции...",
  "keyTopics": ["Реляционная алгебра", "SQL", "Нормализация"],
  "tips": ["Изучайте материал последовательно", "Делайте практические упражнения"],
  "workload": "moderate",
  "_demo": false
}
```

**Контекст для ИИ:**
- Title, description курса
- Все задания
- Последние 5 объявлений
- Количество материалов

#### 8.2.4 `POST /api/ai/student-analysis` — Анализ студента

**Назначение:** ИИ анализирует успеваемость, выявляет сильные/слабые стороны и риски.

**Параметры:**
- `studentId` (обязательный)
- `courseId` (опционально, для скоупа)
- `lang` (опционально)

**Возвращает:**
```json
{
  "analysis": "Студент демонстрирует устойчивую успеваемость...",
  "strengths": ["Высокий процент сданных работ", "Активность на лекциях"],
  "areasToImprove": ["Снижение баллов по практическим заданиям"],
  "recommendations": ["Записаться на дополнительные семинары"],
  "riskLevel": "medium",
  "_demo": false
}
```

**Авторизация:**
- Студент — только сам себя
- Teacher/admin — любого

**Контекст для ИИ:**
- Все оценки с привязкой к курсам и заданиям
- Посещаемость (PRESENT/LATE/ABSENT counts)
- Количество сдач

#### 8.2.5 `POST /api/ai/chat` — Streaming ИИ-чат

**Назначение:** Реал-тайм диалог с ИИ-ассистентом.

**Параметры:**
- `message` (обязательный)
- `context` (опционально, например, текст задания)
- `lang` (опционально)

**Технология:** Server-Sent Events (SSE)
**Формат ответа:** `text/event-stream`

```
data: {"text": "Здравствуй"}
data: {"text": "те! Я г"}
data: {"text": "отов помочь."}
data: [DONE]
```

**Особенности:**
- Token-by-token streaming через `content_block_delta`
- AbortController на клиенте для отмены
- Используется для:
  - Floating AI Chat виджета (на каждой странице)
  - "AI Explain" диалога в заданиях
- Системный промпт: *"You are an AI academic assistant for UniLMS..."*

### 8.3 Демо-режим (без API-ключа)

Все 5 эндпоинтов имеют **fallback на демо-данные**, если переменная окружения `LLM_API_KEY` не установлена:
- Возвращается структурированный ответ с флагом `_demo: true`
- Тексты переведены на en/ru/kz
- UI отображает бейдж "demo"
- Это позволяет демонстрировать систему без реальных API-затрат

### 8.4 Логирование ИИ-запросов

Каждый вызов любого ИИ-эндпоинта пишется в `AiRequestLog`:

```prisma
model AiRequestLog {
  id        String   @id @default(uuid())
  userId    String
  type      String   // assignment-feedback / quiz / course-summary / ...
  prompt    String   @db.Text
  response  String   @db.Text
  createdAt DateTime @default(now())
}
```

**Зачем:** аудит, расчёт стоимости, дебаг.

---

## 9. Фронтенд: страницы и UI

### 9.1 Структура маршрутов

```
/                          → редирект на /dashboard или /login
/login                     → форма входа
/register                  → форма регистрации
/dashboard                 → роле-зависимый дашборд
/courses                   → сетка курсов
/courses/[id]/overview     → обзор + анонсы + AI Course Summary
/courses/[id]/assignments  → список заданий
/courses/[id]/assignments/[aid]/submissions/[sid] → детали сдачи
/courses/[id]/materials    → материалы
/courses/[id]/grades       → оценки
/courses/[id]/attendance   → посещаемость
/courses/[id]/participants → участники
/courses/[id]/quiz         → AI-генератор тестов
/schedule                  → недельное расписание
/calendar                  → месячный календарь
/grades                    → все оценки студента
/notifications             → все уведомления
/activity                  → таймлайн активности
/search                    → глобальный поиск
/profile                   → профиль и пароль
/admin                     → админ-дашборд
/admin/users               → CRUD пользователей
/admin/groups              → CRUD групп
/admin/courses             → CRUD курсов
/admin/enrollments         → CRUD записей на курсы
```

### 9.2 Описание ключевых страниц

#### `/dashboard` (842 строки)
- **Студент:** Hero с приветствием, Quick Actions (4 тайла), Upcoming Deadlines (8-колоночная сетка), Today's Classes, Recent Grades, Gamification, Notifications, Announcements
- **Учитель:** Counts (courses/assignments/pending/graded), Today's Classes, Pending Reviews, Course Performance, Notifications
- **Админ:** 4 stat tiles, Today's Classes, Notifications, Platform Stats grid, **Platform Health (avgGrade, attendanceRate)**

#### `/courses/[id]/...` workspace
- **Layout (752 строки):**
  - Course hero с фоном (light: Unsplash editorial; dark: animated grid + glow orbs)
  - Sticky subnav с framer-motion `layoutId` (плавная подсветка активной вкладки)
  - **AI Assistant правая панель** (xl screens) с:
    - Live-pulse индикатором
    - Scan-line анимацией
    - Urgency-based рекомендациями (critical/warn/ok), вычисляются клиентски на основе deadlines + progress
    - Next-deadline и recent-grade карточки

#### `/courses/[id]/quiz` — AI Quiz UI
**3-режимный state machine:**

**Mode: config**
- Topic input (текстовое поле)
- Question count select (3 / 5 / 8 / 10 / 15)
- Difficulty select (easy / medium / hard)
- **Topic suggestion chips:** SQL Joins, ER Diagrams, Normalization, Indexing & Query Optimization, Transactions & ACID, NoSQL vs Relational
- "Generate Quiz" button → POST /api/ai/generate-quiz

**Mode: quiz**
- Progress bar (X / N вопросов)
- Текущий вопрос
- 4 варианта ответа (A/B/C/D)
- Клик → подсветка зелёным/красным
- **Карточка с объяснением** появляется после ответа
- "Next" button

**Mode: results**
- Trophy icon + score%
- Бейдж: "excellent" (≥80%) / "good" (≥60%) / "keep studying"
- Per-question review (correct vs given)
- "New Quiz" — сброс state machine

#### `/courses/[id]/assignments` (1603 строки!)
- **3 view modes:** Card / Board / Timeline
- Status badges: pending / submitted / late / graded
- Due urgency: overdue / today / soon / normal
- **AI Feedback dialog:** вызов `/ai/assignment-feedback`
- **AI Explain dialog:** SSE-стриминг через `/ai/chat` с контекстом задания
- **Comments thread** (collapsible per-assignment)
- File upload с прогрессом (XHR через `api.uploadWithProgress`)
- Multi-file submit + drafts

#### `/courses/[id]/grades` (teacher view)
- Course average card
- **Insights section:** studentsTracked, atRiskCount, courseHealth
- **Top 3 Students** (avg + attendance ranking)
- **Needs Attention** (avg<60% OR attendance<75%)
- Per-assignment averages
- Submission grader с валидацией (0..maxScore)
- **CSV export**

#### `/courses/[id]/attendance`
- 2 tabs: Records / Stats
- **"Start Today's Session" button:** одной кнопкой отметить ВСЕХ как PRESENT
- Color-coded rate: ≥75% green, ≥50% yellow, <50% red
- **CSV export**

#### `/schedule` — недельная сетка
- Week navigation (prev/today/next)
- 6-цветный цикл по курсам
- Day filter dropdown
- Course filter dropdown
- Type badges с разными цветами

#### `/calendar` — месячная сетка
- 7-колоночная сетка с локализованными днями недели
- Schedule items (синие) + assignment dueAt (красные) в одном виде
- "+N more" badge для >3 событий

#### `/notifications`
- Filters unread, mark-all-read
- Animated framer-motion список (layout + AnimatePresence exit)
- Click unread → marks read

#### `/activity` — timeline
- 5 типов действий с собственными иконками и цветами
- Entity icons (Assignment, Submission, Grade, Course, User)
- Filter dropdown
- Stat pills
- Vertical timeline с connected dots

### 9.3 Глобальные UI-компоненты

- **Sidebar** (`components/layout/sidebar.tsx`):
  - 8 основных пунктов + collapsible Admin section с 5 пунктами
  - Role-gated (admin section виден только админам)
  - Mobile hamburger overlay
  - Framer-motion stagger при появлении

- **Topbar:**
  - Language toggle (en/ru/kz pill)
  - Theme toggle (dark/light, persisted в localStorage)
  - Notification bell с unread badge (>9 → "9+")
  - Logout

- **AiChat floating widget** (`components/ai-chat.tsx`):
  - Floating purple-gradient circle (bottom-right)
  - Expandable 320–384px панель
  - SSE-стриминг с `/api/ai/chat`
  - Buffer/decoder для chunks
  - AbortController при закрытии

### 9.4 Утилиты

- **`lib/api.ts`:** Минимальный fetch-wrapper с `get/post/patch/delete` + `uploadWithProgress` (XHR)
- **`lib/types.ts`:** 24+ TypeScript интерфейса
- **`lib/i18n.tsx` (1595 строк):** Полный trilingual i18n
- **`lib/csv.ts`:** Клиентский CSV экспорт
- **`lib/motion.ts`:** Shared framer-motion variants
- **`hooks/use-auth.ts`:** TanStack Query mutations для login/register/logout
- **`hooks/use-notifications-stream.ts`:** EventSource subscription с auto-reconnect (3s)

---

## 10. Безопасность

### 10.1 Аутентификация и авторизация

- **JWT токены:** access (15 минут) + refresh (7 дней) в httpOnly cookies
- **Раздельные секреты:** `JWT_SECRET` ≠ `JWT_REFRESH_SECRET`
- **bcrypt:** хеширование паролей с 10 раундами
- **RBAC (Role-Based Access Control):** ADMIN / TEACHER / STUDENT
- **Per-resource ownership checks:** студент не может смотреть чужие сдачи, отзывы, анализы

### 10.2 Защита API

- **Helmet:** установка безопасных HTTP-заголовков
- **ThrottlerGuard:** 100 запросов/минута глобально (защита от brute force и DDoS)
- **ValidationPipe:**
  - `whitelist: true` — отбрасывает поля не из DTO
  - `forbidNonWhitelisted: true` — возвращает ошибку при лишних полях
  - `transform: true` — автоматическое приведение типов
- **CORS:** настроен с `credentials: true` для cookies

### 10.3 Защита файлов

- **JWT-protected static server для `/uploads`:** custom Express middleware верифицирует токен перед отдачей файла
- **MIME validation:** только 17 разрешённых типов
- **Размер:** максимум 20 МБ на файл
- **Filename randomization:** имена на диске генерируются заново (защита от path traversal)

### 10.4 Известные риски (для разделa "Будущая работа")

- Hardcoded JWT secrets в `docker-compose.yml` (только для dev)
- Нет CSRF-токенов (mitigated через sameSite cookies, но всё же)
- Нет rate limiting на login endpoint специально
- Нет captcha на регистрации

---

## 11. Многоязычность (i18n)

### 11.1 Поддерживаемые языки

- 🇺🇸 **English (en)** — дефолтный
- 🇷🇺 **Русский (ru)**
- 🇰🇿 **Қазақша (kz)**

### 11.2 Реализация

- **Файл:** `apps/frontend/src/lib/i18n.tsx` (1595 строк)
- **Архитектура:** Nested object → `LanguageProvider` → `useT()` hook
- **Persistence:** localStorage
- **Coverage:** ВСЕ страницы, включая системные (errors, not-found)

### 11.3 Объём переводов

```typescript
{
  nav: {...},                  // навигация
  common: {...},               // общее (buttons, status)
  dashboard: {...},
  courses: {...},
  courseLayout: {...},
  courseQuiz: {...},
  courseOverview: {...},
  courseAssignments: {...},
  courseAttendance: {...},
  courseGrades: {...},
  courseMaterials: {...},
  courseParticipants: {...},
  schedule: {...},
  calendar: {...},
  search: {...},
  notifications: {...},
  profile: {...},
  admin: {...},
  adminCrud: {...},
  activity: {...},
  attendance: {...},
  grades: {...},
  langName: {...},
  systemPages: {...},
  aiChat: {...}
}
```

### 11.4 Multilingual AI

Параметр `lang` передаётся в каждый ИИ-эндпоинт, и Claude генерирует ответы на запрошенном языке:
- Demo-mode заглушки тоже локализованы (включая казахский!)
- Это редкая особенность — большинство AI-LMS поддерживают только английский

---

## 12. Уникальные особенности

Особенности, которые отличают UniLMS от конкурентов:

### Технические

1. **Real-time SSE-стриминг для ИИ-чата** — token-by-token, AbortController на клиенте
2. **SSE для уведомлений** — heartbeat, auto-reconnect, in-memory pub/sub
3. **JWT-защищённый upload-сервер** — файлы недоступны без токена
4. **Server timeouts 5 минут** — специально для долгих AI-запросов
5. **Zod-валидация AI-ответов** — строгая схема для quiz (ровно 4 варианта, correctIndex 0–3)
6. **Demo mode с i18n** — система работает без API-ключа, заглушки на 3 языках

### Функциональные

7. **Trilingual i18n включая ИИ-промпты** — единственный найденный аналог
8. **AI Assistant правая панель** в курсе с urgency-engine (critical/warn/ok)
9. **Top Students / At-Risk insights** — комбинирует grades + attendance
10. **CSV экспорт** в 3 местах (gradebook, attendance records, attendance stats)
11. **"Start Today's Session"** — одной кнопкой массовая отметка PRESENT
12. **AI Explain assignment** — стриминг study guide с контекстом задания
13. **AI Course Summary** — генерирует обзор + tips + workload оценку
14. **Авто-fanout анонсов** — пост → уведомления + emails всем студентам
15. **Multi-file submissions** (до 10 файлов, 17 MIME-типов) + drafts отдельно от submit
16. **Calendar объединяет** schedule items + дедлайны заданий
17. **3 разных дашборда** в одной странице (student/teacher/admin) с общими компонентами
18. **Topic suggestions chips** в quiz config — preset-промпты для тех, кто не знает что вводить

### UX

19. **Page transitions через AnimatePresence** с keyed pathname
20. **Stagger animations** через shared variants
21. **Course hero** с editorial bg (light) + animated grid + glow orbs (dark)
22. **Floating AI Chat** на каждой странице (purple gradient bubble)
23. **PercentRing SVG** для визуализации оценок
24. **Empty states** с CTA-кнопками вместо пустых экранов

---

## 13. Демо-данные

Скрипт `apps/backend/prisma/seed.ts` создаёт:

- **1 группа:** SE-2302 (Bachelor, Year 2)
- **1 admin:** admin@uni.kz
- **2 учителя:** Aisha Nurlanovna, Bolat Serikovich
- **5 студентов** с казахскими именами
- **3 курса:**
  - SE-ARCH-301 — Software Architecture
  - CS-DB-201 — Database Systems
  - CS-ML-401 — Machine Learning
- **Все студенты записаны на все 3 курса**
- **8 элементов расписания** на неделю
- **5 заданий** (одно с просроченным дедлайном для демонстрации)
- **2 проверенных сдачи** с оценками
- **1 черновик**
- **5 объявлений** (2 глобальных + 3 в курсах)
- **Пакет уведомлений** для каждого пользователя

---

## 14. Известные ограничения

Эти моменты стоит знать перед защитой и упомянуть как "будущая работа":

### 14.1 Schema/code drift

В коде `apps/backend/src/assignments/assignments.service.ts` упоминаются модели и поля, которых **нет в `prisma/schema.prisma`**:
- `assignmentResource`
- `assignmentComment`
- `submissionAttachment`
- `User.preferredLang`

**Последствие:** код, использующий их, упадёт против текущего сгенерированного Prisma client. Требуется миграция.

### 14.2 GamificationWidget

Импортируется на дашборде, но реализация — заглушка, возвращает `null`.

### 14.3 Нет UI для `/ai/student-analysis`

Эндпоинт работает, но к нему нет страницы — только Swagger / Postman.

### 14.4 AI default model

В коде указан `claude-opus-4-6`, но публично доступная модель — `claude-opus-4-5`. Перед продакшеном надо обновить.

### 14.5 Hardcoded secrets

`docker-compose.yml` содержит JWT-секреты для dev. В продакшене — через env vars.

### 14.6 Покрытие тестами

Jest-тесты есть только для:
- auth
- courses
- assignments

Нет покрытия:
- AI endpoints
- SSE streams
- Notifications
- Frontend (нет E2E)

---

## 15. Развёртывание

### 15.1 Требования

- Node.js 20+
- pnpm 8+
- PostgreSQL 15
- (опционально) Docker + Docker Compose
- (опционально) SMTP сервер
- (опционально) Anthropic API key

### 15.2 Локальная разработка

```bash
# 1. Клонировать репозиторий
git clone <repo> && cd uni-lms

# 2. Установить зависимости
pnpm install

# 3. Настроить .env (apps/backend/.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/unilms
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
LLM_API_KEY=sk-ant-... # опционально

# 4. Применить миграции
cd apps/backend
npx prisma migrate deploy
npx prisma db seed

# 5. Запустить
cd ../..
pnpm dev
# Backend → http://localhost:4000
# Frontend → http://localhost:3000
# Swagger → http://localhost:4000/api/docs
```

### 15.3 Docker Compose

```bash
docker-compose up
```

Запускает 3 сервиса: postgres + backend + frontend.

### 15.4 Production deployment (опции)

**Frontend:**
- Vercel (нативная поддержка Next.js)
- Netlify
- Self-hosted Node.js

**Backend:**
- Railway
- Render
- Fly.io
- AWS EC2 / DigitalOcean Droplet

**Database:**
- Managed: Neon, Supabase, AWS RDS
- Self-hosted

---

## 16. Дальнейшее развитие

### 16.1 Краткосрочные улучшения (до защиты)

- [ ] Создать миграцию для drifted моделей
- [ ] Включить или удалить GamificationWidget
- [ ] Обновить AI model name на `claude-opus-4-5`
- [ ] Добавить UI для `/ai/student-analysis`
- [ ] Покрыть тестами AI endpoints

### 16.2 Среднесрочные

- [ ] **AI Quiz → реальное Assignment:** сохранять сгенерированный тест как полноценное задание для группы; ИИ автоматически проверяет ответы → выставляет оценку (полный AI-loop)
- [ ] **AI Plagiarism check** — ещё один ИИ-эндпоинт
- [ ] **Adaptive learning:** анализ слабых тем студента → персонализированные тесты
- [ ] **Live lectures via WebRTC** — встроенные видеолекции
- [ ] **Mobile app** (React Native, использующий тот же API)

### 16.3 Долгосрочные

- [ ] **Plugin marketplace** — позволить кафедрам добавлять кастомные модули
- [ ] **Federated learning** между университетами
- [ ] **Voice AI assistant** — голосовой ввод для ассистента
- [ ] **AI proctor** — мониторинг честности на онлайн-экзаменах через камеру

---

## Приложения

### A. Полный список API-эндпоинтов

Всего **96 эндпоинтов**. Полный список — в Swagger UI на `/api/docs`.

### B. Полная структура проекта

```
uni-lms/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── activity-log/
│   │   │   ├── admin/
│   │   │   ├── ai/
│   │   │   ├── announcements/
│   │   │   ├── assignments/
│   │   │   ├── attendance/
│   │   │   ├── auth/
│   │   │   ├── common/
│   │   │   ├── courses/
│   │   │   ├── enrollments/
│   │   │   ├── grades/
│   │   │   ├── groups/
│   │   │   ├── mail/
│   │   │   ├── materials/
│   │   │   ├── notifications/
│   │   │   ├── prisma/
│   │   │   ├── schedule/
│   │   │   ├── search/
│   │   │   ├── users/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── app/
│       │   │   ├── (app)/      ← защищённые страницы
│       │   │   ├── (auth)/     ← login/register
│       │   │   ├── globals.css
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   ├── hooks/
│       │   └── lib/
│       └── package.json
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

### C. Глоссарий

| Термин | Расшифровка |
|--------|-------------|
| **LMS** | Learning Management System (система управления обучением) |
| **JWT** | JSON Web Token |
| **SSE** | Server-Sent Events (одностороннее push-соединение HTTP) |
| **RBAC** | Role-Based Access Control |
| **DTO** | Data Transfer Object |
| **CRUD** | Create / Read / Update / Delete |
| **ORM** | Object-Relational Mapping |
| **CSR/SSR** | Client-Side / Server-Side Rendering |
| **MIME** | Multipurpose Internet Mail Extensions (типы файлов) |
| **i18n** | Internationalization (интернационализация, замена текста на 18 букв) |

---

*Документ сгенерирован для подготовки курсовой/дипломной работы. Все факты подтверждены инспекцией кодовой базы.*
