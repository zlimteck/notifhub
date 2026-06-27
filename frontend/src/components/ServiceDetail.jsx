import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Tag, Trash2, Wrench, GitCommitHorizontal, Pencil } from 'lucide-react';
import { history as historyApi, incidents as incidentsApi, annotations as annotationsApi, monitors as monitorsApi, changelog as changelogApi } from '../api';
import { useLang } from '../context/LangContext';
import Portal from './Portal';
import { getMetrics } from '../utils/metricConfig';
import ServiceIcon from './ServiceIcon';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';

const STATUS_COLOR = {
  online:  'bg-celadon',
  offline: 'bg-red-500',
  error:   'bg-red-500',
  warning: 'bg-amber-400',
  unknown: 'bg-granite/40',
};

function StatusTimeline({ points, period, lang }) {
  const [tooltip, setTooltip] = useState(null);
  if (!points || points.length === 0) return null;
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const periodLabel = period === 24 ? '−24h' : (lang === 'fr' ? '−7j' : '−7d');

  return (
    <div>
      <div className="relative">
        <div className="flex gap-px h-5 rounded overflow-hidden">
          {points.map((p, i) => (
            <div
              key={i}
              className={`flex-1 cursor-default transition-opacity hover:opacity-80 ${STATUS_COLOR[p.status] || 'bg-granite/40'}`}
              onMouseEnter={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const parent = e.currentTarget.closest('.relative').getBoundingClientRect();
                setTooltip({ x: rect.left - parent.left + rect.width / 2, label: p.status, ts: p.ts });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </div>
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 px-2 py-1 rounded text-xs bg-surface border border-border shadow-lg whitespace-nowrap -translate-x-1/2"
            style={{ left: tooltip.x, bottom: '110%' }}
          >
            <span className={`font-semibold ${STATUS_COLOR[tooltip.label]?.replace('bg-', 'text-') || 'text-muted'}`}>{tooltip.label}</span>
            <span className="text-muted ml-1.5">{new Date(tooltip.ts).toLocaleString(locale)}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>{periodLabel}</span>
        <span>{lang === 'fr' ? 'Maintenant' : 'Now'}</span>
      </div>
    </div>
  );
}

function UptimeBadge({ value, label }) {
  if (value == null) return null;
  const color = value >= 99 ? 'text-celadon' : value >= 95 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}%</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  );
}

function duration(ms) {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

export default function ServiceDetail({ monitor, onClose }) {
  const { t, lang } = useLang();
  const [hist, setHist] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState([]);
  const [changelogEntries, setChangelogEntries] = useState([]);
  const [period, setPeriod] = useState(24);
  const [tab, setTab] = useState('metrics');
  const [annLabel, setAnnLabel] = useState('');
  const [addingAnn, setAddingAnn] = useState(false);
  const [addingCl, setAddingCl] = useState(false);
  const [editingCl, setEditingCl] = useState(null);
  const [clForm, setClForm] = useState({ version: '', description: '', deployedAt: '' });

  const loadAnnotations = () => {
    const since = Date.now() - period * 3600 * 1000;
    annotationsApi.list(monitor._id, since).then(setAnnotations).catch(() => {});
  };

  const loadChangelog = () => {
    changelogApi.list(monitor._id).then(setChangelogEntries).catch(() => {});
  };

  useEffect(() => {
    historyApi.monitor(monitor._id, period).then(setHist).catch(() => {});
    incidentsApi.list({ monitorId: monitor._id, limit: 50 }).then(setIncidents).catch(() => {});
    loadAnnotations();
    loadChangelog();
  }, [monitor._id, period]);

  useEffect(() => {
    monitorsApi.maintenanceHistory(monitor._id).then(setMaintenanceWindows).catch(() => {});
  }, [monitor._id, monitor.maintenanceUntil]);

  useEffect(() => {
    if (tab === 'maintenance') {
      monitorsApi.maintenanceHistory(monitor._id).then(setMaintenanceWindows).catch(() => {});
    }
  }, [tab]);

  async function handleAddAnnotation(e) {
    e.preventDefault();
    if (!annLabel.trim()) return;
    await annotationsApi.create({ monitorId: monitor._id, label: annLabel.trim() });
    setAnnLabel('');
    setAddingAnn(false);
    loadAnnotations();
  }

  async function handleDeleteAnnotation(id) {
    await annotationsApi.delete(id);
    loadAnnotations();
  }

  function openAddCl() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setClForm({ version: '', description: '', deployedAt: local });
    setEditingCl(null);
    setAddingCl(true);
  }

  function openEditCl(entry) {
    const d = new Date(entry.deployedAt);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setClForm({ version: entry.version, description: entry.description || '', deployedAt: local });
    setEditingCl(entry);
    setAddingCl(true);
  }

  async function handleSaveCl(e) {
    e.preventDefault();
    if (!clForm.version.trim()) return;
    const payload = {
      monitorId: monitor._id,
      version: clForm.version.trim(),
      description: clForm.description.trim(),
      deployedAt: clForm.deployedAt ? new Date(clForm.deployedAt).toISOString() : new Date().toISOString(),
    };
    if (editingCl) {
      await changelogApi.update(editingCl._id, payload);
    } else {
      await changelogApi.create(payload);
    }
    setAddingCl(false);
    setEditingCl(null);
    loadChangelog();
  }

  async function handleDeleteCl(id) {
    await changelogApi.delete(id);
    loadChangelog();
  }

  const sparkColor = monitor.status === 'online' ? '#c9d7f8' : monitor.status === 'warning' ? '#fbbf24' : '#f87171';
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  const availableMetrics = getMetrics(monitor.type, monitor.config);
  const points = hist?.points || [];
  const hasAnyData = points.length >= 2;
  const hasMetricsData = points.some(p => p.metrics != null);

  // Build the list of graphs to display
  const graphs = (() => {
    if (!hasAnyData) return [];
    if (hasMetricsData && availableMetrics.length > 0) {
      const list = availableMetrics.map(metric => {
        const pts = points.map(p => ({ ...p, value: p.metrics?.[metric.key] ?? null }));
        const vals = pts.filter(p => p.value != null);
        if (vals.length < 2) return null;
        return { key: metric.key, label: lang === 'fr' ? metric.fr : metric.en, unit: metric.unit, pts };
      }).filter(Boolean);
      if (list.length > 0) return list;
    }
    // Fallback: primary metric (old snapshots without metrics object)
    const hasPrimary = points.some(p => p.value != null);
    if (!hasPrimary) return [];
    return [{ key: '__primary', label: t(`modal.metricLabels.${monitor.type}`) || t('modal.metric'), pts: points }];
  })();

  return (
    <Portal><div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl h-[90dvh] sm:h-[82dvh] flex flex-col shadow-2xl overflow-hidden">

        {/* Drag handle mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <ServiceIcon type={monitor.type} size={20} url={monitor.config?.url} faviconUrl={monitor.metrics?.faviconUrl} serviceUrl={monitor.serviceUrl} customIconUrl={monitor.customIconUrl} />
            <div>
              <p className="font-semibold text-thistle text-sm">{monitor.name}</p>
              {monitor.description && <p className="text-xs text-muted">{monitor.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={monitor.enabled ? monitor.status : 'unknown'} />
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 gap-1 shrink-0">
          {[
            { key: 'metrics',     label: lang === 'fr' ? 'Métriques' : 'Metrics' },
            { key: 'incidents',   label: lang === 'fr' ? 'Incidents' : 'Incidents', badge: incidents.filter(i => !i.resolvedAt).length },
            { key: 'maintenance', label: lang === 'fr' ? 'Maintenance' : 'Maintenance', badge: maintenanceWindows.length || null },
            { key: 'annotations', label: lang === 'fr' ? 'Annotations' : 'Annotations', badge: annotations.length },
            { key: 'changelog',   label: t('modal.changelogTab'), badge: changelogEntries.length || null },
            { key: 'badge',       label: 'Badge' },
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-xs font-medium py-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === key ? 'border-periwinkle text-periwinkle' : 'border-transparent text-muted hover:text-thistle'
              }`}
            >
              {label}
              {badge > 0 && (
                <span className={`text-xs px-1 rounded-full font-semibold ${tab === key ? 'bg-periwinkle/20 text-periwinkle' : 'bg-granite/30 text-muted'}`}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {tab === 'metrics' && (
            <>
              {/* Live snapshot chips */}
              {monitor.metrics && (() => {
                const m = monitor.metrics;
                const chips = [];
                if (monitor.type === 'http') {
                  if (m.statusCode != null) {
                    const ok = m.statusCode < 400;
                    const warn = m.statusCode >= 400 && m.statusCode < 500;
                    chips.push({ label: String(m.statusCode), color: ok ? 'text-celadon bg-celadon/10' : warn ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10' });
                  }
                  if (m.responseTime != null) {
                    const fast = m.responseTime < 300, slow = m.responseTime > 1000;
                    chips.push({ label: `${m.responseTime}ms`, color: fast ? 'text-celadon bg-celadon/10' : slow ? 'text-amber-400 bg-amber-400/10' : 'text-periwinkle bg-periwinkle/10' });
                  }
                  if (m.sslInfo?.daysLeft != null) {
                    const urgent = m.sslInfo.daysLeft <= 7, soon = m.sslInfo.daysLeft <= 30;
                    chips.push({ label: `SSL · ${m.sslInfo.daysLeft}${lang === 'fr' ? 'j' : 'd'}`, color: urgent ? 'text-red-400 bg-red-400/10' : soon ? 'text-amber-400 bg-amber-400/10' : 'text-celadon bg-celadon/10' });
                  }
                }
                if (!chips.length) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 pb-4 border-b border-border/50">
                    {chips.map((c, i) => (
                      <span key={i} className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium font-mono ${c.color}`}>{c.label}</span>
                    ))}
                  </div>
                );
              })()}

              {/* Uptime */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('modal.availability')}</p>
                  <div className="flex gap-1">
                    {[24, 168].map(h => (
                      <button key={h} onClick={() => setPeriod(h)}
                        className={`text-xs px-2 py-0.5 rounded ${period === h ? 'bg-periwinkle/20 text-periwinkle' : 'text-muted hover:text-thistle'}`}>
                        {h === 24 ? '24h' : t('modal.period7d')}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const h24 = hist?.uptime?.h24;
                  const d7  = hist?.uptime?.d7;
                  const trend = h24 != null && d7 != null ? Math.round((h24 - d7) * 10) / 10 : null;
                  return (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { value: h24, label: t('modal.label24h'), trendVal: trend },
                        { value: d7,  label: t('modal.label7d'),  trendVal: trend != null ? -trend : null },
                      ].map(({ value, label, trendVal }) => {
                        if (value == null) return null;
                        const color = value >= 99 ? 'text-celadon' : value >= 95 ? 'text-amber-400' : 'text-red-400';
                        const trendColor = trendVal > 0.1 ? 'text-celadon' : trendVal < -0.1 ? 'text-red-400' : 'text-muted';
                        const trendLabel = trendVal == null ? null
                          : trendVal > 0.1  ? `+${trendVal}%`
                          : trendVal < -0.1 ? `${trendVal}%`
                          : null;
                        return (
                          <div key={label} className="bg-granite-3/60 border border-border/50 rounded-lg px-3 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted mb-0.5">{label}</p>
                              <p className={`text-lg font-bold ${color}`}>{value}%</p>
                            </div>
                            {trendLabel && (
                              <span className={`text-xs font-mono font-semibold shrink-0 ${trendColor}`}>{trendLabel}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {points.length >= 2 && <StatusTimeline points={points} period={period} lang={lang} />}
              </div>

              {/* Last HTTP status codes — shown for http monitors, includes error/timeout snapshots */}
              {hist !== null && monitor.type === 'http' && (() => {
                const recent = points
                  .filter(p => p.metrics?.statusCode != null || ['error', 'offline', 'warning'].includes(p.status))
                  .slice(-50)
                  .reverse()
                  .filter((p, i, arr) => {
                    const codeOf = pt => pt.metrics?.statusCode ?? pt.status;
                    return i === 0 || codeOf(p) !== codeOf(arr[i - 1]);
                  })
                  .slice(0, 10);
                if (!recent.length) return null;
                return (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                      {lang === 'fr' ? 'Historique des statuts' : 'Status history'}
                    </p>
                    <div className="space-y-1">
                      {recent.map((p, i) => {
                        const code = p.metrics?.statusCode;
                        const rt   = p.metrics?.responseTime;
                        const isErr = code == null;
                        const label = isErr
                          ? (p.status === 'offline' ? 'offline' : 'timeout')
                          : String(code);
                        const badgeCls = isErr
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : code >= 500 ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : code >= 400 ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                          : code >= 300 ? 'bg-periwinkle/15 text-periwinkle border-periwinkle/30'
                          : 'bg-celadon/15 text-celadon border-celadon/30';
                        const isOk = !isErr && code < 400;
                        const rtColor = rt == null ? '' : rt < 300 ? 'text-celadon' : rt > 1000 ? 'text-amber-400' : 'text-muted/60';
                        const rowBorderColor = isErr || (code != null && code >= 500)
                          ? 'rgba(248,113,113,0.35)'
                          : code != null && code >= 400
                            ? 'rgba(251,191,36,0.35)'
                            : 'rgba(52,211,153,0.25)';
                        const rowBg = isErr || (code != null && code >= 500)
                          ? 'rgba(248,113,113,0.04)'
                          : code != null && code >= 400
                            ? 'rgba(251,191,36,0.04)'
                            : 'rgba(52,211,153,0.03)';
                        return (
                          <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs"
                            style={{ borderLeft: `2px solid ${rowBorderColor}`, background: rowBg, borderRadius: '0 6px 6px 0' }}>
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded border text-xs shrink-0 ${badgeCls}`}>
                              {label}
                            </span>
                            <span className="text-muted flex-1">
                              {new Date(p.ts).toLocaleString(locale)}
                            </span>
                            {rt != null && (
                              <span className={`shrink-0 font-mono ${rtColor}`}>{rt}ms</span>
                            )}
                            {isErr && p.lastError && (
                              <span className="text-muted/50 shrink-0 truncate max-w-[120px]" title={p.lastError}>
                                {p.lastError.length > 20 ? p.lastError.slice(0, 19) + '…' : p.lastError}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Sparklines — one per metric (or fallback primary) */}
              {graphs.map(g => {
                const vals = g.pts.map(p => p.value).filter(v => v != null);
                const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
                const unit = g.unit ?? '';
                const isRt = g.key === 'responseTime' || g.key === 'latency';
                return (
                  <div key={g.key} className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider">{g.label}</p>
                      {avg != null && (
                        <span className="text-xs font-mono text-periwinkle">
                          {lang === 'fr' ? 'moy.' : 'avg'} {avg}{unit}
                        </span>
                      )}
                    </div>
                    <Sparkline points={g.pts} color={sparkColor} height={110} showLabels variant={isRt ? 'bar' : 'line'} incidents={incidents} annotations={annotations} maintenanceWindows={maintenanceWindows} changelogEntries={changelogEntries} />
                    <div className="flex justify-between text-xs text-muted/50 mt-1">
                      <span>{period === 24 ? '−24h' : `−${t('modal.period7d')}`}</span>
                      <span>{t('modal.now')}</span>
                    </div>
                  </div>
                );
              })}

              {graphs.length === 0 && hist !== null && !points.some(p => p.metrics?.statusCode != null) && (
                <div className="text-center py-8">
                  <p className="text-xs text-muted italic">{t('modal.noData')}</p>
                </div>
              )}

            </>
          )}

          {tab === 'badge' && (() => {
            const badgeUrl = `${window.location.origin}/api/badge/${monitor._id}`;
            const mdSnippet = `![${monitor.name}](${badgeUrl})`;
            const htmlSnippet = `<img src="${badgeUrl}" alt="${monitor.name}" />`;
            return (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{lang === 'fr' ? 'Aperçu' : 'Preview'}</p>
                  <img src={badgeUrl} alt="badge" />
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Markdown</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={mdSnippet} className="input text-xs font-mono flex-1 text-muted h-8" />
                    <button type="button" onClick={() => navigator.clipboard.writeText(mdSnippet)}
                      className="btn-ghost px-3 py-1.5 text-xs shrink-0">{lang === 'fr' ? 'Copier' : 'Copy'}</button>
                  </div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">HTML</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={htmlSnippet} className="input text-xs font-mono flex-1 text-muted h-8" />
                    <button type="button" onClick={() => navigator.clipboard.writeText(htmlSnippet)}
                      className="btn-ghost px-3 py-1.5 text-xs shrink-0">{lang === 'fr' ? 'Copier' : 'Copy'}</button>
                  </div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">URL</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={badgeUrl} className="input text-xs font-mono flex-1 text-muted h-8" />
                    <button type="button" onClick={() => navigator.clipboard.writeText(badgeUrl)}
                      className="btn-ghost px-3 py-1.5 text-xs shrink-0">{lang === 'fr' ? 'Copier' : 'Copy'}</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {tab === 'incidents' && (
            <div>
              {incidents.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle size={28} className="text-celadon mx-auto mb-2" />
                  <p className="text-sm text-thistle font-medium">{lang === 'fr' ? 'Aucun incident' : 'No incidents'}</p>
                  <p className="text-xs text-muted mt-1">{lang === 'fr' ? 'Ce service fonctionne parfaitement.' : 'This service is running smoothly.'}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {incidents.map(i => (
                    <div key={i._id} className="flex items-start gap-2.5 bg-surface rounded-lg px-3 py-2">
                      <span className={`mt-0.5 shrink-0 ${i.resolvedAt ? 'text-celadon' : 'text-red-400'}`}>
                        {i.resolvedAt ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      </span>
                      <div className="text-xs text-muted min-w-0">
                        <p className="text-thistle">{new Date(i.startedAt).toLocaleString(locale)}</p>
                        {i.resolvedAt
                          ? <p>{t('modal.resolved')} <span className="text-thistle">{duration(i.duration)}</span></p>
                          : <p className="text-red-400">{t('modal.ongoing')}</p>
                        }
                        {i.reason && <p className="text-muted/70 truncate">{i.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'maintenance' && (
            <div>
              {maintenanceWindows.length === 0 ? (
                <div className="text-center py-10">
                  <Wrench size={28} className="text-muted/40 mx-auto mb-2" />
                  <p className="text-sm text-thistle font-medium">{lang === 'fr' ? 'Aucune maintenance' : 'No maintenance history'}</p>
                  <p className="text-xs text-muted mt-1">{lang === 'fr' ? 'Les fenêtres de maintenance passées apparaîtront ici.' : 'Past maintenance windows will appear here.'}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {maintenanceWindows.map(w => {
                    const dur = w.endedAt ? Math.round((new Date(w.endedAt) - new Date(w.startedAt)) / 60000) : null;
                    return (
                      <div key={w._id} className="flex items-start gap-2.5 bg-surface rounded-lg px-3 py-2">
                        <Wrench size={14} className="mt-0.5 shrink-0 text-amber-400" />
                        <div className="text-xs text-muted min-w-0">
                          <p className="text-thistle">{new Date(w.startedAt).toLocaleString(locale)}</p>
                          {w.endedAt ? (
                            <p className="flex items-center gap-1.5">
                              {w.canceledAt
                                ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{lang === 'fr' ? 'Annulée' : 'Canceled'}</span>
                                : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{lang === 'fr' ? 'Terminée' : 'Ended'}</span>
                              }
                              <span>{lang === 'fr' ? 'Durée :' : 'Duration:'} <span className="text-thistle">{dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}min` : `${dur}min`}</span></span>
                            </p>
                          ) : (
                            <p className="text-amber-400">{lang === 'fr' ? 'En cours' : 'Active'}</p>
                          )}
                          {w.scheduledStart && <p className="text-muted/70">{lang === 'fr' ? 'Planifiée' : 'Scheduled'}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'annotations' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('modal.annotationAdd')}</p>
                <button
                  onClick={() => setAddingAnn(a => !a)}
                  className="text-xs px-2 py-0.5 rounded text-periwinkle bg-periwinkle/10 border border-periwinkle/20 hover:bg-periwinkle/20 transition-colors"
                >
                  + {t('modal.annotationSave')}
                </button>
              </div>
              {addingAnn && (
                <form onSubmit={handleAddAnnotation} className="flex gap-2 mb-3">
                  <input
                    autoFocus
                    className="input text-xs flex-1 h-8"
                    placeholder={t('modal.annotationLabelPlaceholder')}
                    value={annLabel}
                    onChange={e => setAnnLabel(e.target.value)}
                  />
                  <button type="submit" className="btn-primary text-xs px-3 h-8">{t('modal.annotationSave')}</button>
                  <button type="button" onClick={() => setAddingAnn(false)} className="btn-ghost text-xs px-2 h-8"><X size={12} /></button>
                </form>
              )}
              {annotations.length > 0 ? (
                <div className="space-y-1">
                  {annotations.map(a => (
                    <div key={a._id} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5">
                      <Tag size={11} className="text-periwinkle shrink-0" />
                      <span className="text-xs text-thistle flex-1">{a.label}</span>
                      <span className="text-xs text-muted">{new Date(a.ts).toLocaleString(locale)}</span>
                      <button onClick={() => handleDeleteAnnotation(a._id)} className="text-muted hover:text-red-400 transition-colors ml-1"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                !addingAnn && (
                  <div className="text-center py-8">
                    <Tag size={24} className="text-muted/40 mx-auto mb-2" />
                    <p className="text-xs text-muted italic">{t('modal.annotationNone')}</p>
                  </div>
                )
              )}
            </div>
          )}
          {tab === 'changelog' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('modal.changelogTab')}</p>
                <button onClick={openAddCl}
                  className="text-xs px-2 py-0.5 rounded text-periwinkle bg-periwinkle/10 border border-periwinkle/20 hover:bg-periwinkle/20 transition-colors">
                  + {t('modal.changelogAdd')}
                </button>
              </div>

              {addingCl && (
                <form onSubmit={handleSaveCl} className="bg-surface border border-border rounded-lg p-3 mb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted block mb-1">{t('modal.changelogVersion')} *</label>
                      <input autoFocus className="input text-xs h-8 w-full" placeholder={t('modal.changelogVersionPlaceholder')}
                        value={clForm.version} onChange={e => setClForm(f => ({ ...f, version: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">{t('modal.changelogDate')}</label>
                      <input type="datetime-local" className="input text-xs h-8 w-full"
                        value={clForm.deployedAt} onChange={e => setClForm(f => ({ ...f, deployedAt: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">{t('modal.changelogDescription')}</label>
                    <input className="input text-xs h-8 w-full" placeholder={t('modal.changelogDescriptionPlaceholder')}
                      value={clForm.description} onChange={e => setClForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => { setAddingCl(false); setEditingCl(null); }}
                      className="btn-ghost text-xs px-2 h-7"><X size={12} /></button>
                    <button type="submit" className="btn-primary text-xs px-3 h-7">{t('modal.changelogSave')}</button>
                  </div>
                </form>
              )}

              {changelogEntries.length > 0 ? (
                <div className="space-y-1">
                  {changelogEntries.map(c => (
                    <div key={c._id} className="flex items-start gap-2 bg-surface rounded-lg px-3 py-2">
                      <GitCommitHorizontal size={13} className="text-green-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-400">{c.version}</span>
                          <span className="text-xs text-muted">{new Date(c.deployedAt).toLocaleString(locale)}</span>
                        </div>
                        {c.description && <p className="text-xs text-thistle/80 mt-0.5 truncate">{c.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditCl(c)} className="text-muted hover:text-periwinkle transition-colors"><Pencil size={11} /></button>
                        <button onClick={() => handleDeleteCl(c._id)} className="text-muted hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !addingCl && (
                  <div className="text-center py-8">
                    <GitCommitHorizontal size={24} className="text-muted/40 mx-auto mb-2" />
                    <p className="text-xs text-muted">{t('modal.changelogNone')}</p>
                    <p className="text-xs text-muted/60 mt-1">{t('modal.changelogNoneHint')}</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div></Portal>
  );
}
