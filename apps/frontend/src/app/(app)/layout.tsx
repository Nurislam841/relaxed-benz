'use client';
import { useMe } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp } from '@/lib/motion';
import { useNotificationsStream } from '@/hooks/use-notifications-stream';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';

// AI chat is the floating widget on every authenticated page. It's only used
// when the user actively clicks the bubble, so deferring its JS until after
// hydration cuts ~25KB off every dashboard initial load.
const AiChat = dynamic(() => import('@/components/ai-chat').then((m) => ({ default: m.AiChat })), {
  ssr: false,
  loading: () => null,
});

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  useNotificationsStream(!!user);

  useEffect(() => {
    if (!isLoading && (isError || !user)) router.push('/login');
  }, [isLoading, isError, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
          <Loader2 className="h-7 w-7 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Sidebar />
      <div className="lg:ml-[248px]">
        <Topbar />
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="px-6 py-8 lg:px-10 lg:py-10 max-w-[1280px]"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
      <AiChat />
      <KeyboardShortcuts />
    </div>
  );
}
