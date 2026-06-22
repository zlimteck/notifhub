import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Tag, Trash2 } from 'lucide-react';
import { history as historyApi, incidents as incidentsApi, annotations as annotationsApi } from '../api';
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
  const [period, setPeriod] = useState(24);
  const [tab, setTab] = useState('metrics');
  const [annLabel, setAnnLabel] = useState('');
  const [addingAnn, setAddingAnn] = useState(false);

  const loadAnnotations = () => {
    const since = Date.now() - period * 3600 * 1000;
    annotationsApi.list(monitor._id, since).then(setAnnotations).catch(() => {});
  };

  useEffect(() => {
    historyApi.monitor(monitor._id, period).then(setHist).catch(() => {});
    incidentsApi.list({ monitorId: monitor._id, limit: 50 }).then(setIncidents).catch(() => {});
    loadAnnotations();
  }, [monitor._id, period]);

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
        return { key: metric.key, label: lang === 'fr' ? metric.fr : metric.en, pts };
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
            { key: 'annotations', label: lang === 'fr' ? 'Annotations' : 'Annotations', badge: annotations.length },
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
                <div className="flex justify-around mb-3">
                  <UptimeBadge value={hist?.uptime?.h24} label={t('modal.label24h')} />
                  <UptimeBadge value={hist?.uptime?.d7}  label={t('modal.label7d')} />
                </div>
                {points.length >= 2 && <StatusTimeline points={points} period={period} lang={lang} />}
              </div>

              {/* Sparklines — one per metric (or fallback primary) */}
              {graphs.map(g => (
                <div key={g.key} className="pt-4 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{g.label}</p>
                  <Sparkline points={g.pts} color={sparkColor} height={110} showLabels incidents={incidents} annotations={annotations} />
                  <div className="flex justify-between text-xs text-muted/50 mt-1">
                    <span>{period === 24 ? '−24h' : `−${t('modal.period7d')}`}</span>
                    <span>{t('modal.now')}</span>
                  </div>
                </div>
              ))}

              {graphs.length === 0 && hist !== null && monitor.type !== 'http' && (
                <div className="text-center py-8">
                  <p className="text-xs text-muted italic">{t('modal.noData')}</p>
                </div>
              )}

              {/* HTTP: last status codes list */}
              {monitor.type === 'http' && hist !== null && (() => {
                const recent = points
                  .filter(p => p.metrics?.statusCode != null)
                  .slice(-10)
                  .reverse();
                if (!recent.length) return (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted italic">{t('modal.noData')}</p>
                  </div>
                );
                return (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                      {lang === 'fr' ? 'Derniers statuts HTTP' : 'Latest HTTP statuses'}
                    </p>
                    <div className="space-y-1">
                      {recent.map((p, i) => {
                        const code = p.metrics.statusCode;
                        const rt   = p.metrics.responseTime;
                        const cls  =
                          code >= 500 ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                          code >= 400 ? 'bg-amber-400/15 text-amber-400 border-amber-400/30' :
                          code >= 300 ? 'bg-periwinkle/15 text-periwinkle border-periwinkle/30' :
                          'bg-celadon/15 text-celadon border-celadon/30';
                        return (
                          <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface text-xs">
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded border text-xs shrink-0 ${cls}`}>
                              {code}
                            </span>
                            <span className="text-muted flex-1">
                              {new Date(p.ts).toLocaleString(locale)}
                            </span>
                            {rt != null && (
                              <span className="text-muted/60 shrink-0 font-mono">{rt}ms</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
        </div>
      </div>
    </div></Portal>
  );
}
