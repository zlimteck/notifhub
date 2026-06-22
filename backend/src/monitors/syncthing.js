const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

function makeClient(rejectUnauthorized = false, extraHeaders = {}, proxy = null) {
  const proxyAgents = getProxyAgents(proxy);
  return axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: extraHeaders,
  });
}

async function getConnections(http, apiUrl, apiKey) {
  const res = await http.get(`${apiUrl}/rest/system/connections`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data.connections || {};
}

async function getSystemStatus(http, apiUrl, apiKey) {
  const res = await http.get(`${apiUrl}/rest/system/status`, {
    headers: { 'X-API-Key': apiKey },
  });
  return { data: res.data, statusCode: res.status };
}

async function getConfig(http, apiUrl, apiKey) {
  const res = await http.get(`${apiUrl}/rest/system/config`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data;
}

async function getFolderStatus(http, apiUrl, apiKey, folderId) {
  const res = await http.get(`${apiUrl}/rest/db/status?folder=${folderId}`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.data;
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, folderIds = [], rejectUnauthorized = false, proxy } = config;

  if (!apiUrl || !apiKey) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Syncthing', 'API URL and API key required'), level: 'error', type: 'status_change' }
    ]};
  }

  const http = makeClient(rejectUnauthorized, cfHeaders(config), proxy);
  let cfg, connections, sysStatus, sysStatusResult, folders = [];

  try {
    [cfg, connections, sysStatusResult] = await Promise.all([
      getConfig(http, apiUrl, apiKey),
      getConnections(http, apiUrl, apiKey),
      getSystemStatus(http, apiUrl, apiKey),
    ]);
    sysStatus = sysStatusResult.data;

    const targetFolders = folderIds.length
      ? folderIds
      : (cfg.folders || []).map(f => f.id);

    for (const fid of targetFolders) {
      try {
        const status = await getFolderStatus(http, apiUrl, apiKey, fid);
        const folderCfg = cfg.folders?.find(f => f.id === fid);
        folders.push({
          id: fid,
          label: folderCfg?.label || fid,
          state: status.state,
          inSyncFiles: status.inSyncFiles,
          globalFiles: status.globalFiles,
          needBytes: status.needBytes,
        });
      } catch (e) {
        folders.push({ id: fid, label: fid, state: 'error', error: e.message });
      }
    }
  } catch (err) {
    return { status: 'error', state: lastState, metrics: null, notifications: [
      { ...L.apiError('Syncthing', err.message), level: 'error', type: 'status_change' }
    ]};
  }

  const deviceMap = Object.fromEntries((cfg.devices || []).map(d => [d.deviceID, d.name]));
  const myID = sysStatus?.myID;
  const hostDevice = myID ? { id: myID, name: deviceMap[myID] || 'Host', connected: true, isHost: true } : null;
  const peers = Object.entries(connections).map(([id, det]) => ({
    id,
    name: deviceMap[id] || 'Unknown',
    connected: det.connected,
  }));
  const devices = hostDevice ? [hostDevice, ...peers] : peers;

  const notifications = [];
  const prevDeviceMap = lastState?.devices
    ? Object.fromEntries(lastState.devices.map(d => [d.id, d]))
    : null;

  if (prevDeviceMap) {
    for (const dev of devices) {
      const prev = prevDeviceMap[dev.id];
      if (prev) {
        if (!dev.connected && prev.connected) {
          notifications.push({ ...L.syncthingDeviceDisconnected(dev.name), level: 'warning', type: 'status_change' });
        } else if (dev.connected && !prev.connected) {
          notifications.push({ ...L.syncthingDeviceReconnected(dev.name), level: 'success', type: 'status_change' });
        }
      }
    }

    for (const folder of folders) {
      const prevF = lastState?.folders?.find(f => f.id === folder.id);
      if (prevF && folder.state === 'error' && prevF.state !== 'error') {
        notifications.push({ ...L.syncthingFolderError(folder.label), level: 'error', type: 'status_change' });
      }
    }
  }

  const connectedCount = devices.filter(d => d.connected).length;
  const outOfSync = folders.filter(f => f.needBytes > 0 || f.state === 'error').length;
  const status = outOfSync > 0 ? 'warning' : 'online';

  const state = { devices, folders };
  const metrics = {
    devices_total: devices.length,
    devices_connected: connectedCount,
    folders_total: folders.length,
    folders_synced: folders.filter(f => f.needBytes === 0 && f.state !== 'error').length,
    devices,
    folders,
    statusCode: sysStatusResult.statusCode,
  };

  return { status, state, metrics, notifications };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Syncthing', message: 'No data available.' };
  return L.syncthingReport(state);
}

module.exports = { check, report };
