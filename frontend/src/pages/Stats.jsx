import React, { useState, useEffect, useMemo } from 'react';
import { stats as api, incidents as incidentsApi } from '../api';
import { useLang } from '../context/LangContext';
import { Radio, AlertTriangle, CheckCircle, Clock, Timer, Eye, Bell, Wrench, ShieldAlert } from 'lucide-react';

function duration(ms) {
  if (!ms) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}min` : `${h}h`;
}

function StatCard({ icon: Icon, label, value, color = 'text-thistle' }) {
  return (
    <div className="card flex items-center gap-3 py-3 px-4">
      <Icon size={18} className={`shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value ?? '—'}</p>
      </div>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (trend == null) return null;
  if (trend > 2)  return <span className="text-xs font-mono text-celadon w-14 text-right shrink-0">↑ +{trend}%</span>;
  if (trend < -2) return <span className="text-xs font-mono text-red-400 w-14 text-right shrink-0">↓ {trend}%</span>;
  return <span className="text-xs font-mono text-muted w-14 text-right shrink-0">→</span>;
}

function SlaBadge({ slaMet, slaTarget }) {
  if (slaMet === null || slaTarget == null) return null;
  return slaMet
    ? <span className="hidden sm:block text-xs font-mono text-celadon w-20 text-right shrink-0" title={`SLA ${slaTarget}%`}>✓ {slaTarget}%</span>
    : <span className="hidden sm:block text-xs font-mono text-red-400 w-20 text-right shrink-0" title={`SLA ${slaTarget}%`}>✗ {slaTarget}%</span>;
}

function UptimeRow({ monitor, lang }) {
  const uptime    = monitor.uptime;
  const uptimeAdj = monitor.uptimeAdj;
  const display   = uptimeAdj ?? uptime;
  const hasMaint  = monitor.maintenanceCount > 0 && uptimeAdj != null && uptimeAdj !== uptime;
  const color     = display == null ? 'bg-granite/30'   : display >= 99 ? 'bg-celadon/70'   : display >= 90 ? 'bg-amber-400/70' : 'bg-red-400/70';
  const textColor = display == null ? 'text-muted'       : display >= 99 ? 'text-celadon'     : display >= 90 ? 'text-amber-400'  : 'text-red-400';

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-thistle truncate flex-1 min-w-0">{monitor.name}</span>
      {hasMaint && (
        <span className="hidden sm:flex items-center gap-1 text-[10px] text-amber-400/70 shrink-0" title={lang === 'fr' ? `Brut : ${uptime}%` : `Raw: ${uptime}%`}>
          <Wrench size={10} />
          {uptime}%
        </span>
      )}
      <div className="w-32 h-2 bg-granite-3 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${display ?? 0}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right shrink-0 ${textColor}`}>
        {display != null ? `${display}%` : '—'}
      </span>
      <SlaBadge slaMet={monitor.slaMet} slaTarget={monitor.slaTarget} />
    </div>
  );
}

