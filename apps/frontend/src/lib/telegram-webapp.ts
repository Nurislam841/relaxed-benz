'use client';

import { api } from './api';

/**
 * Telegram Mini App auto-login helper (Phase 4.1).
 *
 * When the user opens the LMS through the bot's WebApp button (`/app` → tap),
 * Telegram injects `window.Telegram.WebApp` and provides `initData` — a
 * signed string we send to the backend in exchange for normal JWT cookies.
 *
 * Three call paths converge here:
 *  - First visit inside Telegram → no cookies → call backend, get cookies.
 *  - Already-authenticated visit → backend returns existing user; we still
 *    refresh cookies because Mini Apps tend to outlive the access token TTL.
 *  - Telegram user hasn't linked yet → `requires_link: true` → we send them
 *    to /profile to do the deep-link flow.
 *
 * This is intentionally a side-effect helper, not a hook — we want to run
 * exactly once at app boot. The wrapper is idempotent (guard flag) so a
 * Strict-Mode double-call in dev does nothing harmful.
 */

let bootstrapped = false;

interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  colorScheme?: 'light' | 'dark';
  themeParams?: Record<string, string>;
  HapticFeedback?: {
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function isInsideTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.Telegram?.WebApp?.initData;
}

export async function bootstrapTelegramWebApp(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (!wa || !wa.initData) return;

  // Tell Telegram we've loaded — hides the splash, takes us to full-screen.
  try {
    wa.ready?.();
    wa.expand?.();
  } catch {
    /* noop */
  }

  try {
    const result: any = await api.post('/auth/telegram-webapp', { initData: wa.initData });
    if (result?.requires_link) {
      // Telegram user hasn't linked their LMS account yet — bounce them to
      // the profile page where the deep-link CTA lives.
      window.location.href = '/profile?tg-needs-link=1';
    }
    // Otherwise: cookies are now set; subsequent api.* calls auth normally.
  } catch (e) {
    // Login failed — could be invalid initData, expired, or bot not configured.
    // We don't redirect anywhere automatically; user can still use the manual
    // login flow if they really want to.
    console.warn('[telegram-webapp] auto-login failed:', e);
  }
}
