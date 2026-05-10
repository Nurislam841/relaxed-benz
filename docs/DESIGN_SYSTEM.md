# UniLMS Design System

> Документация по миграции UniLMS на Geist + OKLCH violet design system.
> Готова для защиты диплома 16 мая 2026.

---

## 🎨 Что это

Новый визуальный язык **UniLMS** — продуктовая Geist-типографика, академическая
violet OKLCH-палитра и trilingual-готовая редакционная подача с italic accent
emphasis ("Learning *Operating* System"). Полностью построен на CSS-переменных,
поддерживает density-toggle и sохраняет совместимость с shadcn/ui.

---

## 📐 Дизайн-токены

### Цветовая палитра (OKLCH)

**Accent ramp** — academic violet, оптически-равномерная.

```css
--accent-50:  oklch(0.975 0.015 290);
--accent-500: oklch(0.64 0.19 290);   /* основной */
--accent-600: oklch(0.56 0.20 290);   /* primary button */
--accent-700: oklch(0.48 0.18 290);   /* hover state */
--accent-900: oklch(0.30 0.10 290);
```

**Semantic surfaces:**

```css
--bg, --bg-subtle, --bg-muted
--surface, --surface-2, --surface-raised
--border-color, --border-strong, --border-focus
--fg, --fg-muted, --fg-subtle, --fg-inverse, --fg-on-accent
--success, --warning, --danger, --info  /* OKLCH */
```

Все токены имеют **light** и **dark** варианты, переключается через
`document.documentElement.classList.toggle('dark')`.

### Типографика

| Шрифт                 | Применение                                |
|-----------------------|-------------------------------------------|
| **Geist Sans**        | UI — кнопки, текст, навигация             |
| **Geist Mono**        | Eyebrow lables, code, IDs, tabular nums   |
| **Instrument Serif**  | Display headings + italic em-accent       |

Шкала размеров: `--text-xs` (11px) → `--text-6xl` (64px).

### Spacing (4px base)

```
--space-1 = 2px    --space-5 = 16px   --space-9 = 40px
--space-2 = 4px    --space-6 = 20px   --space-10 = 48px
--space-3 = 8px    --space-7 = 24px   --space-12 = 64px
--space-4 = 12px   --space-8 = 32px   --space-16 = 96px
```

### Density (новый параметр)

`html[data-density="compact"|"normal"|"comfortable"]` влияет на `--density`
переменную, которая масштабирует все control-heights и row-heights. Переключается
в `/profile` → "Display" card.

### Motion

| Token       | Значение | Применение                  |
|-------------|----------|-----------------------------|
| `--dur-fast`  | 120ms  | Hover, focus, цвета         |
| `--dur-base`  | 200ms  | Modal, toast, accordion     |
| `--dur-slow`  | 320ms  | Page transitions, drawers   |

**Easings:** `--ease-out` (0.22, 1, 0.36, 1), `--ease-in-out`, `--ease-spring`.

Все анимации уважают `prefers-reduced-motion`.

---

## 🧱 Компонентная библиотека

### Primitives (`components/ui/`)

| Компонент            | Варианты                                              |
|----------------------|-------------------------------------------------------|
| **Button**           | primary / secondary / ghost / danger / **ai** / outline / link · sm/md/lg/icon |
| **Card**             | hoverable, padding presets, header/footer            |
| **Badge**            | tone × variant (6 tones × soft/solid)                |
| **Input/Textarea/Select** | DS-glow focus ring                              |
| **Dialog**           | header/body/footer, blur overlay                     |
| **PaginationControls** | mono labels                                        |
| **Toaster**          | tone-coloured stripe                                 |

### DS components (`components/ds/`)

11 новых компонентов:
- **Eyebrow** — uppercase mono label (для section headings)
- **HDisplay** — Instrument Serif italic с em-accent
- **Stat** — KPI значение с label/delta/sub
- **Spark** — sparkline SVG
- **Segment** — iOS pill-toggle
- **DataTable** — мono headers, hover row
- **Tabs** — underline / pill варианты
- **Alert** — 4 tones soft alert
- **DsAvatar** — deterministic HSL avatar
- **Kbd** — keyboard shortcut hint
- **DsProgress** — slim progress bar
- **DensityToggle** — Compact/Normal/Comfortable

