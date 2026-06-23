import React, { useState, useEffect, useRef, useMemo } from 'react';
import { monitors as api } from '../api';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import ServiceModal from '../components/ServiceModal';
import ServiceIcon from '../components/ServiceIcon';
import { Plus, Play, Pencil, Trash2, Power, Wrench, X, RefreshCw, LayoutGrid, List, Search, Copy, MoreVertical, Clock } from 'lucide-react';

const STATUS_ORDER = { error: 0, offline: 0, warning: 1, online: 2, unknown: 3 };

function timeRemaining(until) {
  const ms = new Date(until) - Date.now();
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function MaintenancePopover({ monitor, onClose, onSet, onCancel }) {
  const { t } = useLang();
  const [custom, setCustom] = useState('');
  const [mode, setMode] = useState('immediate');
  const [scheduledStart, setScheduledStart] = useState('');
  const ref = useRef();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function handle() { onCloseRef.current(); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const now = new Date();
  const inMaintenance = monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > now &&
    (!monitor.maintenanceStart || new Date(monitor.maintenanceStart) <= now);
  const upcomingMaintenance = monitor.maintenanceStart && new Date(monitor.maintenanceStart) > now &&
    monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > now;

  function getDefaultStart() {
    const d = new Date(Date.now() + 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleSet(minutes) {
    let startsAt = null;
    if (mode === 'scheduled' && scheduledStart) {
      const [datePart, timePart] = scheduledStart.split('T');
      const [y, mo, d] = datePart.split('-').map(Number);
      const [h, mi] = timePart.split(':').map(Number);
      startsAt = new Date(y, mo - 1, d, h, mi).toISOString();
    }
    onSet(minutes, startsAt);
  }

  return (
    <div ref={ref} onMouseDown={e => e.stopPropagation()} className="absolute right-0 top-9 z-50 w-72 card shadow-lg border border-border p-3 space-y-3">
      <p className="text-xs font-semibold text-thistle">{t('services.maintenance.title')}</p>

      {inMaintenance ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-400 font-medium">{t('services.actions.maintenanceActive')(timeRemaining(monitor.maintenanceUntil))}</p>
          <button onClick={onCancel} className="btn-ghost w-full text-xs py-1.5 rounded-lg text-red-400 hover:text-red-300">
            {t('services.actions.maintenanceCancel')}
          </button>
        </div>
      ) : upcomingMaintenance ? (
        <div className="space-y-2">
          <p className="text-xs text-periwinkle font-medium">{t('services.maintenance.scheduledAt')(formatDateTime(monitor.maintenanceStart))}</p>
          <p className="text-xs text-muted">{t('services.maintenance.endsAt')(formatDateTime(monitor.maintenanceUntil))}</p>
          <button onClick={onCancel} className="btn-ghost w-full text-xs py-1.5 rounded-lg text-red-400 hover:text-red-300">
            {t('services.actions.maintenanceCancel')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">{t('services.maintenance.hint')}</p>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            <button onClick={() => setMode('immediate')}
              className={`flex-1 py-1.5 transition-colors ${mode === 'immediate' ? 'bg-periwinkle/20 text-periwinkle' : 'text-muted hover:text-thistle'}`}>
              {t('services.maintenance.modeImmediate')}
            </button>
            <button onClick={() => { setMode('scheduled'); if (!scheduledStart) setScheduledStart(getDefaultStart()); }}
              className={`flex-1 py-1.5 transition-colors ${mode === 'scheduled' ? 'bg-periwinkle/20 text-periwinkle' : 'text-muted hover:text-thistle'}`}>
              {t('services.maintenance.modeScheduled')}
            </button>
          </div>
          {mode === 'scheduled' && (
            <div>
              <label className="text-xs text-muted block mb-1">{t('services.maintenance.startAt')}</label>
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={e => setScheduledStart(e.target.value)}
                min={(() => { const n = new Date(); const p = x => String(x).padStart(2,'0'); return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`; })()}
                className="input text-xs py-1.5 w-full"
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-1">
            {t('services.maintenance.presets').map((label, i) => (
              <button key={i} onClick={() => handleSet(t('services.maintenance.presetValues')[i])}
                className="btn-ghost text-xs py-1.5 rounded-lg border border-border hover:border-periwinkle/40">
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number" min="1" placeholder={t('services.maintenance.custom')}
              value={custom} onChange={e => setCustom(e.target.value)}
              className="input text-xs py-1.5 flex-1"
            />
            <button onClick={() => custom > 0 && handleSet(parseInt(custom))}
              className="btn-primary text-xs px-3 py-1.5 rounded-lg">
              {t('services.maintenance.start')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Services() {
  const { t } = useLang();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [running, setRunning] = useState({});
  const [runningAll, setRunningAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(null);
  const [kebabOpen, setKebabOpen] = useState(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('status');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('nh_services_view') || 'card');

  function setView(v) { setViewMode(v); localStorage.setItem('nh_services_view', v); }

  async function load() {
    setItems(await api.list());
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!kebabOpen) return;
    function close(e) {
      if (!e.target.closest('[data-kebab]')) setKebabOpen(null);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [kebabOpen]);

  const sorted = useMemo(() => {
    if (sortMode === 'name') return [...items].sort((a, b) => a.name.localeCompare(b.name));
    return [...items].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
  }, [items, sortMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  }, [sorted, search]);

  async function handleSave(form) {
    try {
      if (modal && modal._id) await api.update(modal._id, form);
      else await api.create(form);
      setModal(null);
      load();
    } catch (err) {
      toast.add(err.response?.data?.error || err.message, 'error');
    }
  }

  async function handleToggle(id) {
    await api.toggle(id);
    load();
  }

  async function handleRun(id) {
    setRunning(r => ({ ...r, [id]: true }));
    await api.run(id);
    setTimeout(() => { load(); setRunning(r => ({ ...r, [id]: false })); }, 2000);
  }

  async function handleRunAll() {
    const enabled = items.filter(m => m.enabled);
    if (!enabled.length) return;
    const ids = enabled.map(m => m._id);
    setRunningAll(true);
    setRunning(r => Object.fromEntries([...Object.entries(r), ...ids.map(id => [id, true])]));
    await Promise.allSettled(enabled.map(m => api.run(m._id)));
    setTimeout(() => {
      load();
      setRunningAll(false);
      setRunning(r => Object.fromEntries(Object.entries(r).filter(([id]) => !ids.includes(id))));
    }, 2000);
  }

  async function handleClone(id) {
    await api.clone(id);
    load();
  }

  async function handleDelete(id) {
    await api.delete(id);
    setConfirmDelete(null);
    load();
  }

  async function handleSetMaintenance(id, minutes, startsAt) {
    await api.setMaintenance(id, { minutes, startsAt: startsAt || null });
    setMaintenanceOpen(null);
    load();
  }

  async function handleCancelMaintenance(id) {
    await api.cancelMaintenance(id);
    setMaintenanceOpen(null);
    load();
  }

  function timeAgo(date) {
    if (!date) return t('time.never');
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return `${s}${t('time.sec')}`;
    if (s < 3600) return `${Math.floor(s / 60)}${t('time.min')}`;
    return `${Math.floor(s / 3600)}${t('time.hour')}`;
  }

  const n = items.length;
  const subtitle = `${n} ${n !== 1 ? t('services.subtitle_many') : t('services.subtitle_one')}`;

  function renderActions(m) {
    const now = new Date();
    const inMaintenance = m.maintenanceUntil && new Date(m.maintenanceUntil) > now &&
      (!m.maintenanceStart || new Date(m.maintenanceStart) <= now);
    const upcomingMaintenance = m.maintenanceStart && new Date(m.maintenanceStart) > now &&
      m.maintenanceUntil && new Date(m.maintenanceUntil) > now;

    // Desktop buttons (hidden on mobile)
    const desktopActions = (
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <button title={t('services.actions.run')} onClick={() => handleRun(m._id)}
          disabled={running[m._id] || !m.enabled}
          className="btn-ghost p-2 rounded-lg">
          <Play size={14} className={running[m._id] ? 'animate-pulse text-periwinkle' : ''} />
        </button>
        <button title={m.enabled ? t('services.actions.disable') : t('services.actions.enable')}
          onClick={() => handleToggle(m._id)}
          className={`btn-ghost p-2 rounded-lg ${m.enabled ? 'text-celadon' : 'text-muted'}`}>
          <Power size={14} />
        </button>
        <div className="relative">
          <button
            title={t('services.actions.maintenance')}
            onClick={() => setMaintenanceOpen(maintenanceOpen === m._id ? null : m._id)}
            className={`btn-ghost p-2 rounded-lg ${inMaintenance ? 'text-amber-400' : upcomingMaintenance ? 'text-periwinkle' : ''}`}>
            <Wrench size={14} />
          </button>
          {maintenanceOpen === m._id && (
            <MaintenancePopover
              monitor={m}
              onClose={() => setMaintenanceOpen(null)}
              onSet={(minutes, startsAt) => handleSetMaintenance(m._id, minutes, startsAt)}
              onCancel={() => handleCancelMaintenance(m._id)}
            />
          )}
        </div>
        <button title={t('services.actions.edit')} onClick={() => setModal(m)} className="btn-ghost p-2 rounded-lg">
          <Pencil size={14} />
        </button>
        <button title={t('services.actions.clone')} onClick={() => handleClone(m._id)} className="btn-ghost p-2 rounded-lg">
          <Copy size={14} />
        </button>
        {confirmDelete === m._id ? (
          <>
            <button onClick={() => handleDelete(m._id)}
              className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 border border-red-900/40 hover:bg-red-900/50 transition-colors">
              {t('incidents.confirmDelete')}
            </button>
            <button onClick={() => setConfirmDelete(null)} className="p-2 rounded-lg text-muted hover:text-thistle transition-colors">
              <X size={14} />
            </button>
          </>
        ) : (
          <button title={t('services.actions.delete')} onClick={() => setConfirmDelete(m._id)}
            className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );

    // Mobile kebab menu (visible only on mobile)
    const mobileActions = (
      <div data-kebab className="relative sm:hidden shrink-0 flex items-center">
        <button
          onClick={() => setKebabOpen(kebabOpen === m._id ? null : m._id)}
          className="btn-ghost p-2 rounded-lg">
          <MoreVertical size={16} />
        </button>
        {kebabOpen === m._id && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
            <button onClick={() => { handleRun(m._id); setKebabOpen(null); }}
              disabled={running[m._id] || !m.enabled}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-granite-3 active:bg-granite-3 disabled:opacity-40 transition-colors">
              <Play size={13} className={running[m._id] ? 'animate-pulse text-periwinkle' : 'text-muted'} />
              {t('services.actions.run')}
            </button>
            <button onClick={() => { handleToggle(m._id); setKebabOpen(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-granite-3 active:bg-granite-3 transition-colors">
              <Power size={13} className={m.enabled ? 'text-celadon' : 'text-muted'} />
              {m.enabled ? t('services.actions.disable') : t('services.actions.enable')}
            </button>
            <button onClick={() => { setKebabOpen(null); setMaintenanceOpen(m._id); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-granite-3 active:bg-granite-3 transition-colors ${inMaintenance ? 'text-amber-400' : 'text-ink'}`}>
              <Wrench size={13} className={inMaintenance ? 'text-amber-400' : 'text-muted'} />
              {t('services.actions.maintenance')}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            <button onClick={() => { setModal(m); setKebabOpen(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-granite-3 active:bg-granite-3 transition-colors">
              <Pencil size={13} className="text-muted" />
              {t('services.actions.edit')}
            </button>
            <button onClick={() => { handleClone(m._id); setKebabOpen(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-granite-3 active:bg-granite-3 transition-colors">
              <Copy size={13} className="text-muted" />
              {t('services.actions.clone')}
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            {confirmDelete === m._id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <button onClick={() => { handleDelete(m._id); setKebabOpen(null); }}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-900/30 text-red-400 border border-red-900/40 hover:bg-red-900/50 transition-colors">
                  {t('incidents.confirmDelete')}
                </button>
                <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg text-muted hover:text-thistle transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(m._id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={13} />
                {t('services.actions.delete')}
              </button>
            )}
          </div>
        )}
        {maintenanceOpen === m._id && (
          <MaintenancePopover
            monitor={m}
            onClose={() => setMaintenanceOpen(null)}
            onSet={(minutes, startsAt) => handleSetMaintenance(m._id, minutes, startsAt)}
            onCancel={() => handleCancelMaintenance(m._id)}
          />
        )}
      </div>
    );

    return (
      <div className="flex items-center shrink-0">
        {desktopActions}
        {mobileActions}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('services.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRunAll} disabled={runningAll} className="btn-primary text-sm disabled:opacity-50">
            <RefreshCw size={15} className={runningAll ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('services.runAll')}</span>
          </button>
          <button onClick={() => setModal('new')} className="btn-primary text-sm">
            <Plus size={15} />
            <span className="hidden sm:inline">{t('services.new')}</span>
          </button>
        </div>
      </div>

      {/* Toolbar: search + sort + view */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('dashboard.search')}
            className="input pl-8 h-8 text-sm w-full"
          />
        </div>
        <select value={sortMode} onChange={e => setSortMode(e.target.value)}
          className="h-8 text-sm shrink-0 bg-surface border border-border rounded-lg px-2 pr-6 text-ink focus:outline-none focus:border-periwinkle transition-colors appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23626273' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center', backgroundSize: '1.1em 1.1em' }}>
          {['status', 'name'].map(mode => (
            <option key={mode} value={mode}>
              {t(`dashboard.sort${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
            </option>
          ))}
        </select>
        <div className="flex gap-1 shrink-0 border border-border rounded-lg p-0.5 h-8 items-center">
          {[['card', LayoutGrid], ['list', List]].map(([mode, Icon]) => (
            <button key={mode} onClick={() => setView(mode)}
              className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-periwinkle/20 text-periwinkle' : 'text-muted hover:text-thistle'}`}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div className="card text-center py-14">
          <p className="text-thistle font-medium">{t('services.emptyTitle')}</p>
          <p className="text-sm text-muted mt-1">{t('services.emptyHint')}</p>
        </div>
      )}

      {filtered.length === 0 && items.length > 0 && (
        <div className="card text-center py-10">
          <p className="text-muted text-sm">{t('dashboard.noResults')}</p>
        </div>
      )}

      {/* Card view (default) */}
      {viewMode === 'card' && (
        <div className="space-y-3">
          {filtered.map(m => {
            const _now = new Date();
            const inMaintenance = m.maintenanceUntil && new Date(m.maintenanceUntil) > _now &&
              (!m.maintenanceStart || new Date(m.maintenanceStart) <= _now);
            const upcomingMaintenance = m.maintenanceStart && new Date(m.maintenanceStart) > _now &&
              m.maintenanceUntil && new Date(m.maintenanceUntil) > _now;
            return (
              <div key={m._id} className={`card ${!m.enabled ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5"><ServiceIcon type={m.type} size={22} url={m.config?.url} faviconUrl={m.metrics?.faviconUrl} serviceUrl={m.serviceUrl} customIconUrl={m.customIconUrl} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {m.serviceUrl ? (
                        <a href={m.serviceUrl} target="_blank" rel="noreferrer"
                          className="font-semibold text-thistle text-sm hover:text-periwinkle transition-colors">
                          {m.name}
                        </a>
                      ) : (
                        <p className="font-semibold text-thistle text-sm">{m.name}</p>
                      )}
                      <StatusBadge status={m.enabled ? m.status : 'unknown'} />
                      {inMaintenance && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-900/40 flex items-center gap-1">
                          <Wrench size={10} /> {timeRemaining(m.maintenanceUntil)}
                        </span>
                      )}
                      {upcomingMaintenance && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-periwinkle/10 text-periwinkle border border-periwinkle/30 flex items-center gap-1">
                          <Clock size={10} /> {t('services.maintenance.scheduledBadge')}
                        </span>
                      )}
                    </div>
                    {m.description && <p className="text-xs text-muted truncate mt-0.5">{m.description}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted">
                      <span>{t('services.checkEvery')} {m.checkInterval}min</span>
                      {m.reportInterval > 0 && <span>· {t('services.report')} /{m.reportInterval}h</span>}
                      <span>· {timeAgo(m.lastChecked)}</span>
                    </div>
                  </div>
                  {renderActions(m)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view (compact rows) */}
      {viewMode === 'list' && (
        <div className="card divide-y divide-border p-0 overflow-hidden">
          {filtered.map(m => {
            const _now2 = new Date();
            const inMaintenance = m.maintenanceUntil && new Date(m.maintenanceUntil) > _now2 &&
              (!m.maintenanceStart || new Date(m.maintenanceStart) <= _now2);
            const upcomingMaintenance = m.maintenanceStart && new Date(m.maintenanceStart) > _now2 &&
              m.maintenanceUntil && new Date(m.maintenanceUntil) > _now2;
            return (
              <div key={m._id} className={`flex items-center gap-3 px-4 py-2.5 ${!m.enabled ? 'opacity-60' : ''}`}>
                <span className="shrink-0"><ServiceIcon type={m.type} size={18} url={m.config?.url} faviconUrl={m.metrics?.faviconUrl} serviceUrl={m.serviceUrl} customIconUrl={m.customIconUrl} /></span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {m.serviceUrl ? (
                    <a href={m.serviceUrl} target="_blank" rel="noreferrer"
                      className="font-medium text-thistle text-sm truncate hover:text-periwinkle transition-colors">
                      {m.name}
                    </a>
                  ) : (
                    <span className="font-medium text-thistle text-sm truncate">{m.name}</span>
                  )}
                  {inMaintenance && <Wrench size={11} className="text-amber-400 shrink-0" />}
                  {upcomingMaintenance && <Clock size={11} className="text-periwinkle shrink-0" />}
                </div>
                <span className="sm:hidden shrink-0"><StatusBadge status={m.enabled ? m.status : 'unknown'} dotOnly /></span>
                <span className="hidden sm:inline-flex shrink-0"><StatusBadge status={m.enabled ? m.status : 'unknown'} /></span>
                <span className="text-xs text-muted hidden sm:block w-20 text-right shrink-0">{timeAgo(m.lastChecked)}</span>
                {renderActions(m)}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ServiceModal
          monitor={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
