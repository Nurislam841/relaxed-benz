'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ScheduleItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, Skeleton } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Download } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useLanguage, useT } from '@/lib/i18n';

const TYPE_COLORS: Record<string, string> = {
  LECTURE: 'bg-blue-100 border-blue-300 text-blue-900',
  PRACTICE: 'bg-green-100 border-green-300 text-green-900',
  LAB: 'bg-purple-100 border-purple-300 text-purple-900',
  EXAM: 'bg-red-100 border-red-300 text-red-900',
};

const COURSE_COLORS = [
  'bg-sky-50 border-sky-300',
  'bg-emerald-50 border-emerald-300',
  'bg-violet-50 border-violet-300',
  'bg-amber-50 border-amber-300',
  'bg-pink-50 border-pink-300',
  'bg-teal-50 border-teal-300',
];

const LOCALES = {
  en: 'en-US',
  ru: 'ru-RU',
  kz: 'kk-KZ',
} as const;

function getMon(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(getMon(new Date()));
  const [filterDay, setFilterDay] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const t = useT();
  const { lang } = useLanguage();
  const locale = LOCALES[lang];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const { data: items, isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ['sched', weekStart.toISOString()],
    queryFn: () => api.get(`/me/schedule?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`),
  });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return {
          key: date.toISOString().slice(0, 10),
          date,
          short: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
          label: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
        };
      }),
    [weekStart, locale],
  );

  const weekLabel = useMemo(() => {
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    if (sameMonth) {
      return `${new Intl.DateTimeFormat(locale, { month: 'long' }).format(weekStart)} ${weekStart.getDate()}-${weekEnd.getDate()}`;
    }
    return `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(weekStart)} - ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(weekEnd)}`;
  }, [locale, weekStart, weekEnd]);

  const courseIds = useMemo(() => Array.from(new Set((items || []).map((s) => s.courseId))), [items]);
  const courseColorMap = useMemo(
    () => Object.fromEntries(courseIds.map((id, index) => [id, COURSE_COLORS[index % COURSE_COLORS.length]])),
    [courseIds],
  );

  const coursesInView = useMemo(() => {
    const seen = new Set<string>();
    return (items || []).filter((item) => {
      if (seen.has(item.courseId)) return false;
      seen.add(item.courseId);
      return true;
    });
  }, [items]);

  const filtered = useMemo(
    () =>
      (items || []).filter((item) => {
        if (filterCourse && item.courseId !== filterCourse) return false;
        if (filterDay) return item.startsAt.slice(0, 10) === filterDay;
        return true;
      }),
    [items, filterCourse, filterDay],
  );

  const typeLabel = (type: string) => {
    if (type === 'LECTURE') return t.schedule.lecture;
    if (type === 'PRACTICE') return t.schedule.practice;
    if (type === 'LAB') return t.schedule.lab;
    if (type === 'EXAM') return t.schedule.exam;
    return type;
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">
            Weekly schedule
          </span>
          <h1 className="font-serif text-[36px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">
            {t.schedule.title}
          </h1>
          <p className="text-[13px] text-[var(--fg-muted)] font-mono">
            {t.schedule.thisWeek}: {weekLabel}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="h-9 min-w-[150px] text-sm"
          >
            <option value="">{t.schedule.allDays}</option>
            {days.map((day) => (
              <option key={day.key} value={day.key}>
                {day.label}
              </option>
            ))}
          </Select>
          <Select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="h-9 min-w-[170px] text-sm"
          >
            <option value="">{t.schedule.allCourses}</option>
            {coursesInView.map((item) => (
              <option key={item.courseId} value={item.courseId}>
                {item.course?.code} - {item.course?.title}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setWeekStart((prev) => {
                  const next = new Date(prev);
                  next.setDate(prev.getDate() - 7);
                  return next;
                })
              }
              title={t.schedule.previousWeek}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(getMon(new Date()))}>
              {t.schedule.today}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setWeekStart((prev) => {
                  const next = new Date(prev);
                  next.setDate(prev.getDate() + 7);
                  return next;
                })
              }
              title={t.schedule.nextWeek}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <a
              href="/api/me/schedule.ics"
              download="unilms-schedule.ics"
              title="Export to Google Calendar / Apple Calendar / Outlook (.ics)"
            >
              <Button variant="outline" size="sm" type="button">
                <Download className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Export .ics</span>
              </Button>
            </a>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="py-12 text-center text-muted-foreground">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">{t.schedule.noClasses}</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {days.map((day) => {
                if (filterDay && filterDay !== day.key) return null;
                const dayItems = filtered.filter((item) => item.startsAt.slice(0, 10) === day.key);

                return (
                  <div
                    key={day.key}
                    className={`rounded-xl border p-3 ${isToday(day.date) ? 'border-primary/40 bg-primary/5' : 'bg-background'}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {day.short}
                        </p>
                        <p className={`text-lg font-bold ${isToday(day.date) ? 'text-primary' : ''}`}>
                          {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(day.date)}
                        </p>
                      </div>
                      {isToday(day.date) && <Badge variant="outline">{t.schedule.today}</Badge>}
                    </div>

                    {dayItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                        {t.schedule.noItemsForDay}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-3 text-sm ${courseColorMap[item.courseId] || 'bg-muted/50 border-border'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold">{item.course?.code}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.course?.title}</p>
                              </div>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[item.type] || ''}`}
                              >
                                {typeLabel(item.type)}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5" />
                                {formatTime(item.startsAt)}-{formatTime(item.endsAt)}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {t.schedule.room}: {item.room}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
