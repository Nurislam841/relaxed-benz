'use client';

import { useEffect } from 'react';
import { bootstrapTelegramWebApp } from '@/lib/telegram-webapp';

/**
 * Mounts once at app boot — kicks off the Mini App auto-login flow if we're
 * running inside Telegram. Rendered in layout.tsx so it runs on every route.
 *
 * Renders nothing — it's purely a side-effect host. Putting this in a
 * dedicated client component keeps the rest of the layout server-renderable.
 */
export function TelegramWebAppBootstrap() {
  useEffect(() => {
    void bootstrapTelegramWebApp();
  }, []);
  return null;
}
