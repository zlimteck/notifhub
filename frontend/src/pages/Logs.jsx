import React, { useState, useEffect } from 'react';
import { logs as api, monitors as monitorsApi } from '../api';
import { useLang } from '../context/LangContext';
import { Trash2, RefreshCw, Send } from 'lucide-react';

const LEVEL_BADGE = {
  info:    'bg-granite-3 text-periwinkle',
  success: 'bg-celadon/20 text-celadon',
  warning: 'bg-amber-900/40 text-amber-300',
  error:   'bg-red-900/40 text-red-300',
};

const LEVEL_DOT = {
  info:    'text-periwinkle',
  success: 'text-celadon',
  warning: 'text-amber-400',
  error:   'text-red-400',
};

function Composer({ onSent }) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ title: '', message: '', level: 'info' });
  const [state, setState] = useState(null);

  async function handleSend(e) {
    e.preventDefault();
    if (!form.title || !form.message) return;
    setState('sending');
    try {
      const r = await api.send(form);
      setState(r.sent ? 'ok' : 'no_urls');
      if (r.sent) { setForm({ title: '', message: '', level: 'info' }); onSent?.(); }
    } catch { setState('err'); }
    setTimeout(() => setState(null), 3000);
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
        <Send size={14} className="text-periwinkle" /> {t('logs.composer.title')}
      </h2>
      <form onSubmit={handleSend} className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">{t('logs.composer.fieldTitle')}</label>
            <input className="input" placeholder={t('logs.composer.titlePlaceholder')} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('logs.composer.level')}</label>
            <select className="select" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
              <option value="info">{t('logs.levels.info')}</option>
              <option value="success">{t('logs.levels.success')}</option>
              <option value="warning">{t('logs.levels.warning')}</option>
              <option value="error">{t('logs.levels.error')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('logs.composer.message')}</label>
          <textarea className="input h-20 resize-none" placeholder={t('logs.composer.messagePlaceholder')}
            value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={state === 'sending'} className="btn-primary">
            <Send size={14} className={state === 'sending' ? 'animate-pulse' : ''} />
            {state === 'sending' ? t('logs.composer.sending') : t('logs.composer.send')}
          </button>
          {state === 'ok'      && <span className="text-sm text-celadon">{t('logs.composer.ok')}</span>}
          {state === 'no_urls' && <span className="text-sm text-amber-400">{t('logs.composer.noUrls')}</span>}
          {state === 'err'     && <span className="text-sm text-red-400">{t('logs.composer.error')}</span>}
        </div>
      </form>
    </div>
  );
}

export default function Logs() {
  const { t, lang } = useLang();
  const [data, setData] = useState({ logs: [], total: 0 });
  const [monitors, setMonitors] = useState([]);
  const [filter, setFilter] = useState({ level: '', monitorId: '', limit: 50 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  async function load() {
    setLoading(true);
    try {
      const [d, ms] = await Promise.all([api.list(filter), monitorsApi.list()]);
      setData(d);
      setMonitors(ms);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleClear() {
    if (!confirm(t('logs.clearConfirm'))) return;
    await api.clear();
    load();
  }

  const q = search.trim().toLowerCase();
  const displayed = q
    ? data.logs.filter(l => l.title?.toLowerCase().includes(q) || l.message?.toLowerCase().includes(q) || l.monitorName?.toLowerCase().includes(q))
    : data.logs;

  const n = data.total;
  const subtitle = `${n} ${n !== 1 ? t('logs.subtitle_many') : t('logs.subtitle_one')}`;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('logs.title')}</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-primary">
            <RefreshCw size={14} /><span className="hidden sm:inline">{t('dashboard.refresh')}</span>
          </button>
          <button onClick={handleClear} className="btn-danger">
            <Trash2 size={14} /><span className="hidden sm:inline">{t('logs.clear')}</span>
          </button>
        </div>
      </div>

      <Composer onSent={load} />

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          className="input h-9 text-sm flex-1 min-w-48"
          placeholder={lang === 'fr' ? 'Rechercher…' : 'Search…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select w-full sm:w-40" value={filter.level}
          onChange={e => setFilter(f => ({ ...f, level: e.target.value }))}>
          <option value="">{t('logs.allLevels')}</option>
          <option value="info">{t('logs.levels.info')}</option>
          <option value="success">{t('logs.levels.success')}</option>
          <option value="warning">{t('logs.levels.warning')}</option>
          <option value="error">{t('logs.levels.error')}</option>
        </select>
        <select className="select w-full sm:w-52" value={filter.monitorId}
          onChange={e => setFilter(f => ({ ...f, monitorId: e.target.value }))}>
          <option value="">{t('logs.allServices')}</option>
          {[...monitors].sort((a,b) => a.name.localeCompare(b.name)).map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <select className="select w-full sm:w-32" value={filter.limit}
          onChange={e => setFilter(f => ({ ...f, limit: +e.target.value }))}>
          {[25, 50, 100].map(v => (
            <option key={v} value={v}>{v} {t('logs.lines')}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-muted text-sm">{t('logs.loading')}</p>}

      {!loading && data.logs.length === 0 && (
        <div className="card text-center py-14">
          <p className="text-thistle font-medium">{t('logs.empty')}</p>
        </div>
      )}

      <div className="space-y-2">
        {displayed.map(log => (
          <div key={log._id} className="card flex items-start gap-3 py-3 px-4">
            <span className={`shrink-0 mt-1 text-sm ${LEVEL_DOT[log.level]}`}>●</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-medium text-thistle text-sm">{log.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_BADGE[log.level]}`}>
                  {t(`logs.levels.${log.level}`) || log.level}
                </span>
                {!log.sent && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-granite-3 text-muted">{t('logs.notSent')}</span>
                )}
              </div>
              <p className="text-sm text-muted mt-1 whitespace-pre-line leading-relaxed break-words">{log.message}</p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">
                <span>{log.monitorName}</span>
                <span>·</span>
                <span>{new Date(log.createdAt).toLocaleString(locale)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
