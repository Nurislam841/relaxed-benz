import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
}

/**
 * Deterministic avatar — generates pastel HSL colour from name hash.
 *
 *   <Avatar name="Aigerim K" size={28}/>
 */
export function DsAvatar({ name = '?', src, size = 28, className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 47) % 360;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-sans font-semibold',
        className
      )}
      style={{
        width: size,
        height: size,
        background: `oklch(0.85 0.06 ${hue})`,
        color: `oklch(0.32 0.08 ${hue})`,
        fontSize: size * 0.36,
        letterSpacing: 0.02,
      }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        initials || '?'
      )}
    </span>
  );
}
