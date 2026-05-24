'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Sun, Moon, Search } from 'lucide-react';
import { useLogout } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { useLanguage, type Lang } from '@/lib/i18n';
import { Kbd } from '@/components/ds/kbd';
import { Tooltip } from '@/components/ds/tooltip';
import { cn } from '@/lib/utils';

function ThemeToggle() {
  const { t } = useLanguage();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {}
  };

  return (
    <Tooltip content={dark ? 'Switch to light theme' : 'Switch to dark theme'} side="bottom">
      <button
        onClick={toggle}
        aria-label={t.common.toggleTheme}
        className="w-7 h-7 inline-flex items-center justify-center rounded-[6px] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors duration-ds-fast"
      >
        {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </button>
    </Tooltip>
  );
}

function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  const langs: Lang[] = ['en', 'ru', 'kz'];
  return (
    <div className="flex items-center gap-0.5 rounded-[6px] border border-[var(--border-color)] bg-[var(--surface)] p-0.5">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            'px-2 py-0.5 text-[10px] font-mono font-medium rounded-[4px] transition-colors duration-ds-fast',
            lang === l ? 'bg-[var(--accent-600)] text-white' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
          )}
        >
          {t.langName[l]}
        </button>
      ))}
    </div>
  );
}

function CommandHint() {
  return (
    <Tooltip content="Press ? from any page for the full shortcut cheatsheet" side="bottom">
      <Link
        href="/search"
        className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded-[7px] border border-[var(--border-color)] bg-[var(--surface)] text-[12px] text-[var(--fg-subtle)] hover:bg-[var(--bg-subtle)] transition-colors duration-ds-fast min-w-[200px]"
      >
        <Search className="w-3 h-3" />
        <span className="flex-1 text-left">Search everything</span>
        <Kbd>/</Kbd>
      </Link>
    </Tooltip>
  );
}

export function Topbar() {
  const lo = useLogout();
  const { t } = useLanguage();
  const { data: uc } = useQuery<number>({
    queryKey: ['nc'],
    queryFn: () => api.get<number>('/me/notifications/unread-count'),
    // SSE is primary, polling is fallback if the stream drops or fails to connect
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <header
      className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-subtle)]/95 backdrop-blur px-4 lg:px-6"
      style={{ backdropFilter: 'saturate(140%) blur(8px)' }}
    >
      <div className="lg:ml-0 ml-12" />
      <CommandHint />
      <div className="flex-1" />
      <LanguageToggle />
      <ThemeToggle />
      <Tooltip
        content={typeof uc === 'number' && uc > 0 ? `${uc} unread notification${uc === 1 ? '' : 's'}` : 'Notifications'}
        side="bottom"
      >
        <Link
          href="/notifications"
          className="relative w-7 h-7 inline-flex items-center justify-center rounded-[6px] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors duration-ds-fast"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {typeof uc === 'number' && uc > 0 && (
            <span
              className="absolute top-0.5 right-0.5 h-3.5 min-w-[14px] px-[3px] rounded-full text-[9px] text-white flex items-center justify-center font-bold leading-none"
              style={{
                background: 'var(--danger)',
                border: '1.5px solid var(--bg-subtle)',
              }}
            >
              {uc > 9 ? '9+' : uc}
            </span>
          )}
        </Link>
      </Tooltip>
      <Tooltip content="Sign out" side="bottom">
        <button
          onClick={() => lo.mutate()}
          aria-label={t.common.logout}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[12px] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors duration-ds-fast"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t.common.logout}</span>
        </button>
      </Tooltip>
    </header>
  );
}
