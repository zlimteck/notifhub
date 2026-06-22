import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { incidents as api, monitors as monitorsApi } from '../api';
import { useLang } from '../context/LangContext';
import { X, GitBranch } from 'lucide-react';
import Portal from '../components/Portal';
import ServiceDetail from '../components/ServiceDetail';

const SEV_STYLE = {
  P1: 'text-red-400 bg-red-900/30 border-red-900/40',
  P2: 'text-amber-400 bg-amber-900/30 border-amber-900/40',
  P3: 'text-periwinkle bg-blue-900/20 border-blue-900/30',
  P4: 'text-muted bg-granite/20 border-granite/30',
};

function duration(ms) {
  if (ms == null || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

function computeUptime(segments, windowStart, windowEnd) {
  const totalMs = windowEnd - windowStart;
  if (!totalMs || !segments.length) return 100;
  const onlineMs = segments
    .filter(s => s.status === 'online')
    .reduce((sum, s) => sum + (s.end - s.start), 0);
  return Math.round((onlineMs / totalMs) * 100);
}

function segmentColor(status) {
  if (status === 'online') return 'bg-celadon/25 hover:bg-celadon/35';
  if (status === 'warning') return 'bg-amber-400/50 hover:bg-amber-400/65 cursor-pointer';
  return 'bg-red-500/55 hover:bg-red-500/70 cursor-pointer';
}

function segmentBorder(status) {
  if (status === 'online') return '';
  if (status === 'warning') return 'border border-amber-400/50';
  return 'border border-red-500/50';
}

function IncidentPopup({ seg, windowStart, windowEnd, monitorName, onClose, lang }) {
  const { t } = useLang();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const isOngoing = seg.end >= windowEnd - 1000;
  const durMs = seg.end - seg.start;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
            <div>
              <h2 className="font-semibold text-thistle text-sm">{t('timeline.incidentDetail')}</h2>
              <p className="text-xs text-muted mt-0.5">{monitorName}</p>
            </div>
            <button onClick={onClose} className="p-1 text-muted hover:text-thistle transition-colors">
              <X size={15} />
            </button>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <Row label={t('timeline.incidentStatus')}>
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                seg.status === 'warning'
                  ? 'text-amber-400 bg-amber-900/30'
                  : 'text-red-400 bg-red-900/30'
              }`}>
                {seg.status}
              </span>
            </Row>
            {seg.severity && (
              <Row label={t('timeline.incidentSeverity')}>
                <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${SEV_STYLE[seg.severity] || SEV_STYLE.P3}`}>
                  {seg.severity}
                </span>
              </Row>
            )}
            <Row label={t('timeline.incidentStart')}>
              {new Date(seg.start).toLocaleString(locale)}
            </Row>
            <Row label={t('timeline.incidentEnd')}>
              {isOngoing
                ? <span className="text-red-400">{t('timeline.ongoing')}</span>
                : new Date(seg.end).toLocaleString(locale)}
            </Row>
            <Row label={t('timeline.incidentDuration')}>
              {duration(durMs) || '< 1s'}
            </Row>
            {seg.reason && (
              <Row label={t('timeline.incidentReason')}>
                <span className="text-red-300/80">{seg.reason}</span>
              </Row>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted text-xs w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-thistle text-xs flex-1">{children}</span>
    </div>
  );
}

// Shared column widths — must match between TimeAxis and MonitorRow
const NAME_W = 'w-20 sm:w-28 md:w-36';
const UPTIME_W = 'w-8 sm:w-10';
const DOT_W = 'w-2';

