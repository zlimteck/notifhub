import React, { useState, useEffect } from 'react';
import { publicStatus } from '../api';
import { useLang } from '../context/LangContext';
import ServiceIcon from '../components/ServiceIcon';

function UptimeBar({ days }) {
  if (!days?.length) return null;
  return (
    <div className="flex gap-px" style={{ height: 24 }}>
      {days.map((uptime, i) => (
        <div
          key={i}
          title={uptime != null ? `${uptime}%` : '–'}
          className={`flex-1 rounded-sm ${
            uptime == null ? 'bg-granite/30' :
            uptime >= 99   ? 'bg-celadon/60' :
            uptime >= 90   ? 'bg-amber-400/60' :
            'bg-red-400/60'
          }`}
        />
      ))}
    </div>
  );
}

function StatusDot({ status }) {
  const cls =
    status === 'online'  ? 'bg-celadon' :
    status === 'warning' ? 'bg-amber-400' :
    ['error', 'offline'].includes(status) ? 'bg-red-400' :
    'bg-granite';
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`} />;
}

function StatusLabel({ status, t }) {
  const cls =
    status === 'online'  ? 'text-celadon' :
    status === 'warning' ? 'text-amber-400' :
    ['error','offline'].includes(status) ? 'text-red-400' :
    'text-muted';
  const key = ['error','offline'].includes(status) ? status : (status || 'unknown');
  return <span className={`text-xs font-medium ${cls}`}>{t(`statusPage.status.${key}`)}</span>;
}

function duration(ms) {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

function timeAgo(date) {
  if (!date) return '–';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

function overallStatus(monitors, openIncidents) {
  if (openIncidents?.length) {
    const hasError = monitors.some(m => ['error', 'offline'].includes(m.status));
    return hasError ? 'outage' : 'degraded';
  }
  if (monitors.some(m => ['error', 'offline'].includes(m.status))) return 'outage';
  if (monitors.some(m => m.status === 'warning')) return 'degraded';
  return 'operational';
}

export default function StatusPage() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [, setTick] = useState(0);

  async function load() {
    try {
      setData(await publicStatus.get());
      setFetchedAt(Date.now());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const fetchTimer = setInterval(load, 60000);
    const tickTimer  = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(fetchTimer); clearInterval(tickTimer); };
  }, []);

  if (error) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-muted text-sm">{t('statusPage.loadError')}</p>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-muted text-sm">{t('statusPage.loading')}</p>
    </div>
  );

  const { title, monitors, openIncidents, recentIncidents, updatedAt } = data;
  const overall = overallStatus(monitors, openIncidents);

  const bannerCls =
    overall === 'operational' ? 'border-celadon/30 bg-celadon/5' :
    overall === 'degraded'    ? 'border-amber-400/30 bg-amber-400/5' :
    'border-red-400/30 bg-red-400/5';

  const bannerTextCls =
    overall === 'operational' ? 'text-celadon' :
    overall === 'degraded'    ? 'text-amber-400' :
    'text-red-400';

  const bannerLabel =
    overall === 'operational' ? t('statusPage.operational') :
    overall === 'degraded'    ? t('statusPage.degraded') :
    t('statusPage.outage');

  const groups = new Map();
  for (const m of monitors) {
    const cat = m.category?.trim() || '';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(m);
  }
  const hasCategories = [...groups.keys()].some(k => k !== '');

  const uptimeGlobal = (() => {
    const vals = monitors.map(m => m.uptime?.h24).filter(v => v != null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  })();

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="text-lg font-bold text-thistle">{title || 'System Status'}</h1>
          <span className="text-xs text-muted">{t('statusPage.updatedAgo')} {timeAgo(fetchedAt)}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Banner */}
        <div className={`rounded-xl border px-5 py-4 flex items-center gap-3 ${bannerCls}`}>
          <StatusDot status={overall === 'operational' ? 'online' : overall === 'degraded' ? 'warning' : 'error'} />
          <span className={`font-semibold ${bannerTextCls}`}>{bannerLabel}</span>
          {uptimeGlobal != null && (
            <span className="ml-auto text-xs text-muted">{uptimeGlobal}% {t('statusPage.uptimeLabel')}</span>
          )}
        </div>

        {/* Open incidents */}
        {openIncidents?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('statusPage.openIncidents')}</p>
            {openIncidents.map(i => (
              <div key={i._id} className="card border-red-400/30 bg-red-400/5 px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium text-red-400 text-sm">{i.monitorName}</span>
                <span className="text-xs text-muted">{t('statusPage.since')} {timeAgo(i.startedAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Services */}
        <div className="space-y-5">
          {[...groups.entries()].map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              {hasCategories && cat && (
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{cat}</p>
              )}
              <div className="card divide-y divide-border p-0 overflow-hidden">
                {items.map(m => (
                  <div key={m._id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <ServiceIcon type={m.type} size={16} serviceUrl={m.serviceUrl} faviconUrl={m.faviconUrl} />
                      <span className="font-medium text-sm text-thistle flex-1 truncate">{m.name}</span>
                      {m.uptime?.h24 != null && (
                        <span className={`text-xs ${m.uptime.h24 >= 99 ? 'text-celadon' : m.uptime.h24 >= 95 ? 'text-amber-400' : 'text-red-400'}`}>
                          {m.uptime.h24}%
                        </span>
                      )}
                      <StatusDot status={m.status} />
                      <StatusLabel status={m.status} t={t} />
                    </div>
                    {m.days?.length > 0 && (
                      <div className="space-y-0.5">
                        <UptimeBar days={m.days} />
                        <div className="flex justify-between text-xs text-muted/50" style={{ fontSize: 9 }}>
                          <span>{t('statusPage.days90')}</span>
                          <span>{t('statusPage.today')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Recent incidents */}
        {recentIncidents?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t('statusPage.recentIncidents')}</p>
            <div className="card divide-y divide-border p-0 overflow-hidden">
              {recentIncidents.map(i => (
                <div key={i._id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span className="text-celadon text-xs">✓</span>
                  <span className="text-thistle flex-1">{i.monitorName}</span>
                  <span className="text-muted text-xs">{t('statusPage.resolvedIn')} {duration(i.duration)}</span>
                  <span className="text-muted/50 text-xs shrink-0">
                    {new Date(i.resolvedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted/40 pt-2 border-t border-border">
          {t('statusPage.poweredBy')} NotifHub
        </p>
      </div>
    </div>
  );
}
