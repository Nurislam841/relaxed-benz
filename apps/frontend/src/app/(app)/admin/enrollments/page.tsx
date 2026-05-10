'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Course, Enrollment, User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label, Select, Skeleton } from '@/components/ui/form-elements';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { Link2Off, Plus, Trash2 } from 'lucide-react';

export default function AdminEnrollmentsPage() {
  const qc = useQueryClient();
  const t = useT();
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [roleInCourse, setRoleInCourse] = useState('STUDENT');

  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ['a-enr', page],
    queryFn: () => api.get(`/admin/enrollments?page=${page}&limit=${pageSize}`),
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['a-users'],
    queryFn: () => api.get('/admin/users?limit=200'),
  });

  const { data: courses } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () =>
      api.get<{ items: Course[] } | Course[]>('/courses?page=1&limit=200').then((r) =>
        Array.isArray(r) ? r : r.items,
      ),
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post('/admin/enrollments', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['a-enr'] });
      toast({ title: t.adminCrud.enrolled });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/enrollments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['a-enr'] });
      toast({ title: t.adminCrud.removed });
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setUserId('');
    setCourseId('');
    setRoleInCourse('STUDENT');
    setOpen(true);
  };

  const roleLabel = {
    STUDENT: t.adminCrud.userRoleStudent,
    TEACHER: t.adminCrud.userRoleTeacher,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">Enrollments</span>
          <h1 className="font-serif text-[32px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">{t.adminCrud.enrollmentsTitle}</h1>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t.adminCrud.enrollmentsAdd}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !enrollments?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Link2Off className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">{t.adminCrud.enrollmentsEmpty}</p>
            <p className="mx-auto mt-1 max-w-md text-xs">{t.adminCrud.enrollmentsEmptyDescription}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:hidden">
            {enrollments.map(enrollment => (
              <Card key={enrollment.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="space-y-1">
                    <p className="font-medium">{enrollment.user?.fullName}</p>
                    <p className="text-sm text-muted-foreground">{enrollment.user?.email}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="font-medium">{enrollment.course?.code}</p>
                    <p className="text-sm text-muted-foreground">{enrollment.course?.title}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={enrollment.roleInCourse === 'TEACHER' ? 'default' : 'secondary'}>
                      {roleLabel[enrollment.roleInCourse]}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-destructive"
                      onClick={() => {
                        if (confirm(t.adminCrud.confirmRemove)) deleteMutation.mutate(enrollment.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.adminCrud.remove}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">{t.adminCrud.user}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.course}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.role}</th>
                    <th className="p-3 text-right font-medium">{t.adminCrud.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enrollment => (
                    <tr key={enrollment.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <p className="font-medium">{enrollment.user?.fullName}</p>
                        <p className="text-xs text-muted-foreground">{enrollment.user?.email}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{enrollment.course?.code}</p>
                        <p className="text-xs text-muted-foreground">{enrollment.course?.title}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant={enrollment.roleInCourse === 'TEACHER' ? 'default' : 'secondary'}>
                          {roleLabel[enrollment.roleInCourse]}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(t.adminCrud.confirmRemove)) deleteMutation.mutate(enrollment.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <PaginationControls
            page={page}
            itemsCount={enrollments.length}
            pageSize={pageSize}
            isLoading={isLoading}
            onPrevious={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => current + 1)}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{t.adminCrud.enrollmentsAdd}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t.adminCrud.user}</Label>
            <Select value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">{t.adminCrud.select}</option>
              {users?.map(user => <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>)}
            </Select>
          </div>
          <div>
            <Label>{t.adminCrud.course}</Label>
            <Select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">{t.adminCrud.select}</option>
              {courses?.map(course => <option key={course.id} value={course.id}>{course.code} - {course.title}</option>)}
            </Select>
          </div>
          <div>
            <Label>{t.adminCrud.role}</Label>
            <Select value={roleInCourse} onChange={e => setRoleInCourse(e.target.value)}>
              <option value="STUDENT">{t.adminCrud.userRoleStudent}</option>
              <option value="TEACHER">{t.adminCrud.userRoleTeacher}</option>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => createMutation.mutate({ userId, courseId, roleInCourse })}
            disabled={!userId || !courseId}
          >
            {t.adminCrud.create}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
