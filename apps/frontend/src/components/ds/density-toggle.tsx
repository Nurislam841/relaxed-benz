'use client';

import * as React from 'react';
import { Segment } from './segment';
import { useT } from '@/lib/i18n';

type Density = 'compact' | 'normal' | 'comfortable';

/**
 * Density toggle — sets [data-density] attribute on <html> element which
 * scales --row-h, --control-h via the global --density var.
 */
export function DensityToggle() {
  const t = useT() as any;
  const [density, setDensity] = React.useState<Density>('normal');

  React.useEffect(() => {
    try {
      const stored = (localStorage.getItem('density') as Density | null) ?? 'normal';
      setDensity(stored);
      if (stored === 'normal') {
        document.documentElement.removeAttribute('data-density');
      } else {
        document.documentElement.setAttribute('data-density', stored);
      }
    } catch {}
  }, []);

  const set = (next: Density) => {
    setDensity(next);
    try {
      if (next === 'normal') {
        localStorage.removeItem('density');
        document.documentElement.removeAttribute('data-density');
      } else {
        localStorage.setItem('density', next);
        document.documentElement.setAttribute('data-density', next);
      }
    } catch {}
  };

  return (
    <Segment
      value={density}
      onChange={set}
      options={[
        { value: 'compact', label: t.ui?.densityCompact ?? 'Compact' },
        { value: 'normal', label: t.ui?.densityNormal ?? 'Normal' },
        { value: 'comfortable', label: t.ui?.densityComfortable ?? 'Comfortable' },
      ]}
    />
  );
}
