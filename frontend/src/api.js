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
  clone: (id) => api.post(`/monitors/${id}/clone`).then(r => r.data),
  delete: (id) => api.delete(`/monitors/${id}`).then(r => r.data),
  reorder: (items) => api.patch('/monitors/reorder', { items }).then(r => r.data),
  bulk: (ids, action) => api.patch('/monitors/bulk', { ids, action }).then(r => r.data),
  pin: (id) => api.patch(`/monitors/${id}/pin`).then(r => r.data),
  maintenanceHistory: (id) => api.get(`/monitors/${id}/maintenance`).then(r => r.data),
  setMaintenance: (id, { minutes, startsAt }) => api.post(`/monitors/${id}/maintenance`, { minutes, startsAt }).then(r => r.data),
  cancelMaintenance: (id) => api.delete(`/monitors/${id}/maintenance`).then(r => r.data),
  test:       (id)           => api.post(`/monitors/${id}/test`).then(r => r.data),
  testConfig: (type, config) => api.post('/monitors/test', { type, config }).then(r => r.data),
  haEntities: (url, token, rejectUnauthorized) => api.post('/monitors/homeassistant/entities', { url, token, rejectUnauthorized }).then(r => r.data),
  generateWebhookToken: (id) => api.post(`/monitors/${id}/webhook-token`).then(r => r.data),
  revokeWebhookToken:   (id) => api.delete(`/monitors/${id}/webhook-token`).then(r => r.data),
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
  testProxy: (proxy) => api.post('/settings/proxy/test', { proxy }).then(r => r.data),
  regenerateMcpKey: () => api.post('/settings/mcp/regenerate').then(r => r.data),
  exportData: () => api.get('/settings/export').then(r => r.data),
  importData: (data) => api.post('/settings/import', data).then(r => r.data),
  addProxy: (proxy) => api.post('/settings/proxies', proxy).then(r => r.data),
  updateProxy: (id, proxy) => api.put(`/settings/proxies/${id}`, proxy).then(r => r.data),
  deleteProxy: (id) => api.delete(`/settings/proxies/${id}`).then(r => r.data),
  activateProxy: (id) => api.patch(`/settings/proxies/${id}/activate`).then(r => r.data),
};

export const history = {
  all: (hours = 24) => api.get('/history', { params: { hours } }).then(r => r.data),
  monitor: (id, hours = 24) => api.get(`/history/${id}`, { params: { hours } }).then(r => r.data),
  dailyAll: (days = 90) => api.get('/history/daily', { params: { days } }).then(r => r.data),
};

export const incidents = {
  list: (params) => api.get('/incidents', { params }).then(r => r.data),
  acknowledge: (id) => api.post(`/incidents/${id}/acknowledge`).then(r => r.data),
  setSeverity: (id, severity) => api.patch(`/incidents/${id}/severity`, { severity }).then(r => r.data),
  delete: (id) => api.delete(`/incidents/${id}`).then(r => r.data),
  savePostmortem: (id, data) => api.patch(`/incidents/${id}/postmortem`, data).then(r => r.data),
  timeline: (hours = 24) => api.get('/incidents/timeline', { params: { hours } }).then(r => r.data),
};

export const stats = {
  get: () => api.get('/stats').then(r => r.data),
};

export const annotations = {
  list: (monitorId, since) => api.get('/annotations', { params: { monitorId, since } }).then(r => r.data),
  create: (data) => api.post('/annotations', data).then(r => r.data),
  delete: (id) => api.delete(`/annotations/${id}`).then(r => r.data),
};

export const publicStatus = {
  get: () => axios.get('/api/public/status').then(r => r.data),
};

export const changelog = {
  list:   (monitorId)       => api.get('/changelog', { params: { monitorId } }).then(r => r.data),
  create: (data)            => api.post('/changelog', data).then(r => r.data),
  update: (id, data)        => api.put(`/changelog/${id}`, data).then(r => r.data),
  delete: (id)              => api.delete(`/changelog/${id}`).then(r => r.data),
};

export const search = {
  query: (q) => api.get('/search', { params: { q } }).then(r => r.data),
};

export const ai = {
  status:    ()          => api.get('/ai/status').then(r => r.data),
  models:    ()          => api.get('/ai/models').then(r => r.data),
  saveKey:   (apiKey)    => api.put('/ai/key', { apiKey }).then(r => r.data),
  deleteKey: ()          => api.delete('/ai/key').then(r => r.data),
  saveModel: (model)     => api.put('/ai/model', { model }).then(r => r.data),
  chat:      (messages)  => api.post('/ai/chat', { messages }).then(r => r.data),
};
