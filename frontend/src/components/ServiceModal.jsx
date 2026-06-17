import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useLang } from '../context/LangContext';
import ServiceIcon from './ServiceIcon';

const TYPE_DEFAULTS = {
  cloudflare: { checkInterval: 1,  reportInterval: 6,  config: { apiToken: '', accountId: '' } },
  adguard:    { checkInterval: 60, reportInterval: 24, config: { accessToken: '', refreshTok: '' } },
  hms:        { checkInterval: 5,  reportInterval: 0,  config: { hmsToken: '', vpsList: [{ id: '', name: '' }] } },
  ultracc:    { checkInterval: 5,  reportInterval: 0,  config: { apiUrl: '', ultraToken: '' } },
  syncthing:  { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', apiKey: '', folderIds: [], rejectUnauthorized: true } },
  http:       { checkInterval: 5,  reportInterval: 0,  config: { url: '', method: 'GET', body: '', expectedStatus: 200, keyword: '', timeout: 10000, sslAlertDays: 30, bearerToken: '', basicUser: '', basicPass: '', customHeaderName: '', customHeaderValue: '', rejectUnauthorized: true } },
  ping:       { checkInterval: 2,  reportInterval: 0,  config: { host: '', port: 80, attempts: 3 } },
  proxmox:    { checkInterval: 5,  reportInterval: 24, config: { apiUrl: '', apiToken: '', node: 'pve', rejectUnauthorized: false } },
  immich:     { checkInterval: 30, reportInterval: 24, config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  portainer:  { checkInterval: 5,  reportInterval: 0,  config: { apiUrl: '', apiKey: '', rejectUnauthorized: true } },
  ssh:        { checkInterval: 5,  reportInterval: 24, config: { host: '', port: 22, username: '', password: '', privateKey: '' } },
  heartbeat:  { checkInterval: 5,  reportInterval: 0,  config: { expectedEvery: 60, slug: crypto.randomUUID() } },
  docker:     { checkInterval: 1,  reportInterval: 0,  config: { socketPath: '/var/run/docker.sock' } },
};

const TYPE_LABELS = {
  cloudflare: 'Cloudflare Tunnels',
  adguard:    'AdGuard DNS',
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
};

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

function ConfigFields({ type, config, onChange, t }) {
  const set = (key, val) => onChange({ ...config, [key]: val });
  const f = t('form.fields');

  if (type === 'cloudflare') return (
    <>
      <Field label="API Token" value={config.apiToken} onChange={v => set('apiToken', v)}
        placeholder="Your Cloudflare API token" hint={t('form.fields.cloudflare.apiTokenHint')} />
      <Field label="Account ID" value={config.accountId} onChange={v => set('accountId', v)}
        placeholder="Your Account ID" hint={t('form.fields.cloudflare.accountIdHint')} />
      <CFAccessSection config={config} set={set} t={t} />
    </>
  );

  if (type === 'adguard') return (
    <>
      <Field label="Access Token" value={config.accessToken} onChange={v => set('accessToken', v)}
        placeholder="Your AdGuard DNS access token" />
      <Field label="Refresh Token" value={config.refreshTok} onChange={v => set('refreshTok', v)}
        placeholder="Your AdGuard DNS refresh token" hint={t('form.fields.adguard.refreshHint')} />
      <CFAccessSection config={config} set={set} t={t} />
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
    </>
  );

  if (type === 'http') return (
    <>
      <Field label="URL" value={config.url} onChange={v => set('url', v)} placeholder="https://my-service.com" />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">{t('form.fields.http.method')}</label>
          <select value={config.method || 'GET'} onChange={e => set('method', e.target.value)}
            className="input text-sm">
            {['GET','POST','PUT','PATCH','DELETE','HEAD'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <Field label={t('form.fields.http.expectedStatus')} value={config.expectedStatus} onChange={v => set('expectedStatus', +v)} type="number" placeholder="200" />
      </div>
      {['POST','PUT','PATCH'].includes(config.method) && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">{t('form.fields.http.body')}</label>
          <textarea value={config.body || ''} onChange={e => set('body', e.target.value)}
            rows={4} placeholder='{"key": "value"}'
            className="input text-xs font-mono resize-y" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timeout (ms)" value={config.timeout} onChange={v => set('timeout', +v)} type="number" placeholder="10000" />
        <Field label={t('form.fields.http.sslAlertDays')} value={config.sslAlertDays ?? 30} onChange={v => set('sslAlertDays', +v)} type="number" placeholder="30" hint={t('form.fields.http.sslAlertDaysHint')} />
      </div>
      <Field label={t('form.fields.http.keyword')} value={config.keyword} onChange={v => set('keyword', v)}
        placeholder={t('form.fields.http.keywordPlaceholder')} hint={t('form.fields.http.keywordHint')} />
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

  if (type === 'proxmox') return (
    <>
      <Field label="URL API" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="https://192.168.1.10:8006" />
      <Field label="API Token" value={config.apiToken} onChange={v => set('apiToken', v)}
        placeholder="user@pve!tokenid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        hint={t('form.fields.proxmox.tokenHint')} />
      <Field label={t('form.fields.proxmox.node')} value={config.node} onChange={v => set('node', v)} placeholder="pve" />
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
    </>
  );

  if (type === 'immich') return (
    <>
      <Field label="URL Immich" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="https://immich.example.com" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder={t('form.fields.immich.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
    </>
  );

  if (type === 'portainer') return (
    <>
      <Field label="URL Portainer" value={config.apiUrl} onChange={v => set('apiUrl', v)} placeholder="https://portainer.example.com" />
      <Field label="API Key" value={config.apiKey} onChange={v => set('apiKey', v)}
        placeholder={t('form.fields.portainer.apiKeyHint')} />
      <TlsToggle config={config} set={set} t={t} />
      <CFAccessSection config={config} set={set} t={t} />
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

  if (type === 'docker') return (
    <Field label={t('form.fields.docker.socketPath')} value={config.socketPath}
      onChange={v => set('socketPath', v)} placeholder="/var/run/docker.sock"
      hint={t('form.fields.docker.socketPathHint')} />
  );

  return null;
}

export default function ServiceModal({ monitor, onClose, onSave, error }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: '', type: 'cloudflare', description: '', category: '',
    enabled: true, checkInterval: 1, reportInterval: 6,
    config: TYPE_DEFAULTS.cloudflare.config,
  });

  useEffect(() => {
    if (monitor) {
      setForm({
        name: monitor.name,
        type: monitor.type,
        description: monitor.description || '',
        category: monitor.category || '',
        enabled: monitor.enabled,
        checkInterval: monitor.checkInterval,
        reportInterval: monitor.reportInterval,
        config: monitor.config || {},
      });
    }
  }, [monitor]);

  const handleTypeChange = (type) => {
    const d = TYPE_DEFAULTS[type];
    setForm(f => ({ ...f, type, checkInterval: d.checkInterval, reportInterval: d.reportInterval, config: { ...d.config } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto shadow-2xl">
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-thistle">{monitor ? t('form.titleEdit') : t('form.titleNew')}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('form.name')} value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t('form.namePlaceholder')} />
            <Field label={t('form.category')} value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))} placeholder={t('form.categoryPlaceholder')} />
          </div>

          <div>
            <label className="label">{t('form.type')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(TYPE_LABELS).map(([v, l]) => {
                const active = form.type === v;
                return (
                  <button key={v} type="button" disabled={!!monitor}
                    onClick={() => !monitor && handleTypeChange(v)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left
                      ${active
                        ? 'bg-periwinkle/20 border-periwinkle/40 text-periwinkle'
                        : 'bg-surface border-border text-muted hover:border-periwinkle/30 hover:text-thistle'
                      } ${monitor ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <ServiceIcon type={v} size={16} />
                    <span className="truncate">{l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label={t('form.description')} value={form.description}
            onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="…" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('form.checkInterval')}</label>
              <input className="input" type="number" min="1" value={form.checkInterval}
                onChange={e => setForm(f => ({ ...f, checkInterval: +e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('form.reportInterval')}</label>
              <input className="input" type="number" min="0" value={form.reportInterval}
                onChange={e => setForm(f => ({ ...f, reportInterval: +e.target.value }))} />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">{t('form.config')} {TYPE_LABELS[form.type]}</p>
            <ConfigFields type={form.type} config={form.config}
              onChange={config => setForm(f => ({ ...f, config }))} t={t} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled}
              onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              className="w-4 h-4 rounded accent-periwinkle" />
            <span className="text-sm text-thistle">{t('form.enabled')}</span>
          </label>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost">{t('form.cancel')}</button>
            <button type="submit" className="btn-primary">{monitor ? t('form.save') : t('form.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
