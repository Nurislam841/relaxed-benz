'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { Attendance, AttendanceStats, Enrollment, StudentAttendanceStat } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Download,
  CalendarCheck,
  BarChart3,
  TrendingUp,
  Users,
  PlayCircle,
  FileText,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { downloadCsv } from '@/lib/csv';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-500/[0.15] dark:text-green-300',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-500/[0.15] dark:text-red-300',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-amber-500/[0.15] dark:text-amber-300',
};

function StatBadge({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useMe();
  const qc = useQueryClient();
  const t = useT();

  const [tab, setTab] = useState<'records' | 'stats'>('records');

  const { data: records, isLoading } = useQuery<Attendance[]>({
    queryKey: ['attendance', id],
    queryFn: () => api.get(`/courses/${id}/attendance`),
  });

  const { data: statsRaw } = useQuery({
    queryKey: ['attendance-stats', id],
    queryFn: () => api.get(`/courses/${id}/attendance/stats`),
  });

  const markMutation = useMutation({
    mutationFn: (data: { studentId: string; date: string; status: string }) =>
      api.post(`/courses/${id}/attendance`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', id] });
      qc.invalidateQueries({ queryKey: ['attendance-stats', id] });
      toast({ title: t.courseAttendance.recorded });
    },
    onError: () => toast({ title: t.common.error, variant: 'destructive' }),
  });

  const canMark = user?.role === 'ADMIN' || user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';
  const today = new Date().toISOString().split('T')[0];

  const { data: participants } = useQuery<Enrollment[]>({
    queryKey: ['c-parts', id],
    queryFn: () => api.get(`/courses/${id}/participants`),
    enabled: canMark,
  });

  const enrolledStudents = (participants || []).filter((p) => p.roleInCourse === 'STUDENT');

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        enrolledStudents.map((s) =>
          api.post(`/courses/${id}/attendance`, { studentId: s.userId, date: today, status: 'PRESENT' }),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', id] });
      qc.invalidateQueries({ queryKey: ['attendance-stats', id] });
      toast({
        title: `Session started — ${enrolledStudents.length} student${enrolledStudents.length !== 1 ? 's' : ''} marked Present.`,
      });
    },
    onError: () => toast({ title: t.common.error, variant: 'destructive' }),
  });

  if (isLoading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );

  // Group records by date
  const byDate = (records || []).reduce<Record<string, Attendance[]>>((acc, r) => {
    const d = r.date.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});

  // Student stats view
  const myStats = isStudent ? (statsRaw as AttendanceStats | undefined) : undefined;
  // Teacher stats view (array per student)
  const studentStats = canMark ? (statsRaw as StudentAttendanceStat[] | undefined) : undefined;
  const statusLabel = {
    PRESENT: t.attendance.present,
    LATE: t.attendance.late,
    ABSENT: t.attendance.absent,
  };
  const statusShort = {
    PRESENT: t.courseAttendance.presentShort,
    LATE: t.courseAttendance.lateShort,
    ABSENT: t.courseAttendance.absentShort,
  };

  const exportCsv = () => {
    if (canMark && tab === 'stats') {
      if (!studentStats?.length) {
        toast({ title: t.courseAttendance.exportEmpty, variant: 'destructive' });
        return;
      }

      downloadCsv(
        `${t.courseAttendance.exportStatsFilename}-${id}.csv`,
        [
          t.courseAttendance.exportStudent,
          t.courseAttendance.exportEmail,
          t.courseAttendance.sessions,
          t.courseAttendance.exportPresent,
          t.courseAttendance.exportLate,
          t.courseAttendance.exportAbsent,
          t.courseAttendance.exportPresentRate,
        ],
        studentStats.map((student) => [
          student.student.fullName,
          student.student.email || '',
          student.total,
          student.present,
          student.late,
          student.absent,
          `${student.presentRate}%`,
        ]),
      );

      toast({ title: t.courseAttendance.exportReady });
      return;
    }

    if (!records?.length) {
      toast({ title: t.courseAttendance.exportEmpty, variant: 'destructive' });
      return;
    }

    downloadCsv(
      `${t.courseAttendance.exportRecordsFilename}-${id}.csv`,
      [
        t.courseAttendance.exportDate,
        t.courseAttendance.exportStudent,
        t.courseAttendance.exportEmail,
        t.courseAttendance.exportStatus,
      ],
      records.map((record) => [
        formatDate(record.date),
        record.student?.fullName || record.studentId,
        record.student?.email || '',
        statusLabel[record.status] || record.status,
      ]),
    );

    toast({ title: t.courseAttendance.exportReady });
  };

  return (
    <div className="space-y-5 mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg)]">{t.attendance.title}</h2>
        <div className="flex flex-wrap gap-1">
          {canMark && (
            <>
              <a href={`/api/courses/${id}/attendance.pdf`} download>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  className="gap-2"
                  title="Download printable PDF attendance summary"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </a>
              <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
                <Download className="h-4 w-4" />
                {t.common.export}
              </Button>
            </>
          )}
          <Button size="sm" variant={tab === 'records' ? 'default' : 'outline'} onClick={() => setTab('records')}>
            {t.courseAttendance.recordsTab}
          </Button>
          <Button size="sm" variant={tab === 'stats' ? 'default' : 'outline'} onClick={() => setTab('stats')}>
            {t.courseAttendance.statsTab}
          </Button>
        </div>
      </div>

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <>
          {isStudent && myStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatBadge
                  label={t.courseAttendance.sessions}
                  value={myStats.total}
                  color="bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                />
                <StatBadge
                  label={t.attendance.presentRate}
                  value={`${myStats.presentRate}%`}
                  color="bg-green-50 text-green-700 dark:bg-green-500/[0.12] dark:text-green-300"
                />
                <StatBadge
                  label={t.attendance.present}
                  value={myStats.present}
                  color="bg-green-100 text-green-800 dark:bg-green-500/[0.15] dark:text-green-300"
                />
                <StatBadge
                  label={t.attendance.late}
                  value={myStats.late}
                  color="bg-yellow-100 text-yellow-800 dark:bg-amber-500/[0.15] dark:text-amber-300"
                />
                <StatBadge
                  label={t.attendance.absent}
                  value={myStats.absent}
                  color="bg-red-100 text-red-800 dark:bg-red-500/[0.15] dark:text-red-300"
                />
                <StatBadge
                  label={t.courseAttendance.absentRate}
                  value={`${myStats.absentRate}%`}
                  color="bg-red-50 text-red-700 dark:bg-red-500/[0.12] dark:text-red-300"
                />
              </div>
              {myStats.total === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-10 text-center"
                >
                  <div className="h-12 w-12 rounded-xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mb-3">
                    <TrendingUp className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No data yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Your attendance statistics will appear here once your instructor starts recording sessions.
                  </p>
                </motion.div>
              )}
            </div>
          )}

          {canMark && (
            <div className="space-y-3">
              {!studentStats?.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-14 text-center"
                >
                  <div className="h-14 w-14 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mb-4">
                    <BarChart3 className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="font-serif font-medium text-foreground mb-1">No attendance data yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start marking attendance in the Records tab and statistics will appear here.
                  </p>
                </motion.div>
              ) : (
                studentStats.map((s) => (
                  <Card key={s.student.id}>
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{s.student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.student.email}</p>
                      </div>
                      <div className="flex gap-3 text-center text-xs shrink-0">
                        <div className="text-green-700">
                          <CheckCircle2 className="h-4 w-4 mx-auto" />
                          {s.present}
                        </div>
                        <div className="text-yellow-700">
                          <Clock className="h-4 w-4 mx-auto" />
                          {s.late}
                        </div>
                        <div className="text-red-700">
                          <XCircle className="h-4 w-4 mx-auto" />
                          {s.absent}
                        </div>
                      </div>
                      <Badge
                        className={
                          s.presentRate >= 75
                            ? 'bg-green-100 text-green-800'
                            : s.presentRate >= 50
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }
                      >
                        {s.presentRate}%
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ── RECORDS TAB ── */}
      {tab === 'records' && (
        <>
          {/* Teacher: mark today's attendance */}
          {canMark && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  {t.courseAttendance.markToday} ({formatDate(today)})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {(byDate[today] || []).length === 0 ? (
                  <div className="space-y-3">
                    {enrolledStudents.length === 0 ? (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>{t.courseAttendance.markTodayHelp}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {enrolledStudents.length} student{enrolledStudents.length !== 1 ? 's' : ''} enrolled. Start
                          today's session to mark attendance.
                        </p>
                        <Button
                          size="sm"
                          className="gap-2 w-full sm:w-auto"
                          onClick={() => startSessionMutation.mutate()}
                          disabled={startSessionMutation.isPending}
                        >
                          {startSessionMutation.isPending ? (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5" />
                          )}
                          Start Today's Session
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {byDate[today].map((r) => (
                      <div key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm">{r.student?.fullName}</p>
                        <div className="flex flex-wrap gap-1">
                          {(['PRESENT', 'LATE', 'ABSENT'] as const).map((s) => (
                            <Button
                              key={s}
                              size="sm"
                              variant={r.status === s ? 'default' : 'outline'}
                              className={`h-7 px-2 text-[10px] ${r.status === s ? '' : 'text-muted-foreground'}`}
                              title={statusLabel[s]}
                              onClick={() => markMutation.mutate({ studentId: r.studentId, date: today, status: s })}
                            >
                              {statusShort[s]}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {Object.keys(byDate).length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-14 text-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center mb-4">
                <CalendarCheck className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="font-serif font-medium text-foreground mb-1">
                {canMark ? 'No attendance sessions yet' : 'No attendance records'}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {canMark
                  ? 'Use the "Mark Today" card above to record your first attendance session.'
                  : 'Your instructor has not recorded any attendance yet.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byDate)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, rows]) => (
                  <Card key={date}>
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold mb-3">{formatDate(date)}</p>
                      <div className="space-y-2">
                        {rows.map((r) => (
                          <div
                            key={r.id}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <p className="text-sm">{r.student?.fullName || r.studentId}</p>
                            {canMark ? (
                              <div className="flex flex-wrap gap-1">
                                {(['PRESENT', 'LATE', 'ABSENT'] as const).map((s) => (
                                  <Button
                                    key={s}
                                    size="sm"
                                    variant={r.status === s ? 'default' : 'outline'}
                                    className={`h-6 px-2 text-[10px] ${r.status === s ? '' : 'text-muted-foreground'}`}
                                    title={statusLabel[s]}
                                    onClick={() => markMutation.mutate({ studentId: r.studentId, date, status: s })}
                                  >
                                    {statusShort[s]}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[r.status] || ''}`}
                              >
                                {statusLabel[r.status]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
