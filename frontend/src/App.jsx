import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LangProvider } from './context/LangContext';
import { ToastProvider } from './context/ToastContext';
import Stats from './pages/Stats';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Logs from './pages/Logs';
import Incidents from './pages/Incidents';
import Timeline from './pages/Timeline';
import Settings from './pages/Settings';
import ApiDocs from './pages/ApiDocs';
import Login from './pages/Login';
import StatusPage from './pages/StatusPage';
import NotFound from './pages/NotFound';
import KonamiEasterEgg from './components/KonamiEasterEgg';

function AuthGuard() {
  const { token, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-muted text-sm">Chargement…</p>
    </div>
  );
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function LoginGuard() {
  const { token } = useAuth();
  return token ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
    <LangProvider>
    <AuthProvider>
    <ToastProvider>
      <Routes>
        <Route path="/status" element={<StatusPage />} />
        <Route path="/login" element={<LoginGuard />} />
        <Route path="*" element={<NotFound />} />
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="monitors" element={<Services />} />
            <Route path="logs" element={<Logs />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="settings" element={<Settings />} />
            <Route path="docs" element={<ApiDocs />} />
            <Route path="stats" element={<Stats />} />
          </Route>
        </Route>
      </Routes>
      <KonamiEasterEgg />
    </ToastProvider>
    </AuthProvider>
    </LangProvider>
    </ThemeProvider>
  );
}
