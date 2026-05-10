'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, FileText, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { Course, CourseProgress, PaginatedResponse } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/form-elements';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { DsProgress } from '@/components/ds/progress';
import { stagger, item } from '@/lib/motion';
import { useT } from '@/lib/i18n';

function ProgressBar({ courseId }: { courseId: string }) {
  const t = useT();
  const { data } = useQuery<CourseProgress>({
    queryKey: ['progress', courseId],
    queryFn: () => api.get(`/courses/${courseId}/progress`),
  });
  if (!data) return null;
  return (
    <div className="mt-4">
      <DsProgress
        value={data.progress}
        label={
          <span className="flex justify-between w-full">
            <span>{t.courses.progress}</span>
            <span className="font-mono">
              {data.completedAssignments}/{data.totalAssignments}
            </span>
          </span>
        }
        showPercent={false}
      />
    </div>
  );
}

export default function CoursesPage() {
  const { data: user } = useMe();
  const t = useT();
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const { data, isLoading } = useQuery<PaginatedResponse<Course>>({
    queryKey: ['courses', page],
    queryFn: () => api.get(`/courses?page=${page}&limit=${pageSize}`),
  });
  const courses = data?.items || [];
  const isStudent = user?.role === 'STUDENT';

  return (
    <div className="space-y-7 max-w-5xl">
      <div className="space-y-2">
        <Eyebrow>Courses</Eyebrow>
        <HDisplay size="md" as="h1">
          {t.courses.title}
        </HDisplay>
        <p className="text-[14px] text-[var(--fg-muted)] max-w-[60ch]">
          {t.courses.subtitle}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-ds-lg" />)}
        </div>
      ) : !courses?.length ? (
        <Card className="flex flex-col items-center py-14 text-center gap-4 border-dashed">
          <div
            className="h-14 w-14 rounded-[12px] flex items-center justify-center"
            style={{ background: 'var(--bg-muted)' }}
          >
            <BookOpen className="h-6 w-6 text-[var(--fg-subtle)]" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="font-serif text-[20px] tracking-[-0.01em] text-[var(--fg)]">
              {t.courses.notFound}
            </h3>
            <p className="text-[13px] text-[var(--fg-muted)]">
              {user?.role === 'STUDENT'
                ? "You haven't been enrolled in any courses yet. Contact your instructor or administrator."
                : user?.role === 'TEACHER'
                ? "You haven't been assigned to any courses yet. Ask your administrator to add you as a course instructor."
                : 'No courses have been created yet. Add the first course to get started.'}
            </p>
          </div>
          {user?.role === 'ADMIN' && (
            <Link href="/admin/courses">
              <Button variant="primary" size="md">
                <BookOpen className="h-3.5 w-3.5" />
                Create first course
              </Button>
            </Link>
          )}
          {user?.role !== 'ADMIN' && (
            <Link
              href="/search"
              className="text-[13px] text-[var(--accent-700)] hover:underline"
            >
              Search for courses →
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {courses.map((c, i) => {
              const accentHues = [290, 220, 155, 75, 25, 235];
              const hue = accentHues[i % accentHues.length];
              return (
                <motion.div key={c.id} variants={item}>
                  <Link href={`/courses/${c.id}/overview`}>
                    <Card
                      hoverable
                      className="overflow-hidden cursor-pointer group h-full transition-transform duration-ds-base hover:-translate-y-px"
                    >
                      <div
                        className="h-1.5"
                        style={{ background: `oklch(0.62 0.18 ${hue})` }}
                      />
                      <CardContent className="pt-5 pb-5 px-5">
                        <div className="mb-3">
                          <p
                            className="font-mono text-[10px] uppercase tracking-[0.10em] mb-1"
                            style={{ color: `oklch(0.50 0.18 ${hue})` }}
                          >
                            {c.code}
                          </p>
                          <h3 className="text-[14px] font-semibold text-[var(--fg)] leading-snug tracking-[-0.005em] group-hover:text-[var(--accent-700)] transition-colors">
                            {c.title}
                          </h3>
                        </div>
                        <div className="flex flex-col gap-1 text-[12px] text-[var(--fg-muted)]">
                          {c.teacher && (
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3 w-3" />
                              {c.teacher.fullName}
                            </span>
                          )}
                          {c._count && (
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3" />
                              {c._count.assignments} {t.courses.assignments}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex gap-1.5 flex-wrap">
                          <Badge tone="neutral" variant="soft">{c.semester}</Badge>
                          {c.roleInCourse && (
                            <Badge
                              tone={c.roleInCourse === 'TEACHER' ? 'accent' : 'neutral'}
                              variant={c.roleInCourse === 'TEACHER' ? 'solid' : 'soft'}
                            >
                              {c.roleInCourse.toLowerCase()}
                            </Badge>
                          )}
                        </div>
                        {isStudent && <ProgressBar courseId={c.id} />}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
          <PaginationControls
            page={page}
            itemsCount={courses.length}
            totalItems={data?.total}
            hasNext={data?.hasNext ?? false}
            isLoading={isLoading}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        </div>
      )}
    </div>
  );
}
