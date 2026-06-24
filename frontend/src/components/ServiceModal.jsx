import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Wifi, RefreshCw, Image, ChevronDown, Webhook, Copy, Check, RotateCcw } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { monitors as monitorsApi, settings as settingsApi } from '../api';
import Portal from './Portal';
import { getMetrics } from '../utils/metricConfig';
import ServiceIcon from './ServiceIcon';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const TYPE_DEFAULTS = {
  cloudflare: { checkInterval: 1,  reportInterval: 6,  config: { apiToken: '', accountId: '' } },
  adguard:     { checkInterval: 60, reportInterval: 24, serviceUrl: 'https://adguard-dns.io', config: { accessToken: '', refreshTok: '' } },
  adguardhome: { checkInterval: 5,  reportInterval: 24, config: { url: '', username: '', password: '', rejectUnauthorized: true } },
  hms:        { checkInterval: 5,  reportInterval: 0,  config: { hmsToken: '', vpsList: [{ id: '', name: '' }] } },
  ultracc:    { checkInterval: 5,  reportInterval: 0,  config: { apiUrl: '', ultraToken: '' } },
  syncthing:  { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', apiKey: '', folderIds: [], rejectUnauthorized: true } },
  http:       { checkInterval: 5,  reportInterval: 0,  config: { url: '', method: 'GET', body: '', expectedStatus: 200, acceptedStatusCodes: '', keyword: '', keywordMode: 'present', timeout: 10000, sslAlertDays: 30, responseTimeThreshold: 0, bearerToken: '', basicUser: '', basicPass: '', customHeaderName: '', customHeaderValue: '', rejectUnauthorized: true } },
  ping:       { checkInterval: 2,  reportInterval: 0,  config: { host: '', port: 80, attempts: 3 } },
  proxmox:    { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', apiToken: '', node: 'pve', rejectUnauthorized: false } },
  immich:     { checkInterval: 30, reportInterval: 24, config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  portainer:  { checkInterval: 5,  reportInterval: 0,  config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  ssh:        { checkInterval: 5,  reportInterval: 24, config: { host: '', port: 22, username: '', password: '', privateKey: '' } },
  heartbeat:  { checkInterval: 5,  reportInterval: 0,  config: { expectedEvery: 60, slug: uuid() } },
  docker:     { checkInterval: 1,  reportInterval: 0,  config: { socketPath: '/var/run/docker.sock' } },
  unraid:     { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  speedtest:      { checkInterval: 60, reportInterval: 24, config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  homeassistant:  { checkInterval: 5,  reportInterval: 24, config: { url: '', token: '', entities: [], rejectUnauthorized: true } },
  jellyfin:       { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  dns:            { checkInterval: 5,  reportInterval: 0,  config: { hostname: '', recordType: 'A', expectedValue: '' } },
  mysql:          { checkInterval: 5,  reportInterval: 0,  config: { host: '', port: 3306, user: '', password: '', database: '' } },
  redis:          { checkInterval: 5,  reportInterval: 0,  config: { host: '', port: 6379, password: '' } },
  ollama:         { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', rejectUnauthorized: true } },
  portforward:    { checkInterval: 2,  reportInterval: 0,  config: { host: '', port: 80 } },
  multistep:      { checkInterval: 5,  reportInterval: 0,  config: { steps: [{ name: '', url: '', method: 'GET', expectedStatus: 200, body: '', headers: '', extract: '' }] } },
};

const TYPE_LABELS = {
  cloudflare: 'Cloudflare Tunnels',
  adguard:     'AdGuard DNS',
  adguardhome: 'AdGuard Home',
  hms:        'HostMyServers VPS',
  ultracc:    'Ultra.cc Seedbox',
  syncthing:  'Syncthing',
  http:       'HTTP Monitor',
  ping:       'Ping / TCP',
  proxmox:    'Proxmox',
  immich:     'Immich',
  portainer:  'Portainer',
  ssh:        'SSH',
  heartbeat:  'Heartbeat',
  docker:     'Docker',
  unraid:     'Unraid',
  speedtest:     'Speedtest Tracker',
  homeassistant: 'Home Assistant',
  jellyfin:      'Jellyfin',
  dns:           'DNS',
  mysql:         'MySQL',
  redis:         'Redis',
  ollama:        'Ollama',
  portforward:   'Port Forwarding',
  multistep:     'Multi-step HTTP',
};

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-muted/60 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

function UnitField({ label, value, onChange, unit, min = 0 }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex">
        <input className="input rounded-r-none flex-1 border-r-0" type="number" min={min}
          value={value ?? ''} onChange={e => onChange(+e.target.value)} />
        <span className="flex items-center px-3 text-xs text-muted bg-surface border border-border rounded-r-lg shrink-0">{unit}</span>
      </div>
    </div>
  );
}

function HAConfigFields({ config, set, t }) {
  const [entityList, setEntityList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadEntities() {
    if (!config.url || !config.token) return;
    setLoading(true); setError(null);
    try {
      const { entities } = await monitorsApi.haEntities(config.url, config.token, config.rejectUnauthorized);
      setEntityList(entities);
    } catch (e) {
      setError(t('form.fields.homeassistant.loadError'));
    }
    setLoading(false);
  }

  const selected = config.entities || [];
  const filtered = entityList.filter(e =>
    !selected.some(s => s.entity_id === e.entity_id) &&
    (e.entity_id.toLowerCase().includes(search.toLowerCase()) ||
     e.friendly_name.toLowerCase().includes(search.toLowerCase()))
  );

  function addEntity(entity) {
    set('entities', [...selected, { entity_id: entity.entity_id, friendly_name: entity.friendly_name }]);
    setSearch('');
  }

  function removeEntity(entity_id) {
    set('entities', selected.filter(e => e.entity_id !== entity_id));
  }

  return (
    <>
      <Field label="URL Home Assistant" value={config.url} onChange={v => set('url', v)}
        placeholder="http://homeassistant.local:8123"
        hint={t('form.fields.homeassistant.urlHint')} />
      <Field label="Token" value={config.token} onChange={v => set('token', v)}
        type="password" placeholder="••••••••••••••••"
        hint={t('form.fields.homeassistant.tokenHint')} />
      <TlsToggle config={config} set={set} t={t} />

      {/* Entity selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label mb-0">{t('form.fields.homeassistant.selectedEntities')}</label>
          <button type="button" onClick={loadEntities} disabled={loading || !config.url || !config.token}
            className="flex items-center gap-1.5 text-xs text-periwinkle hover:text-thistle disabled:opacity-40 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? t('form.fields.homeassistant.loading') : t('form.fields.homeassistant.loadEntities')}
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {!error && entityList.length > 0 && (
          <p className="text-xs text-celadon">{entityList.length} {t('form.fields.homeassistant.entitiesLoaded')}</p>
        )}

        {/* Selected entities */}
        {selected.length > 0 ? (
          <div className="space-y-1">
            {selected.map(e => (
              <div key={e.entity_id} className="flex items-center justify-between bg-granite-3/40 border border-border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-thistle font-medium truncate">{e.friendly_name}</p>
                  <p className="text-xs text-muted font-mono truncate">{e.entity_id}</p>
                </div>
                <button type="button" onClick={() => removeEntity(e.entity_id)}
                  className="text-muted hover:text-red-400 transition-colors ml-2 shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted/60 italic">{t('form.fields.homeassistant.noEntities')}</p>
        )}

        {/* Search + add from list */}
        {entityList.length > 0 && (
          <div className="space-y-1">
            <input className="input" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('form.fields.homeassistant.searchEntities')} />
            {search && filtered.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {filtered.slice(0, 50).map(e => (
                  <button key={e.entity_id} type="button" onClick={() => addEntity(e)}
                    className="w-full text-left px-3 py-2 hover:bg-granite-3/60 transition-colors border-b border-border last:border-0">
                    <p className="text-xs text-thistle font-medium truncate">{e.friendly_name}</p>
                    <p className="text-xs text-muted font-mono truncate">{e.entity_id}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TlsToggle({ config, set, t }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!config.rejectUnauthorized}
        onChange={e => set('rejectUnauthorized', e.target.checked)}
        className="w-4 h-4 rounded accent-periwinkle" />
      <span className="text-sm text-thistle">{t('form.tlsCert')}</span>
    </label>
  );
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg';

function IconPicker({ value, onChange, t, name = '' }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [icons, setIcons] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !search && name) setSearch(name.toLowerCase());
    if (icons !== null) return;
    setLoading(true);
    setError(false);
    fetch('https://api.github.com/repos/homarr-labs/dashboard-icons/git/trees/main?recursive=1')
      .then(r => r.json())
      .then(data => {
        const svgs = (data.tree || [])
          .filter(f => f.type === 'blob' && f.path.startsWith('svg/') && f.path.endsWith('.svg'))
          .map(f => f.path.slice(4, -4))
          .sort();
        setIcons(svgs);
      })
      .catch(() => { setIcons([]); setError(true); })
      .finally(() => setLoading(false));
  };

  const filtered = icons
    ? (search.trim() ? icons.filter(n => n.includes(search.toLowerCase())) : icons).slice(0, 80)
    : [];

  const selectedName = value ? value.split('/').pop().replace('.svg', '') : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {value && (
          <div className="flex items-center gap-2 flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg">
            <img src={value} width={20} height={20} style={{ objectFit: 'contain' }} alt="" />
            <span className="text-xs text-thistle truncate flex-1">{selectedName}</span>
            <button type="button" onClick={() => onChange('')}
              className="text-muted hover:text-red-400 shrink-0">
              <X size={13} />
            </button>
          </div>
        )}
        {!value && <span className="text-xs text-muted flex-1 italic">{t('form.customIconNone')}</span>}
        <button type="button" onClick={handleOpen}
          className={`btn-ghost border border-border px-3 py-2 rounded-lg text-sm whitespace-nowrap flex items-center gap-1.5 shrink-0 ${open ? 'text-periwinkle border-periwinkle/50' : ''}`}>
          <Image size={13} />
          {t('form.customIconBrowse')}
        </button>
      </div>
      {open && (
        <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
          <input
            className="input w-full text-sm"
            placeholder={t('form.customIconSearchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {loading && <p className="text-xs text-muted text-center py-3">{t('form.customIconLoading')}</p>}
          {error && <p className="text-xs text-red-400 text-center py-2">{t('form.customIconError')}</p>}
          {!loading && !error && icons !== null && (
            <>
              <div className="grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto pr-0.5">
                {filtered.map(name => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => { onChange(`${CDN_BASE}/${name}.svg`); setOpen(false); setSearch(''); }}
                    className={`flex items-center justify-center p-2 rounded-lg transition-colors ${value === `${CDN_BASE}/${name}.svg` ? 'bg-periwinkle/20 ring-1 ring-periwinkle/50' : 'hover:bg-card'}`}
                  >
                    <img
                      src={`${CDN_BASE}/${name}.svg`}
                      width={22} height={22}
                      style={{ objectFit: 'contain' }}
                      alt={name}
                      onError={e => { e.currentTarget.style.opacity = '0.12'; }}
                    />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-8 text-xs text-muted text-center py-3">{t('form.customIconNoResults')}</p>
                )}
              </div>
              {!search.trim() && icons.length > 80 && (
                <p className="text-xs text-muted/60 text-center">{icons.length} {t('form.customIconTotal')}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProxySection({ config, set, proxies }) {
  const { t } = useLang();
  const [open, setOpen] = React.useState(!!config.proxyId);
  const selectedId = config.proxyId || '';
  const selectedProxy = proxies.find(p => p._id === selectedId);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);

  function handleSelect(id) {
    set('proxyId', id || undefined);
    setTestResult(null);
  }

  async function handleTest() {
    if (!selectedProxy) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await settingsApi.testProxy(selectedProxy);
      setTestResult(r.ok ? { ok: true, ms: r.ms } : { ok: false, error: r.error });
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message });
    }
    setTesting(false);
  }

  const typeLabel = { http: 'HTTP', https: 'HTTPS', socks5: 'SOCKS5', ssh: 'SSH' };

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-thistle transition-colors w-full">
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Proxy
        {selectedProxy
          ? <span className="ml-auto text-periwinkle font-normal normal-case tracking-normal">{selectedProxy.name}</span>
          : proxies.some(p => p.active)
            ? <span className="ml-auto text-muted/50 font-normal normal-case tracking-normal">{t('settings.proxies.globalFallback')}</span>
            : null
        }
      </button>
      {open && (
        <div className="space-y-2 pl-3">
          <select className="select text-sm" value={selectedId} onChange={e => handleSelect(e.target.value)}>
            <option value="">{t('settings.proxies.globalFallback')}</option>
            {proxies.map(p => (
              <option key={p._id} value={p._id}>
                {p.name} ({typeLabel[p.type] || p.type} · {p.host}{p.port ? `:${p.port}` : ''})
              </option>
            ))}
          </select>
          {proxies.length === 0 && (
            <p className="text-xs text-muted italic">{t('settings.proxies.emptyHint')}</p>
          )}
          {selectedProxy && (
            <div className="space-y-1">
              <button type="button" onClick={handleTest} disabled={testing}
                className="btn-ghost border border-border px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 disabled:opacity-40">
                <Wifi size={12} className={testing ? 'animate-pulse text-periwinkle' : ''} />
                {testing ? t('settings.proxies.testing') : t('settings.proxies.test')}
              </button>
              {testResult && (
                <p className={`text-xs ${testResult.ok ? 'text-celadon' : 'text-red-400'}`}>
                  {testResult.ok ? `✓ ${t('settings.proxies.testOk')} (${testResult.ms}ms)` : `✗ ${testResult.error}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CFAccessSection({ config, set, t }) {
  const [open, setOpen] = React.useState(!!(config.cfClientId || config.cfClientSecret));
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-thistle transition-colors">
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {t('form.cfAccess')}
      </button>
      {open && (
        <div className="space-y-3 pl-3">
          <Field label="CF-Access-Client-Id" value={config.cfClientId} onChange={v => set('cfClientId', v)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.access" />
          <Field label="CF-Access-Client-Secret" value={config.cfClientSecret} onChange={v => set('cfClientSecret', v)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
      )}
    </div>
  );
}

const STEP_DEFAULT = { name: '', url: '', method: 'GET', expectedStatus: 200, body: '', headers: '', extract: '' };
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

function MultistepConfigFields({ config, set, t }) {
  const steps = config.steps?.length ? config.steps : [{ ...STEP_DEFAULT }];
  const [expanded, setExpanded] = useState(() => [0]);

  const updateStep = (i, field, value) =>
    set('steps', steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const addStep = () => {
    set('steps', [...steps, { ...STEP_DEFAULT }]);
    setExpanded(e => [...e, steps.length]);
  };

  const removeStep = (i) => {
    set('steps', steps.filter((_, idx) => idx !== i));
    setExpanded(e => e.filter(x => x !== i).map(x => x > i ? x - 1 : x));
  };

  const toggle = (i) =>
    setExpanded(e => e.includes(i) ? e.filter(x => x !== i) : [...e, i]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t('form.fields.multistep.hint')}</p>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="border border-border rounded-xl overflow-hidden">
            <button type="button" onClick={() => toggle(i)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-granite-3/30 hover:bg-granite-3/50 transition-colors">
              <ChevronDown size={14} className={`text-muted shrink-0 transition-transform ${expanded.includes(i) ? 'rotate-180' : ''}`} />
              <span className="flex-1 font-medium text-thistle text-left truncate">
                {step.name || `Step ${i + 1}`}
                {step.url && <span className="text-muted font-normal ml-2 text-xs">{step.url}</span>}
              </span>
              <span className="text-xs text-muted shrink-0 mr-1">{step.method || 'GET'} {step.expectedStatus || 200}</span>
              {steps.length > 1 && (
                <span role="button" onClick={e => { e.stopPropagation(); removeStep(i); }}
                  className="text-muted/50 hover:text-red-400 transition-colors shrink-0 p-0.5">
                  <X size={13} />
                </span>
              )}
            </button>
            {expanded.includes(i) && (
              <div className="p-3 space-y-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('form.fields.multistep.stepName')} value={step.name}
                    onChange={v => updateStep(i, 'name', v)} placeholder={`Step ${i + 1}`} />
                  <div>
                    <label className="label">{t('form.fields.multistep.method')}</label>
                    <select className="input" value={step.method || 'GET'}
                      onChange={e => updateStep(i, 'method', e.target.value)}>
                      {METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <Field label="URL" value={step.url} onChange={v => updateStep(i, 'url', v)}
                  placeholder="https://api.example.com/endpoint"
                  hint={t('form.fields.multistep.urlHint')} />
                <Field label={t('form.fields.multistep.expectedStatus')} value={step.expectedStatus}
                  onChange={v => updateStep(i, 'expectedStatus', +v)} type="number" placeholder="200" />
                {['POST', 'PUT', 'PATCH'].includes(step.method) && (
                  <div>
                    <label className="label">{t('form.fields.multistep.body')}</label>
                    <textarea className="input text-xs font-mono" rows={3}
                      value={step.body || ''} onChange={e => updateStep(i, 'body', e.target.value)}
                      placeholder={'{"key": "value"}'} />
                  </div>
                )}
                <div>
                  <label className="label">{t('form.fields.multistep.headers')}</label>
                  <textarea className="input text-xs font-mono" rows={2}
                    value={step.headers || ''} onChange={e => updateStep(i, 'headers', e.target.value)}
                    placeholder={'{"Content-Type": "application/json", "Authorization": "Bearer {{token}}"}'} />
                  <p className="text-xs text-muted mt-1">{t('form.fields.multistep.headersHint')}</p>
                </div>
                <div>
                  <label className="label">{t('form.fields.multistep.extract')}</label>
                  <textarea className="input text-xs font-mono" rows={2}
                    value={step.extract || ''} onChange={e => updateStep(i, 'extract', e.target.value)}
                    placeholder={'{"token": "$.access_token", "userId": "$.data.id"}'} />
                  <p className="text-xs text-muted mt-1">{t('form.fields.multistep.extractHint')}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addStep}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded-xl text-sm text-muted hover:text-thistle hover:border-periwinkle/50 transition-colors">
        <Plus size={14} /> {t('form.fields.multistep.addStep')}
      </button>
    </div>
  );
}

function ConfigFields({ type, config, onChange, t, proxies = [] }) {
  const set = (key, val) => onChange({ ...config, [key]: val });
  const f = t('form.fields');

  if (type === 'cloudflare') return (
    <>
      <Field label="API Token" value={config.apiToken} onChange={v => set('apiToken', v)}
        placeholder="Your Cloudflare API token" hint={t('form.fields.cloudflare.apiTokenHint')} />
      <Field label="Account ID" value={config.accountId} onChange={v => set('accountId', v)}
        placeholder="Your Account ID" hint={t('form.fields.cloudflare.accountIdHint')} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'adguard') return (
    <>
      <Field label="Access Token" value={config.accessToken} onChange={v => set('accessToken', v)}
        placeholder="Your AdGuard DNS access token" />
      <Field label="Refresh Token" value={config.refreshTok} onChange={v => set('refreshTok', v)}
        placeholder="Your AdGuard DNS refresh token" hint={t('form.fields.adguard.refreshHint')} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'hms') return (
    <>
      <Field label="HMS Token" value={config.hmsToken} onChange={v => set('hmsToken', v)}
        placeholder="Your HostMyServers API token" hint={t('form.fields.hms.tokenHint')} />
      <div>
        <label className="label">{t('form.vpsServers')}</label>
        <div className="space-y-2">
          {(config.vpsList || []).map((vps, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" placeholder={t('form.vpsId')} value={vps.id}
                onChange={e => { const l = [...config.vpsList]; l[i] = { ...l[i], id: e.target.value }; set('vpsList', l); }} />
              <input className="input flex-1" placeholder={t('form.vpsName')} value={vps.name}
                onChange={e => { const l = [...config.vpsList]; l[i] = { ...l[i], name: e.target.value }; set('vpsList', l); }} />
              {config.vpsList.length > 1 && (
                <button type="button" className="btn-ghost p-2 rounded-lg"
                  onClick={() => set('vpsList', config.vpsList.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-ghost text-xs"
            onClick={() => set('vpsList', [...(config.vpsList || []), { id: '', name: '' }])}>
            <Plus size={13} /> {t('form.addVps')}
          </button>
        </div>
      </div>
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'ultracc') return (
    <>
      <Field label="URL API Stats" value={config.apiUrl} onChange={v => set('apiUrl', v)}
        placeholder="https://nom.serveur.usbx.me/ultra-api/total-stats"
        hint={t('form.fields.ultracc.urlHint')} />
      <Field label="Ultra Token" value={config.ultraToken} onChange={v => set('ultraToken', v)}
        placeholder="Your Ultra.cc API token" />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'syncthing') return (
    <>
      <Field label="URL Syncthing" value={config.apiUrl} onChange={v => set('apiUrl', v)}
        placeholder="http://192.168.1.x:8384" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder={t('form.fields.syncthing.apiKeyHint')} />
      <div>
        <label className="label">{t('form.fields.syncthing.folderIds')}</label>
        <div className="space-y-2">
          {(config.folderIds || []).map((fid, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" placeholder={t('form.fields.syncthing.folderPlaceholder')} value={fid}
                onChange={e => { const l = [...config.folderIds]; l[i] = e.target.value; set('folderIds', l); }} />
              <button type="button" className="btn-ghost p-2 rounded-lg"
                onClick={() => set('folderIds', config.folderIds.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost text-xs"
            onClick={() => set('folderIds', [...(config.folderIds || []), ''])}>
            <Plus size={13} /> {t('form.addFolder')}
          </button>
          <p className="text-xs text-muted">{t('form.allFolders')}</p>
        </div>
      </div>
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'http') return (
    <>
      <Field label="URL" value={config.url} onChange={v => set('url', v)} placeholder="https://my-service.com" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('form.fields.http.method')}</label>
          <select value={config.method || 'GET'} onChange={e => set('method', e.target.value)}
            className="select">
            {['GET','POST','PUT','PATCH','DELETE','HEAD'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <Field label={t('form.fields.http.expectedStatus')} value={config.expectedStatus} onChange={v => set('expectedStatus', +v)} type="number" placeholder="200" />
      </div>
      <Field label="Codes HTTP acceptés (optionnel)" value={config.acceptedStatusCodes || ''} onChange={v => set('acceptedStatusCodes', v)}
        placeholder="200,201,302" hint="Liste de codes séparés par virgule. Remplace le champ 'Status attendu' si renseigné." />
      {['POST','PUT','PATCH'].includes(config.method) && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">{t('form.fields.http.body')}</label>
          <textarea value={config.body || ''} onChange={e => set('body', e.target.value)}
            rows={4} placeholder='{"key": "value"}'
            className="input text-xs font-mono resize-y" />
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Timeout (ms)" value={config.timeout} onChange={v => set('timeout', +v)} type="number" placeholder="10000" />
        <Field label={t('form.fields.http.sslAlertDays')} value={config.sslAlertDays ?? 30} onChange={v => set('sslAlertDays', +v)} type="number" placeholder="30" hint={t('form.fields.http.sslAlertDaysHint')} />
        <Field label={t('form.fields.http.responseTimeThreshold')} value={config.responseTimeThreshold ?? 0} onChange={v => set('responseTimeThreshold', +v)} type="number" placeholder="0" hint={t('form.fields.http.responseTimeThresholdHint')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.fields.http.keyword')} value={config.keyword} onChange={v => set('keyword', v)}
          placeholder={t('form.fields.http.keywordPlaceholder')} hint={t('form.fields.http.keywordHint')} />
        {config.keyword ? (
          <div>
            <label className="label">Mode</label>
            <select className="select" value={config.keywordMode || 'present'} onChange={e => set('keywordMode', e.target.value)}>
              <option value="present">Doit être présent</option>
              <option value="absent">Doit être absent</option>
            </select>
          </div>
        ) : <div />}
      </div>
      <Field label={t('form.fields.http.bearerToken')} value={config.bearerToken} onChange={v => set('bearerToken', v)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" hint={t('form.fields.http.bearerTokenHint')} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.fields.http.basicUser')} value={config.basicUser} onChange={v => set('basicUser', v)} placeholder="admin" />
        <Field label={t('form.fields.http.basicPass')} value={config.basicPass} onChange={v => set('basicPass', v)} type="password" placeholder="••••••••" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.fields.http.customHeaderName')} value={config.customHeaderName} onChange={v => set('customHeaderName', v)} placeholder="X-API-Key" />
        <Field label={t('form.fields.http.customHeaderValue')} value={config.customHeaderValue} onChange={v => set('customHeaderValue', v)} placeholder="my-secret-key" />
      </div>
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'ping') return (
    <>
      <Field label={t('form.fields.ping.host')} value={config.host} onChange={v => set('host', v)} placeholder="192.168.1.1" />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.fields.ping.port')} value={config.port} onChange={v => set('port', +v)} type="number" placeholder="80" />
        <Field label={t('form.fields.ping.attempts')} value={config.attempts} onChange={v => set('attempts', +v)} type="number" placeholder="3" />
      </div>
    </>
  );

  if (type === 'multistep') return <MultistepConfigFields config={config} set={set} t={t} />;

  if (type === 'portforward') return (
    <>
      <Field label={t('form.fields.portforward.host')} value={config.host} onChange={v => set('host', v)} placeholder="203.0.113.1" hint={t('form.fields.portforward.hostHint')} />
      <Field label={t('form.fields.portforward.port')} value={config.port} onChange={v => set('port', +v)} type="number" placeholder="8080" />
    </>
  );

  if (type === 'proxmox') return (
    <>
      <Field label="URL API" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="https://192.168.1.10:8006" />
      <Field label="API Token" value={config.apiToken} onChange={v => set('apiToken', v)}
        placeholder="user@pve!tokenid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        hint={t('form.fields.proxmox.tokenHint')} />
      <Field label={t('form.fields.proxmox.node')} value={config.node} onChange={v => set('node', v)} placeholder="pve" />
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'immich') return (
    <>
      <Field label="URL Immich" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="https://immich.example.com" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder={t('form.fields.immich.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'portainer') return (
    <>
      <Field label="URL Portainer" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="https://portainer.example.com" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder={t('form.fields.portainer.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'ssh') return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label={t('form.fields.ping.host')} value={config.host} onChange={v => set('host', v)} placeholder="192.168.1.100" />
        </div>
        <Field label="Port" value={config.port} onChange={v => set('port', +v)} type="number" placeholder="22" />
      </div>
      <Field label={t('form.fields.ssh.user')} value={config.username} onChange={v => set('username', v)} placeholder="root" />
      <Field label={t('form.fields.ssh.password')} value={config.password} onChange={v => set('password', v)}
        type="password" placeholder="••••••••" hint={t('form.fields.ssh.passwordHint')} />
      <div>
        <label className="label">{t('form.privateKey')}</label>
        <textarea className="input h-24 resize-none font-mono text-xs"
          placeholder={t('form.fields.ssh.privateKeyPlaceholder')}
          value={config.privateKey} onChange={e => set('privateKey', e.target.value)} />
      </div>
    </>
  );

  if (type === 'heartbeat') {
    const pingUrl = `${window.location.origin}/api/ping/${config.slug}`;
    return (
      <>
        <Field label={t('form.fields.heartbeat.expectedEvery')} value={config.expectedEvery}
          onChange={v => set('expectedEvery', +v)} type="number" placeholder="60"
          hint={t('form.fields.heartbeat.expectedEveryHint')} />
        <div className="space-y-1">
          <label className="label">{t('form.fields.heartbeat.pingUrl')}</label>
          <div className="flex items-center gap-2">
            <input readOnly value={pingUrl} className="input text-xs font-mono flex-1 text-muted" />
            <button type="button" onClick={() => navigator.clipboard.writeText(pingUrl)}
              className="btn-ghost px-3 py-2 text-xs shrink-0">
              {t('form.fields.heartbeat.copy')}
            </button>
          </div>
          <p className="text-xs text-muted">{t('form.fields.heartbeat.pingUrlHint')}</p>
        </div>
      </>
    );
  }

  if (type === 'unraid') return (
    <>
      <Field label="URL Unraid" value={config.apiUrl} onChange={v => set('apiUrl', v)}
        placeholder="http://192.168.1.10:80" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        hint={t('form.fields.unraid.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'docker') return (
    <Field label={t('form.fields.docker.socketPath')} value={config.socketPath}
      onChange={v => set('socketPath', v)} placeholder="/var/run/docker.sock"
      hint={t('form.fields.docker.socketPathHint')} />
  );

  if (type === 'adguardhome') return (
    <>
      <Field label="URL AdGuard Home" value={config.url} onChange={v => set('url', v)}
        placeholder="http://192.168.1.1:3000"
        hint={t('form.fields.adguardhome.urlHint')} />
      <Field label={t('form.fields.ssh.user')} value={config.username} onChange={v => set('username', v)}
        placeholder="admin" />
      <Field label={t('form.fields.ssh.password')} value={config.password} onChange={v => set('password', v)}
        type="password" placeholder="••••••••" />
      <TlsToggle config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'homeassistant') return (
    <>
      <HAConfigFields config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'speedtest') return (
    <>
      <Field label="URL Speedtest Tracker" value={config.apiUrl} onChange={v => set('apiUrl', v)}
        placeholder="https://speedtest.example.com"
        hint={t('form.fields.speedtest.urlHint')} />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        hint={t('form.fields.speedtest.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'jellyfin') return (
    <>
      <Field label="URL Jellyfin" value={config.apiUrl} onChange={v => set('apiUrl', v)}
        placeholder="https://jellyfin.example.com" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        hint={t('form.fields.jellyfin.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  if (type === 'dns') return (
    <>
      <Field label="Hostname" value={config.hostname} onChange={v => set('hostname', v)} placeholder="example.com" />
      <div className="space-y-1">
        <label className="label">Type de record</label>
        <select className="select" value={config.recordType} onChange={e => set('recordType', e.target.value)}>
          {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Field label="Valeur attendue (optionnel)" value={config.expectedValue} onChange={v => set('expectedValue', v)}
        placeholder="93.184.216.34" hint="Si renseigné, passe en warning si la valeur n'est pas trouvée dans les records." />
    </>
  );

  if (type === 'mysql') return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Hôte" value={config.host} onChange={v => set('host', v)} placeholder="192.168.1.10" />
        </div>
        <Field label="Port" value={config.port} onChange={v => set('port', +v)} type="number" placeholder="3306" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Utilisateur" value={config.user} onChange={v => set('user', v)} placeholder="root" />
        <Field label="Mot de passe" value={config.password} onChange={v => set('password', v)} type="password" placeholder="••••••••" />
      </div>
      <Field label="Base de données (optionnel)" value={config.database} onChange={v => set('database', v)} placeholder="mydb" />
    </>
  );

  if (type === 'redis') return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Hôte" value={config.host} onChange={v => set('host', v)} placeholder="192.168.1.10" />
        </div>
        <Field label="Port" value={config.port} onChange={v => set('port', +v)} type="number" placeholder="6379" />
      </div>
      <Field label="Mot de passe (optionnel)" value={config.password} onChange={v => set('password', v)} type="password" placeholder="••••••••" />
    </>
  );

  if (type === 'ollama') return (
    <>
      <Field label="URL Ollama" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="http://192.168.1.10:11434" />
      <TlsToggle config={config} set={set} t={t} />
      <ProxySection config={config} set={set} proxies={proxies} />
    </>
  );

  return null;
}

function WebhookSection({ monitor }) {
  const [token, setToken] = React.useState(monitor?.webhookToken || null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const baseUrl = window.location.origin;
  const webhookUrl = `${baseUrl}/api/webhook/changelog`;

  async function generate() {
    setLoading(true);
    try {
      const data = await monitorsApi.generateWebhookToken(monitor._id);
      setToken(data.webhookToken);
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    if (!confirm('Révoquer ce token ? Les intégrations qui l\'utilisent ne fonctionneront plus.')) return;
    setLoading(true);
    try {
      await monitorsApi.revokeWebhookToken(monitor._id);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCurl() {
    const cmd = `curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"token":"${token}","version":"v1.0.0","description":"Deploy description"}'`;
    navigator.clipboard.writeText(cmd);
    setCopied('curl');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="flex items-center gap-2">
        <Webhook size={13} className="text-periwinkle shrink-0" />
        <p className="text-xs font-medium text-thistle">Webhook changelog</p>
      </div>
      <p className="text-xs text-muted">
        Permet à tes pipelines CI/CD de créer automatiquement une entrée changelog sur ce monitor via une requête HTTP.
      </p>

      {!token ? (
        <button type="button" onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-periwinkle/10 border border-periwinkle/30 text-periwinkle hover:bg-periwinkle/20 transition-colors disabled:opacity-50">
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Webhook size={12} />}
          Générer un token
        </button>
      ) : (
        <div className="space-y-2">
          {/* Token */}
          <div>
            <p className="text-xs text-muted mb-1">Token</p>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 font-mono text-xs bg-granite-3 border border-border rounded-lg px-2.5 py-1.5 text-periwinkle truncate">
                {token}
              </code>
              <button type="button" onClick={copyToken}
                className="shrink-0 p-1.5 rounded-lg border border-border text-muted hover:text-thistle hover:border-periwinkle/50 transition-colors">
                {copied === true ? <Check size={13} className="text-celadon" /> : <Copy size={13} />}
              </button>
              <button type="button" onClick={generate} disabled={loading} title="Régénérer"
                className="shrink-0 p-1.5 rounded-lg border border-border text-muted hover:text-thistle hover:border-periwinkle/50 transition-colors disabled:opacity-50">
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              </button>
            </div>
          </div>

          {/* Exemple curl */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted">Exemple d'appel</p>
              <button type="button" onClick={copyCurl}
                className="flex items-center gap-1 text-xs text-muted hover:text-thistle transition-colors">
                {copied === 'curl' ? <><Check size={11} className="text-celadon" /> Copié</> : <><Copy size={11} /> Copier</>}
              </button>
            </div>
            <pre className="text-xs bg-granite-3 border border-border rounded-lg p-2.5 text-periwinkle/80 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"token":"${token.slice(0, 8)}…","version":"v1.0.0","description":"Deploy"}'`}</pre>
          </div>

          {/* Revoke */}
          <button type="button" onClick={revoke} disabled={loading}
            className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
            Révoquer le token
          </button>
        </div>
      )}
    </div>
  );
}

function AdvancedSection({ form, setForm, allMonitors, monitor, lang, t, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [tab, setTab] = React.useState('general');
  const metrics = getMetrics(form.type, form.config);

  const tabs = [
    { id: 'general',       label: lang === 'fr' ? 'Général' : 'General' },
    { id: 'monitoring',    label: 'Monitoring' },
    { id: 'notifications', label: lang === 'fr' ? 'Notifs' : 'Notifs' },
    ...(monitor ? [{ id: 'integrations', label: lang === 'fr' ? 'Intégrations' : 'Integrations' }] : []),
  ];

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-thistle transition-colors w-full">
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {t('form.advanced') || 'Avancé'}
      </button>
      {open && (
        <div className="pt-1">
          {/* Tab bar */}
          <div className="flex gap-0.5 border-b border-border mb-4">
            {tabs.map(t2 => (
              <button key={t2.id} type="button" onClick={() => setTab(t2.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors whitespace-nowrap
                  ${tab === t2.id
                    ? 'text-thistle border-b-2 border-periwinkle -mb-px bg-granite-3/30'
                    : 'text-muted hover:text-thistle'}`}>
                {t2.label}
              </button>
            ))}
          </div>

          {/* Général */}
          {tab === 'general' && (
            <div className="space-y-4">
              <Field label={t('form.description')} value={form.description}
                onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="…" />
              <Field label={t('form.serviceUrl')} value={form.serviceUrl}
                onChange={v => setForm(f => ({ ...f, serviceUrl: v }))} placeholder="https://…" />
              <div>
                <label className="label">{t('form.customIcon')}</label>
                <IconPicker value={form.customIconUrl} onChange={v => setForm(f => ({ ...f, customIconUrl: v }))} t={t} name={form.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <UnitField label={t('form.checkInterval')} value={form.checkInterval} unit="min" min={1}
                  onChange={v => setForm(f => ({ ...f, checkInterval: v }))} />
                <UnitField label={t('form.reportInterval')} value={form.reportInterval} unit="h" min={0}
                  onChange={v => setForm(f => ({ ...f, reportInterval: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.enabled}
                    onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                    className="w-4 h-4 rounded accent-periwinkle" />
                  <span className="text-sm text-thistle">{t('form.enabled')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.showOnStatusPage !== false}
                    onChange={e => setForm(f => ({ ...f, showOnStatusPage: e.target.checked }))}
                    className="w-4 h-4 rounded accent-periwinkle" />
                  <span className="text-sm text-thistle">{t('form.showOnStatusPage')}</span>
                </label>
              </div>
            </div>
          )}

          {/* Monitoring */}
          {tab === 'monitoring' && (
            <div className="space-y-4">
              <div>
                <label className="label">{t('form.confirmAfter')}</label>
                <div className="flex">
                  <input className="input rounded-r-none flex-1 border-r-0" type="number" min="1" max="10" step="1"
                    placeholder="1" value={form.confirmAfter}
                    onChange={e => setForm(f => ({ ...f, confirmAfter: Math.max(1, parseInt(e.target.value) || 1) }))} />
                  <span className="flex items-center px-3 text-xs text-muted bg-surface border border-border rounded-r-lg shrink-0">
                    {t('form.confirmAfterHint')}
                  </span>
                </div>
              </div>
              <div>
                <label className="label">{t('form.slaTarget')}</label>
                <div className="flex">
                  <input className="input rounded-r-none flex-1 border-r-0" type="number" min="0" max="100" step="0.1"
                    placeholder={t('form.slaTargetHint')} value={form.slaTarget}
                    onChange={e => setForm(f => ({ ...f, slaTarget: e.target.value }))} />
                  <span className="flex items-center px-3 text-xs text-muted bg-surface border border-border rounded-r-lg shrink-0">%</span>
                </div>
              </div>
              {metrics.length > 0 && (
                <div>
                  <label className="label">{t('form.cardMetric')}</label>
                  <select className="select" value={form.cardMetric || ''}
                    onChange={e => setForm(f => ({ ...f, cardMetric: e.target.value || null }))}>
                    <option value="">{t('form.cardMetricDefault')}</option>
                    {metrics.map(m => (
                      <option key={m.key} value={m.key}>{lang === 'fr' ? m.fr : m.en}</option>
                    ))}
                  </select>
                </div>
              )}
              {allMonitors.filter(m => m._id !== monitor?._id).length > 0 && (
                <div>
                  <label className="label">{t('form.dependsOn')}</label>
                  <p className="text-xs text-muted mb-2">{t('form.dependsOnHint')}</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
                    {allMonitors.filter(m => m._id !== monitor?._id).sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                      <label key={m._id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded accent-periwinkle"
                          checked={form.dependsOn.includes(String(m._id))}
                          onChange={e => {
                            const id = String(m._id);
                            setForm(f => ({
                              ...f,
                              dependsOn: e.target.checked
                                ? [...f.dependsOn, id]
                                : f.dependsOn.filter(d => d !== id),
                            }));
                          }} />
                        <span className="text-sm text-thistle">{m.name}</span>
                        <span className="text-xs text-muted ml-auto">{m.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div className="space-y-3">
              <div className="bg-granite-3/50 border border-border rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs text-muted">{t('form.notifTemplates.hint')}</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {['{{name}}','{{status}}','{{duration}}','{{downAt}}','{{resolvedAt}}'].map(v => (
                    <code key={v} className="text-xs bg-granite-3 border border-border rounded px-1.5 py-0.5 text-periwinkle">{v}</code>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-400">{t('form.notifTemplates.down')}</p>
                <Field label={t('form.notifTemplates.titleField')} value={form.config.downTitle || ''}
                  onChange={v => setForm(f => ({ ...f, config: { ...f.config, downTitle: v || undefined } }))}
                  placeholder={t('form.notifTemplates.titlePlaceholderDown')} />
                <Field label={t('form.notifTemplates.messageField')} value={form.config.downMessage || ''}
                  onChange={v => setForm(f => ({ ...f, config: { ...f.config, downMessage: v || undefined } }))}
                  placeholder={t('form.notifTemplates.messagePlaceholderDown')} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-celadon">{t('form.notifTemplates.recovery')}</p>
                <Field label={t('form.notifTemplates.titleField')} value={form.config.recoveryTitle || ''}
                  onChange={v => setForm(f => ({ ...f, config: { ...f.config, recoveryTitle: v || undefined } }))}
                  placeholder={t('form.notifTemplates.titlePlaceholderRecovery')} />
                <Field label={t('form.notifTemplates.messageField')} value={form.config.recoveryMessage || ''}
                  onChange={v => setForm(f => ({ ...f, config: { ...f.config, recoveryMessage: v || undefined } }))}
                  placeholder={t('form.notifTemplates.messagePlaceholderRecovery')} />
              </div>
            </div>
          )}

          {/* Intégrations */}
          {tab === 'integrations' && monitor && (
            <WebhookSection monitor={monitor} />
          )}

        </div>
      )}
    </div>
  );
}

export default function ServiceModal({ monitor, onClose, onSave }) {
  const { t, lang } = useLang();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const savedRef = useRef(false);
  const originalFormRef = useRef(null);
  const [allMonitors, setAllMonitors] = useState([]);
  const [savedProxies, setSavedProxies] = useState([]);
  const [tab, setTab] = useState('config');

  useEffect(() => {
    monitorsApi.list().then(setAllMonitors).catch(() => {});
    settingsApi.get().then(s => setSavedProxies(s.proxies || [])).catch(() => {});
  }, []);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = monitor?._id
        ? await monitorsApi.test(monitor._id)
        : await monitorsApi.testConfig(form.type, form.config);
      if (r.status === 'online') {
        setTestResult({ ok: true, message: t('test.ok') });
      } else {
        setTestResult({ ok: false, message: `${r.status}${r.error ? ': ' + r.error : ''}` });
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.response?.data?.error || t('test.error') });
    }
    setTesting(false);
  }
  const [form, setForm] = useState(() => {
    const initial = {
      name: '', type: 'cloudflare', description: '', category: '',
      enabled: true, checkInterval: 1, reportInterval: 6,
      cardMetric: null, serviceUrl: '', showOnStatusPage: true,
      slaTarget: '', confirmAfter: 1, dependsOn: [], customIconUrl: '',
      config: TYPE_DEFAULTS.cloudflare.config,
    };
    originalFormRef.current = initial;
    return initial;
  });

  useEffect(() => {
    if (monitor) {
      const monitorForm = {
        name: monitor.name,
        type: monitor.type,
        description: monitor.description || '',
        category: monitor.category || '',
        enabled: monitor.enabled,
        checkInterval: monitor.checkInterval,
        reportInterval: monitor.reportInterval,
        cardMetric: monitor.cardMetric || null,
        serviceUrl: monitor.serviceUrl || '',
        showOnStatusPage: monitor.showOnStatusPage !== false,
        slaTarget: monitor.slaTarget != null ? String(monitor.slaTarget) : '',
        confirmAfter: monitor.confirmAfter ?? 1,
        dependsOn: monitor.dependsOn?.map(id => String(id)) || [],
        customIconUrl: monitor.customIconUrl || '',
        config: monitor.config || {},
      };
      originalFormRef.current = monitorForm;
      savedRef.current = false;
      setTestResult(null);
      setForm(monitorForm);
    }
  }, [monitor]);

  const handleTypeChange = (type) => {
    const d = TYPE_DEFAULTS[type];
    setForm(f => {
      const autoName = !f.name || Object.values(TYPE_LABELS).includes(f.name);
      const autoServiceUrl = !f.serviceUrl || Object.values(TYPE_DEFAULTS).some(td => td.serviceUrl === f.serviceUrl);
      return {
        ...f, type,
        checkInterval: d.checkInterval, reportInterval: d.reportInterval,
        cardMetric: null, config: { ...d.config },
        ...(autoName ? { name: TYPE_LABELS[type] } : {}),
        ...(autoServiceUrl ? { serviceUrl: d.serviceUrl || '' } : {}),
      };
    });
  };

  const advancedDefaultOpen = !!(monitor && (
    monitor.description ||
    monitor.serviceUrl ||
    monitor.slaTarget != null ||
    monitor.cardMetric ||
    monitor.dependsOn?.length
  ));

  function handleClose() {
    const hasChanges = !savedRef.current &&
      JSON.stringify(form) !== JSON.stringify(originalFormRef.current);
    if (hasChanges && !window.confirm(t('form.unsavedChanges'))) return;
    onClose();
  }

  const modalTabs = [
    { id: 'config',        label: 'Config' },
    { id: 'general',       label: lang === 'fr' ? 'Général' : 'General' },
    { id: 'monitoring',    label: 'Monitoring' },
    { id: 'notifications', label: lang === 'fr' ? 'Notifs' : 'Notifs' },
    ...(monitor ? [{ id: 'integrations', label: lang === 'fr' ? 'Intégrations' : 'Integrations' }] : []),
  ];

  const metrics = getMetrics(form.type, form.config);

  return (
    <Portal><div className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="modal-panel bg-card border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl h-[92dvh] sm:h-[600px] flex flex-col shadow-2xl">
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ServiceIcon type={form.type} size={16} customIconUrl={form.customIconUrl} />
            <h2 className="font-semibold text-thistle">{monitor ? (form.name || t('form.titleEdit')) : t('form.titleNew')}</h2>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-5 border-b border-border shrink-0 overflow-x-auto">
          {modalTabs.map(mt => (
            <button key={mt.id} type="button" onClick={() => setTab(mt.id)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors
                ${tab === mt.id
                  ? 'text-thistle border-b-2 border-periwinkle -mb-px'
                  : 'text-muted hover:text-thistle'}`}>
              {mt.label}
            </button>
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); savedRef.current = true; onSave({ ...form, slaTarget: form.slaTarget !== '' ? parseFloat(form.slaTarget) : null }); }}
          className="flex flex-col flex-1 min-h-0">

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Config */}
            {tab === 'config' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('form.name')} value={form.name}
                    onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t('form.namePlaceholder')} />
                  <Field label={t('form.category')} value={form.category}
                    onChange={v => setForm(f => ({ ...f, category: v }))} placeholder={t('form.categoryPlaceholder')} />
                </div>
                <div>
                  <label className="label">{t('form.type')}</label>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-shrink-0 flex items-center justify-center px-3 py-2 rounded-lg border border-border bg-surface">
                      <ServiceIcon key={form.type} type={form.type} size={18} customIconUrl={form.customIconUrl} />
                    </div>
                    <select className="input flex-1" value={form.type} disabled={!!monitor}
                      onChange={e => !monitor && handleTypeChange(e.target.value)}>
                      {Object.entries(TYPE_LABELS).sort((a, b) => a[1].localeCompare(b[1])).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Field label={t('form.serviceUrl')} value={form.serviceUrl}
                  onChange={v => setForm(f => ({ ...f, serviceUrl: v }))} placeholder="https://…" />
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.enabled}
                      onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded accent-periwinkle" />
                    <span className="text-sm text-thistle">{t('form.enabled')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.showOnStatusPage !== false}
                      onChange={e => setForm(f => ({ ...f, showOnStatusPage: e.target.checked }))}
                      className="w-4 h-4 rounded accent-periwinkle" />
                    <span className="text-sm text-thistle">{t('form.showOnStatusPage')}</span>
                  </label>
                </div>
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">{t('form.config')} {TYPE_LABELS[form.type]}</p>
                  <ConfigFields type={form.type} config={form.config}
                    onChange={config => setForm(f => ({ ...f, config }))} t={t} proxies={savedProxies} />
                </div>
              </>
            )}

            {/* Général */}
            {tab === 'general' && (
              <div className="space-y-4">
                <Field label={t('form.description')} value={form.description}
                  onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="…" />
                <div>
                  <label className="label">{t('form.customIcon')}</label>
                  <IconPicker value={form.customIconUrl} onChange={v => setForm(f => ({ ...f, customIconUrl: v }))} t={t} name={form.name} />
                </div>
              </div>
            )}

            {/* Monitoring */}
            {tab === 'monitoring' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <UnitField label={t('form.checkInterval')} value={form.checkInterval} unit="min" min={1}
                    onChange={v => setForm(f => ({ ...f, checkInterval: v }))} />
                  <UnitField label={t('form.reportInterval')} value={form.reportInterval} unit="h" min={0}
                    onChange={v => setForm(f => ({ ...f, reportInterval: v }))} />
                </div>
                <div>
                  <label className="label">{t('form.confirmAfter')}</label>
                  <div className="flex">
                    <input className="input rounded-r-none flex-1 border-r-0" type="number" min="1" max="10" step="1"
                      placeholder="1" value={form.confirmAfter}
                      onChange={e => setForm(f => ({ ...f, confirmAfter: Math.max(1, parseInt(e.target.value) || 1) }))} />
                    <span className="flex items-center px-3 text-xs text-muted bg-surface border border-border rounded-r-lg shrink-0">
                      {t('form.confirmAfterHint')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="label">{t('form.slaTarget')}</label>
                  <div className="flex">
                    <input className="input rounded-r-none flex-1 border-r-0" type="number" min="0" max="100" step="0.1"
                      placeholder={t('form.slaTargetHint')} value={form.slaTarget}
                      onChange={e => setForm(f => ({ ...f, slaTarget: e.target.value }))} />
                    <span className="flex items-center px-3 text-xs text-muted bg-surface border border-border rounded-r-lg shrink-0">%</span>
                  </div>
                </div>
                {metrics.length > 0 && (
                  <div>
                    <label className="label">{t('form.cardMetric')}</label>
                    <select className="select" value={form.cardMetric || ''}
                      onChange={e => setForm(f => ({ ...f, cardMetric: e.target.value || null }))}>
                      <option value="">{t('form.cardMetricDefault')}</option>
                      {metrics.map(m => (
                        <option key={m.key} value={m.key}>{lang === 'fr' ? m.fr : m.en}</option>
                      ))}
                    </select>
                  </div>
                )}
                {allMonitors.filter(m => m._id !== monitor?._id).length > 0 && (
                  <div>
                    <label className="label">{t('form.dependsOn')}</label>
                    <p className="text-xs text-muted mb-2">{t('form.dependsOnHint')}</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                      {allMonitors.filter(m => m._id !== monitor?._id).sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                        <label key={m._id} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded accent-periwinkle"
                            checked={form.dependsOn.includes(String(m._id))}
                            onChange={e => {
                              const id = String(m._id);
                              setForm(f => ({
                                ...f,
                                dependsOn: e.target.checked
                                  ? [...f.dependsOn, id]
                                  : f.dependsOn.filter(d => d !== id),
                              }));
                            }} />
                          <span className="text-sm text-thistle">{m.name}</span>
                          <span className="text-xs text-muted ml-auto">{m.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notifications */}
            {tab === 'notifications' && (
              <div className="space-y-3">
                <div className="bg-granite-3/50 border border-border rounded-lg px-3 py-2 space-y-1">
                  <p className="text-xs text-muted">{t('form.notifTemplates.hint')}</p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {['{{name}}','{{status}}','{{duration}}','{{downAt}}','{{resolvedAt}}'].map(v => (
                      <code key={v} className="text-xs bg-granite-3 border border-border rounded px-1.5 py-0.5 text-periwinkle">{v}</code>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-400">{t('form.notifTemplates.down')}</p>
                  <Field label={t('form.notifTemplates.titleField')} value={form.config.downTitle || ''}
                    onChange={v => setForm(f => ({ ...f, config: { ...f.config, downTitle: v || undefined } }))}
                    placeholder={t('form.notifTemplates.titlePlaceholderDown')} />
                  <Field label={t('form.notifTemplates.messageField')} value={form.config.downMessage || ''}
                    onChange={v => setForm(f => ({ ...f, config: { ...f.config, downMessage: v || undefined } }))}
                    placeholder={t('form.notifTemplates.messagePlaceholderDown')} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-celadon">{t('form.notifTemplates.recovery')}</p>
                  <Field label={t('form.notifTemplates.titleField')} value={form.config.recoveryTitle || ''}
                    onChange={v => setForm(f => ({ ...f, config: { ...f.config, recoveryTitle: v || undefined } }))}
                    placeholder={t('form.notifTemplates.titlePlaceholderRecovery')} />
                  <Field label={t('form.notifTemplates.messageField')} value={form.config.recoveryMessage || ''}
                    onChange={v => setForm(f => ({ ...f, config: { ...f.config, recoveryMessage: v || undefined } }))}
                    placeholder={t('form.notifTemplates.messagePlaceholderRecovery')} />
                </div>
              </div>
            )}

            {/* Intégrations */}
            {tab === 'integrations' && monitor && (
              <WebhookSection monitor={monitor} />
            )}

          </div>

          {/* Footer — always visible */}
          <div className="flex justify-between items-start gap-3 px-5 py-4 border-t border-border shrink-0">
            <div>
              <button type="button" onClick={handleTest} disabled={testing}
                className="btn-ghost border border-border px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <Wifi size={14} className={testing ? 'animate-pulse text-periwinkle' : ''} />
                {testing ? t('test.testing') : t('test.button')}
              </button>
              {testResult && (
                <p className={`text-xs mt-1.5 ${testResult.ok ? 'text-celadon' : 'text-red-400'}`}>
                  {testResult.ok ? '✓' : '✗'} {testResult.message}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className="btn-ghost">{t('form.cancel')}</button>
              <button type="submit" className="btn-primary">{monitor ? t('form.save') : t('form.create')}</button>
            </div>
          </div>
        </form>
      </div>
    </div></Portal>
  );
}
