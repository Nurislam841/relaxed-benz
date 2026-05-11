'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import type { Enrollment } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/form-elements';
import { Input } from '@/components/ui/input';
import { DsAvatar } from '@/components/ds/avatar';
import { Eyebrow } from '@/components/ds/eyebrow';
import { useT } from '@/lib/i18n';

export default function ParticipantsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [search, setSearch] = useState('');
  const { data: parts, isLoading } = useQuery<Enrollment[]>({
    queryKey: ['c-parts', id],
    queryFn: () => api.get(`/courses/${id}/participants`),
  });

  const teachers = (parts || []).filter((p) => p.roleInCourse === 'TEACHER');
  const students = (parts || []).filter((p) => p.roleInCourse === 'STUDENT');
  const filteredStudents = search.trim()
    ? students.filter(
        (p) =>
          p.user?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
          p.user?.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : students;

  return (
    <div className="space-y-5 mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
            {t.courseParticipants.title}
          </h2>
          <span className="font-mono text-[12px] text-[var(--fg-subtle)]">
            ({parts?.length || 0})
          </span>
        </div>
        {(parts?.length || 0) > 3 && (
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-subtle)] pointer-events-none" />
            <Input
              className="pl-8"
              placeholder={(t as any).ui?.searchByNameEmail ?? 'Search by name or email…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          {teachers.length > 0 && (
            <div className="space-y-2">
              <Eyebrow>{t.courseParticipants.instructors}</Eyebrow>
              <div className="space-y-2">
                {teachers.map((p) => (
                  <Card key={p.id} hoverable padding="md" className="flex items-center gap-3">
                    <DsAvatar name={p.user?.fullName ?? '?'} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--fg)] truncate">
                        {p.user?.fullName}
                      </p>
                      <p className="text-[11px] text-[var(--fg-muted)] font-mono truncate">
                        {p.user?.email}
                      </p>
                    </div>
                    <Badge tone="accent" variant="solid">
                      {t.courseParticipants.teacher}
                    </Badge>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Eyebrow>
              {t.courseParticipants.students} · {students.length}
            </Eyebrow>
            <div className="space-y-2">
              {filteredStudents.length === 0 && !search ? (
                <Card className="flex flex-col items-center py-10 text-center gap-2 border-dashed">
                  <div className="h-10 w-10 rounded-[10px] bg-[var(--bg-muted)] flex items-center justify-center">
                    <Users className="h-5 w-5 text-[var(--fg-subtle)]" />
                  </div>
                  <p className="text-[13px] text-[var(--fg-muted)]">
                    {t.courseParticipants.noStudents}
                  </p>
                </Card>
              ) : filteredStudents.length === 0 ? (
                <p className="text-[13px] text-[var(--fg-muted)] text-center py-4">
                  No students match &ldquo;{search}&rdquo;
                </p>
              ) : (
                filteredStudents.map((p) => (
                  <Card key={p.id} hoverable padding="md" className="flex items-center gap-3">
                    <DsAvatar name={p.user?.fullName ?? '?'} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--fg)] truncate">
                        {p.user?.fullName}
                      </p>
                      <p className="text-[11px] text-[var(--fg-muted)] font-mono truncate">
                        {p.user?.email}
                      </p>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
