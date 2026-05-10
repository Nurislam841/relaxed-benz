'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Link as LinkIcon, AlignLeft, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import type { CourseMaterial } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea, Select, Skeleton } from '@/components/ui/form-elements';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ds/eyebrow';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { useT } from '@/lib/i18n';

const TYPE_ICONS = { link: LinkIcon, file: FileText, text: AlignLeft };
const TYPE_TONES: Record<string, { bg: string; fg: string }> = {
  link: { bg: 'color-mix(in oklch, var(--info), transparent 85%)', fg: 'var(--info)' },
  file: { bg: 'color-mix(in oklch, var(--success), transparent 85%)', fg: 'var(--success)' },
  text: { bg: 'var(--accent-100)', fg: 'var(--accent-700)' },
};

export default function MaterialsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useMe();
  const qc = useQueryClient();
  const t = useT();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'link', url: '', content: '' });

  const { data: materials, isLoading } = useQuery<CourseMaterial[]>({
    queryKey: ['materials', id],
    queryFn: () => api.get(`/courses/${id}/materials`),
  });

  const canManage = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/courses/${id}/materials`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials', id] });
      setShowForm(false);
      setForm({ title: '', type: 'link', url: '', content: '' });
      toast({ title: t.courseMaterials.materialAdded });
    },
    onError: () =>
      toast({
        title: t.courseMaterials.materialAddFailedTitle,
        description: t.courseMaterials.materialAddFailedDescription,
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (matId: string) => api.delete(`/materials/${matId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials', id] });
      toast({ title: t.courseMaterials.materialDeleted });
    },
  });

  if (isLoading)
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );

  return (
    <div className="space-y-5 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          {t.courseMaterials.title}
        </h2>
        {canManage && (
          <Button variant="primary" size="md" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5" />
            {t.courseMaterials.addMaterial}
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t.courseMaterials.addMaterialTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder={t.courseMaterials.titlePlaceholder}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="link">{t.courseMaterials.linkType}</option>
              <option value="file">{t.courseMaterials.fileType}</option>
              <option value="text">{t.courseMaterials.textType}</option>
            </Select>
            {(form.type === 'link' || form.type === 'file') && (
              <Input
                placeholder={t.courseMaterials.urlPlaceholder}
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            )}
            {form.type === 'text' && (
              <Textarea
                placeholder={t.courseMaterials.contentPlaceholder}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  addMutation.mutate({
                    title: form.title,
                    type: form.type,
                    url: form.url || undefined,
                    content: form.content || undefined,
                  })
                }
                disabled={!form.title || addMutation.isPending}
                loading={addMutation.isPending}
              >
                {addMutation.isPending ? t.courseMaterials.saving : t.common.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(materials || []).length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center gap-3 border-dashed">
          <div className="h-11 w-11 rounded-[10px] bg-[var(--bg-muted)] flex items-center justify-center">
            <FileText className="h-5 w-5 text-[var(--fg-subtle)]" />
          </div>
          <p className="text-[13px] text-[var(--fg-muted)]">{t.courseMaterials.noMaterials}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(materials || []).map((m) => {
            const Icon = TYPE_ICONS[m.type as keyof typeof TYPE_ICONS] || FileText;
            const tone = TYPE_TONES[m.type] || TYPE_TONES.file;
            const typeLabel =
              m.type === 'link'
                ? t.courseMaterials.typeLink
                : m.type === 'file'
                ? t.courseMaterials.typeFile
                : t.courseMaterials.typeText;
            return (
              <Card key={m.id} hoverable padding="md" className="flex items-start gap-3">
                <div
                  className="p-2 rounded-[8px] shrink-0"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-[14px] text-[var(--fg)]">{m.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge tone="neutral" size="sm">
                        {typeLabel}
                      </Badge>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(m.id)}
                          className="p-1 rounded text-[var(--fg-subtle)] hover:bg-[color:color-mix(in_oklch,var(--danger),transparent_85%)] hover:text-[var(--danger)] transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-[var(--accent-700)] hover:underline break-all font-mono"
                    >
                      {m.url}
                    </a>
                  )}
                  {m.content && (
                    <p className="text-[12px] text-[var(--fg-muted)] mt-1 line-clamp-3 leading-snug">
                      {m.content}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--fg-subtle)] font-mono mt-1">
                    {formatDate(m.createdAt)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
