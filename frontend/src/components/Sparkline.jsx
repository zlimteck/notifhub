import React, { useState } from 'react';

function smoothPath(coords) {
  if (coords.length < 2) return '';
  const t = 0.18;
  let d = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * t;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function smoothArea(coords, bottomY) {
  if (coords.length < 2) return '';
  return smoothPath(coords) + ` L ${coords[coords.length - 1][0]},${bottomY} L ${coords[0][0]},${bottomY} Z`;
}

const formatVal = v => {
  if (v == null) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (v % 1 === 0) return `${v}`;
  return v.toFixed(1);
};

export default function Sparkline({ points = [], color = '#c9d7f8', height = 56, showLabels = false, variant = 'line', incidents = [], annotations = [], maintenanceWindows = [], changelogEntries = [] }) {
  const [tooltip, setTooltip] = useState(null);
  const [clTooltip, setClTooltip] = useState(null);

  const values = points.map(p => p.value).filter(v => v != null);
  if (values.length < 2) return null;

  const W = 400, H = height;
  const PAD_LEFT = showLabels ? 38 : 4;
  const PAD_RIGHT = 6;
  const PAD_TOP = 10;
  const PAD_BOTTOM = showLabels ? 22 : 4;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const min = dataMax === dataMin ? 0 : dataMin;
  const max = dataMax === dataMin ? (dataMax > 0 ? dataMax * 1.5 : 1) : dataMax;
  const range = max - min || 1;

  const valid = points.filter(p => p.value != null);
  const toX = vi => valid.length <= 1 ? 0 : (vi / (valid.length - 1)) * innerW;
  const toY = v => PAD_TOP + innerH - ((v - min) / range) * innerH;

  // Segments (handle null gaps)
  const segments = [];
  let current = [];
  let vi = 0;
  for (const p of points) {
    if (p.value != null) {
      current.push({ p, vi: vi++ });
    } else {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);

  // Dashed bridges connecting end of one segment to start of next
  const bridges = segments.slice(0, -1).map((seg, i) => {
    const last = seg[seg.length - 1];
    const first = segments[i + 1][0];
    return {
      x1: toX(last.vi),  y1: toY(last.p.value),
      x2: toX(first.vi), y2: toY(first.p.value),
    };
  });

  const gradId = `sg-${color.replace('#', '')}-${H}`;

  // Y ticks
  const yTicks = Array.from({ length: 3 }, (_, i) => {
    const frac = i / 2;
    return { val: max - frac * range, y: PAD_TOP + frac * innerH };
  });

  // Error dots
  const errorCoords = valid
    .map((p, vi) => ({ p, vi }))
    .filter(({ p }) => ['error', 'offline', 'warning'].includes(p.status))
    .map(({ p, vi }) => [toX(vi), toY(p.value), p.status]);

  // Time range
  const tFirst = valid.length > 0 ? new Date(valid[0].ts).getTime() : null;
  const tLast  = valid.length > 0 ? new Date(valid[valid.length - 1].ts).getTime() : null;
  const tRange = tFirst && tLast && tLast > tFirst ? tLast - tFirst : null;
  const tsToX  = ts => tRange ? Math.max(0, Math.min(innerW, ((new Date(ts).getTime() - tFirst) / tRange) * innerW)) : null;

  // X-axis time labels (4 ticks)
  const xTicks = showLabels && tRange ? [0, 1, 2, 3].map(i => {
    const frac = i / 3;
    const ts = new Date(tFirst + frac * tRange);
    const label = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { x: frac * innerW, label };
  }) : [];

  // Incident shading
  const incidentRects = tRange ? incidents.map(inc => {
    const x1 = tsToX(inc.startedAt);
    const x2 = tsToX(inc.resolvedAt || Date.now());
    if (x1 == null || x2 == null || x2 <= x1) return null;
    return { x: x1, w: Math.max(x2 - x1, 2), key: inc._id };
  }).filter(Boolean) : [];

  // Maintenance window shading
  const maintenanceRects = tRange ? maintenanceWindows.map(w => {
    const x1 = tsToX(w.startedAt);
    const x2 = tsToX(w.endedAt || Date.now());
    if (x1 == null || x2 == null || x2 <= x1) return null;
    return { x: x1, w: Math.max(x2 - x1, 2), key: w._id };
  }).filter(Boolean) : [];

  // Annotation lines
  const annotationLines = tRange ? annotations.map(a => {
    const x = tsToX(a.ts);
    return x != null ? { x, label: a.label, id: a._id } : null;
  }).filter(Boolean) : [];

  // Changelog markers
  const changelogLines = tRange ? changelogEntries.map(c => {
    const x = tsToX(c.deployedAt);
    return x != null ? { x, version: c.version, description: c.description, id: c._id } : null;
  }).filter(Boolean) : [];

  // Hover tooltip
  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xFrac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(xFrac * (valid.length - 1));
    const pt = valid[Math.max(0, Math.min(valid.length - 1, idx))];
    if (!pt) return;
    setTooltip({
      value: pt.value,
      ts: pt.ts,
      status: pt.status,
      xPct: xFrac * 100,
      x: toX(idx),
      y: toY(pt.value),
    });
  }

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {/* Y-axis labels */}
      {showLabels && (
        <div className="absolute top-0 left-0 flex flex-col justify-between pointer-events-none"
          style={{ width: PAD_LEFT - 4, top: PAD_TOP, bottom: PAD_BOTTOM }}>
          {yTicks.map(({ val }, i) => (
            <span key={i} className="block text-right leading-none"
              style={{ fontSize: 9, color: 'currentColor', opacity: 0.25 }}>
              {formatVal(val)}
            </span>
          ))}
        </div>
      )}

      {/* Changelog tooltip */}
      {clTooltip && !tooltip && (
        <div className="pointer-events-none absolute z-10 px-2 py-1.5 rounded text-xs bg-surface border border-green-500/30 shadow-lg whitespace-nowrap"
          style={{ left: `clamp(0%, ${(clTooltip.x / (W - PAD_LEFT)) * 100}%, calc(100% - 140px))`, top: 0, transform: 'translateX(-50%)' }}>
          <span className="font-semibold text-green-400">{clTooltip.version}</span>
          {clTooltip.description && <span className="text-muted ml-1.5">{clTooltip.description}</span>}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 px-2 py-1 rounded text-xs bg-surface border border-border shadow-lg whitespace-nowrap"
          style={{
            left: `clamp(0%, ${tooltip.xPct}%, calc(100% - 120px))`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="font-mono font-semibold text-thistle">{formatVal(tooltip.value)}</span>
          {tooltip.ts && (
            <span className="text-muted ml-1.5">
              {new Date(tooltip.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {['error', 'offline'].includes(tooltip.status) && (
            <span className="ml-1.5 text-red-400">●</span>
          )}
          {tooltip.status === 'warning' && (
            <span className="ml-1.5 text-amber-400">●</span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W - PAD_LEFT} ${H}`}
        className="absolute top-0 right-0"
        style={{ left: showLabels ? PAD_LEFT : 0, height, width: showLabels ? `calc(100% - ${PAD_LEFT}px)` : '100%' }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
            <stop offset="70%"  stopColor={color} stopOpacity="0.07" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line key={i} x1={0} y1={y} x2={innerW} y2={y}
            stroke="currentColor" strokeOpacity="0.04" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}

        {/* X-axis time labels */}
        {xTicks.map(({ x, label }, i) => (
          <text key={i} x={x} y={H - 4} fontSize="8" textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}
            fill="currentColor" opacity="0.35">{label}</text>
        ))}

        {/* Maintenance window shaded regions */}
        {maintenanceRects.map(r => (
          <rect key={r.key} x={r.x} y={PAD_TOP} width={r.w} height={innerH}
            fill="rgba(251,191,36,0.12)" />
        ))}

        {/* Incident shaded regions */}
        {incidentRects.map(r => (
          <rect key={r.key} x={r.x} y={PAD_TOP} width={r.w} height={innerH}
            fill="rgba(248,113,113,0.10)" />
        ))}

        {/* Annotation vertical lines */}
        {annotationLines.map(a => (
          <g key={a.id}>
            <line x1={a.x} y1={PAD_TOP} x2={a.x} y2={PAD_TOP + innerH}
              stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
            <text x={a.x + 3} y={PAD_TOP + 9} fontSize="8" fill="#a78bfa" opacity="0.9">
              {a.label.length > 18 ? a.label.slice(0, 17) + '…' : a.label}
            </text>
          </g>
        ))}

        {/* Changelog version markers */}
        {changelogLines.map(c => (
          <g key={c.id}
            onMouseEnter={() => setClTooltip(c)}
            onMouseLeave={() => setClTooltip(null)}
            style={{ cursor: 'default' }}>
            <line x1={c.x} y1={PAD_TOP} x2={c.x} y2={PAD_TOP + innerH}
              stroke="#4ade80" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {/* Diamond marker at top */}
            <polygon
              points={`${c.x},${PAD_TOP - 1} ${c.x + 4},${PAD_TOP + 4} ${c.x},${PAD_TOP + 9} ${c.x - 4},${PAD_TOP + 4}`}
              fill="#4ade80" opacity="0.9" />
            <text x={c.x + 6} y={PAD_TOP + 9} fontSize="8" fill="#4ade80" opacity="0.9" fontWeight="600">
              {c.version.length > 10 ? c.version.slice(0, 9) + '…' : c.version}
            </text>
          </g>
        ))}

        {variant === 'bar' ? (
          <>
            {valid.map((p, vi) => {
              const barW = Math.max(1, (innerW / valid.length) * 0.65);
              const x    = toX(vi) - barW / 2;
              const y    = toY(p.value);
              const barH = PAD_TOP + innerH - y;
              const isErr  = p.status === 'error' || p.status === 'offline';
              const isWarn = p.status === 'warning';
              const fill = isErr ? '#f87171' : isWarn ? '#fbbf24' : color;
              const opacity = isErr || isWarn ? 0.85 : 0.7;
              return (
                <rect key={vi} x={x} y={y} width={barW} height={Math.max(barH, 1)}
                  fill={fill} fillOpacity={opacity} rx="1.5" />
              );
            })}
            {tooltip && (
              <line x1={tooltip.x} y1={PAD_TOP} x2={tooltip.x} y2={PAD_TOP + innerH}
                stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            )}
          </>
        ) : (
          <>
            {/* Area fill + smooth line per segment */}
            {segments.map((seg, si) => {
              const coords = seg.map(({ p, vi }) => [toX(vi), toY(p.value)]);
              return (
                <g key={si}>
                  <path d={smoothArea(coords, PAD_TOP + innerH)} fill={`url(#${gradId})`} />
                  <path d={smoothPath(coords)} fill="none" stroke={color}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}

            {/* Dashed bridges through null gaps */}
            {bridges.map((b, i) => (
              <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
                stroke={color} strokeWidth="1.5" strokeDasharray="4,4"
                strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
            ))}

            {/* Error/warning dots */}
            {errorCoords.map(([x, y, status], i) => (
              <circle key={i} cx={x} cy={y} r="3"
                fill={status === 'warning' ? '#fbbf24' : '#f87171'}
                stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
            ))}

            {/* Hover crosshair + dot */}
            {tooltip && (
              <g>
                <line x1={tooltip.x} y1={PAD_TOP} x2={tooltip.x} y2={PAD_TOP + innerH}
                  stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <circle cx={tooltip.x} cy={tooltip.y} r="3.5"
                  fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
              </g>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
