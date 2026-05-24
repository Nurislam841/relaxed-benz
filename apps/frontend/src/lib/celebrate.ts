'use client';

import confetti from 'canvas-confetti';

/**
 * Confetti helpers — used at "celebration" moments:
 *   - achievement unlock ([dashboard widget, /achievements page])
 *   - perfect quiz score
 *   - high-percent adaptive completion
 *
 * Respects `prefers-reduced-motion`: returns immediately without animating.
 * This is important — confetti is delightful for most students but actively
 * uncomfortable for users with vestibular disorders.
 */

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Big celebration burst — fired for "10/10" or "100%" moments.
 * Three quick bursts from left/right/center to fill the viewport edges
 * without sustained animation that would hurt low-end devices.
 */
export function celebrate() {
  if (isReducedMotion()) return;

  const defaults = {
    spread: 70,
    ticks: 80,
    gravity: 1,
    decay: 0.93,
    startVelocity: 30,
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
  };

  confetti({ ...defaults, particleCount: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...defaults, particleCount: 60, origin: { x: 1, y: 0.7 } });
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 100, origin: { x: 0.5, y: 0.6 }, spread: 100 });
  }, 250);
}

/**
 * Small badge "pop" — fired for an achievement unlock. Less screen-filling
 * than the perfect-score celebration so it doesn't get fatigued by frequent
 * use (badges can come in clusters after a single grading session).
 */
export function badgePop() {
  if (isReducedMotion()) return;

  confetti({
    particleCount: 40,
    spread: 50,
    startVelocity: 20,
    gravity: 1.2,
    decay: 0.94,
    origin: { x: 0.5, y: 0.3 },
    colors: ['#fbbf24', '#f59e0b', '#d97706', '#fde68a'],
    scalar: 0.8,
  });
}
