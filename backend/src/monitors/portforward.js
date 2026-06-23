'use strict';
const net  = require('net');
const i18n = require('../i18n');

function tcpConnect(host, port, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start  = Date.now();
    const socket = net.createConnection({ host, port, timeout });
    socket.on('connect', () => { resolve({ latency: Date.now() - start, errorType: null }); socket.destroy(); });
    socket.on('timeout',  () => { socket.destroy(); reject({ message: 'Timeout', errorType: 'timeout' }); });
    socket.on('error',    (e) => reject({ message: e.message, errorType: e.code === 'ECONNREFUSED' ? 'refused' : 'timeout' }));
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { host, port = 80 } = config;

  if (!host || !port) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Port Forwarding', 'Host and port required'), level: 'error', type: 'status_change' }],
  };

  let latency   = null;
  let errorType = null;
  let errorMsg  = null;

  try {
    ({ latency, errorType } = await tcpConnect(host, Number(port)));
  } catch (e) {
    errorMsg  = e.message;
    errorType = e.errorType || 'timeout';
  }

  const online    = latency !== null;
  const wasOnline = lastState?.online ?? null;

  const notifications = [];
  if (lastState !== null) {
    if (!online && wasOnline)  notifications.push({ ...L.portForwardClosed(host, port, errorType), level: 'error',   type: 'status_change' });
    if (online  && !wasOnline) notifications.push({ ...L.portForwardOpen(host, port, latency),     level: 'success', type: 'status_change' });
  }

  return {
    status:    online ? 'online' : 'offline',
    lastError: errorMsg || null,
    state:     { online, latency, errorType, host, port },
    metrics:   { host, port, latency, errorType },
    notifications,
  };
}

module.exports = { check };
