'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/form-elements';
import { Eyebrow } from '@/components/ds/eyebrow';
import { HDisplay } from '@/components/ds/h-display';
import { EmptyState } from '@/components/ds/empty-state';
import { useT } from '@/lib/i18n';
import { getNotificationContent } from '@/lib/notification-content';

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/me/notifications'),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/me/notifications/read-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifs'] });
      qc.invalidateQueries({ queryKey: ['nc'] });
    },
  });

  const readOneMutation = useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifs'] });
      qc.invalidateQueries({ queryKey: ['nc'] });
    },
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1.5">
          <Eyebrow>Inbox</Eyebrow>
          <HDisplay size="md" as="h1">
            {t.notifications.title}
          </HDisplay>
          {unread > 0 && (
            <p className="text-[13px] text-[var(--fg-muted)] font-mono">
              {unread} {t.notifications.unread}
            </p>
          )}
        </div>
        {unread > 0 && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t.notifications.markAll}
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <EmptyState
            icon={Bell}
            title={t.notifications.empty}
            description="When you receive an assignment, grade, or announcement, it will appear here."
          />
        </motion.div>
      )}

      <motion.div
        className="space-y-1.5"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      >
        <AnimatePresence>
          {notifications.map((n) =>
            (() => {
              const content = getNotificationContent(n, t);
              return (
                <motion.div
                  key={n.id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                  }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    hoverable
                    className={n.isRead ? 'opacity-60' : 'border-[var(--accent-200)] bg-[var(--accent-50)]'}
                    onClick={() => !n.isRead && readOneMutation.mutate(n.id)}
                  >
                    <CardContent className="p-4 flex items-start gap-3 cursor-pointer">
                      <div
                        className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                        style={{ background: n.isRead ? 'transparent' : 'var(--accent-500)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--fg)]">{content.title}</p>
                        {content.body && <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">{content.body}</p>}
                        <p className="text-[11px] text-[var(--fg-subtle)] font-mono mt-1.5">
                          {formatDateTime(n.createdAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })(),
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
