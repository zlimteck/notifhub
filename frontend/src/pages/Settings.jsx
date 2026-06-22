import React, { useState, useEffect } from 'react';
import { settings as api, auth as authApi } from '../api';
import { Save, Send, Info, KeyRound, CalendarClock, BarChart2, Globe, Copy, Check, RefreshCw, Server, Download, Upload, AlertTriangle, Network, Wifi, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';

const EXAMPLES = [
  'pover://UserKey@ApiToken/',
  'tgram://BotToken/ChatID/',
  'slack://TokenA/TokenB/TokenC/',
  'discord://WebhookID/WebhookToken/',
  'mailto://user:pass@gmail.com',
];

const EMPTY_PROXY_FORM = { name: '', type: 'http', host: '', port: '', username: '', password: '', privateKey: '' };

function ProxyForm({ initial = EMPTY_PROXY_FORM, onSave, onCancel, t, saving }) {
  const [form, setForm] = useState(initial);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTestResult(null); };

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testProxy({ ...form, port: form.port ? +form.port : undefined });
      setTestResult(r.ok ? { ok: true, ms: r.ms } : { ok: false, error: r.error });
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message });
    }
    setTesting(false);
  }

  const canTest = form.host && (form.type === 'ssh' || form.port);

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <div>
        <label className="label">{t('settings.proxies.name')}</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('settings.proxies.namePlaceholder')} />
      </div>
      <div>
        <label className="label">{t('settings.proxies.type')}</label>
        <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="http">HTTP</option>
          <option value="https">HTTPS</option>
          <option value="socks5">SOCKS5</option>
          <option value="ssh">SSH tunnel</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">{t('settings.proxies.host')}</label>
          <input className="input" value={form.host} onChange={e => set('host', e.target.value)} placeholder={form.type === 'ssh' ? 'jump.example.com' : '127.0.0.1'} />
        </div>
        <div>
          <label className="label">{t('settings.proxies.port')}</label>
          <input className="input" type="number" value={form.port} onChange={e => set('port', e.target.value)} placeholder={form.type === 'ssh' ? '22' : '1080'} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{form.type === 'ssh' ? t('settings.proxies.sshUser') : t('settings.proxies.username')}</label>
          <input className="input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="user" />
        </div>
        <div>
          <label className="label">{t('settings.proxies.password')}</label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
        </div>
      </div>
      {form.type === 'ssh' && (
        <div>
          <label className="label">{t('settings.proxies.privateKey')}</label>
          <textarea className="input h-20 resize-none font-mono text-xs"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            value={form.privateKey} onChange={e => set('privateKey', e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <button type="button" disabled={saving || !form.host} onClick={() => onSave(form)}
            className="btn-primary text-xs px-3 py-1.5">
            <Save size={12} /> {t('settings.proxies.save')}
          </button>
          <button type="button" disabled={testing || !canTest} onClick={handleTest}
            className="btn-ghost border border-border text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40">
            <Wifi size={12} className={testing ? 'animate-pulse text-periwinkle' : ''} />
            {testing ? t('settings.proxies.testing') : t('settings.proxies.test')}
          </button>
          <button type="button" onClick={onCancel}
            className="btn-ghost border border-border text-xs px-3 py-1.5">
            {t('settings.proxies.cancel')}
          </button>
        </div>
        {testResult && (
          <p className={`text-xs ${testResult.ok ? 'text-celadon' : 'text-red-400'}`}>
            {testResult.ok ? `✓ ${t('settings.proxies.testOk')} (${testResult.ms}ms)` : `✗ ${testResult.error}`}
          </p>
        )}
      </div>
    </div>
  );
}

function ProxiesCard({ proxies, setProxies, t }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleAdd(form) {
    setSaving(true);
    try {
      const created = await api.addProxy({ ...form, port: form.port ? +form.port : undefined });
      setProxies(prev => [...prev, created]);
      setAdding(false);
      toast.add(t('settings.saved'), 'success');
    } catch { toast.add('Error', 'error'); }
    setSaving(false);
  }

  async function handleUpdate(id, form) {
    setSaving(true);
    try {
      const updated = await api.updateProxy(id, { ...form, port: form.port ? +form.port : undefined });
      setProxies(prev => prev.map(p => p._id === id ? updated : p));
      setEditingId(null);
      toast.add(t('settings.saved'), 'success');
    } catch { toast.add('Error', 'error'); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm(t('settings.proxies.confirmDelete'))) return;
    try {
      await api.deleteProxy(id);
      setProxies(prev => prev.filter(p => p._id !== id));
    } catch { toast.add('Error', 'error'); }
  }

  async function handleActivate(id) {
    try {
      const r = await api.activateProxy(id);
      setProxies(prev => prev.map(p => ({ ...p, active: p._id === id ? r.active : false })));
    } catch { toast.add('Error', 'error'); }
  }

  async function handleTest(proxy) {
    setTesting(proxy._id);
    setTestResults(r => ({ ...r, [proxy._id]: null }));
    try {
      const r = await api.testProxy(proxy);
      setTestResults(prev => ({ ...prev, [proxy._id]: r.ok ? { ok: true, ms: r.ms } : { ok: false, error: r.error } }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [proxy._id]: { ok: false, error: err.response?.data?.error || err.message } }));
    }
    setTesting(null);
  }

  const typeLabel = (type) => ({ http: 'HTTP', https: 'HTTPS', socks5: 'SOCKS5', ssh: 'SSH' }[type] || type?.toUpperCase());

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
        <Network size={14} className="text-periwinkle" /> {t('settings.proxies.title')}
      </h2>
      <p className="text-xs text-muted">{t('settings.proxies.hint')}</p>

      {proxies.length === 0 && !adding && (
        <p className="text-xs text-muted italic">{t('settings.proxies.empty')}</p>
      )}

      <div className="space-y-2">
        {proxies.map(proxy => {
          const result = testResults[proxy._id];
          const isEditing = editingId === proxy._id;
          return (
            <div key={proxy._id} className={`rounded-xl border px-4 py-3 space-y-2 transition-colors ${proxy.active ? 'border-periwinkle/40 bg-periwinkle/5' : 'border-border bg-granite-3/30'}`}>
              {/* Row 1 : toggle + nom + badge */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleActivate(proxy._id)}
                  title={proxy.active ? t('settings.proxies.deactivate') : t('settings.proxies.activate')}
                  className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${proxy.active ? 'border-periwinkle bg-periwinkle' : 'border-muted hover:border-periwinkle'}`} />
                <span className="text-sm text-thistle font-medium flex-1 min-w-0 truncate">{proxy.name}</span>
                {proxy.active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-periwinkle/20 text-periwinkle font-medium shrink-0">{t('settings.proxies.active')}</span>
                )}
              </div>

              {/* Row 2 : host info */}
              <div>
                <span className="text-xs text-muted">{typeLabel(proxy.type)} · {proxy.host}{proxy.port ? `:${proxy.port}` : ''}</span>
              </div>

              {/* Row 3 : boutons d'action */}
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={testing === proxy._id || !proxy.host}
                  onClick={() => handleTest(proxy)}
                  className="btn-ghost border border-border text-xs px-2 py-1 flex items-center gap-1 disabled:opacity-40">
                  <Wifi size={11} className={testing === proxy._id ? 'animate-pulse text-periwinkle' : ''} />
                  {testing === proxy._id ? t('settings.proxies.testing') : t('settings.proxies.test')}
                </button>
                <button type="button" onClick={() => setEditingId(isEditing ? null : proxy._id)}
                  className="btn-ghost border border-border p-1.5">
                  {isEditing ? <ChevronUp size={13} /> : <Pencil size={13} />}
                </button>
                <button type="button" onClick={() => handleDelete(proxy._id)}
                  className="btn-ghost border border-border p-1.5 hover:border-red-400 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>

              {result && (
                <p className={`text-xs ${result.ok ? 'text-celadon' : 'text-red-400'}`}>
                  {result.ok ? `✓ ${t('settings.proxies.testOk')} (${result.ms}ms)` : `✗ ${result.error}`}
                </p>
              )}

              {isEditing && (
                <ProxyForm
                  initial={{ name: proxy.name, type: proxy.type || 'http', host: proxy.host || '', port: proxy.port || '', username: proxy.username || '', password: '', privateKey: '' }}
                  onSave={form => handleUpdate(proxy._id, form)}
                  onCancel={() => setEditingId(null)}
                  t={t} saving={saving}
                />
              )}
            </div>
          );
        })}

        {adding && (
          <div className="rounded-xl border border-dashed border-border px-4 py-3">
            <ProxyForm
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
              t={t} saving={saving}
            />
          </div>
        )}
      </div>

      {!adding && (
        <button type="button" onClick={() => { setAdding(true); setEditingId(null); }}
          className="btn-ghost border border-border flex items-center gap-2">
          <Plus size={14} /> {t('settings.proxies.add')}
        </button>
      )}
    </div>
  );
}

function ChangePassword() {
  const { t } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { toast.add(t('settings.password.mismatch'), 'error'); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.add(t('settings.password.ok'), 'success');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.add(err.response?.data?.error || '❌ Error', 'error');
    }
    setSaving(false);
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
        <KeyRound size={14} className="text-periwinkle" /> {t('settings.password.title')}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input className="input" type="password" placeholder={t('settings.password.current')}
          value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
        <input className="input" type="password" placeholder={t('settings.password.new')}
          value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} />
        <input className="input" type="password" placeholder={t('settings.password.confirm')}
          value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        <button type="submit" disabled={saving} className="btn-primary">
          <Save size={14} /> {saving ? t('settings.password.saving') : t('settings.save')}
        </button>
      </form>
    </div>
  );
}

export default function Settings() {
  const { t } = useLang();
  const toast = useToast();
  const [proxies, setProxies] = useState([]);
  const [form, setForm] = useState({ appriseUrls: [], appriseApiUrl: 'http://apprise:8000', weeklyReport: { enabled: false, dayOfWeek: 1, hour: 8 }, showGraphs: true, statusPage: { title: '', description: '', logoUrl: '', accentColor: '', footerText: '' } });
  const [urlsText, setUrlsText] = useState('');
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get()
      .then(s => {
        setForm({
          appriseUrls: s.appriseUrls || [],
          appriseApiUrl: s.appriseApiUrl || 'http://apprise:8000',
          weeklyReport: s.weeklyReport || { enabled: false, dayOfWeek: 1, hour: 8 },
          showGraphs: s.showGraphs !== false,
          statusPage: s.statusPage || { title: '', description: '', logoUrl: '', accentColor: '', footerText: '' },
        });
        setProxies(s.proxies || []);
        setUrlsText((s.appriseUrls || []).join('\n'));
        setMcpApiKey(s.mcpApiKey || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveAll(patch = {}) {
    const appriseUrls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
    await api.save({
      appriseUrls,
      appriseApiUrl: form.appriseApiUrl,
      weeklyReport: form.weeklyReport,
      showGraphs: form.showGraphs,
      statusPage: form.statusPage,
      ...patch,
    });
    toast.add(t('settings.saved'), 'success');
  }

  async function handleSaveApprise(e) {
    e.preventDefault();
    await saveAll();
  }

  async function handleSaveWeekly(e) {
    e.preventDefault();
    await saveAll();
  }

  async function handleTest() {
    setTesting(true);
    try {
      const r = await api.test();
      toast.add(r.sent ? t('settings.testOk') : t('settings.testNoUrls'), r.sent ? 'success' : 'warning');
    } catch { toast.add(t('settings.testError'), 'error'); }
    setTesting(false);
  }

  async function handleExport() {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orveil-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.add(t('settings.backup.exportError'), 'error'); }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !Array.isArray(data.monitors)) throw new Error('Format invalide');
      const r = await api.importData({ monitors: data.monitors, settings: data.settings });
      const msg = t('settings.backup.importSuccess').replace('{{created}}', r.created).replace('{{updated}}', r.updated);
      toast.add(msg, 'success');
    } catch (err) {
      toast.add(err.message || t('settings.backup.importError'), 'error');
    }
    setImporting(false);
  }

  if (loading) return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-1.5">
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton h-3.5 w-64 rounded" />
      </div>
      {[180, 120, 100, 120, 100].map((h, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="skeleton w-4 h-4 rounded" />
            <div className="skeleton h-4 w-36 rounded" />
          </div>
          <div className="skeleton rounded" style={{ height: h }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('settings.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <form onSubmit={handleSaveApprise} className="card space-y-4">
          <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(0,128) scale(0.1,-0.1)" fill="currentColor" stroke="none">
                <path d="M512 1235 c-128 -29 -267 -113 -342 -207 -204 -256 -183 -606 50 -838 124 -125 257 -180 430 -180 173 0 306 55 430 180 85 84 128 158 159 270 26 92 28 226 5 319 -51 206 -212 378 -414 442 -85 27 -234 34 -318 14z m280 -54 c193 -55 334 -190 398 -379 16 -49 21 -88 21 -165 0 -173 -48 -287 -170 -407 -114 -112 -226 -161 -376 -163 -117 -2 -185 9 -191 31 -3 9 -21 51 -41 92 -20 41 -39 84 -43 95 -28 76 -28 75 -54 64 -91 -42 -208 77 -178 179 13 42 45 78 61 68 6 -4 35 -49 66 -101 31 -52 58 -95 61 -95 4 0 -51 104 -88 165 -24 40 -23 55 6 80 23 19 24 27 30 185 6 161 9 191 20 238 8 35 14 41 69 69 127 64 281 80 409 44z"/>
                <path d="M784 1015 c-10 -25 6 -35 52 -35 125 0 211 -112 174 -227 -7 -21 -19 -46 -27 -55 -17 -19 -11 -48 10 -48 34 0 77 84 77 151 0 68 -21 118 -67 165 -48 47 -91 64 -166 64 -32 0 -49 -5 -53 -15z"/>
                <path d="M582 978 c-7 -7 -12 -18 -12 -25 0 -31 -76 -160 -123 -210 -28 -30 -82 -73 -119 -94 -38 -22 -68 -43 -68 -46 0 -7 63 -122 96 -175 l24 -37 77 44 c112 64 170 73 393 62 61 -3 52 23 -90 267 -132 225 -148 244 -178 214z m142 -273 c38 -68 69 -127 70 -132 0 -4 -15 -9 -35 -11 -29 -2 -37 1 -46 21 -11 24 -14 24 -65 15 -54 -10 -68 -20 -68 -50 0 -16 -55 -36 -67 -25 -2 3 8 71 23 151 30 156 27 152 94 154 22 1 33 -14 94 -123z"/>
                <path d="M610 726 c0 -13 -3 -37 -6 -53 -6 -28 -5 -29 30 -25 20 2 36 6 36 8 0 12 -45 94 -52 94 -4 0 -8 -11 -8 -24z"/>
                <path d="M764 905 c-9 -21 4 -35 32 -35 32 0 80 -25 88 -45 11 -29 7 -70 -10 -93 -18 -25 -11 -42 16 -42 11 0 26 12 35 30 33 64 8 153 -54 185 -38 19 -100 20 -107 0z"/>
                <path d="M186 548 c-9 -12 -16 -42 -16 -65 0 -60 47 -112 108 -120 27 -4 42 -2 42 5 0 11 -109 202 -115 202 -2 0 -11 -10 -19 -22z"/>
                <path d="M460 371 c-25 -16 -44 -33 -43 -38 1 -6 18 -38 38 -72 27 -45 42 -61 58 -61 26 0 85 34 93 53 7 19 -68 147 -86 146 -8 0 -35 -13 -60 -28z"/>
              </g>
            </svg>
            {t('settings.apprise.title')}
          </h2>
          <p className="text-xs text-muted">{t('settings.apprise.hint')}</p>

          <div>
            <label className="label">{t('settings.apprise.urlsLabel')}</label>
            <textarea
              className="input h-28 resize-none font-mono text-xs leading-relaxed"
              placeholder={EXAMPLES.join('\n')}
              value={urlsText}
              onChange={e => setUrlsText(e.target.value)}
            />
          </div>

          <div className="bg-granite-3/60 border border-border rounded-xl p-3 flex gap-2.5 text-xs text-muted">
            <Info size={14} className="shrink-0 mt-0.5 text-periwinkle" />
            <div className="min-w-0">
              <p className="font-medium text-thistle mb-1.5">{t('settings.apprise.examples')}</p>
              <ul className="space-y-0.5 font-mono break-all">
                {EXAMPLES.map(e => <li key={e}>{e}</li>)}
              </ul>
              <p className="mt-2 font-sans">
                {t('settings.apprise.docsText')}{' '}
                <a href="https://github.com/caronc/apprise/wiki" target="_blank" rel="noreferrer"
                  className="text-periwinkle hover:underline">{t('settings.apprise.docsLink')}</a>{' '}
                {t('settings.apprise.docsAfter')}
              </p>
            </div>
          </div>

          <div>
            <label className="label">{t('settings.apprise.apiUrlLabel')}</label>
            <input className="input" value={form.appriseApiUrl}
              onChange={e => setForm(f => ({ ...f, appriseApiUrl: e.target.value }))}
              placeholder="http://apprise:8000" />
            <p className="text-xs text-muted mt-1">{t('settings.apprise.apiUrlHint')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" className="btn-primary">
              <Save size={14} /> {t('settings.save')}
            </button>
            <button type="button" onClick={handleTest} disabled={testing} className="btn-ghost border border-border px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <Send size={14} className={testing ? 'animate-pulse' : ''} />
              {testing ? t('settings.testing') : t('settings.test')}
            </button>
          </div>
      </form>

      <form onSubmit={handleSaveWeekly} className="card space-y-4">
          <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
            <CalendarClock size={14} className="text-periwinkle" /> {t('settings.weeklyReport.title')}
          </h2>
          <p className="text-xs text-muted">{t('settings.weeklyReport.hint')}</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-periwinkle"
              checked={form.weeklyReport?.enabled || false}
              onChange={e => {
                const weeklyReport = { ...(form.weeklyReport || {}), enabled: e.target.checked };
                setForm(f => ({ ...f, weeklyReport }));
                saveAll({ weeklyReport });
              }} />
            <span className="text-sm text-thistle">{t('settings.weeklyReport.enable')}</span>
          </label>
          {form.weeklyReport?.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('settings.weeklyReport.day')}</label>
                <select className="select" value={form.weeklyReport?.dayOfWeek ?? 1}
                  onChange={e => setForm(f => ({ ...f, weeklyReport: { ...(f.weeklyReport || {}), dayOfWeek: +e.target.value } }))}>
                  {(t('settings.weeklyReport.days') || []).map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('settings.weeklyReport.hour')}</label>
                <input type="number" min="0" max="23" className="input"
                  value={form.weeklyReport?.hour ?? 8}
                  onChange={e => setForm(f => ({ ...f, weeklyReport: { ...(f.weeklyReport || {}), hour: +e.target.value } }))} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="btn-primary">
              <Save size={14} /> {t('settings.save')}
            </button>
          </div>
      </form>

      <div className="card space-y-3">
        <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
          <BarChart2 size={14} className="text-periwinkle" /> {t('settings.display.title')}
        </h2>
        <p className="text-xs text-muted">{t('settings.display.hint')}</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-periwinkle"
            checked={form.showGraphs}
            onChange={e => {
              const showGraphs = e.target.checked;
              setForm(f => ({ ...f, showGraphs }));
              saveAll({ showGraphs });
            }} />
          <span className="text-sm text-thistle">{t('settings.display.showGraphs')}</span>
        </label>
      </div>

      <form onSubmit={e => { e.preventDefault(); saveAll(); }} className="card space-y-4">
        <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
          <Globe size={14} className="text-periwinkle" /> {t('settings.statusPage.title')}
        </h2>
        <p className="text-xs text-muted">{t('settings.statusPage.hint')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('settings.statusPage.pageTitle')}</label>
            <input className="input" value={form.statusPage?.title || ''}
              placeholder="System Status"
              onChange={e => setForm(f => ({ ...f, statusPage: { ...f.statusPage, title: e.target.value } }))} />
          </div>
          <div>
            <label className="label">{t('settings.statusPage.accentColor')}</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.statusPage?.accentColor || '#60a5fa'}
                onChange={e => setForm(f => ({ ...f, statusPage: { ...f.statusPage, accentColor: e.target.value } }))}
                className="h-9 w-12 rounded-lg border border-border bg-surface cursor-pointer p-0.5"
              />
              <input className="input flex-1" value={form.statusPage?.accentColor || ''}
                placeholder="#60a5fa"
                onChange={e => setForm(f => ({ ...f, statusPage: { ...f.statusPage, accentColor: e.target.value } }))} />
              {form.statusPage?.accentColor && (
                <button type="button" onClick={() => setForm(f => ({ ...f, statusPage: { ...f.statusPage, accentColor: '' } }))}
                  className="text-muted hover:text-thistle text-xs shrink-0">✕</button>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="label">{t('settings.statusPage.pageDescription')}</label>
          <input className="input" value={form.statusPage?.description || ''}
            placeholder="All systems operational"
            onChange={e => setForm(f => ({ ...f, statusPage: { ...f.statusPage, description: e.target.value } }))} />
        </div>
        <div>
          <label className="label">{t('settings.statusPage.logoUrl')}</label>
          <input className="input" value={form.statusPage?.logoUrl || ''}
            placeholder="https://example.com/logo.png"
            onChange={e => setForm(f => ({ ...f, statusPage: { ...f.statusPage, logoUrl: e.target.value } }))} />
          <p className="text-xs text-muted mt-1">{t('settings.statusPage.logoUrlHint')}</p>
        </div>
        <div>
          <label className="label">{t('settings.statusPage.footerText')}</label>
          <input className="input" value={form.statusPage?.footerText || ''}
            placeholder="Powered by Acme Inc."
            onChange={e => setForm(f => ({ ...f, statusPage: { ...f.statusPage, footerText: e.target.value } }))} />
        </div>
        <div className="bg-granite-3/60 border border-border rounded-xl px-3 py-2 flex items-start gap-2 text-xs">
          <Globe size={12} className="text-muted shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-muted">{t('settings.statusPage.url')} :</span>
            <a href="/status" target="_blank" rel="noreferrer"
              className="text-periwinkle hover:underline font-mono break-all block">
              {window.location.origin}/status
            </a>
          </div>
        </div>
        <button type="submit" className="btn-primary">
          <Save size={14} /> {t('settings.save')}
        </button>
      </form>

      <ChangePassword />

      <ProxiesCard proxies={proxies} setProxies={setProxies} t={t} />

      <div className="card space-y-4">
        <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
          <Server size={14} className="text-periwinkle" /> {t('settings.mcp.title')}
        </h2>
        <p className="text-xs text-muted">{t('settings.mcp.hint')}</p>

        <div className="space-y-2">
          <label className="label">{t('settings.mcp.keyLabel')}</label>
          <div className="bg-granite-3/60 border border-border rounded-lg px-3 py-2 flex items-center gap-2 font-mono text-xs">
            <span className="text-frosted truncate flex-1">{mcpApiKey}</span>
            <button
              onClick={() => {
                const text = mcpApiKey;
                function fallback() {
                  const el = document.createElement('textarea');
                  el.value = text;
                  el.style.cssText = 'position:fixed;opacity:0';
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand('copy');
                  document.body.removeChild(el);
                }
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(text).catch(fallback);
                } else {
                  fallback();
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="p-1 rounded text-muted hover:text-thistle transition-colors shrink-0"
            >
              {copied ? <Check size={13} className="text-celadon" /> : <Copy size={13} />}
            </button>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm(t('settings.mcp.regenerateConfirm'))) return;
              const { mcpApiKey: newKey } = await api.regenerateMcpKey();
              setMcpApiKey(newKey);
              toast.add(t('settings.mcp.regenerate'), 'success');
            }}
            className="btn-primary"
          >
            <RefreshCw size={13} /> {t('settings.mcp.regenerate')}
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted">{t('settings.mcp.endpoint')}</p>
          <div className="bg-granite-3/60 border border-border rounded-xl px-3 py-2 font-mono text-xs text-thistle select-all">
            {window.location.origin}/api/mcp
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted">{t('settings.mcp.stdioHint')}</p>
          <div className="bg-granite-3/60 border border-border rounded-xl px-3 py-2 font-mono text-xs text-thistle">
            node /chemin/vers/orveil/backend/mcp-stdio.js
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
          <Download size={15} className="text-periwinkle" />
          {t('settings.backup.title')}
        </h2>
        <p className="text-xs text-muted">{t('settings.backup.hint')}</p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-400/5 border border-amber-400/20 text-xs text-amber-400">
          <AlertTriangle size={13} className="shrink-0" />
          {t('settings.backup.warning')}
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-ghost border border-border px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <Download size={14} /> {t('settings.backup.export')}
          </button>
          <label className={`btn-ghost border border-border px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={14} /> {importing ? t('settings.backup.importing') : t('settings.backup.import')}
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-thistle text-sm flex items-center gap-2">
          <svg viewBox="0 0 24 18" className="w-5 h-4 fill-[#2496ED]" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.4 4.5h2.2V2.3h-2.2v2.2zm0 2.7h2.2V5h-2.2v2.2zm-2.7 0h2.2V5h-2.2v2.2zm-2.7 0h2.2V5H8v2.2zm-2.7 0h2.2V5H5.3v2.2zm2.7-2.7h2.2V2.3H8V4.5zm2.7 0h2.2V2.3h-2.2V4.5zm0-2.7h2.2V-.1h-2.2V1.8zm-2.7 0h2.2V-.1H8V1.8zM23.3 8c-.5-.3-1.5-.4-2.3-.3-.1-.8-.6-1.6-1.3-2l-.4-.3-.3.4c-.4.5-.5 1.4-.5 2 0 .3 0 .8.3 1.3-.3.1-.8.3-1.5.3H.2l-.1.4c-.1.9 0 4.3 2 6.1.9.8 2.2 1.2 3.8 1.2 3.7 0 6.4-1.7 7.7-4.8.9 0 2.8.1 3.7-1.9l.2-.3-.4-.3zm-11 4.3H10v2.3h2.3v-2.3zm0-2.8H10v2.3h2.3V9.5zm2.7 2.8h-2.2v2.3h2.2v-2.3zm-2.7-5.5H10v2.2h2.3V6.8zM7.3 12.3H5v2.3h2.3v-2.3zm2.7 0H7.8v2.3H10v-2.3zm0-2.8H7.8v2.3H10V9.5zm-2.7 0H5v2.3h2.3V9.5zm-2.8 0H2.3v2.3h2.2V9.5zm2.8-2.7H5v2.2h2.3V6.8zm2.7 0H7.8v2.2H10V6.8z"/>
          </svg>
          {t('settings.docker.title')}
        </h2>
        <div className="divide-y divide-border">
          {[
            ['App',         window.location.origin],
            ['Backend API', `${window.location.origin}/api`],
            ['MCP (HTTP)',  `${window.location.origin}/api/mcp`],
            ['Apprise API', `${window.location.hostname}:8008`],
            ['MongoDB',     `${t('settings.docker.internal')} (mongo:27017)`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2 text-sm">
              <span className="text-muted">{label}</span>
              <span className="font-mono text-xs text-thistle">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
