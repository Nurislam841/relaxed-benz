import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * UniLMS DS Badge — tone × variant matrix.
 * tones: neutral | accent | success | warning | danger | info
 * variant: soft (default) | solid
 */
const bv = cva(
  'inline-flex items-center gap-1 rounded-full border font-medium leading-[1.4] font-sans',
  {
    variants: {
      tone: {
        neutral: '',
        accent: '',
        success: '',
        warning: '',
        danger: '',
        info: '',
      },
      variant: {
        soft: '',
        solid: '',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-[1px]',
        md: 'text-[11px] px-[7px] py-[2px]',
      },
    },
    compoundVariants: [
      // Soft (default)
      { tone: 'neutral', variant: 'soft', class: 'bg-[var(--bg-muted)] text-[var(--fg-muted)] border-[var(--border-color)]' },
      { tone: 'accent', variant: 'soft', class: 'bg-[var(--accent-100)] text-[var(--accent-700)] border-[var(--accent-200)]' },
      { tone: 'success', variant: 'soft', class: 'bg-[color:color-mix(in_oklch,var(--success),transparent_85%)] text-[var(--success)] border-[color:color-mix(in_oklch,var(--success),transparent_70%)]' },
      { tone: 'warning', variant: 'soft', class: 'bg-[color:color-mix(in_oklch,var(--warning),transparent_85%)] text-[var(--warning)] border-[color:color-mix(in_oklch,var(--warning),transparent_70%)]' },
      { tone: 'danger', variant: 'soft', class: 'bg-[color:color-mix(in_oklch,var(--danger),transparent_85%)] text-[var(--danger)] border-[color:color-mix(in_oklch,var(--danger),transparent_70%)]' },
      { tone: 'info', variant: 'soft', class: 'bg-[color:color-mix(in_oklch,var(--info),transparent_85%)] text-[var(--info)] border-[color:color-mix(in_oklch,var(--info),transparent_70%)]' },
      // Solid
      { tone: 'neutral', variant: 'solid', class: 'bg-[var(--fg)] text-[var(--fg-inverse)] border-transparent' },
      { tone: 'accent', variant: 'solid', class: 'bg-[var(--accent-600)] text-white border-transparent' },
      { tone: 'success', variant: 'solid', class: 'bg-[var(--success)] text-white border-transparent' },
      { tone: 'warning', variant: 'solid', class: 'bg-[var(--warning)] text-white border-transparent' },
      { tone: 'danger', variant: 'solid', class: 'bg-[var(--danger)] text-white border-transparent' },
      { tone: 'info', variant: 'solid', class: 'bg-[var(--info)] text-white border-transparent' },
    ],
    defaultVariants: { tone: 'neutral', variant: 'soft', size: 'md' },
  }
);

type LegacyVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
type Variant = 'soft' | 'solid' | LegacyVariant;

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'tone'> {
  tone?: Tone;
  /** Accepts new ('soft'|'solid') OR legacy shadcn variants. */
  variant?: Variant;
  size?: 'sm' | 'md';
  legacyVariant?: LegacyVariant;
  dot?: boolean;
}

function mapLegacy(v?: LegacyVariant): { tone: any; variant: any } {
  switch (v) {
    case 'default': return { tone: 'accent', variant: 'solid' };
    case 'secondary': return { tone: 'neutral', variant: 'soft' };
    case 'destructive': return { tone: 'danger', variant: 'solid' };
    case 'outline': return { tone: 'neutral', variant: 'soft' };
    case 'success': return { tone: 'success', variant: 'soft' };
    case 'warning': return { tone: 'warning', variant: 'soft' };
    default: return { tone: 'neutral', variant: 'soft' };
  }
}

function Badge({ className, tone, variant, size, legacyVariant, dot, children, ...p }: BadgeProps) {
  // Detect legacy variant strings and map them
  const legacyKeys = ['default', 'secondary', 'destructive', 'outline', 'success', 'warning'];
  let resolvedTone = tone;
  let resolvedVariant: any = variant;
  if (typeof variant === 'string' && legacyKeys.includes(variant)) {
    const m = mapLegacy(variant as any);
    resolvedTone = m.tone;
    resolvedVariant = m.variant;
  }
  if (legacyVariant) {
    const m = mapLegacy(legacyVariant);
    resolvedTone = m.tone;
    resolvedVariant = m.variant;
  }
  return (
    <div className={cn(bv({ tone: resolvedTone, variant: resolvedVariant, size }), className)} {...p}>
      {dot && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </div>
  );
}

export { Badge, bv as badgeVariants };
