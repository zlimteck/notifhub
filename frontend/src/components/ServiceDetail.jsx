import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { history as historyApi, incidents as incidentsApi } from '../api';
import { useLang } from '../context/LangContext';
import ServiceIcon from './ServiceIcon';
import StatusBadge from './StatusBadge';
import Sparkline from './Sparkline';

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
  const [period, setPeriod] = useState(24);

  useEffect(() => {
    historyApi.monitor(monitor._id, period).then(setHist).catch(() => {});
    incidentsApi.list({ monitorId: monitor._id, limit: 10 }).then(setIncidents).catch(() => {});
  }, [monitor._id, period]);

  const sparkColor = monitor.status === 'online' ? '#c9d7f8' : monitor.status === 'warning' ? '#fbbf24' : '#f87171';
  const hasPoints = hist?.points?.length >= 2;
  const metricLabel = t(`modal.metricLabels.${monitor.type}`) || t('modal.metric');
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto shadow-2xl">

        {/* Drag handle mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ServiceIcon type={monitor.type} size={20} url={monitor.config?.url} faviconUrl={monitor.metrics?.faviconUrl} />
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

        <div className="p-5 space-y-5">
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
            <div className="flex justify-around">
              <UptimeBadge value={hist?.uptime?.h24} label={t('modal.label24h')} />
              <UptimeBadge value={hist?.uptime?.d7}  label={t('modal.label7d')} />
            </div>
          </div>

          {/* Sparkline */}
          {hasPoints && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {metricLabel}
              </p>
              <div className="bg-surface rounded-lg px-3 pt-3 pb-2">
                <Sparkline points={hist.points} color={sparkColor} height={90} showLabels />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>{period === 24 ? '−24h' : period === 168 ? `−${t('modal.period7d')}` : `−${period}h`}</span>
                  <span>{t('modal.now')}</span>
                </div>
              </div>
            </div>
          )}

          {!hasPoints && hist !== null && (
            <p className="text-xs text-muted italic text-center py-4">{t('modal.noData')}</p>
          )}

          {/* Incidents récents */}
          {incidents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('modal.incidents')}</p>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
