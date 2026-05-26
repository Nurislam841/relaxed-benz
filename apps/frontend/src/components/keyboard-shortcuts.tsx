'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Keyboard } from 'lucide-react';
import { Kbd } from '@/components/ds/kbd';
import { cn } from '@/lib/utils';

/**
 * Global keyboard shortcuts.
 *
 * Modeled after GitHub / Linear conventions:
 *   - Single-key actions:   ?  → open cheatsheet
 *                           /  → focus search bar (jumps to /search if not on a search-capable page)
 *                           Esc → close any open modal (including the cheatsheet itself)
 *   - Chord nav (g + X):    g d → dashboard, g c → courses, g s → schedule,
 *                           g g → grades, g k → AI coach
 *
 * Editable-element guard:
 *   We skip the global handlers when the user is typing in <input>,
 *   <textarea>, <select>, or any element with contentEditable. Otherwise
 *   pressing "g" inside a form field would yank the user off-page mid-sentence.
 *
 * Chord timing:
 *   `g`-prefix waits 1.2s for the second key. Same window as GitHub uses.
 *   Pressing any non-mapped second key cancels the chord silently.
 */

const NAV_SHORTCUTS: { keys: string; path: string; label: string }[] = [
  { keys: 'g d', path: '/dashboard', label: 'Go to Dashboard' },
  { keys: 'g c', path: '/courses', label: 'Go to Courses' },
  { keys: 'g s', path: '/schedule', label: 'Go to Schedule' },
  { keys: 'g g', path: '/grades', label: 'Go to Grades' },
  { keys: 'g k', path: '/ai-analysis', label: 'Go to AI Coach' },
  { keys: 'g n', path: '/notifications', label: 'Go to Notifications' },
  { keys: 'g p', path: '/profile', label: 'Go to Profile' },
];

const ACTION_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '/', label: 'Focus search (or go to /search)' },
  { keys: '?', label: 'Show this cheatsheet' },
  { keys: 'Esc', label: 'Close any open dialog' },
];

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const chordPrefixRef = useRef<{ key: string; expiresAt: number } | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Esc handled even inside inputs (so it can blur them too — but only
      // we react if a modal is open)
      if (e.key === 'Escape') {
        if (cheatsheetOpen) {
          setCheatsheetOpen(false);
          e.preventDefault();
        }
        return;
      }

      if (isEditableElement(e.target)) return;

      // Single-key shortcuts
      if (e.key === '?' || (e.shiftKey && e.key === '?')) {
        setCheatsheetOpen((o) => !o);
        e.preventDefault();
        return;
      }

      if (e.key === '/') {
        // Try to focus a search input on the current page first; otherwise navigate to /search.
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="earch" i]',
        );
        if (searchInput) {
          searchInput.focus();
        } else {
          router.push('/search');
        }
        e.preventDefault();
        return;
      }

      // Chord prefix
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        chordPrefixRef.current = { key: 'g', expiresAt: Date.now() + 1200 };
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        chordTimerRef.current = setTimeout(() => {
          chordPrefixRef.current = null;
        }, 1200);
        return;
      }

      // Chord completion
      if (
        chordPrefixRef.current &&
        chordPrefixRef.current.key === 'g' &&
        Date.now() < chordPrefixRef.current.expiresAt
      ) {
        chordPrefixRef.current = null;
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        const second = e.key.toLowerCase();
        const hit = NAV_SHORTCUTS.find((s) => s.keys === `g ${second}`);
        if (hit) {
          router.push(hit.path);
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };
  }, [router, cheatsheetOpen]);

  if (!cheatsheetOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => setCheatsheetOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="bg-[var(--surface)] rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--accent-100)] flex items-center justify-center">
              <Keyboard className="h-4 w-4 text-[var(--accent-700)]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold">Keyboard shortcuts</h3>
              <p className="text-xs text-[var(--fg-muted)]">
                Press <Kbd>?</Kbd> from any page to bring this up.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCheatsheetOpen(false)}
            className="h-8 w-8 rounded-md hover:bg-[var(--bg-muted)] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wide text-[var(--fg-subtle)] mb-2">Navigation</h4>
            <ul className="space-y-1.5">
              {NAV_SHORTCUTS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg)]">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.split(' ').map((k, i, arr) => (
                      <span key={i} className="flex items-center gap-1">
                        <Kbd>{k}</Kbd>
                        {i < arr.length - 1 && <span className="text-[var(--fg-subtle)] text-xs">then</span>}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-mono uppercase tracking-wide text-[var(--fg-subtle)] mb-2">Actions</h4>
            <ul className="space-y-1.5">
              {ACTION_SHORTCUTS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg)]">{s.label}</span>
                  <Kbd>{s.keys}</Kbd>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-[var(--fg-subtle)] pt-2 border-t border-[var(--border-color)]">
            Shortcuts are disabled while typing in inputs, textareas, and editable fields.
          </p>
        </div>
      </div>
    </div>
  );
}
