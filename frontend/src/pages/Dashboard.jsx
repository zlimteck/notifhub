import React, { useState, useEffect, useMemo } from 'react';
import { monitors as monitorsApi, history as historyApi } from '../api';
import { useLang } from '../context/LangContext';
import StatusBadge from '../components/StatusBadge';
import ServiceIcon from '../components/ServiceIcon';
import ServiceDetail from '../components/ServiceDetail';
import { RefreshCw, Radio, AlertTriangle, CheckCircle, Clock, GripVertical, Search } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
        <div className={`flex items-center gap-1 text-xs ${
          metrics.sslStatus === 'expired'  ? 'text-red-400' :
          metrics.sslStatus === 'expiring' ? 'text-amber-400' : 'text-muted'
        }`}>
          <span>SSL ·{' '}
            {metrics.sslStatus === 'expired'
              ? t('metrics.sslExpired')
              : `${metrics.sslInfo.daysLeft}j`}
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
      {metrics.memPct != null && (
        <div className="flex gap-4 text-xs text-muted">
          <span>{t('metrics.ram')} <span className={metrics.memPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.memPct}%</span></span>
          {metrics.diskPct != null && <span>{t('metrics.disk')} <span className={metrics.diskPct > 80 ? 'text-amber-400 font-medium' : 'text-thistle font-medium'}>{metrics.diskPct}%</span></span>}
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

function CardContent({ monitor, hist, onSelect, t, dragging = false, dragHandleProps = {} }) {
  const uptime = hist[monitor._id]?.uptime?.h24;
  return (
    <div
      onClick={() => !dragging && onSelect(monitor)}
      className={`group card flex flex-col gap-2.5 cursor-pointer hover:border-periwinkle/40 transition-colors select-none h-full ${!monitor.enabled ? 'opacity-50' : ''} ${dragging ? 'shadow-2xl border-periwinkle/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 relative flex items-center justify-center w-5 h-5">
            <span className={dragHandleProps ? 'transition-opacity group-hover:opacity-0' : ''}>
              <ServiceIcon type={monitor.type} size={20} url={monitor.config?.url} faviconUrl={monitor.metrics?.faviconUrl} />
            </span>
            {dragHandleProps && (
              <div {...dragHandleProps} onClick={e => e.stopPropagation()}
                className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted opacity-0 group-hover:opacity-100 transition-opacity touch-none">
                <GripVertical size={16} />
              </div>
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-thistle text-sm truncate">{monitor.name}</p>
            {monitor.description && <p className="text-xs text-muted truncate">{monitor.description}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={monitor.enabled ? monitor.status : 'unknown'} />
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
      <div className="flex-1 flex flex-col justify-end">
        <MetricsBlock monitor={monitor} />
      </div>
    </div>
  );
}

function SortableCard({ monitor, hist, onSelect, t, sortMode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: monitor._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <CardContent monitor={monitor} hist={hist} onSelect={onSelect} t={t}
        dragHandleProps={sortMode === 'manual' ? { ...attributes, ...listeners } : null} />
    </div>
  );
}

export default function Dashboard() {
  const { t } = useLang();
  const [monitors, setMonitors] = useState([]);
  const [hist, setHist] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sortMode, setSortMode] = useState('status');
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function load() {
    try {
      const [ms, h] = await Promise.all([monitorsApi.list(), historyApi.all(24)]);
      setMonitors(ms);
      setHist(h);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

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
        <button onClick={load} className="btn-primary">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'dashboard.stats.total',    value: counts.total,    icon: Radio,         color: 'text-periwinkle' },
          { key: 'dashboard.stats.online',   value: counts.online,   icon: CheckCircle,   color: 'text-celadon' },
          { key: 'dashboard.stats.alerts',   value: counts.warning,  icon: AlertTriangle, color: 'text-amber-400' },
          { key: 'dashboard.stats.disabled', value: counts.disabled, icon: Clock,         color: 'text-muted' },
        ].map(({ key, value, icon: Icon, color }) => (
          <div key={key} className="card flex items-center gap-3 p-4">
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
          <div className="flex gap-1 shrink-0">
            {['manual', 'status', 'name'].map(mode => (
              <button key={mode} onClick={() => setSortMode(mode)}
                className={`text-xs px-2.5 h-8 rounded-lg border transition-colors ${
                  sortMode === mode
                    ? 'bg-periwinkle/20 text-periwinkle border-periwinkle/30'
                    : 'text-muted border-border hover:text-thistle hover:border-granite'
                }`}>
                {t(`dashboard.sort${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-muted text-sm">{t('dashboard.loading')}</p>}
        {!loading && monitors.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-muted text-sm">{t('dashboard.empty')}</p>
          </div>
        )}

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
                      <SortableCard key={m._id} monitor={m} hist={hist} onSelect={setSelected} t={t} sortMode={sortMode} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeMonitor && (
              <CardContent monitor={activeMonitor} hist={hist} onSelect={() => {}} t={t} dragging />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {selected && (
        <ServiceDetail monitor={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
