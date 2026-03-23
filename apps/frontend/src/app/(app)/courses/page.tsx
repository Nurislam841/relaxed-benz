'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { Course, CourseProgress, PaginatedResponse } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/form-elements';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Users, FileText, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>{t.courses.progress}</span>
        <span>{data.completedAssignments} {t.common.of} {data.totalAssignments}</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${data.progress}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.3 }}
        />
      </div>
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
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{t.courses.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.courses.subtitle}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-lg" />)}
        </div>
      ) : !courses?.length ? (
        <div className="flex flex-col items-center py-16 text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted dark:bg-white/[0.04] flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <div>
            <p className="font-serif font-semibold text-lg text-foreground">{t.courses.notFound}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {user?.role === 'STUDENT'
                ? 'You haven\'t been enrolled in any courses yet. Contact your instructor or administrator.'
                : user?.role === 'TEACHER'
                ? 'You haven\'t been assigned to any courses yet. Ask your administrator to add you as a course instructor.'
                : 'No courses have been created yet. Add the first course to get started.'}
            </p>
          </div>
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin/courses"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Create first course
            </Link>
          )}
          {user?.role !== 'ADMIN' && (
            <Link href="/search" className="text-sm text-primary hover:underline">
              Search for courses →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {courses.map(c => (
              <motion.div key={c.id} variants={item}>
                <Link href={`/courses/${c.id}/overview`}>
                  <Card className="overflow-hidden hover:-translate-y-1 hover:shadow-lift cursor-pointer group h-full">
                    <div className="h-1.5 bg-primary" />
                    <CardContent className="pt-5">
                      <div className="mb-3">
                        <p className="text-xs font-semibold tracking-widest text-primary uppercase">{c.code}</p>
                        <h3 className="font-medium text-foreground mt-0.5 leading-snug group-hover:text-primary transition-colors">{c.title}</h3>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
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
                        <Badge variant="secondary">{c.semester}</Badge>
                        {c.roleInCourse && (
                          <Badge variant={c.roleInCourse === 'TEACHER' ? 'default' : 'outline'}>
                            {c.roleInCourse}
                          </Badge>
                        )}
                      </div>
                      {isStudent && <ProgressBar courseId={c.id} />}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          <PaginationControls
            page={page}
            itemsCount={courses.length}
            totalItems={data?.total}
            hasNext={data?.hasNext ?? false}
            isLoading={isLoading}
            onPrevious={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => current + 1)}
          />
        </div>
      )}
    </div>
  );
}
