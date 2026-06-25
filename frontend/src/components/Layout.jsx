import React, { useState, useEffect, useRef } from 'react';
import { version } from '../../package.json';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, Bell, Settings, Menu, X, Code2, Siren, LogOut, Sun, Moon, BarChart2, GitBranch, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import { incidents as incidentsApi, ai as aiApi } from '../api';
import AiChat from './AiChat';
import ChangelogModal from './ChangelogModal';
import GlobalSearch from './GlobalSearch';

function NavItem({ to, icon: Icon, label, onClick, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-periwinkle/10 text-periwinkle border border-periwinkle/25'
            : 'text-thistle/70 hover:text-thistle hover:bg-granite-3'
        }`
      }
    >
      <span className="relative shrink-0">
        <Icon size={16} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </span>
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function UserFooter({ onLogout }) {
  const { user } = useAuth();
  const initial = (user?.username?.[0] ?? '?').toUpperCase();
  return (
    <div className="p-3 border-t border-border flex items-center gap-2.5 safe-bottom">
      <div className="w-7 h-7 rounded-full bg-periwinkle/20 border border-periwinkle/30 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-periwinkle">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-thistle truncate">{user?.username}</p>
      </div>
      <button onClick={onLogout} title="Logout"
        className="btn-ghost p-1.5 rounded-lg shrink-0 text-muted/50 hover:text-red-400 transition-colors">
        <LogOut size={14} />
      </button>
    </div>
  );
}

function SidebarHeader() {
  const { theme, toggle, auto, enableAuto } = useTheme();
  const { lang, switchLang, t } = useLang();
  const [showChangelog, setShowChangelog] = useState(false);
  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2.5">
        <img src="/logo.svg" alt="Orveil" className="w-7 h-7" />
        <span className="text-lg font-bold tracking-tight text-thistle">Orveil</span>
        <button onClick={() => setShowChangelog(true)}
          className="text-[10px] text-muted/50 font-normal ml-0.5 mt-1 hover:text-periwinkle transition-colors">
          v{version}
        </button>
      </div>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      <p className="text-xs text-muted mt-1">{t('nav.subtitle')}</p>
      <div className="flex items-center justify-center gap-2 mt-2.5">
        <button onClick={toggle} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          className={`p-2 rounded-lg hover:text-thistle hover:bg-granite-3 transition-colors ${auto ? 'text-muted/40' : 'text-muted'}`}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={enableAuto} title="Auto (system theme)"
          className={`text-xs px-1.5 py-1 rounded-lg transition-colors font-medium ${auto ? 'text-periwinkle bg-periwinkle/10' : 'text-muted hover:text-thistle hover:bg-granite-3'}`}>
          Auto
        </button>
        <div className="w-px h-4 bg-border" />
        <button onClick={() => switchLang(lang === 'fr' ? 'en' : 'fr')}
          title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
          className="flex items-center gap-1 p-2 rounded-lg text-muted hover:text-thistle hover:bg-granite-3 transition-colors">
          <span className="text-xs font-semibold uppercase tracking-wide">{lang === 'fr' ? 'EN' : 'FR'}</span>
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();
  const { t } = useLang();
  const { add: addToast } = useToast();
  const mountedAt = useRef(Date.now());

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function fetchIncidents() {
      incidentsApi.list({ open: true, limit: 100 }).then(data => setOpenIncidents(data.length)).catch(() => {});
    }
    fetchIncidents();
    const timer = setInterval(fetchIncidents, 60000);

    aiApi.status().then(({ configured }) => setAiConfigured(configured)).catch(() => {});

    const es = new EventSource('/api/events', { withCredentials: true });
    es.addEventListener('monitor', (e) => {
      fetchIncidents();
      // Suppress toasts for the first 5s after page load to avoid spamming on connect
      if (Date.now() - mountedAt.current < 5000) return;
      const { name, prevStatus, status } = JSON.parse(e.data);
      if (!prevStatus || prevStatus === status || prevStatus === 'unknown') return;
      if (status === 'error') addToast(`${name} — ${t('toast.statusError')}`, 'error');
      else if (status === 'warning') addToast(`${name} — ${t('toast.statusWarning')}`, 'warning');
      else if (status === 'online') addToast(`${name} — ${t('toast.statusOnline')}`, 'success');
    });
    es.onerror = () => {};

    return () => { clearInterval(timer); es.close(); };
  }, []);

  const nav = [
    { to: '/',         icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/monitors', icon: Radio,           label: t('nav.services') },
    { to: '/logs',     icon: Bell,            label: t('nav.notifications') },
    { to: '/incidents',icon: Siren,           label: t('nav.incidents'), badge: openIncidents },
    { to: '/timeline', icon: GitBranch,       label: t('nav.timeline') },
    { to: '/stats',    icon: BarChart2,       label: t('nav.stats') },
    { to: '/settings', icon: Settings,        label: t('nav.settings') },
    { to: '/docs',     icon: Code2,           label: t('nav.api') },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-card border-r border-border flex-col h-screen sticky top-0">
        <SidebarHeader />
        <div className="px-3 pt-2 pb-1">
          <button onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted/70 bg-granite-3/60 border border-border hover:border-periwinkle/30 hover:text-thistle transition-colors">
            <Search size={13} className="shrink-0" />
            <span className="flex-1 text-left truncate">{t('globalSearch.placeholder')}</span>
            <kbd className="text-[10px] bg-surface border border-border rounded px-1 py-0.5 opacity-60 shrink-0">⌘K</kbd>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => <NavItem key={item.to} {...item} />)}
        </nav>
        <UserFooter onLogout={logout} />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex-1"><SidebarHeader /></div>
          <button onClick={() => setSidebarOpen(false)} className="btn-ghost p-1.5 rounded-lg mt-3 mr-3 shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="px-3 pt-2 pb-1">
          <button onClick={() => { setSidebarOpen(false); setSearchOpen(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted/70 bg-granite-3/60 border border-border">
            <Search size={13} className="shrink-0" />
            <span className="flex-1 text-left truncate">{t('globalSearch.placeholder')}</span>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />)}
        </nav>
        <UserFooter onLogout={logout} />
      </aside>

      {/* Mobile top bar — fixed so the virtual keyboard can't push it off screen */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 h-14 bg-card border-b border-border safe-top" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-1.5 rounded-lg">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Orveil" className="w-5 h-5" />
          <span className="font-bold text-thistle text-sm">Orveil</span>
        </div>
        <button onClick={() => setSearchOpen(true)} className="btn-ghost p-1.5 rounded-lg">
          <Search size={18} />
        </button>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Spacer that matches the fixed header height on mobile */}
        <div className="md:hidden shrink-0" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }} />

        <main className="flex-1 overflow-auto safe-bottom">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <AiChat configured={aiConfigured} />
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
