'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Course, User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label, Select, Skeleton, Textarea } from '@/components/ui/form-elements';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';

export default function AdminCoursesPage() {
  const qc = useQueryClient();
  const t = useT();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [semester, setSemester] = useState('2025-Spring');

  const { data: courses, isLoading } = useQuery<Course[]>({
    queryKey: ['courses', 'admin', page],
    queryFn: () =>
      api
        .get<{ items: Course[] } | Course[]>(`/courses?page=${page}&limit=${pageSize}`)
        .then((r) => (Array.isArray(r) ? r : r.items)),
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['a-users'],
    queryFn: () => api.get('/admin/users'),
  });

  const teachers = users?.filter(user => user.role === 'TEACHER') || [];

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post('/admin/courses', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: t.adminCrud.created });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.patch(`/admin/courses/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: t.adminCrud.updated });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/courses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: t.adminCrud.deleted });
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setEditing(null);
    setCode('');
    setTitle('');
    setDescription('');
    setTeacherId('');
    setSemester('2025-Spring');
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setCode(course.code);
    setTitle(course.title);
    setDescription(course.description);
    setTeacherId(course.teacherId || '');
    setSemester(course.semester);
    setOpen(true);
  };

  const submit = () => {
    const payload = { code, title, description, teacherId: teacherId || undefined, semester };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">Courses</span>
          <h1 className="font-serif text-[32px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">{t.adminCrud.coursesTitle}</h1>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t.adminCrud.coursesAdd}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !courses?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">{t.adminCrud.coursesEmpty}</p>
            <p className="mx-auto mt-1 max-w-md text-xs">{t.adminCrud.coursesEmptyDescription}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:hidden">
            {courses.map(course => (
              <Card key={course.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-primary">{course.code}</p>
                      <p className="font-medium">{course.title}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      {course.semester}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t.adminCrud.teacher}: {course.teacher?.fullName || '-'}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => openEdit(course)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t.adminCrud.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2 text-destructive"
                      onClick={() => {
                        if (confirm(t.adminCrud.confirmDelete)) deleteMutation.mutate(course.id);
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
                    <th className="p-3 text-left font-medium">{t.adminCrud.code}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.title}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.teacher}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.semester}</th>
                    <th className="p-3 text-right font-medium">{t.adminCrud.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(course => (
                    <tr key={course.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono font-medium">{course.code}</td>
                      <td className="p-3">{course.title}</td>
                      <td className="p-3 text-muted-foreground">{course.teacher?.fullName || '-'}</td>
                      <td className="p-3 text-muted-foreground">{course.semester}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(course)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(t.adminCrud.confirmDelete)) deleteMutation.mutate(course.id);
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
            itemsCount={courses.length}
            pageSize={pageSize}
            isLoading={isLoading}
            onPrevious={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => current + 1)}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? t.adminCrud.coursesEdit : t.adminCrud.coursesCreate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{t.adminCrud.code}</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder={t.adminCrud.codePlaceholder} />
            </div>
            <div>
              <Label>{t.adminCrud.semester}</Label>
              <Input value={semester} onChange={e => setSemester(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{t.adminCrud.title}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>{t.adminCrud.description}</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>{t.adminCrud.teacher}</Label>
            <Select value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">{t.adminCrud.none}</option>
              {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </Select>
          </div>
          <Button className="w-full" onClick={submit} disabled={!code || !title}>
            {editing ? t.adminCrud.update : t.adminCrud.create}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
