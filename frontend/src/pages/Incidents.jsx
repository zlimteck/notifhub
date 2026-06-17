import React, { useState, useEffect } from 'react';
import { incidents as api } from '../api';
import { useLang } from '../context/LangContext';
import { AlertTriangle, CheckCircle, BellOff, Trash2 } from 'lucide-react';

function duration(ms) {
  if (ms == null) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

function IncidentRow({ incident: i, onAcknowledge, onDelete }) {
  const { t, lang } = useLang();
  const resolved = !!i.resolvedAt;
  const acknowledged = !!i.acknowledgedAt;
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
        <button
          onClick={() => onDelete(i._id)}
          title={t('incidents.delete')}
          className="p-2 rounded-lg text-muted hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Incidents() {
  const { t } = useLang();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    api.list({ limit: 100 }).then(setData).catch(() => {}).finally(() => setLoading(false));
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

  const open = data.filter(i => !i.resolvedAt);
  const closed = data.filter(i => i.resolvedAt);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('incidents.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">{t('incidents.subtitle')(open.length, closed.length)}</p>
      </div>

      {loading && <p className="text-muted text-sm">{t('incidents.loading')}</p>}

      {open.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('incidents.open')}</h2>
          {open.map(i => <IncidentRow key={i._id} incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('incidents.resolved')}</h2>
          {closed.map(i => <IncidentRow key={i._id} incident={i} onAcknowledge={handleAcknowledge} onDelete={handleDelete} />)}
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
