const axios = require('axios');
const https = require('https');

async function check(config, lastState) {
  const { apiUrl, apiKey, rejectUnauthorized = true } = config;

  if (!apiUrl || !apiKey) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ title: 'Config manquante — Speedtest Tracker', message: 'URL et clé API requises', level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');

  try {
    const res = await axios.get(`${base}/api/v1/results/latest`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized }),
    });

    const d = res.data?.data;
    if (!d) throw new Error('Réponse inattendue de l\'API');

    // bandwidth in bytes/s → Mbps; fallback if top-level already in Mbps
    const rawDown = d.data?.download?.bandwidth;
    const rawUp   = d.data?.upload?.bandwidth;
    const downloadMbps = rawDown != null
      ? Math.round((rawDown / 125000) * 10) / 10
      : (d.download != null ? Math.round(parseFloat(d.download) * 10) / 10 : null);
    const uploadMbps = rawUp != null
      ? Math.round((rawUp / 125000) * 10) / 10
      : (d.upload != null ? Math.round(parseFloat(d.upload) * 10) / 10 : null);

    const pingMs   = d.data?.ping?.latency != null ? Math.round(d.data.ping.latency * 10) / 10 : (d.ping != null ? Math.round(parseFloat(d.ping) * 10) / 10 : null);
    const jitterMs = d.data?.ping?.jitter  != null ? Math.round(d.data.ping.jitter  * 10) / 10 : null;

    const successful = d.is_successful ?? d.status === 'completed' ?? true;
    const status = successful ? 'online' : 'warning';

    const failReason = !successful
      ? (d.data?.result?.message || d.message || 'Le dernier test speedtest a échoué')
      : null;

    const metrics = { downloadMbps, uploadMbps, pingMs, jitterMs };

    const notifications = [];
    if (lastState && successful !== (lastState.successful ?? true)) {
      notifications.push({
        title: 'Speedtest Tracker',
        message: successful ? 'Test speedtest réussi' : `Test speedtest échoué${failReason ? ` — ${failReason}` : ''}`,
        level: successful ? 'info' : 'warning',
        type: 'status_change',
      });
    }

    return { status, lastError: failReason, state: { ...metrics, successful }, metrics, notifications };
  } catch (err) {
    console.error('[speedtest]', err.message);
    return {
      status: 'error', lastError: err.message, state: lastState, metrics: null,
      notifications: [{ title: 'Speedtest Tracker — Erreur API', message: err.message, level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state) {
  if (!state) return { title: 'Speedtest Tracker', message: 'Aucune donnée.' };
  const lines = [];
  if (state.downloadMbps != null) lines.push(`↓ Download : ${state.downloadMbps} Mbps`);
  if (state.uploadMbps   != null) lines.push(`↑ Upload   : ${state.uploadMbps} Mbps`);
  if (state.pingMs       != null) lines.push(`Ping : ${state.pingMs} ms`);
  if (state.jitterMs     != null) lines.push(`Jitter : ${state.jitterMs} ms`);
  return { title: 'Rapport Speedtest', message: lines.join('\n') };
}

module.exports = { check, report };
