import React from 'react';
import { PIXEL_ICONS, type IconName } from '@/lib/pixel-icons';

/** Role character -> fill. CSS variables keep icons in sync with the active theme. */
const ROLE_FILL: Record<string, string> = {
  k: 'rgb(var(--c-icon-line))', // light on dark theme, black on classic
  w: 'rgb(var(--c-hilite))',
  a: 'rgb(var(--c-spidey))',
  l: 'rgb(var(--c-lavender))',
  g: 'rgb(var(--c-green))',
  r: 'rgb(var(--c-red))',
  y: 'rgb(var(--c-yellow))',
  s: 'rgb(var(--c-slate))',
  d: '#4a4a5a',
  c: 'currentColor',
};

type Run = { x: number; y: number; w: number; fill: string };

const runCache = new Map<IconName, Run[]>();

/** Merge each row into horizontal runs of the same role: one <rect> per run. */
function getRuns(name: IconName): Run[] {
  const cached = runCache.get(name);
  if (cached) return cached;
  const runs: Run[] = [];
  PIXEL_ICONS[name].rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = ROLE_FILL[ch];
      if (ch !== '.' && fill) runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  runCache.set(name, runs);
  return runs;
}

export interface PixelIconProps {
  name: IconName;
  /** Rendered size in CSS px (use multiples of 16 for crisp pixels). Default 16. */
  size?: number;
  className?: string;
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  title?: string;
}

export const PixelIcon: React.FC<PixelIconProps> = ({ name, size = 16, className, title }) => {
  const runs = getRuns(name);
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'inline-block', verticalAlign: '-0.2em', flexShrink: 0, imageRendering: 'pixelated' }}
      {...(title ? { role: 'img' } : { 'aria-hidden': true, focusable: 'false' })}
    >
      {title ? <title>{title}</title> : null}
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
};

export default PixelIcon;
