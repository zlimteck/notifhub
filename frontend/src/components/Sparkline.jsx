import React from 'react';

export default function Sparkline({ points = [], color = '#c9d7f8', height = 56, showLabels = false }) {
  const values = points.map(p => p.value).filter(v => v != null);
  if (values.length < 2) return null;

  const W = 300, H = height;
  const PAD_LEFT = showLabels ? 36 : 4;
  const PAD_RIGHT = 4;
  const PAD_TOP = 6;
  const PAD_BOTTOM = showLabels ? 18 : 4;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const valid = points.filter(p => p.value != null);

  const toX = i => PAD_LEFT + (i / (valid.length - 1)) * innerW;
  const toY = v => PAD_TOP + innerH - ((v - min) / range) * innerH;

  const coords = valid.map((p, i) => [toX(i), toY(p.value)]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${coords[0][0]},${PAD_TOP + innerH} ` + line + ` ${coords[coords.length - 1][0]},${PAD_TOP + innerH}`;

  const gradId = `sg-${color.replace('#', '')}-${height}`;

  const gridLines = 3;
  const yTicks = Array.from({ length: gridLines }, (_, i) => {
    const frac = i / (gridLines - 1);
    const val = max - frac * range;
    const y = PAD_TOP + frac * innerH;
    return { y, val };
  });

  const formatVal = v => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v % 1 === 0) return `${v}`;
    return v.toFixed(1);
  };

  const errorPoints = valid.filter(p => p.status === 'error' || p.status === 'offline' || p.status === 'warning');
  const errorCoords = errorPoints.map(p => {
    const i = valid.indexOf(p);
    return [toX(i), toY(p.value), p.status];
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(({ y }, i) => (
        <line key={i} x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y}
          stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
      ))}

      {/* Y-axis labels */}
      {showLabels && yTicks.map(({ y, val }, i) => (
        <text key={i} x={PAD_LEFT - 4} y={y + 4} textAnchor="end"
          fontSize="9" fill="currentColor" fillOpacity="0.4">
          {formatVal(val)}
        </text>
      ))}

      {/* Area fill */}
      <polygon points={area} fill={`url(#${gradId})`} />

      {/* Line */}
      <polyline points={line} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Error/warning dots */}
      {errorCoords.map(([x, y, status], i) => (
        <circle key={i} cx={x} cy={y} r="2.5"
          fill={status === 'warning' ? '#fbbf24' : '#f87171'} />
      ))}
    </svg>
  );
}
