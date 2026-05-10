import * as React from 'react';

interface SparkProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}

/**
 * Sparkline SVG — area + line chart for trends.
 *
 *   <Spark data={[12,18,14,22,28,30,26]} />
 */
export function Spark({
  data,
  color = 'var(--accent-600)',
  width: w = 100,
  height: h = 28,
  fill = true,
  className,
}: SparkProps) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    h - ((d - min) / (max - min || 1)) * h,
  ] as const);
  const path = pts
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  const areaPath = `${path} L${w} ${h} L0 ${h} Z`;
  // build a deterministic gradient ID
  const id = `spk-${Math.abs(data.reduce((a, c) => a + c, 0)).toString(36)}`;

  return (
    <svg width={w} height={h} className={className} style={{ display: 'block' }}>
      {fill && (
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={areaPath} fill={`url(#${id})`} />}
      <path
        d={path}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
