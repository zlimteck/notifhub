import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(form);
      login(data.token, data.username);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/logo.svg" alt="Orveil" className="w-14 h-14 mx-auto" />
          <h1 className="text-2xl font-bold text-thistle">Orveil</h1>
          <p className="text-sm text-muted">{t('login.subtitle')}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('login.username')}</label>
              <input className="input" autoComplete="username" autoFocus
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin" />
            </div>
            <div>
              <label className="label">{t('login.password')}</label>
              <input className="input" type="password" autoComplete="current-password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" />
            </div>
            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? t('login.signing') : t('login.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
