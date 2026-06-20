import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';

const FLATLINE = 'M0,24 L30,24 L38,4 L46,44 L54,4 L62,44 L70,24 L400,24';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = s => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center animate-fade-in-up">

        <div className="relative inline-flex items-center justify-center mb-8">
          <img src="/logo.svg" alt="Orveil" className="w-16 h-16 opacity-40" />
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            <span className="absolute w-4 h-4 rounded-full bg-red-500 opacity-30 scale-150 animate-ping" />
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse-red" />
          </span>
        </div>

        <div className="mb-2">
          <span className="text-8xl font-bold text-ink/10 select-none tracking-tighter">404</span>
        </div>

        <h1 className="text-xl font-medium text-ink mb-1">{t('notFound.title')}</h1>
        <p className="text-sm text-muted mb-8">
          {t('notFound.monitoring')}{' '}
          <span className="text-thistle font-mono">{fmt(elapsed)}</span>
          <span className="animate-blink text-thistle">_</span>
          <br />{t('notFound.neverOnline')}
        </p>

        <div className="bg-card border border-border rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex">
              <span className="absolute w-2.5 h-2.5 rounded-full bg-red-500/30 animate-ping" />
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-medium text-ink truncate">{window.location.pathname}</span>
            <span className="ml-auto text-xs bg-red-900/30 text-red-400 border border-red-900/40 rounded px-2 py-0.5 shrink-0">Offline</span>
          </div>

          <svg viewBox="0 0 400 48" className="w-full h-8 mb-3" aria-hidden="true">
            <path d={FLATLINE} fill="none" stroke="rgb(239 68 68 / 0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={FLATLINE} fill="none" stroke="rgb(239 68 68 / 0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-flatline" />
          </svg>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface rounded-lg px-3 py-2">
              <p className="text-muted mb-0.5">{t('notFound.status')}</p>
              <p className="text-red-400 font-mono">404 Not Found</p>
            </div>
            <div className="bg-surface rounded-lg px-3 py-2">
              <p className="text-muted mb-0.5">{t('notFound.uptime')}</p>
              <p className="text-ink font-mono">0.00%</p>
            </div>
            <div className="bg-surface rounded-lg px-3 py-2">
              <p className="text-muted mb-0.5">{t('notFound.incident')}</p>
              <p className="text-amber-400 font-mono">#1 open</p>
            </div>
            <div className="bg-surface rounded-lg px-3 py-2">
              <p className="text-muted mb-0.5">{t('notFound.responseTime')}</p>
              <p className="text-ink font-mono">∞ ms</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted mb-6 leading-relaxed">
          {t('notFound.incidentOpened')}<br />
          {t('notFound.incidentClosed')}<br />
          {t('notFound.incidentReason')}
        </p>

        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          {t('notFound.back')}
        </button>

      </div>
    </div>
  );
}
