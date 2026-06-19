import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useLang } from '../context/LangContext';

const BASE = window.location.origin;

const METHOD_STYLE = {
  GET:    'bg-periwinkle/20 text-periwinkle border border-periwinkle/30',
  POST:   'bg-celadon/20 text-celadon border border-celadon/30',
  PUT:    'bg-frosted/20 text-frosted border border-frosted/30',
  PATCH:  'bg-thistle/20 text-thistle border border-thistle/30',
  DELETE: 'bg-red-900/30 text-red-300 border border-red-900/40',
};

function buildSections(t) {
  return [
    {
      key: 'services',
      routes: [
        { method: 'GET',    path: '/api/health',              descKey: 'health' },
        { method: 'GET',    path: '/api/monitors',            descKey: 'monitorsList' },
        { method: 'GET',    path: '/api/monitors/stats',      descKey: 'monitorsStats' },
        { method: 'GET',    path: '/api/monitors/:id',        descKey: 'monitorsById' },
        { method: 'GET',    path: '/api/monitors/cloudflare', descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/adguard',      descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/adguardhome',     descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/homeassistant',   descKey: 'monitorsByType' },
        { method: 'POST',   path: '/api/monitors/homeassistant/entities', descKey: 'haEntities', body: '{ "url": "…", "token": "…" }' },
        { method: 'GET',    path: '/api/monitors/hms',        descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/ultracc',    descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/syncthing',  descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/http',       descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/ping',       descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/proxmox',    descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/immich',     descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/portainer',  descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/ssh',        descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/heartbeat',  descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/docker',      descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/unraid',      descKey: 'monitorsByType' },
        { method: 'GET',    path: '/api/monitors/speedtest',   descKey: 'monitorsByType' },
        { method: 'POST',   path: '/api/monitors',            descKey: 'monitorsCreate' },
        { method: 'POST',   path: '/api/monitors/test',       descKey: 'monitorsTest', body: '{ "type": "http", "config": { "url": "…" } }' },
        { method: 'PUT',    path: '/api/monitors/:id',        descKey: 'monitorsUpdate' },
        { method: 'PATCH',  path: '/api/monitors/:id/toggle', descKey: 'monitorsToggle' },
        { method: 'PATCH',  path: '/api/monitors/reorder',    descKey: 'monitorsReorder' },
        { method: 'POST',   path: '/api/monitors/:id/run',    descKey: 'monitorsRun' },
        { method: 'DELETE', path: '/api/monitors/:id',        descKey: 'monitorsDelete' },
        { method: 'GET',    path: '/api/ping/:slug',          descKey: 'heartbeatPing' },
        { method: 'GET',    path: '/api/incidents',           descKey: 'incidentsList' },
        { method: 'GET',    path: '/api/history/:monitorId',  descKey: 'historyGet', params: '?limit=100' },
      ],
    },
    {
      key: 'public',
      routes: [
        { method: 'GET', path: '/api/public/status', descKey: 'publicStatus' },
      ],
    },
    {
      key: 'notifications',
      routes: [
        { method: 'GET',    path: '/api/logs',       descKey: 'logsList',  params: '?level=error&limit=50&monitorId=xxx' },
        { method: 'POST',   path: '/api/logs/send',  descKey: 'logsSend',  body: '{ "title": "…", "message": "…", "level": "info" }' },
        { method: 'DELETE', path: '/api/logs',       descKey: 'logsClear' },
      ],
    },
    {
      key: 'settings',
      routes: [
        { method: 'GET',  path: '/api/settings',      descKey: 'settingsGet' },
        { method: 'PUT',  path: '/api/settings',      descKey: 'settingsSave', body: '{ "appriseUrls": […], "appriseApiUrl": "…" }' },
        { method: 'POST', path: '/api/settings/test', descKey: 'settingsTest' },
      ],
    },
  ].map(s => ({
    title: t(`api.sections.${s.key}`),
    routes: s.routes.map(r => ({ ...r, desc: t(`api.routes.${r.descKey}`) })),
  }));
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function fallback() {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  function copy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="p-1 rounded text-muted hover:text-thistle transition-colors shrink-0">
      {copied ? <Check size={13} className="text-celadon" /> : <Copy size={13} />}
    </button>
  );
}

function TokenCard({ t }) {
  const token = localStorage.getItem('nh_token') || '';
  const preview = token ? `${token.slice(0, 20)}…` : '—';
  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold text-thistle">{t('api.auth.title')}</h2>
      <p className="text-xs text-muted">
        {t('api.auth.hint')} <span className="font-mono text-frosted">/api/health</span>{t('api.auth.hintAfter')}
      </p>
      <div className="bg-granite-3/60 border border-border rounded-lg px-3 py-2 flex items-center gap-2 font-mono text-xs">
        <span className="text-muted shrink-0">Authorization:</span>
        <span className="text-frosted truncate flex-1">Bearer {preview}</span>
        <CopyBtn text={`Bearer ${token}`} />
      </div>
      <p className="text-xs text-muted">
        {t('api.auth.validity')} <span className="text-thistle">{t('api.auth.days')}</span>. {t('api.auth.renew')}
      </p>
    </div>
  );
}

export default function ApiDocs() {
  const { t } = useLang();
  const sections = buildSections(t);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thistle">{t('api.title')}</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">
          {t('api.baseUrl')} : <span className="font-mono text-periwinkle">{BASE}/api</span>
        </p>
      </div>

      <TokenCard t={t} />

      {sections.map(section => (
        <div key={section.title} className="card space-y-1 p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-thistle">{section.title}</h2>
          </div>
          <div className="divide-y divide-border">
            {section.routes.map((r, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border shrink-0 mt-0.5 ${METHOD_STYLE[r.method]}`}>
                  {r.method}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-mono text-xs text-frosted truncate">{r.path}</span>
                    <CopyBtn text={`${BASE}${r.path}`} />
                  </div>
                  <p className="text-xs text-muted">{r.desc}</p>
                  {r.params && (
                    <p className="font-mono text-xs text-muted/70">{t('api.params')} : {r.params}</p>
                  )}
                  {r.body && (
                    <p className="font-mono text-xs text-muted/70 bg-granite-3/50 rounded px-2 py-1 mt-1">{r.body}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
