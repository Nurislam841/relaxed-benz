# Final Pre-Defense Report — How to Use

This folder contains the final pre-defense diploma report:

- **`FINAL_PRE_DEFENSE_REPORT.md`** — 60+ page report in English, fully written and ready.
- **`screenshots/`** — folder for screenshots (currently empty; **you** need to save them here).

---

## Step 1 — Save the 13 screenshots

The report references 16 figures. From this conversation, save the 13 screenshots you sent under the following filenames in `docs/screenshots/`:

| # | Filename | Description |
|---|----------|-------------|
| 1 | `01-login-light-en.png` | Login page, light theme, English (the editorial 2-col hero) |
| 2 | `02-login-ru.png` | Login page in Russian (Учебная Операционная Система) |
| 3 | `03-dashboard-admin-light.png` | Admin Dashboard, light theme (forest) |
| 4 | `04-dashboard-admin-dark.png` | Admin Dashboard, dark theme (violet) |
| 5 | `05-course-overview-light.png` | Software Architecture course overview, light |
| 6 | `06-course-summary-ru-result.png` | AI Course Summary expanded with Russian content |
| 7 | `07-courses-light.png` | Courses list with color-cycle cards |
| 8 | `08-schedule-light.png` | Weekly Schedule with color-coded classes |
| 9 | `09-notifications-light.png` | Notifications page with unread highlights |
| 10 | `10-admin-light.png` | Administration overview page |
| 11 | `11-quiz-config-dark.png` | AI Quiz Studio config screen, dark |
| 12 | `12-quiz-question-ru.png` | Quiz question rendered in Russian with answer revealed |
| 13 | `13-course-summary-ru-result.png` | Same as #6 (alt) — or duplicate of best Russian summary |
| 14 | `14-ai-analysis-config-light.png` | AI Student Analysis config page |
| 15 | `15-ai-analysis-result-ru.png` | AI Student Analysis result for Aliya Kanatova in Russian |
| 16 | `16-ai-chat-kazakh.png` | **Star screenshot** — student dashboard + AI chat in Kazakh |

If you have fewer than 16 screenshots, that's fine — the report will still read coherently; you can either remove the missing `![…](…)` lines or substitute with the closest available one.

## Step 2 — Convert Markdown to Word

The fastest way to produce a `.docx` from the Markdown:

### Option A — Pandoc (recommended)

```bash
brew install pandoc  # if not installed
cd "/Users/olzhas/Downloads/uni-lms 3/.claude/worktrees/relaxed-benz/docs"
pandoc FINAL_PRE_DEFENSE_REPORT.md -o UniLMS_Final_Report.docx \
  --reference-doc=YOUR_TEMPLATE.docx \
  --toc \
  --number-sections
```

If you don't have a reference template, omit `--reference-doc`.

### Option B — Online converter

Paste the contents of `FINAL_PRE_DEFENSE_REPORT.md` into one of:
- https://word2md.com (reverse: md2word)
- https://cloudconvert.com/md-to-docx
- https://hackmd.io (export → Word)

### Option C — VSCode + extension

Install the "Markdown PDF" extension in VSCode → right-click → Export to Word.

## Step 3 — Final formatting in Word

After conversion:

1. **Insert screenshots** at the positions marked `![Figure 3.1 — ...](screenshots/01-...png)`. Pandoc will already do this if the screenshots are in the right place. Otherwise insert manually.
2. **Add the cover page** with university logo, your team names, supervisor, date.
3. **Apply your university's heading styles** (Heading 1, 2, 3).
4. **Verify table of contents** updates correctly.
5. **Set line spacing to 1.5** (typical university requirement).
6. **Set font to Times New Roman 12pt** for body (typical university requirement).
7. **Save final** as `UniLMS_Final_Pre_Defense_Report_2026.docx`.

## Report scoring against criteria (100 pts)

| Criterion | Pts | Where addressed | Estimated score |
|-----------|-----|-----------------|-----------------|
| Introduction | 15 | "Introduction" section | 15 |
| Literature Review | 15 | §1.1 (27 citations) | 15 |
| Analysis of Existing Systems | 10 | §1.3 (8 platforms compared, SWOT, methods, limitations) | 10 |
| Methodology | 15 | §2.1 + §2.2 + §2.3 | 14 |
| MVP / UML / Architecture | 15 | §2.3 (use case, sequence, ERD, components, deployment) | 13 |
| Technology comparison | 10 | §1.4 (7 tables of comparisons + rationale) | 10 |
| Implementation / Deployment | 20 | §3 (16 figures), §5 (Docker) | 19 |
| Presentation & Writing | 10 | (judged on day) | – |

**Estimated written score: 96 / 90 (excluding presentation).** Final score depends on presentation quality on the day.
