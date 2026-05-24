'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMe } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import type { SearchResults } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, BookOpen, FileText, ClipboardList, Bell, Users } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ds/empty-state';
import { formatDate } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export default function SearchPage() {
  const { data: me } = useMe();
  const t = useT();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery<SearchResults>({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
  });

  const total =
    (data?.courses?.length ?? 0) +
    (data?.materials?.length ?? 0) +
    (data?.assignments?.length ?? 0) +
    (data?.announcements?.length ?? 0) +
    (data?.users?.length ?? 0);
  const roleLabel = {
    ADMIN: t.adminCrud.userRoleAdmin,
    TEACHER: t.adminCrud.userRoleTeacher,
    STUDENT: t.adminCrud.userRoleStudent,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">Global search</span>
        <h1 className="font-serif text-[36px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">{t.search.title}</h1>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder={t.search.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {debouncedQuery.length < 2 && <p className="text-sm text-muted-foreground text-center py-8">{t.search.hint}</p>}

      {isLoading && debouncedQuery.length >= 2 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {data && !isLoading && (
        <>
          <p className="text-sm text-muted-foreground">
            {total} {total !== 1 ? t.search.results_pl : t.search.results} {t.search.for} &quot;{debouncedQuery}&quot;
          </p>

          {/* Courses */}
          {data.courses.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t.search.coursesSection}
              </h2>
              {data.courses.map((c) => (
                <Link key={c.id} href={`/courses/${c.id}/overview`}>
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                      </div>
                      <Badge variant="secondary">{c.code}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Materials */}
          {data.materials.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t.search.materialsSection}
              </h2>
              {data.materials.map((m) => (
                <Link key={m.id} href={`/courses/${m.courseId}/materials`}>
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.course?.code} · {m.course?.title}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {m.type === 'link'
                          ? t.courseMaterials.linkType
                          : m.type === 'file'
                            ? t.courseMaterials.fileType
                            : t.courseMaterials.textType}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Assignments */}
          {data.assignments.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                {t.search.assignmentsSection}
              </h2>
              {data.assignments.map((a) => (
                <Link key={a.id} href={`/courses/${a.courseId}/assignments`}>
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.course?.code} · {t.common.due} {formatDate(a.dueAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Feature 6 — Announcements in search */}
          {(data.announcements?.length || 0) > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t.search.announcementsSection}
              </h2>
              {data.announcements!.map((a) => (
                <Link key={a.id} href={a.courseId ? `/courses/${a.courseId}/overview` : '/dashboard'}>
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{a.body}</p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">{formatDate(a.createdAt)}</p>
                      </div>
                      {a.course && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {a.course.code}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Feature 6 — Users in search (admin only) */}
          {(data.users?.length || 0) > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t.search.usersSection}
              </h2>
              {data.users!.map((u) => (
                <Link key={u.id} href={`/admin/users`}>
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                        {u.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {roleLabel[u.role]}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {total === 0 && (
            <EmptyState
              icon={SearchIcon}
              title={`${t.common.noResults} "${debouncedQuery}"`}
              description="Try a different keyword, check spelling, or search with fewer words."
            />
          )}
        </>
      )}
    </div>
  );
}