### AI patterns (`components/ai/`)

8 компонентов специально для ИИ-сценариев:
- **AIBubble** — chat bubble с citations + actions
- **AIComposer** — textarea + suggestions + ⌘↵ hint
- **StreamingText / LiveCaret** — SSE-стрим визуализация
- **ThinkingDots** — pulsing indicator
- **GenerationPanel** — multi-step progress
- **SuggestionStrip** — chip prompts
- **AIFeedbackPanel** — grading suggestion с criteria
- **QuizQuestionPreview** — full quiz question card

---

## 🏗️ Архитектура файлов

```
apps/frontend/src/
├── app/
│   ├── globals.css              ← дизайн-токены (OKLCH, spacing, motion)
│   ├── layout.tsx               ← Geist + Instrument Serif
│   ├── (auth)/
│   │   ├── login/page.tsx       ← editorial 2-col hero
│   │   └── register/page.tsx
│   └── (app)/
│       ├── layout.tsx           ← 248px sidebar grid
│       ├── dashboard/
│       │   ├── page.tsx
│       │   └── _components/index.tsx  ← role-aware Hero/Stats/Tiles
│       ├── courses/
│       │   ├── page.tsx         ← grid с violet color cycle
│       │   └── [id]/
│       │       ├── overview/page.tsx       ← AI Course Summary
│       │       ├── quiz/page.tsx           ← полный AI Quiz UI
│       │       ├── assignments/page.tsx
│       │       ├── grades/page.tsx
│       │       ├── attendance/page.tsx
│       │       ├── materials/page.tsx
│       │       └── participants/page.tsx
│       ├── notifications/page.tsx
│       ├── grades/page.tsx
│       ├── schedule/page.tsx
│       ├── calendar/page.tsx
│       ├── activity/page.tsx
│       ├── search/page.tsx
│       ├── profile/page.tsx     ← + DensityToggle
│       └── admin/
│           ├── page.tsx
│           ├── users/page.tsx
│           ├── groups/page.tsx
│           ├── courses/page.tsx
│           └── enrollments/page.tsx
├── components/
│   ├── ui/                      ← 8 переписанных primitives
│   ├── ds/                      ← 12 новых DS-компонентов
│   ├── ai/                      ← 8 AI-паттернов
│   ├── layout/
│   │   ├── sidebar.tsx          ← 248px, brand mark с conic gradient
│   │   └── topbar.tsx           ← cmd+K, lang/theme toggles
│   └── ai-chat.tsx              ← floating SSE chat (использует ai/*)
└── tailwind.config.ts           ← extended tokens
```

---

## ✨ Принципы дизайна

1. **AI is a collaborator, never an authority**
   Все ИИ-генерации помечаются (`Badge "AI generated"`, `Badge "draft"`),
   редактируются и могут быть отклонены. Учитель имеет последнее слово.

2. **Academic before flashy**
   Long-form чтение, плотные gradebook'и, цитированные утверждения — на
   первом месте. Декорация оправдана только если уточняет смысл.

3. **Productivity scales with density**
   Роли, живущие в продукте весь день (учитель, админ), получают компактные
   таблицы и keyboard-shortcuts. Студенты, заходящие еженедельно — больше
   "воздуха".

4. **Trilingual by construction**
   Layout'ы переносят +35% horizontal expansion для RU перевода без поломок.
   Line-height tokens учитывают высокие диакритики казахских глифов.

---

## 🌍 Trilingual support

Дизайн-система с самого начала рассчитана на три языка: **EN / RU / KZ**.

- Все strings вынесены в `lib/i18n.tsx` (1595 строк)
- ИИ-эндпоинты принимают `lang` параметр и генерируют на нужном языке
- Demo-mode стимулирует translations даже без LLM API key
- Cyrillic glyph metrics учтены в line-height

---

## ⚡ AI-сценарии в новом UI