function TimeAxis({ windowStart, windowEnd, hours, lang }) {
  const totalMs = windowEnd - windowStart;
  const ticks = 3; // 4 labels (start + 3 intervals) — legible on mobile and desktop
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  return (
    <div className="flex items-center gap-2">
      <div className={`${NAME_W} shrink-0`} />
      <div className="flex-1 relative h-5">
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const pct = (i / ticks) * 100;
          const ts = new Date(windowStart + (i / ticks) * totalMs);
          const label = hours <= 24
            ? ts.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            : ts.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
          return (
            <span
              key={i}
              className="absolute text-[10px] text-muted/60 transform -translate-x-1/2"
              style={{ left: `${pct}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className={`${UPTIME_W} shrink-0`} />
      <div className={`${DOT_W} shrink-0`} />
    </div>
  );
}

function MonitorRow({ row, windowStart, windowEnd, onSegmentClick, onNameClick }) {
  const totalMs = windowEnd - windowStart;
  const uptime = computeUptime(row.segments, windowStart, windowEnd);
  const uptimeColor = uptime >= 99 ? 'text-celadon' : uptime >= 95 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2 min-h-[30px] group">
      {/* Name — clickable */}
      <button
        className={`${NAME_W} shrink-0 text-[11px] text-thistle/70 hover:text-periwinkle truncate pr-1 text-right transition-colors leading-tight`}
        title={row.monitorName}
        onClick={() => onNameClick(row.monitorId)}
      >
        {row.monitorName}
      </button>

      {/* Segments bar + now marker */}
      <div className="flex-1 relative">
        <div className="flex h-6 rounded overflow-hidden gap-px bg-surface/50">
          {row.segments.map((seg, i) => {
            const widthPct = ((seg.end - seg.start) / totalMs) * 100;
            if (widthPct < 0.05) return null;
            const isIncident = seg.status !== 'online';
            return (
              <div
                key={i}
                title={isIncident ? `${seg.status} — ${duration(seg.end - seg.start) || '< 1s'}` : undefined}
                className={`h-full transition-colors ${segmentColor(seg.status)} ${segmentBorder(seg.status)}`}
                style={{ width: `${widthPct}%`, minWidth: isIncident ? '2px' : undefined }}
                onClick={isIncident ? () => onSegmentClick(seg, row.monitorName) : undefined}
              />
            );
          })}
          {row.segments.length === 0 && (
            <div className="flex-1 h-full bg-muted/10" />
          )}
        </div>
        {/* Now marker */}
        <div className="absolute top-0 right-0 h-full flex items-center pointer-events-none">
          <div className="w-0.5 h-4 bg-periwinkle/50 rounded-full" />
        </div>
      </div>

      {/* Uptime % */}
      <div className={`${UPTIME_W} shrink-0 text-right text-[11px] font-mono font-medium ${uptimeColor}`}>
        {uptime}%
      </div>

      {/* Current status dot */}
      <div
        className={`${DOT_W} h-2 rounded-full shrink-0 ${
          row.currentStatus === 'online'  ? 'bg-celadon' :
          row.currentStatus === 'warning' ? 'bg-amber-400' :
          ['error','offline'].includes(row.currentStatus) ? 'bg-red-400' :
          'bg-muted/40'
        }`}
        title={row.currentStatus}
      />
    </div>
  );
}

function CategorySection({ label, rows, windowStart, windowEnd, onSegmentClick, onNameClick }) {
  return (
    <div>
      {label && (
        <div className="flex items-center gap-3 mb-1 mt-3 first:mt-0">
          <span className="text-xs text-muted/60 font-medium whitespace-nowrap">{label}</span>
          <div className="flex-1 h-px bg-border/60" />
        </div>
      )}
      <div className="space-y-1">
        {rows.map(row => (
          <MonitorRow
            key={row.monitorId}
            row={row}
            windowStart={windowStart}
            windowEnd={windowEnd}
            onSegmentClick={onSegmentClick}
            onNameClick={onNameClick}
          />
        ))}
      </div>
    </div>
  );
}

const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23626273' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.4rem center',
  backgroundSize: '1.1em 1.1em',
};

export default function Timeline() {
  const { t, lang } = useLang();
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [activeSegment, setActiveSegment] = useState(null);
  const [detailMonitor, setDetailMonitor] = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.timeline(hours)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hours]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    load();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(load, 60000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  async function handleNameClick(monitorId) {
    try {
      const m = await monitorsApi.get(monitorId);
      setDetailMonitor(m);
    } catch {}
  }

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = [...new Set(data.rows.map(r => r.category || ''))].sort();
    return cats;
  }, [data]);

  const hasCategories = categories.some(c => c !== '');

  const groupedRows = useMemo(() => {
    if (!data) return [];
    const rows = filterCategory
      ? (filterCategory === '__none__'
          ? data.rows.filter(r => !r.category)
          : data.rows.filter(r => r.category === filterCategory))
      : data.rows;

    if (!hasCategories) return [{ label: null, rows }];

    const groups = {};
    for (const row of rows) {
      const key = row.category || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (!a) return 1;
        if (!b) return -1;
        return a.localeCompare(b);
      })
      .map(([key, rows]) => ({
        label: key || t('timeline.uncategorized'),
        rows,
      }));
  }, [data, filterCategory, hasCategories, t]);

  const windowStart = data ? new Date(data.windowStart).getTime() : 0;
  const windowEnd   = data ? new Date(data.windowEnd).getTime()   : 0;
  const totalRows   = groupedRows.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {activeSegment && (
        <IncidentPopup
          seg={activeSegment.seg}
          windowStart={windowStart}
          windowEnd={windowEnd}
          monitorName={activeSegment.monitorName}
          onClose={() => setActiveSegment(null)}
          lang={lang}
        />
      )}
      {detailMonitor && (
        <ServiceDetail monitor={detailMonitor} onClose={() => setDetailMonitor(null)} />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('timeline.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{t('timeline.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('timeline.allCategories')}</option>
          {categories.map(c => (
            <option key={c || '__none__'} value={c || '__none__'}>
              {c || t('timeline.uncategorized')}
            </option>
          ))}
        </select>
        <select
          value={hours}
          onChange={e => setHours(Number(e.target.value))}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value={24}>{t('timeline.last24h')}</option>
          <option value={168}>{t('timeline.last7d')}</option>
        </select>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-celadon/35 inline-block" />
          {t('status.online')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-400/50 inline-block" />
          {t('status.warning')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/55 inline-block" />
          {t('status.error')}
        </span>
        <span className="text-muted/60 ml-auto hidden sm:block">{t('timeline.clickDetail')}</span>
      </div>

      <div className="card p-4">
        {loading && (
          <div className="space-y-2 py-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className={`${NAME_W} shrink-0`}>
                  <div className="skeleton h-3 rounded w-3/4 ml-auto" />
                </div>
                <div className="flex-1 skeleton h-6 rounded" />
                <div className={`${UPTIME_W} skeleton h-3 rounded shrink-0`} />
                <div className={`${DOT_W} h-2 rounded-full skeleton shrink-0`} />
              </div>
            ))}
          </div>
        )}

        {!loading && totalRows === 0 && (
          <div className="text-center py-10">
            <GitBranch size={28} className="text-muted/40 mx-auto mb-3" />
            <p className="text-thistle font-medium text-sm">
              {data?.rows.length === 0 ? t('timeline.noMonitors') : t('timeline.noIncidents')}
            </p>
          </div>
        )}

        {!loading && totalRows > 0 && (
          <div className="space-y-0">
            <TimeAxis windowStart={windowStart} windowEnd={windowEnd} hours={hours} lang={lang} />
            <div className="mt-1">
              {groupedRows.map((group, gi) => (
                <CategorySection
                  key={group.label ?? gi}
                  label={hasCategories ? group.label : null}
                  rows={group.rows}
                  windowStart={windowStart}
                  windowEnd={windowEnd}
                  onSegmentClick={(seg, name) => setActiveSegment({ seg, monitorName: name })}
                  onNameClick={handleNameClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