function IncidentBarChart({ incidentsByDay, lang }) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const [tooltip, setTooltip] = useState(null);

  const days = useMemo(() => {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      result.push({ key, date: d, count: incidentsByDay[key] || 0 });
    }
    return result;
  }, [incidentsByDay]);

  const maxCount = Math.max(...days.map(d => d.count), 1);
  const hasData = days.some(d => d.count > 0);

  return (
    <div className="card px-4 py-3 relative" onMouseLeave={() => setTooltip(null)}>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 px-2 py-1 rounded text-xs text-thistle bg-surface border border-border shadow-lg whitespace-nowrap"
          style={{ left: `${tooltip.pct}%`, top: '4px', transform: 'translate(-50%, 0)' }}
        >
          <span className="font-semibold">{tooltip.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
          {' — '}
          {tooltip.count} incident{tooltip.count > 1 ? 's' : ''}
        </div>
      )}
      <div className="flex items-end gap-0.5 h-16 mt-6">
        {days.map((day, i) => (
          <div
            key={day.key}
            className="flex-1 flex flex-col justify-end h-full"
            onMouseEnter={() => day.count > 0 && setTooltip({ ...day, pct: ((i + 0.5) / 30) * 100 })}
          >
            <div
              className={`w-full rounded-sm transition-colors ${
                day.count === 0
                  ? 'bg-granite/20'
                  : 'bg-red-400/60 hover:bg-red-400/90'
              }`}
              style={{ height: day.count === 0 ? '3px' : `${Math.max((day.count / maxCount) * 100, 10)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted/60 mt-1.5">
        <span>{days[0].date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
        <span>{days[14].date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
        <span>{lang === 'fr' ? "auj." : "today"}</span>
      </div>
      {!hasData && (
        <p className="text-xs text-muted/50 text-center mt-2">—</p>
      )}
    </div>
  );
}

function Heatmap({ incidents, lang }) {
  const days = lang === 'fr'
    ? ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
    : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const [tooltip, setTooltip] = useState(null);

  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const inc of incidents) {
      const d = new Date(inc.startedAt);
      const day = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      g[day][hour]++;
    }
    return g;
  }, [incidents]);

  const maxCount = useMemo(() => Math.max(...grid.flat(), 1), [grid]);

  return (
    <div className="card px-4 py-3 overflow-x-auto relative">
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 px-2 py-1 rounded text-xs text-thistle bg-surface border border-border shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -110%)' }}
        >
          <span className="font-semibold">{tooltip.day} {tooltip.hour}h</span>
          {' — '}
          {tooltip.count} incident{tooltip.count > 1 ? 's' : ''}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2rem repeat(24, 1fr)', gap: '2px', minWidth: '480px' }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center" style={{ fontSize: '9px', color: 'var(--color-muted, #888)' }}>
            {h % 3 === 0 ? `${h}h` : ''}
          </div>
        ))}
        {grid.map((row, dayIdx) => (
          <React.Fragment key={dayIdx}>
            <div className="flex items-center justify-end pr-1" style={{ fontSize: '10px', color: 'var(--color-muted, #888)' }}>
              {days[dayIdx]}
            </div>
            {row.map((count, hour) => {
              const intensity = count === 0 ? 0 : 0.15 + (count / maxCount) * 0.85;
              const bg = count === 0
                ? 'rgba(96,165,250,0.07)'
                : `rgba(228,87,87,${intensity.toFixed(2)})`;
              return (
                <div
                  key={hour}
                  style={{ background: bg, borderRadius: '2px', height: '22px', cursor: count > 0 ? 'default' : undefined }}
                  onMouseEnter={count > 0 ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const parent = e.currentTarget.closest('.card').getBoundingClientRect();
                    setTooltip({ day: days[dayIdx], hour, count, x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top });
                  } : undefined}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function Stats() {
  const { t, lang } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allIncidents, setAllIncidents] = useState([]);

  useEffect(() => {
    api.get().then(setData).catch(() => {}).finally(() => setLoading(false));
    incidentsApi.list({ limit: 1000 }).then(setAllIncidents).catch(() => {});
  }, []);

  if (loading) return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in-up">
      <div><div className="skeleton h-7 w-40 rounded mb-1" /><div className="skeleton h-3.5 w-56 rounded" /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map(i => <div key={i} className="card flex items-center gap-3 py-3 px-4"><div className="skeleton w-5 h-5 rounded" /><div className="space-y-1.5"><div className="skeleton h-2.5 w-14 rounded" /><div className="skeleton h-6 w-10 rounded" /></div></div>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map(i => <div key={i} className="card flex items-center gap-3 py-3 px-4"><div className="skeleton w-5 h-5 rounded" /><div className="space-y-1.5"><div className="skeleton h-2.5 w-14 rounded" /><div className="skeleton h-6 w-10 rounded" /></div></div>)}</div>
      <div className="card px-4 py-3"><div className="skeleton h-16 w-full rounded" /></div>
      <div className="card px-4 divide-y divide-border">{[0,1,2,3,4].map(i => <div key={i} className="flex items-center gap-3 py-2.5"><div className="skeleton flex-1 h-3 rounded" /><div className="skeleton w-32 h-2 rounded-full" /><div className="skeleton w-10 h-3 rounded" /><div className="skeleton w-14 h-3 rounded" /></div>)}</div>
    </div>
  );
  if (!data) return <div className="p-6 text-red-400 text-sm">Erreur de chargement</div>;

  const past30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const heatmapIncidents = allIncidents.filter(i => new Date(i.startedAt) >= past30);

  const { monitors, incidents, incidentsByDay, uptimeByMonitor, logsByLevel, maintenance,
          sslExpiring, mostUnstable, incidentDurationDist, responseTimePercentiles, notifDeliveryRate } = data;
  const totalSev    = Object.values(incidents.severityCount || {}).reduce((s, v) => s + v, 0);
  const totalNotifs = Object.values(logsByLevel).reduce((s, v) => s + v, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('stats.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">{t('stats.subtitle')}</p>
      </div>

      {/* Monitors */}
      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.monitors')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Radio}         label={t('dashboard.stats.total')}    value={monitors.total}    color="text-periwinkle" />
          <StatCard icon={CheckCircle}   label={t('stats.online')}             value={monitors.online}   color="text-celadon" />
          <StatCard icon={AlertTriangle} label={t('stats.alerting')}           value={monitors.alerting} color="text-amber-400" />
          <StatCard icon={Clock}         label={t('stats.disabled')}           value={monitors.total - monitors.enabled} color="text-muted" />
        </div>
      </div>

      {/* Uptime par monitor */}
      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.uptimeTitle')}</h2>
        {uptimeByMonitor.length === 0 ? (
          <p className="text-sm text-muted">{t('stats.noData')}</p>
        ) : (
          <div className="card px-4 divide-y divide-border">
            {uptimeByMonitor.map(m => <UptimeRow key={m.id} monitor={m} lang={lang} />)}
          </div>
        )}
      </div>

      {/* SSL certificates */}
      {sslExpiring && sslExpiring.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.sslExpiryTitle')}</h2>
          <div className="card px-4 divide-y divide-border">
            {sslExpiring.map(m => {
              const urgent = m.daysLeft <= 0;
              const warn   = m.daysLeft <= 7;
              const soon   = m.daysLeft <= 30;
              const color     = urgent ? 'text-red-400'  : warn ? 'text-amber-400' : soon ? 'text-thistle' : 'text-celadon';
              const barColor  = urgent ? '#f87171'        : warn ? '#fbbf24'        : soon ? '#c4b5fd'      : '#34d399';
              const pct       = urgent ? 0 : Math.min(100, Math.round((m.daysLeft / 90) * 100));
              const expDate = m.expiresAt
                ? new Date(m.expiresAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <ShieldAlert size={14} className={`shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-thistle truncate">{m.name}</p>
                    {expDate && <p className="text-xs text-muted">{expDate}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-32 h-2 bg-granite-3 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.85 }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold w-14 text-right" style={{ color: barColor }}>
                      {m.daysLeft <= 0 ? (lang === 'fr' ? 'Expiré' : 'Expired') : `${m.daysLeft}j`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Response time percentiles */}
      {responseTimePercentiles && responseTimePercentiles.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.responseTimeTitle')}</h2>
          <div className="card px-4 py-3 overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="text-muted">
                  <th className="text-left font-normal pb-2 w-full">{lang === 'fr' ? 'Service' : 'Service'}</th>
                  <th className="text-right font-semibold pb-2 pl-4 shrink-0">P50</th>
                  <th className="text-right font-semibold pb-2 pl-4 shrink-0">P95</th>
                  <th className="text-right font-semibold pb-2 pl-4 shrink-0">P99</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {responseTimePercentiles.map(m => {
                  const p99Color = m.p99 > 2000 ? 'text-red-400' : m.p99 > 1000 ? 'text-amber-400' : 'text-celadon';
                  return (
                    <tr key={m.id}>
                      <td className="py-1.5 text-thistle truncate max-w-[140px]">{m.name}</td>
                      <td className="py-1.5 pl-4 text-right font-mono text-muted">{m.p50 != null ? `${m.p50}ms` : '—'}</td>
                      <td className="py-1.5 pl-4 text-right font-mono text-muted">{m.p95 != null ? `${m.p95}ms` : '—'}</td>
                      <td className={`py-1.5 pl-4 text-right font-mono font-semibold ${p99Color}`}>{m.p99 != null ? `${m.p99}ms` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance */}
      {maintenance && maintenance.totalWindows > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{lang === 'fr' ? 'Maintenance (30j)' : 'Maintenance (30d)'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Wrench} label={lang === 'fr' ? 'Fenêtres' : 'Windows'} value={maintenance.totalWindows} color="text-amber-400" />
            <StatCard icon={Clock}  label={lang === 'fr' ? 'Temps total' : 'Total time'} value={
              maintenance.totalMinutes >= 60
                ? `${Math.floor(maintenance.totalMinutes / 60)}h ${maintenance.totalMinutes % 60}min`
                : `${maintenance.totalMinutes}min`
            } color="text-amber-400" />
          </div>
          {uptimeByMonitor.some(m => m.maintenanceCount > 0) && (
            <div className="card px-4 py-3 mt-3 space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">{lang === 'fr' ? 'Par service' : 'Per service'}</p>
              {uptimeByMonitor.filter(m => m.maintenanceCount > 0).map(m => (
                <div key={m.id} className="flex items-center gap-3 text-xs">
                  <span className="text-thistle truncate flex-1 min-w-0">{m.name}</span>
                  <span className="text-muted shrink-0">{m.maintenanceCount} {lang === 'fr' ? (m.maintenanceCount > 1 ? 'fenêtres' : 'fenêtre') : (m.maintenanceCount > 1 ? 'windows' : 'window')}</span>
                  <span className="text-amber-400 font-mono shrink-0 w-16 text-right">
                    {m.maintenanceMinutes >= 60
                      ? `${Math.floor(m.maintenanceMinutes / 60)}h ${m.maintenanceMinutes % 60}min`
                      : `${m.maintenanceMinutes}min`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incidents */}
      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.incidents')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={AlertTriangle} label={t('stats.open')}     value={incidents.open}     color={incidents.open > 0 ? 'text-red-400' : 'text-muted'} />
          <StatCard icon={CheckCircle}   label={t('stats.resolved')} value={incidents.resolved} color="text-celadon" />
          <StatCard icon={Timer}         label="MTTR"                value={duration(incidents.mttr)} />
          <StatCard icon={Eye}           label={t('stats.mttn')}     value={duration(incidents.mttn)} color="text-periwinkle" />
        </div>

        {totalSev > 0 && (
          <div className="card px-4 py-3 mt-3 space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('stats.severityBreakdown')}</p>
            {[
              { key: 'P1', color: 'bg-red-400',    label: t('stats.severity.P1') },
              { key: 'P2', color: 'bg-amber-400',  label: t('stats.severity.P2') },
              { key: 'P3', color: 'bg-periwinkle', label: t('stats.severity.P3') },
              { key: 'P4', color: 'bg-granite',    label: t('stats.severity.P4') },
            ].map(({ key, color }) => {
              const count = incidents.severityCount?.[key] || 0;
              const mttr  = incidents.mttrBySeverity?.[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={`text-xs font-semibold w-6 shrink-0 ${color.replace('bg-','text-')}`}>{key}</span>
                  <div className="flex-1 h-1.5 bg-granite-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: totalSev > 0 ? `${(count / totalSev) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-xs text-muted w-4 text-right shrink-0">{count}</span>
                  {mttr
                    ? <span className="text-xs text-muted/50 w-20 text-right shrink-0">MTTR {duration(mttr)}</span>
                    : <span className="w-20 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Most Unstable */}
      {mostUnstable && mostUnstable.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.mostUnstableTitle')}</h2>
          <div className="card px-4 py-3 space-y-2">
            {(() => {
              const max = mostUnstable[0]?.count || 1;
              return mostUnstable.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-sm text-thistle truncate w-36 min-w-0 shrink-0">{m.name}</span>
                  <div className="flex-1 h-2 bg-granite-3 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-400/60" style={{ width: `${(m.count / max) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-muted shrink-0 text-right">
                    {m.count} incident{m.count > 1 ? 's' : ''}
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Incident duration distribution */}
      {incidentDurationDist && incidents.resolved > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.incidentDurationTitle')}</h2>
          <div className="card px-4 py-3 space-y-2">
            {[
              { key: 'short',    label: t('stats.durationShort'),    color: 'bg-celadon' },
              { key: 'medium',   label: t('stats.durationMedium'),   color: 'bg-amber-400' },
              { key: 'long',     label: t('stats.durationLong'),     color: 'bg-red-400/70' },
              { key: 'critical', label: t('stats.durationCritical'), color: 'bg-red-600' },
            ].map(({ key, label, color }) => {
              const count = incidentDurationDist[key] || 0;
              const total = incidents.resolved;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-granite-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-xs font-mono text-muted w-6 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incidents per day */}
      {incidentsByDay && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.incidentsByDayTitle')}</h2>
          <IncidentBarChart incidentsByDay={incidentsByDay} lang={lang} />
        </div>
      )}

      {/* Heatmap */}
      {heatmapIncidents.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.heatmapTitle')}</h2>
          <Heatmap incidents={heatmapIncidents} lang={lang} />
        </div>
      )}

      {/* Notifications */}
      <div>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('stats.notifications')}</h2>
        <div className="card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t('stats.total')}</span>
            <div className="flex items-center gap-3">
              {notifDeliveryRate != null && (
                <span className={`text-xs font-mono ${notifDeliveryRate >= 95 ? 'text-celadon' : notifDeliveryRate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                  {t('stats.deliveryRate')} {notifDeliveryRate}%
                </span>
              )}
              <span className="font-bold text-thistle">{totalNotifs}</span>
            </div>
          </div>
          {Object.entries(logsByLevel).map(([level, count]) => (
            <div key={level} className="flex items-center gap-3">
              <span className="text-xs text-muted w-16 capitalize">{level}</span>
              <div className="flex-1 h-1.5 bg-granite-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  level === 'error'   ? 'bg-red-400' :
                  level === 'warning' ? 'bg-amber-400' :
                  level === 'success' ? 'bg-celadon' :
                  'bg-periwinkle/50'
                }`} style={{ width: totalNotifs > 0 ? `${(count / totalNotifs) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs font-mono text-muted w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