| Сценарий                 | Компоненты используются              |
|--------------------------|--------------------------------------|
| Floating AI Chat         | AIBubble, AIComposer, ThinkingDots, LiveCaret |
| Quiz generation          | GenerationPanel (multi-step), QuizQuestionPreview |
| Quiz topic suggestions   | SuggestionStrip                      |
| AI Course Summary        | ThinkingDots loading + accent gradient card |
| AI Assignment Feedback   | AIFeedbackPanel (с criteria + Apply/Edit/Dismiss) |
| AI Explain (assignment)  | AIBubble + StreamingText (SSE)       |

---

## 📊 Что показать комиссии

### Файлы-витрины

| Файл | Для чего показать |
|------|-------------------|
| `app/(auth)/login/page.tsx` | Editorial hero c "*Operating*" italic violet em — первое впечатление |
| `app/(app)/courses/[id]/quiz/page.tsx` | AI Quiz Studio — главная фича. GenerationPanel с пошаговым прогрессом, потом QuizQuestionPreview |
| `app/(app)/courses/[id]/overview/page.tsx` | AI Course Summary с violet gradient, ThinkingDots, key topics, study tips |
| `components/ai/ai-bubble.tsx` | Chat bubble с citations и action buttons |
| `app/globals.css` | OKLCH токены — современный CSS, не HSL |
| `components/ds/h-display.tsx` | Italic em-accent в Instrument Serif |

### Demo-сценарий для защиты (5 минут)

1. **Login** — обратите внимание на trilingual eyebrow, Instrument Serif italic
2. **Dashboard** → Hero + Quick Actions + Today's Classes
3. **Courses** → грид с violet color cycle
4. **Open course → Quiz** → ввести topic → нажать **Generate** → показать
   GenerationPanel с пошаговым прогрессом → пройти 1-2 вопроса → показать
   results screen с Trophy и per-question review
5. **Open course → Overview** → нажать **AI Course Summary** → показать
   ThinkingDots, потом result с key topics + tips + workload badge
6. **Floating AI Chat** (любая страница) → задать вопрос → показать SSE-стрим
   с LiveCaret
7. **Profile → Display** → переключить density
8. **Topbar** → переключить тему / язык

---

## 🛠️ Технические детали

### Совместимость

- **Browser:** Safari 15.4+, Chrome 111+ (для `oklch()`, `color-mix()`)
- **shadcn/ui** компоненты продолжают работать через HSL compat layer
- **Tailwind 3.4** — extended tokens добавлены, не replaced

### Производительность

- Все шрифты загружаются через `next/font` с `display: swap`
- CSS-переменные позволяют менять theme без перезагрузки CSS
- Tree-shaking работает: только используемые DS-компоненты попадают в bundle

### Accessibility

- WCAG 2.2 AA минимум, AAA на критических путях (login, grading, exam)
- Body text 4.5:1 contrast, large 3:1
- Focus ring через `--shadow-glow` — никогда не убираем `outline`
- `prefers-reduced-motion` отключает все anim'ы и shimmer'ы

---

## 📦 Дистрибутив миграции (4 коммита)

| Коммит | SHA | Что входит |
|--------|-----|-----------|
| **Block 1** | `3d5b43f` | Tokens + 8 primitives + 12 DS + 8 AI + Layout shell |
| **Block 2** | `e59c339` | Login, register, dashboard `_components`, course pages, quiz |
| **Block 3** | `1a2b933` | Global pages + admin pages + DensityToggle |
| **Block 4** | _финальный_ | Полировка + DESIGN_SYSTEM.md |

**Всего:** 53 файла поменяны, +5092 / −642 строк.

---

## 🚀 Дальнейшие улучшения (после защиты)

- [ ] Storybook с DS-компонентами для open-source-релиза
- [ ] Per-component visual regression тесты (Chromatic)
- [ ] Dark mode для course hero (есть, но можно улучшить)
- [ ] Адаптация course `[id]/layout.tsx` (751 строк) под полный DS
- [ ] Mobile-first review всех админ страниц
- [ ] Dynamic Island-подобный AI status indicator в topbar

---

*Документ для защиты диплома UniLMS, май 2026. Авторские принципы: ясность, плотность, trilingual-first.*
