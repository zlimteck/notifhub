import React, { useState, useEffect, useMemo } from 'react';
import { monitors as monitorsApi, history as historyApi, settings as settingsApi } from '../api';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { extractValue, getMetricLabel, formatMetricValue, getMetrics } from '../utils/metricConfig';
import StatusBadge from '../components/StatusBadge';
import ServiceIcon from '../components/ServiceIcon';
import ServiceDetail from '../components/ServiceDetail';
import { RefreshCw, Radio, AlertTriangle, CheckCircle, Clock, GripVertical, Search, LayoutGrid, List, Thermometer, Wrench } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function smoothCardPath(coords) {
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

function Sparkline({ points, cardMetric }) {
  const vals = (points || []).map(p => extractValue(p, cardMetric)).filter(v => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 200, H = 32;
  const PAD_TOP = 4, PAD_BOTTOM = 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const pts = (points || []).filter(p => extractValue(p, cardMetric) != null);
  const coords = pts.map((p, i) => {
    const v = extractValue(p, cardMetric);
    return [
      (i / (pts.length - 1)) * W,
      PAD_TOP + innerH - ((v - min) / range) * innerH,
    ];
  });
  const linePath = smoothCardPath(coords);
  const areaPath = linePath + ` L ${coords[coords.length - 1][0]},${H} L ${coords[0][0]},${H} Z`;
  const gradId = `cg-${cardMetric || 'default'}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-periwinkle/50" style={{ height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function StatusStrip({ points }) {
  if (!points || !points.length) return null;
  return (
    <div className="flex gap-px" style={{ height: 20 }}>
      {points.map((p, i) => (
        <div key={i} className={`flex-1 rounded-sm ${
          p.status === 'online'  ? 'bg-celadon/50' :
          p.status === 'warning' ? 'bg-amber-400/50' :
          ['error','offline'].includes(p.status) ? 'bg-red-400/50' :
          'bg-granite/30'
        }`} />
      ))}
    </div>
  );
}

function UptimeBar({ days }) {
  if (!days || days.every(d => d === null)) return null;
  const NUMERIC_TYPES = ['http','ping','proxmox','ssh','immich','ultracc','adguard','adguardhome','unraid'];
  return (
    <div className="space-y-1">
      <div className="flex gap-px" style={{ height: 6 }}>
        {days.map((uptime, i) => (
          <div key={i} title={uptime != null ? `${uptime}%` : '–'}
            className={`flex-1 rounded-sm ${
              uptime == null    ? 'bg-granite/25' :
              uptime >= 99      ? 'bg-celadon/70' :
              uptime >= 90      ? 'bg-amber-400/70' :
              'bg-red-400/70'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted" style={{ fontSize: 9 }}>
        <span>90j</span>
        <span>auj.</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, warn = 80, danger = 95 }) {
  const color = value >= danger ? 'bg-red-400' : value >= warn ? 'bg-amber-400' : 'bg-frosted';
  return (
    <div className="h-1.5 bg-granite-3 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function ScrollList({ items }) {
  return (
    <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span className={item.ok ? 'text-celadon' : 'text-red-400'}>●</span>
          <span className="text-thistle truncate flex-1">{item.name}</span>
          {item.sub && <span className="text-muted shrink-0">{item.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function CloudflareTunnels({ metrics }) {
  const { t } = useLang();
  const tunnels = metrics.tunnels || [];
  const items = [];
  for (const t2 of tunnels) {
    const ok = t2.status === 'active' || t2.status === 'healthy';
    items.push({ ok, name: t2.name, sub: null });
    for (const h of (t2.hostnames || [])) {
      items.push({ ok, name: h, sub: null, indent: true });
    }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.tunnels')} : <span className="text-thistle font-medium">{metrics.healthy}/{metrics.total}</span></span>
      </div>
      <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
        {items.map((item, i) => (
          <div key={i} className={`flex items-center gap-1.5 text-xs ${item.indent ? 'pl-3' : ''}`}>
            <span className={item.indent ? 'text-muted/50' : (item.ok ? 'text-celadon' : 'text-red-400')}>
              {item.indent ? '└' : '●'}
            </span>
            <span className={item.indent ? 'text-muted truncate' : 'text-thistle truncate'}>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsBlock({ monitor }) {
  const { t } = useLang();
  const { type, metrics, status, lastError } = monitor;

  if (!metrics) {
    if (status === 'error' && lastError) {
      return (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded px-2 py-1.5 break-all">
          {lastError}
        </p>
      );
    }
    return <p className="text-xs text-muted italic">{t('metrics.waiting')}</p>;
  }

  if (type === 'cloudflare') return <CloudflareTunnels metrics={metrics} />;

  if (type === 'homeassistant') return (
    <div className="space-y-1">
      {metrics.version && <p className="text-xs text-muted">v<span className="text-thistle">{metrics.version}</span></p>}
      {metrics.entityStates?.length > 0 && (
        <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
          {metrics.entityStates.map(e => (
            <div key={e.entity_id} className="flex items-center justify-between text-xs gap-2">
              <span className="text-muted truncate">{e.friendly_name}</span>
              <span className={`font-medium shrink-0 ${e.state === 'unavailable' ? 'text-red-400' : 'text-thistle'}`}>
                {e.state}{e.unit ? ` ${e.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (type === 'adguardhome') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.protection')} : <span className={metrics.protectionEnabled ? 'text-celadon font-medium' : 'text-red-400 font-medium'}>{metrics.protectionEnabled ? t('metrics.active') : t('metrics.inactive')}</span></span>
        {metrics.totalQueries != null && <span>{t('metrics.requests')} : <span className="text-thistle font-medium">{metrics.totalQueries.toLocaleString()}</span></span>}
      </div>
      {metrics.blockedPct != null && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-muted">
            <span>{t('metrics.blocked')}</span><span>{metrics.blockedPct}%</span>
          </div>
          <ProgressBar value={metrics.blockedPct} warn={70} danger={90} />
        </div>
      )}
    </div>
  );

  if (type === 'adguard') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.protection')} : <span className={metrics.protection ? 'text-celadon font-medium' : 'text-red-400 font-medium'}>{metrics.protection ? t('metrics.active') : t('metrics.inactive')}</span></span>
        <span>{t('metrics.devices')} : <span className="text-thistle font-medium">{metrics.devices}</span></span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-xs text-muted">
          <span>{t('metrics.requests')}</span><span>{metrics.pct_requests}%</span>
        </div>
        <ProgressBar value={metrics.pct_requests} warn={70} danger={90} />
      </div>
    </div>
  );

  if (type === 'hms') return (
    <div className="space-y-1.5">
      {(metrics.vps || []).map(v => (
        <div key={v.id} className="space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={v.state === 'running' ? 'text-celadon text-xs' : 'text-red-400 text-xs'}>●</span>
            <span className="text-thistle font-medium text-xs truncate">{v.name}</span>
          </div>
          <div className="flex gap-3 text-xs text-muted pl-3">
            {v.ipv4  && <span>IP : <span className="text-frosted">{v.ipv4}</span></span>}
            {v.vcores && <span>CPU : <span className="text-frosted">{v.vcores}c</span></span>}
            {v.ram_gb && <span>RAM : <span className="text-frosted">{v.ram_gb} GB</span></span>}
          </div>
        </div>
      ))}
    </div>
  );

  if (type === 'ultracc') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.free')} : <span className="text-thistle font-medium">{metrics.free_storage} GB</span></span>
        <span>{t('metrics.traffic')} : <span className={metrics.traffic_available < 20 ? 'text-amber-400 font-medium' : 'text-frosted font-medium'}>{metrics.traffic_available}%</span></span>
      </div>
      <ProgressBar value={100 - metrics.free_pct} warn={70} danger={90} />
    </div>
  );

  if (type === 'syncthing') return (
    <div className="space-y-2">
      {(metrics.devices || []).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted uppercase tracking-wider">{t('metrics.devices')}</p>
          {metrics.devices.map(d => (
            <div key={d.id} className="flex items-center gap-1.5 text-xs">
              <span className={d.connected ? 'text-celadon' : 'text-muted'}>●</span>
              <span className={d.connected ? 'text-thistle' : 'text-muted'}>{d.name}</span>
              {d.isHost && <span className="text-muted italic">{t('settings.docker.internal')}</span>}
              {!d.connected && !d.isHost && <span className="text-muted italic">{t('metrics.disconnected')}</span>}
            </div>
          ))}
        </div>
      )}
      {(metrics.folders || []).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted uppercase tracking-wider">{t('metrics.folders')}</p>
          {metrics.folders.map(f => {
            const synced = f.needBytes === 0 && f.state !== 'error';
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={synced ? 'text-celadon' : 'text-amber-400'}>●</span>
                  <span className="text-thistle truncate">{f.label}</span>
                </div>
                <span className="text-muted shrink-0">
                  {synced ? `${f.inSyncFiles} ${t('metrics.files')}` : f.state}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (type === 'http') return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className={metrics.ok ? 'text-celadon font-medium' : 'text-red-400 font-medium'}>
          {metrics.statusCode ?? '—'}
        </span>
        <span className="text-muted">·</span>
        <span className="text-muted">{metrics.responseTime != null ? `${metrics.responseTime}ms` : '—'}</span>
        {!metrics.ok && metrics.errMsg && (
          <span className="text-red-400 truncate">{metrics.errMsg}</span>
        )}
      </div>
      {metrics.sslInfo && (
        <div className={`text-xs ${
          metrics.sslStatus === 'expired'  ? 'text-red-400' :
          metrics.sslStatus === 'expiring' ? 'text-amber-400' : 'text-muted'
        }`}>
          <span>
            SSL ·{' '}
            {metrics.sslStatus === 'expired'
              ? t('metrics.sslExpired')
              : `${metrics.sslInfo.daysLeft}j`}
            {metrics.sslInfo.expiresAt && (
              <span className="text-muted/60">
                {' '}· exp. {new Date(metrics.sslInfo.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
            {metrics.sslInfo.issuer && (
              <span className="text-muted/50"> · {metrics.sslInfo.issuer}</span>
            )}
          </span>
        </div>
      )}
      <p className="text-xs text-muted truncate">{metrics.url}</p>
    </div>
  );

  if (type === 'ping') return (
    <div className="flex gap-4 text-xs text-muted">
      <span>{t('metrics.latency')} <span className={metrics.latency > 200 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.latency != null ? `${metrics.latency}ms` : '—'}</span></span>
      <span>{t('metrics.loss')} <span className={metrics.loss > 0 ? 'text-amber-400 font-medium' : 'text-celadon font-medium'}>{metrics.loss}%</span></span>
      <span className="text-muted/60">:{metrics.port}</span>
    </div>
  );

  if (type === 'proxmox') return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>CPU <span className={metrics.cpuPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.cpuPct}%</span></span>
      <span>{t('metrics.ram')} <span className={metrics.memPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.memPct}%</span></span>
      <span>VMs <span className="text-thistle font-medium">{metrics.vmRunning}/{metrics.vmTotal}</span></span>
      <span>LXC <span className="text-thistle font-medium">{metrics.lxcRunning}/{metrics.lxcTotal}</span></span>
    </div>
  );

  if (type === 'immich') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>Photos : <span className="text-thistle font-medium">{metrics.photos?.toLocaleString()}</span></span>
        <span>Videos : <span className="text-thistle font-medium">{metrics.videos?.toLocaleString()}</span></span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-xs text-muted">
          <span>{metrics.diskUse} {t('metrics.used')}</span><span>{metrics.diskPct}%</span>
        </div>
        <ProgressBar value={metrics.diskPct} warn={80} danger={90} />
      </div>
    </div>
  );

  if (type === 'portainer') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span>{t('metrics.envs')} <span className="text-thistle font-medium">{metrics.environments}</span></span>
        <span><span className="text-celadon font-medium">{metrics.containersRunning}</span> {t('metrics.running')}</span>
        <span><span className={metrics.containersStopped > 0 ? 'text-amber-400 font-medium' : 'text-muted font-medium'}>{metrics.containersStopped}</span> {t('metrics.stopped')}</span>
      </div>
      {(metrics.containers || []).length > 0 && (
        <ScrollList items={(metrics.containers || []).map(c => ({
          ok: c.state === 'running',
          name: c.name,
          sub: c.state !== 'running' ? c.state : null,
        }))} />
      )}
    </div>
  );

  if (type === 'ssh') return (
    <div className="space-y-1">
      {metrics.uptime && <p className="text-xs text-muted">{t('metrics.uptime')} : <span className="text-thistle">{metrics.uptime}</span></p>}
      {(metrics.cpuPct != null || metrics.memPct != null || metrics.diskPct != null) && (
        <div className="flex gap-4 text-xs text-muted">
          {metrics.cpuPct != null && <span>CPU <span className={metrics.cpuPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.cpuPct}%</span></span>}
          {metrics.memPct != null && <span>{t('metrics.ram')} <span className={metrics.memPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.memPct}%</span></span>}
          {metrics.diskPct != null && <span>{t('metrics.disk')} <span className={metrics.diskPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.diskPct}%</span></span>}
        </div>
      )}
    </div>
  );

  if (type === 'unraid') return (
    <div className="space-y-1.5">
      <div className="flex gap-3 text-xs text-muted flex-wrap">
        <span>Array : <span className={metrics.arrayState === 'STARTED' ? 'text-celadon font-medium' : 'text-amber-400 font-medium'}>{metrics.arrayState}</span></span>
        {metrics.diskErrors > 0 && <span className="text-red-400 font-medium">{metrics.diskErrors} erreur{metrics.diskErrors > 1 ? 's' : ''}</span>}
        {metrics.containersRunning > 0 && <span><span className="text-thistle font-medium">{metrics.containersRunning}</span> containers</span>}
        {metrics.tempAvg != null && <span className={`flex items-center gap-0.5 ${metrics.tempCrit > 0 ? 'text-red-400' : metrics.tempWarn > 0 ? 'text-amber-400' : 'text-muted'}`}><Thermometer size={12} />{metrics.tempAvg}°C</span>}
      </div>
      {metrics.diskTotal > 0 && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-muted">
            <span>{t('metrics.disk')} — {metrics.diskUsed} / {metrics.diskTotal} TB</span>
            <span>{metrics.diskPct}%</span>
          </div>
          <ProgressBar value={metrics.diskPct} warn={80} danger={90} />
        </div>
      )}
      {metrics.cpuPct != null && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-muted">
            <span>CPU{metrics.cpuBrand ? ` — ${metrics.cpuBrand}${metrics.cpuCores ? ` · ${metrics.cpuCores}c` : ''}` : ''}</span>
            <span>{metrics.cpuPct}%</span>
          </div>
          <ProgressBar value={metrics.cpuPct} warn={70} danger={90} />
        </div>
      )}
      {metrics.ramPct != null && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-muted">
            <span>{t('metrics.ram')}{metrics.ramUsedGB != null ? ` — ${metrics.ramUsedGB} / ${metrics.ramTotalGB} GB` : ''}</span>
            <span>{metrics.ramPct}%</span>
          </div>
          <ProgressBar value={metrics.ramPct} warn={80} danger={90} />
        </div>
      )}
    </div>
  );

  if (type === 'docker') return (
    <div className="space-y-1.5">
      <div className="flex gap-4 text-xs text-muted">
        <span><span className="text-celadon font-medium">{metrics.containersRunning}</span> {t('metrics.running')}</span>
        <span><span className={metrics.containersStopped > 0 ? 'text-amber-400 font-medium' : 'text-muted font-medium'}>{metrics.containersStopped}</span> {t('metrics.stopped')}</span>
      </div>
      <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
        {(metrics.containers || []).map(c => (
          <div key={c.id} className="flex items-center gap-1.5 text-xs">
            <span className={c.state === 'running' ? 'text-celadon' : 'text-amber-400'}>●</span>
            <span className="text-thistle truncate flex-1">{c.name}</span>
            {c.state !== 'running' && <span className="text-muted shrink-0">{c.state}</span>}
          </div>
        ))}
      </div>
    </div>
  );

  if (type === 'heartbeat') return (
    <div className="space-y-0.5 text-xs text-muted">
      {metrics.lastPing
        ? <span>{t('metrics.lastPing')} : <span className="text-thistle">{timeAgoMs(metrics.lastPing)}</span></span>
        : <span className="italic">{t('metrics.noHeartbeat')}</span>
      }
      <div><span>{t('metrics.expectedEvery')} : <span className="text-frosted">{metrics.expectedEvery} min</span></span></div>
    </div>
  );

  if (type === 'speedtest') return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
      <div>
        <p>↓ Download</p>
        <p className="text-thistle font-semibold text-sm">{metrics.downloadMbps != null ? `${metrics.downloadMbps} Mbps` : '—'}</p>
      </div>
      <div>
        <p>↑ Upload</p>
        <p className="text-thistle font-semibold text-sm">{metrics.uploadMbps != null ? `${metrics.uploadMbps} Mbps` : '—'}</p>
      </div>
      {metrics.pingMs != null && (
        <div>
          <p>Ping</p>
          <p className="text-frosted font-medium">{metrics.pingMs} ms</p>
        </div>
      )}
      {metrics.jitterMs != null && (
        <div>
          <p>Jitter</p>
          <p className="text-frosted font-medium">{metrics.jitterMs} ms</p>
        </div>
      )}
    </div>
  );

  if (type === 'ollama') return (
    <div className="space-y-1 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span>{metrics.modelsCount ?? '—'} modèle{metrics.modelsCount !== 1 ? 's' : ''}</span>
        {metrics.responseTime != null && <><span>·</span><span>{metrics.responseTime}ms</span></>}
      </div>
      {metrics.version && <p className="text-muted/60">v{metrics.version}</p>}
    </div>
  );

  return null;
}

function timeAgoMs(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function timeAgo(date, t) {
  if (!date) return t('time.never');
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}${t('time.sec')}`;
  if (s < 3600) return `${Math.floor(s / 60)}${t('time.min')}`;
  return `${Math.floor(s / 3600)}${t('time.hour')}`;
}

const STATUS_ORDER = { error: 0, offline: 1, warning: 2, unknown: 3, online: 4 };

function SkeletonStatCard() {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
      <div className="space-y-1.5">
        <div className="skeleton h-6 w-8 rounded" />
        <div className="skeleton h-2.5 w-16 rounded" />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card flex flex-col gap-3" style={{ minHeight: 130 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="skeleton w-5 h-5 rounded-md shrink-0" />
          <div className="skeleton h-3.5 w-28 rounded" />
        </div>
        <div className="skeleton h-3.5 w-14 rounded-full" />
      </div>
      <div className="space-y-2 flex-1">
        <div className="skeleton h-2.5 w-full rounded" />
        <div className="skeleton h-2.5 w-3/4 rounded" />
        <div className="skeleton h-2.5 w-1/2 rounded" />
      </div>
    </div>
  );
}

function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="skeleton w-4 h-4 rounded shrink-0" />
      <div className="skeleton h-3.5 flex-1 max-w-[180px] rounded" />
      <div className="flex-1" />
      <div className="skeleton h-3.5 w-20 rounded hidden sm:block" />
      <div className="skeleton h-3.5 w-16 rounded-full" />
    </div>
  );
}

function CardContent({ monitor, hist, dailyHist, showGraphs, onSelect, t, dragging = false, dragHandleProps = {} }) {
  const { lang } = useLang();
  const uptime = hist[monitor._id]?.uptime?.h24;
  const points = hist[monitor._id]?.points || [];
  const daily  = dailyHist[monitor._id] || null;
  const cardMetric = monitor.cardMetric || null;
  const hasNumeric = points.some(p => extractValue(p, cardMetric) != null);
  return (
    <div
      onClick={() => !dragging && onSelect(monitor)}
      className={`group card flex flex-col gap-2.5 cursor-pointer hover:border-periwinkle/40 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 select-none h-full animate-fade-in-up ${!monitor.enabled ? 'opacity-50' : ['error','offline'].includes(monitor.status) ? 'border-red-900/60' : monitor.status === 'warning' ? 'border-amber-900/50' : ''} ${dragging ? 'shadow-2xl border-periwinkle/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 relative flex items-center justify-center w-5 h-5">
            <span className={dragHandleProps ? 'transition-opacity group-hover:opacity-0' : ''}>
              <ServiceIcon type={monitor.type} size={20} url={monitor.config?.url} faviconUrl={monitor.metrics?.faviconUrl} serviceUrl={monitor.serviceUrl} customIconUrl={monitor.customIconUrl} />
            </span>
            {dragHandleProps && (
              <div {...dragHandleProps} onClick={e => e.stopPropagation()}
                className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted opacity-0 group-hover:opacity-100 transition-opacity touch-none">
                <GripVertical size={16} />
              </div>
            )}
          </span>
          <div className="min-w-0">
            {monitor.serviceUrl ? (
              <a href={monitor.serviceUrl} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="font-medium text-thistle text-sm truncate block hover:text-periwinkle transition-colors">
                {monitor.name}
              </a>
            ) : (
              <p className="font-medium text-thistle text-sm truncate">{monitor.name}</p>
            )}
            {monitor.description && <p className="text-xs text-muted truncate">{monitor.description}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            {monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > new Date() && (
              <span className="flex items-center gap-0.5 text-xs text-amber-400" title="En maintenance"><Wrench size={11} /></span>
            )}
            <StatusBadge status={monitor.enabled ? monitor.status : 'unknown'} />
          </div>
          <div className="flex items-center gap-1.5">
            {uptime != null && (
              <span className={`text-xs font-medium ${uptime >= 99 ? 'text-celadon' : uptime >= 95 ? 'text-amber-400' : 'text-red-400'}`}>
                {uptime}%
              </span>
            )}
            <span className="text-xs text-muted">{timeAgo(monitor.lastChecked, t)}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-2">
        <MetricsBlock monitor={monitor} />
        {showGraphs && points.length > 1 && (
          hasNumeric ? (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-muted" style={{ fontSize: 10 }}>
                  {cardMetric
                    ? getMetricLabel(monitor.type, cardMetric, lang, monitor.config)
                    : (getMetrics(monitor.type, monitor.config)[0]
                        ? getMetricLabel(monitor.type, getMetrics(monitor.type, monitor.config)[0].key, lang, monitor.config)
                        : null)}
                </span>
                <span className="font-medium text-thistle" style={{ fontSize: 10 }}>
                  {(() => {
                    const key = cardMetric || getMetrics(monitor.type, monitor.config)[0]?.key;
                    const last = [...points].reverse().find(p => extractValue(p, cardMetric) != null);
                    return last ? formatMetricValue(monitor.type, key, extractValue(last, cardMetric)) : '—';
                  })()}
                </span>
              </div>
              <Sparkline points={points} cardMetric={cardMetric} />
            </div>
          ) : <StatusStrip points={points} />
        )}
        {daily && <UptimeBar days={daily} />}
      </div>
    </div>
  );
}

function metricSummary(monitor) {
  const m = monitor.metrics;
  if (!m) return null;
  switch (monitor.type) {
    case 'http':       return m.responseTime != null ? `${m.responseTime}ms` : null;
    case 'ping':       return m.latency != null ? `${m.latency}ms` : null;
    case 'proxmox':    return m.cpuPct != null ? `CPU ${m.cpuPct}%` : null;
    case 'ssh':        return m.cpuPct != null ? `CPU ${m.cpuPct}%` : m.memPct != null ? `RAM ${m.memPct}%` : null;
    case 'immich':     return m.diskPct != null ? `${m.diskPct}%` : null;
    case 'ultracc':    return m.free_pct != null ? `${m.free_pct}% libre` : null;
    case 'homeassistant': return m.entityStates?.length > 0 ? `${m.entityStates.filter(e => e.state !== 'unavailable').length}/${m.entityStates.length} entités` : m.version ? `v${m.version}` : null;
    case 'adguardhome': return m.blockedPct != null ? `${m.blockedPct}% bloqués` : null;
    case 'adguard':     return m.pct_requests != null ? `${m.pct_requests}%` : null;
    case 'cloudflare': return m.total != null ? `${m.healthy}/${m.total} tunnels` : null;
    case 'portainer':  return m.containersRunning != null ? `${m.containersRunning} actifs` : null;
    case 'docker':     return m.containersRunning != null ? `${m.containersRunning} actifs` : null;
    case 'syncthing':  return m.folders_synced != null ? `${m.folders_synced} dossiers` : null;
    case 'hms':        return Array.isArray(m.vps) ? `${m.vps.filter(v => v.state === 'running').length} VPS` : null;
    case 'heartbeat':  return m.lastPing ? timeAgoMs(m.lastPing) : null;
    case 'unraid':     return m.diskPct != null ? `${m.diskPct}% disque` : null;
    case 'speedtest':  return m.downloadMbps != null ? `↓ ${m.downloadMbps} Mbps` : null;
    default:           return null;
  }
}

function ListRow({ monitor, hist, onSelect, t }) {
  const uptime = hist[monitor._id]?.uptime?.h24;
  const summary = metricSummary(monitor);
  return (
    <div
      onClick={() => onSelect(monitor)}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-periwinkle/30 hover:bg-granite-3/40 cursor-pointer transition-all duration-150 select-none animate-fade-in-up ${!monitor.enabled ? 'opacity-50' : ''}`}
    >
      <span className="shrink-0">
        <ServiceIcon type={monitor.type} size={18} url={monitor.config?.url} faviconUrl={monitor.metrics?.faviconUrl} serviceUrl={monitor.serviceUrl} customIconUrl={monitor.customIconUrl} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-thistle truncate">{monitor.name}</p>
        {monitor.category && <p className="text-xs text-muted truncate">{monitor.category}</p>}
      </div>
      {summary && <span className="text-xs text-muted shrink-0 hidden sm:block">{summary}</span>}
      {uptime != null && (
        <span className={`text-xs font-medium shrink-0 hidden sm:block ${uptime >= 99 ? 'text-celadon' : uptime >= 95 ? 'text-amber-400' : 'text-red-400'}`}>
          {uptime}%
        </span>
      )}
      <span className="text-xs text-muted shrink-0 hidden md:block">{timeAgo(monitor.lastChecked, t)}</span>
      <StatusBadge status={monitor.enabled ? monitor.status : 'unknown'} />
    </div>
  );
}

function SortableCard({ monitor, hist, dailyHist, showGraphs, onSelect, t, sortMode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: monitor._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <CardContent monitor={monitor} hist={hist} dailyHist={dailyHist} showGraphs={showGraphs} onSelect={onSelect} t={t}
        dragHandleProps={sortMode === 'manual' ? { ...attributes, ...listeners } : null} />
    </div>
  );
}

export default function Dashboard() {
  const { t } = useLang();
  const { token } = useAuth();
  const [monitors, setMonitors] = useState([]);
  const [hist, setHist] = useState({});
  const [dailyHist, setDailyHist] = useState({});
  const [showGraphs, setShowGraphs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sortMode, setSortMode] = useState('status');
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('nh_view') || 'grid');

  const toggleView = (mode) => { setViewMode(mode); localStorage.setItem('nh_view', mode); };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const [ms, h, dh, s] = await Promise.all([
        monitorsApi.list(), historyApi.all(24), historyApi.dailyAll(90),
        settingsApi.get(),
      ]);
      setMonitors(ms);
      setHist(h);
      setDailyHist(dh);
      setShowGraphs(s.showGraphs !== false);
    } catch {}
    finally { if (showSpinner) setLoading(false); }
  }

  useEffect(() => {
    load(true);

    const es = new EventSource(`/api/events?token=${token}`);
    es.addEventListener('monitor', (e) => {
      const data = JSON.parse(e.data);
      setMonitors(prev => prev.map(m => m._id === data.id ? { ...m, ...data } : m));
    });
    es.onerror = () => {};

    return () => es.close();
  }, [token]);

  const sorted = useMemo(() => {
    if (sortMode === 'name')   return [...monitors].sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'status') return [...monitors].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
    return monitors;
  }, [monitors, sortMode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(m => m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q));
  }, [sorted, search]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(m => {
      const cat = m.category?.trim() || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(m);
    });
    return map;
  }, [filtered]);

  const hasCategories = useMemo(() => monitors.some(m => m.category?.trim()), [monitors]);

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    setMonitors(prev => {
      const oldIndex = prev.findIndex(m => m._id === active.id);
      const newIndex = prev.findIndex(m => m._id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      monitorsApi.reorder(reordered.map((m, i) => ({ id: m._id, position: i }))).catch(() => {});
      return reordered;
    });
  }

  const counts = {
    total:    monitors.length,
    online:   monitors.filter(m => m.status === 'online').length,
    warning:  monitors.filter(m => ['warning', 'error', 'offline'].includes(m.status)).length,
    disabled: monitors.filter(m => !m.enabled).length,
  };

  const activeMonitor = activeId ? monitors.find(m => m._id === activeId) : null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('dashboard.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <button onClick={() => load()} className="btn-primary">
          <RefreshCw size={14} />
          <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? [0,1,2,3].map(i => <SkeletonStatCard key={i} />) : [
          { key: 'dashboard.stats.total',    value: counts.total,    icon: Radio,         color: 'text-periwinkle' },
          { key: 'dashboard.stats.online',   value: counts.online,   icon: CheckCircle,   color: 'text-celadon' },
          { key: 'dashboard.stats.alerts',   value: counts.warning,  icon: AlertTriangle, color: 'text-amber-400' },
          { key: 'dashboard.stats.disabled', value: counts.disabled, icon: Clock,         color: 'text-muted' },
        ].map(({ key, value, icon: Icon, color }) => (
          <div key={key} className="card flex items-center gap-3 p-4 animate-fade-in-up">
            <div className={`p-2 rounded-xl bg-granite-3 shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-thistle leading-none">{value}</p>
              <p className="text-xs text-muted mt-0.5">{t(key)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('dashboard.search')}
              className="input pl-8 text-sm w-full h-8"
            />
          </div>
          <select value={sortMode} onChange={e => setSortMode(e.target.value)}
            className="h-8 text-sm shrink-0 bg-surface border border-border rounded-lg px-2 pr-6 text-ink focus:outline-none focus:border-periwinkle transition-colors appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23626273' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center', backgroundSize: '1.1em 1.1em' }}>
            {['manual', 'status', 'name'].map(mode => (
              <option key={mode} value={mode}>
                {t(`dashboard.sort${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
              </option>
            ))}
          </select>
          <div className="flex gap-1 shrink-0 border border-border rounded-lg p-0.5">
            {[['grid', LayoutGrid], ['list', List]].map(([mode, Icon]) => (
              <button key={mode} onClick={() => toggleView(mode)}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === mode ? 'bg-periwinkle/20 text-periwinkle' : 'text-muted hover:text-thistle'
                }`}>
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {loading && viewMode === 'list' && (
          <div className="card divide-y divide-border p-1">
            {[0,1,2,3,4].map(i => <SkeletonListRow key={i} />)}
          </div>
        )}
        {loading && viewMode === 'grid' && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[0,1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && monitors.length === 0 && (
          <div className="card text-center py-16">
            <Radio size={36} className="text-muted/40 mx-auto mb-3" />
            <p className="text-thistle font-medium">{t('dashboard.empty')}</p>
            <p className="text-sm text-muted mt-1">{t('dashboard.emptyHint')}</p>
          </div>
        )}

        {!loading && viewMode === 'list' ? (
          <div className="card divide-y divide-border p-1">
            {[...groups.entries()].map(([cat, items]) => (
              <div key={cat}>
                {hasCategories && (
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider px-3 pt-3 pb-1">
                    {cat || t('dashboard.uncategorized')}
                  </p>
                )}
                {items.map(m => (
                  <ListRow key={m._id} monitor={m} hist={hist} onSelect={setSelected} t={t} />
                ))}
              </div>
            ))}
          </div>
        ) : !loading && (
          <DndContext sensors={sensors} collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={e => { handleDragEnd(e); setActiveId(null); }}
            onDragCancel={() => setActiveId(null)}>
            <SortableContext items={sorted.map(m => m._id)} strategy={rectSortingStrategy}>
              <div className="space-y-5">
                {[...groups.entries()].map(([cat, items]) => (
                  <div key={cat} className="space-y-2">
                    {hasCategories && (
                      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                        <span className="w-4 h-px bg-border" />
                        {cat || t('dashboard.uncategorized')}
                        <span className="flex-1 h-px bg-border" />
                      </h3>
                    )}
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {items.map(m => (
                        <SortableCard key={m._id} monitor={m} hist={hist} dailyHist={dailyHist} showGraphs={showGraphs} onSelect={setSelected} t={t} sortMode={sortMode} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activeMonitor && (
                <CardContent monitor={activeMonitor} hist={hist} dailyHist={dailyHist} showGraphs={showGraphs} onSelect={() => {}} t={t} dragging />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {selected && (
        <ServiceDetail monitor={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
