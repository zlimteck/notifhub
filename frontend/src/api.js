import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('nh_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nh_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (data) => api.post('/auth/login', data).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  changePassword: (data) => api.post('/auth/change-password', data).then(r => r.data),
};

export const monitors = {
  list: () => api.get('/monitors').then(r => r.data),
  get: (id) => api.get(`/monitors/${id}`).then(r => r.data),
  create: (data) => api.post('/monitors', data).then(r => r.data),
  update: (id, data) => api.put(`/monitors/${id}`, data).then(r => r.data),
  toggle: (id) => api.patch(`/monitors/${id}/toggle`).then(r => r.data),
  run: (id) => api.post(`/monitors/${id}/run`).then(r => r.data),
  delete: (id) => api.delete(`/monitors/${id}`).then(r => r.data),
  reorder: (items) => api.patch('/monitors/reorder', { items }).then(r => r.data),
  setMaintenance: (id, minutes) => api.post(`/monitors/${id}/maintenance`, { minutes }).then(r => r.data),
  cancelMaintenance: (id) => api.delete(`/monitors/${id}/maintenance`).then(r => r.data),
  test: (id) => api.post(`/monitors/${id}/test`).then(r => r.data),
};

export const logs = {
  list: (params) => api.get('/logs', { params }).then(r => r.data),
  clear: () => api.delete('/logs').then(r => r.data),
  send: (data) => api.post('/logs/send', data).then(r => r.data),
};

export const settings = {
  get: () => api.get('/settings').then(r => r.data),
  save: (data) => api.put('/settings', data).then(r => r.data),
  test: () => api.post('/settings/test').then(r => r.data),
};

export const history = {
  all: (hours = 24) => api.get('/history', { params: { hours } }).then(r => r.data),
  monitor: (id, hours = 24) => api.get(`/history/${id}`, { params: { hours } }).then(r => r.data),
  dailyAll: (days = 90) => api.get('/history/daily', { params: { days } }).then(r => r.data),
};

export const incidents = {
  list: (params) => api.get('/incidents', { params }).then(r => r.data),
  acknowledge: (id) => api.post(`/incidents/${id}/acknowledge`).then(r => r.data),
  delete: (id) => api.delete(`/incidents/${id}`).then(r => r.data),
};

export const stats = {
  get: () => api.get('/stats').then(r => r.data),
};

export const publicStatus = {
  get: () => axios.get('/api/public/status').then(r => r.data),
};
