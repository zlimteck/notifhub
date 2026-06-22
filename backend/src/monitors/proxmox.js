const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiToken, node = 'pve', rejectUnauthorized = false, proxy } = config;
  // Proxmox uses self-signed certs by default; honour the config but never throw on cert errors unless explicitly enabled
  const tlsReject = rejectUnauthorized === true;

  if (!apiUrl || !apiToken) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('Proxmox', 'URL and API token required'), level: 'error', type: 'status_change' }
  ]};

  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized: tlsReject }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: { Authorization: `PVEAPIToken=${apiToken}`, ...cfHeaders(config) },
  });

  const base = apiUrl.replace(/\/$/, '');

  const start = Date.now();
  try {
    let resolvedNode = node;
    try {
      const nodesRes = await http.get(`${base}/api2/json/nodes`);
      const nodes = nodesRes.data.data || [];
      if (nodes.length && !nodes.find(n => n.node === resolvedNode)) {
        resolvedNode = nodes[0].node;
      }
    } catch (e) {
      if (e.response?.status === 403) {
        throw new Error('403 Access denied — Proxmox: Datacenter → Permissions → Add → API Token Permission → path "/" → role Administrator');
      }
      throw e;
    }

    const [nodeRes, qemuRes, lxcRes] = await Promise.all([
      http.get(`${base}/api2/json/nodes/${resolvedNode}/status`),
      http.get(`${base}/api2/json/nodes/${resolvedNode}/qemu`).catch(() => ({ data: { data: [] } })),
      http.get(`${base}/api2/json/nodes/${resolvedNode}/lxc`).catch(() => ({ data: { data: [] } })),
    ]);

    const ns = nodeRes.data.data;
    const vms  = qemuRes.data.data || [];
    const lxcs = lxcRes.data.data  || [];

    const cpuPct = Math.round((ns.cpu ?? 0) * 100);
    const memPct = ns.memory?.total > 0 ? Math.round((ns.memory.used / ns.memory.total) * 100) : 0;
    const vmRunning  = vms.filter(v => v.status === 'running').length;
    const lxcRunning = lxcs.filter(l => l.status === 'running').length;

    const notifications = [];
    if (lastState) {
      if (cpuPct > 90 && (lastState.cpuPct ?? 0) <= 90)
        notifications.push({ ...L.proxmoxHighCpu(cpuPct, node), level: 'warning', type: 'status_change' });
      if (memPct > 90 && (lastState.memPct ?? 0) <= 90)
        notifications.push({ ...L.proxmoxHighRam(memPct, node), level: 'warning', type: 'status_change' });
    }

    const responseTime = Date.now() - start;
    const state = { cpuPct, memPct, vmRunning, lxcRunning };
    const metrics = {
      node, cpuPct, memPct,
      vmTotal: vms.length, vmRunning,
      lxcTotal: lxcs.length, lxcRunning,
      uptime: ns.uptime,
      responseTime,
      statusCode: nodeRes.status,
    };

    return { status: 'online', state, metrics, notifications };
  } catch (err) {
    return { status: 'error', lastError: err.message, state: lastState, metrics: null, notifications: [
      { ...L.apiError('Proxmox', err.message), level: 'error', type: 'status_change' }
    ]};
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Proxmox', message: 'No data.' };
  return L.proxmoxReport(state, config.node);
}

module.exports = { check, report };
