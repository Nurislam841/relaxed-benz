'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Group } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label, Skeleton } from '@/components/ui/form-elements';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';

export default function AdminGroupsPage() {
  const qc = useQueryClient();
  const t = useT();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [degree, setDegree] = useState('');
  const [year, setYear] = useState('');

  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ['a-groups', page],
    queryFn: () => api.get(`/admin/groups?page=${page}&limit=${pageSize}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post('/admin/groups', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['a-groups'] });
      toast({ title: t.adminCrud.created });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.patch(`/admin/groups/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['a-groups'] });
      toast({ title: t.adminCrud.updated });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['a-groups'] });
      toast({ title: t.adminCrud.deleted });
    },
    onError: (error: Error) => toast({ title: t.common.error, description: error.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDegree('');
    setYear('');
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditing(group);
    setName(group.name);
    setDegree(group.degree || '');
    setYear(group.year?.toString() || '');
    setOpen(true);
  };

  const submit = () => {
    const payload = {
      name,
      degree: degree || undefined,
      year: year ? parseInt(year, 10) : undefined,
    };
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
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[var(--fg-subtle)]">Groups</span>
          <h1 className="font-serif text-[32px] tracking-[-0.015em] leading-[1.05] text-[var(--fg)]">{t.adminCrud.groupsTitle}</h1>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t.adminCrud.groupsAdd}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !groups?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">{t.adminCrud.groupsEmpty}</p>
            <p className="mx-auto mt-1 max-w-md text-xs">{t.adminCrud.groupsEmptyDescription}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:hidden">
            {groups.map(group => (
              <Card key={group.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.degree || '-'}</p>
                    </div>
                    <Badge variant="secondary">{group._count?.users || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t.adminCrud.year}</span>
                    <span>{group.year || '-'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => openEdit(group)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t.adminCrud.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2 text-destructive"
                      onClick={() => {
                        if (confirm(t.adminCrud.confirmDelete)) deleteMutation.mutate(group.id);
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
                    <th className="p-3 text-left font-medium">{t.adminCrud.name}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.degree}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.year}</th>
                    <th className="p-3 text-left font-medium">{t.adminCrud.studentsCount}</th>
                    <th className="p-3 text-right font-medium">{t.adminCrud.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => (
                    <tr key={group.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{group.name}</td>
                      <td className="p-3 text-muted-foreground">{group.degree || '-'}</td>
                      <td className="p-3">{group.year || '-'}</td>
                      <td className="p-3"><Badge variant="secondary">{group._count?.users || 0}</Badge></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(group)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(t.adminCrud.confirmDelete)) deleteMutation.mutate(group.id);
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
            itemsCount={groups.length}
            pageSize={pageSize}
            isLoading={isLoading}
            onPrevious={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => current + 1)}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? t.adminCrud.groupsEdit : t.adminCrud.groupsCreate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t.adminCrud.name}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t.adminCrud.namePlaceholder} />
          </div>
          <div>
            <Label>{t.adminCrud.degree}</Label>
            <Input value={degree} onChange={e => setDegree(e.target.value)} placeholder={t.adminCrud.degreePlaceholder} />
          </div>
          <div>
            <Label>{t.adminCrud.year}</Label>
            <Input type="number" value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={!name}>
            {editing ? t.adminCrud.update : t.adminCrud.create}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
