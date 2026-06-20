import React, { useState, useEffect, useMemo } from 'react';
import { incidents as api } from '../api';
import { useLang } from '../context/LangContext';
import { AlertTriangle, CheckCircle, BellOff, Trash2, X } from 'lucide-react';

const SEVERITIES = ['P1','P2','P3','P4'];
const SEV_STYLE = {
  P1: 'text-red-400 bg-red-900/30 border-red-900/40',
  P2: 'text-amber-400 bg-amber-900/30 border-amber-900/40',
  P3: 'text-periwinkle bg-blue-900/20 border-blue-900/30',
  P4: 'text-muted bg-granite/20 border-granite/30',
};

function duration(ms) {
  if (ms == null) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

function IncidentRow({ incident: i, onAcknowledge, onDelete, onSeverityChange }) {
  const { t, lang } = useLang();
  const [confirming, setConfirming] = useState(false);
  const resolved = !!i.resolvedAt;
  const acknowledged = !!i.acknowledgedAt;
  const sev = i.severity || 'P3';

  function cycleSeverity(e) {
    e.stopPropagation();
    const next = SEVERITIES[(SEVERITIES.indexOf(sev) + 1) % SEVERITIES.length];
    onSeverityChange(i._id, next);
  }
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  return (
    <div className="card flex items-start gap-3 py-3 px-4">
      <div className={`mt-0.5 shrink-0 ${resolved ? 'text-celadon' : acknowledged ? 'text-amber-400' : 'text-red-400'}`}>
        {resolved ? <CheckCircle size={16} /> : acknowledged ? <BellOff size={16} /> : <AlertTriangle size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="font-medium text-thistle text-sm">{i.monitorName}</p>
          <span className="text-xs text-muted font-mono">{i.monitorType}</span>
          <button
            onClick={cycleSeverity}
            title={t('incidents.severityClick')}
            className={`text-xs px-1.5 py-0.5 rounded border font-semibold transition-opacity hover:opacity-70 ${SEV_STYLE[sev]}`}
          >
            {sev}
          </button>
          {!resolved && !acknowledged && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-900/40">
              {t('incidents.badge')}
            </span>
          )}
          {!resolved && acknowledged && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-900/40">
              {t('incidents.acknowledged')}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-muted">
          <span>{t('incidents.start')} : {new Date(i.startedAt).toLocaleString(locale)}</span>
          {resolved && <span>{t('incidents.resolvedAt')} : {new Date(i.resolvedAt).toLocaleString(locale)}</span>}
          {resolved && i.duration && (
            <span>{t('incidents.duration')} : <span className="text-thistle">{duration(i.duration)}</span></span>
          )}
          {!resolved && (
            <span className={acknowledged ? 'text-amber-400' : 'text-red-400'}>
              {t('incidents.ongoing')(duration(Date.now() - new Date(i.startedAt)))}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 self-center">
        {!resolved && !acknowledged && (
          <button
            onClick={() => onAcknowledge(i._id)}
            title={t('incidents.acknowledge')}
            className="btn-ghost p-2 rounded-lg text-muted hover:text-amber-400 transition-colors"
          >
            <BellOff size={14} />
          </button>
        )}
        {confirming ? (
          <>
            <button
              onClick={() => onDelete(i._id)}
              className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 border border-red-900/40 hover:bg-red-900/50 transition-colors"
            >
              {t('incidents.confirmDelete')}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="p-2 rounded-lg text-muted hover:text-thistle transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title={t('incidents.delete')}
            className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
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

export default function Incidents() {
  const { t } = useLang();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterService, setFilterService] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [sortMode, setSortMode] = useState('newest');

  async function load() {
    api.list({ limit: 500 }).then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAcknowledge(id) {
    await api.acknowledge(id);
    load();
  }

  async function handleDelete(id) {
    await api.delete(id);
    load();
  }

  async function handleSeverityChange(id, severity) {
    await api.setSeverity(id, severity);
    load();
  }

  const serviceNames = useMemo(() => {
    const names = [...new Set(data.map(i => i.monitorName))].sort();
    return names;
  }, [data]);

  const filtered = useMemo(() => {
    let result = [...data];

    if (filterService)  result = result.filter(i => i.monitorName === filterService);
    if (filterSeverity) result = result.filter(i => (i.severity || 'P3') === filterSeverity);

    if (filterPeriod) {
      const cutoff = Date.now() - parseInt(filterPeriod) * 24 * 60 * 60 * 1000;
      result = result.filter(i => new Date(i.startedAt).getTime() >= cutoff);
    }

    if (filterDuration) {
      const minMs = parseInt(filterDuration) * 60 * 1000;
      result = result.filter(i => {
        const ms = i.resolvedAt
          ? i.duration
          : Date.now() - new Date(i.startedAt).getTime();
        return ms != null && ms >= minMs;
      });
    }

    result.sort((a, b) => {
      if (sortMode === 'oldest') return new Date(a.startedAt) - new Date(b.startedAt);
      if (sortMode === 'longest') {
        const da = a.resolvedAt ? a.duration : Date.now() - new Date(a.startedAt).getTime();
        const db = b.resolvedAt ? b.duration : Date.now() - new Date(b.startedAt).getTime();
        return (db ?? 0) - (da ?? 0);
      }
      return new Date(b.startedAt) - new Date(a.startedAt);
    });

    return result;
  }, [data, filterService, filterPeriod, filterDuration, sortMode]);

  const open = filtered.filter(i => !i.resolvedAt);
  const closed = filtered.filter(i => i.resolvedAt);
  const hasFilters = filterService || filterPeriod || filterDuration || filterSeverity || sortMode !== 'newest';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('incidents.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">{t('incidents.subtitle')(open.length, closed.length)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filterService}
          onChange={e => setFilterService(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allServices')}</option>
          {serviceNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <select
          value={filterPeriod}
          onChange={e => setFilterPeriod(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allPeriods')}</option>
          <option value="7">{t('incidents.filters.last7d')}</option>
          <option value="30">{t('incidents.filters.last30d')}</option>
        </select>

        <select
          value={filterDuration}
          onChange={e => setFilterDuration(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allDurations')}</option>
          <option value="5">{t('incidents.filters.gt5min')}</option>
          <option value="30">{t('incidents.filters.gt30min')}</option>
          <option value="60">{t('incidents.filters.gt1h')}</option>
        </select>

        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="">{t('incidents.filters.allSeverities')}</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value)}
          className="select h-8 text-xs pr-7 pl-3 py-0 flex-1 min-w-32"
          style={SELECT_STYLE}
        >
          <option value="newest">{t('incidents.filters.sortNewest')}</option>
          <option value="oldest">{t('incidents.filters.sortOldest')}</option>
          <option value="longest">{t('incidents.filters.sortLongest')}</option>
        </select>
      </div>

      {loading && <p className="text-muted text-sm">{t('incidents.loading')}</p>}

      {!loading && data.length > 0 && filtered.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-thistle font-medium">{t('incidents.noResults')}</p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('incidents.open')}</h2>
          {open.map(i => <IncidentRow key={i._id} incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} onSeverityChange={handleSeverityChange} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('incidents.resolved')}</h2>
          {closed.map(i => <IncidentRow key={i._id} incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} onSeverityChange={handleSeverityChange} />)}
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="card text-center py-14">
          <p className="text-thistle font-medium">{t('incidents.empty')}</p>
          <p className="text-sm text-muted mt-1">{t('incidents.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}
