const axios = require('axios');
const https = require('https');
const tls = require('tls');
const cfHeaders = require('./cfHeaders');

function extractFavicon(html, base) {
  if (!html || typeof html !== 'string') return null;
  const m = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i)
          || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return null; }
}

function checkSSLCert(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.valid_to) return resolve(null);
      const expiresAt = new Date(cert.valid_to);
      const daysLeft = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
      resolve({ expiresAt: expiresAt.toISOString(), daysLeft });
    });
    socket.on('error', () => { socket.destroy(); resolve(null); });
    socket.setTimeout(5000, () => { socket.destroy(); resolve(null); });
  });
}

async function check(config, lastState) {
  const {
    url, method = 'GET', body,
    expectedStatus = 200, keyword, timeout = 10000, rejectUnauthorized = true,
    bearerToken, basicUser, basicPass, customHeaderName, customHeaderValue,
    sslAlertDays = 30, responseTimeThreshold = 0,
  } = config;

  if (!url) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — HTTP', message: 'URL requise', level: 'error', type: 'error' }
  ]};

  const start = Date.now();
  let statusCode = null;
  let responseTime = null;
  let ok = false;
  let errMsg = null;

  const headers = { ...cfHeaders(config) };
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  } else if (basicUser || basicPass) {
    headers['Authorization'] = `Basic ${Buffer.from(`${basicUser || ''}:${basicPass || ''}`).toString('base64')}`;
  }
  if (customHeaderName && customHeaderValue) {
    headers[customHeaderName] = customHeaderValue;
  }

  let faviconUrl = null;
  let sslInfo = null;

  // SSL check for HTTPS URLs
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {}
  if (parsedUrl?.protocol === 'https:') {
    const port = parsedUrl.port ? parseInt(parsedUrl.port) : 443;
    sslInfo = await checkSSLCert(parsedUrl.hostname, port);
  }

  try {
    const httpMethod = (method || 'GET').toLowerCase();
    const hasBody = ['post', 'put', 'patch'].includes(httpMethod) && body;
    let parsedBody;
    if (hasBody) {
      try { parsedBody = JSON.parse(body); headers['Content-Type'] = 'application/json'; }
      catch { parsedBody = body; headers['Content-Type'] = 'text/plain'; }
    }

    const res = await axios({
      method: httpMethod,
      url,
      data: parsedBody,
      timeout,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized }),
      maxRedirects: 5,
      headers,
    });
    responseTime = Date.now() - start;
    statusCode = res.status;
    const resBody = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const statusOk = res.status === expectedStatus;
    const keywordOk = keyword ? resBody.includes(keyword) : true;
    ok = statusOk && keywordOk;
    if (!statusOk) errMsg = `Status ${res.status} (attendu ${expectedStatus})`;
    else if (!keywordOk) errMsg = `Mot-clé "${keyword}" absent de la réponse`;

    // Extract favicon — try current response first, fall back to site root
    if (httpMethod === 'get') {
      faviconUrl = extractFavicon(resBody, url);
      if (!faviconUrl) {
        const origin = parsedUrl?.origin;
        if (origin && origin + '/' !== url && origin !== url) {
          try {
            const rootRes = await axios.get(origin, {
              timeout: 5000,
              validateStatus: () => true,
              httpsAgent: new https.Agent({ rejectUnauthorized }),
              maxRedirects: 3,
              headers,
            });
            const rootBody = typeof rootRes.data === 'string' ? rootRes.data : '';
            faviconUrl = extractFavicon(rootBody, origin);
          } catch {}
        }
      }
    }
  } catch (err) {
    responseTime = Date.now() - start;
    errMsg = err.message;
  }

  const wasOk = lastState?.ok === true;
  const wasSlow = lastState?.slowAlerted === true;
  const isSlow = ok && responseTimeThreshold > 0 && responseTime != null && responseTime > responseTimeThreshold;
  const notifications = [];
  if (lastState !== null) {
    if (!ok && wasOk) notifications.push({
      title: `${url} — Hors ligne`,
      message: errMsg || 'Service inaccessible',
      level: 'error', type: 'status_change',
    });
    if (ok && !wasOk) notifications.push({
      title: `${url} — De retour`,
      message: `Temps de réponse : ${responseTime}ms`,
      level: 'success', type: 'status_change',
    });

    // Response time threshold alerts
    if (isSlow && !wasSlow) notifications.push({
      title: `${url} — Temps de réponse élevé`,
      message: `${responseTime}ms (seuil : ${responseTimeThreshold}ms)`,
      level: 'warning', type: 'response_time',
    });
    if (!isSlow && wasSlow) notifications.push({
      title: `${url} — Temps de réponse normalisé`,
      message: `${responseTime}ms`,
      level: 'success', type: 'response_time',
    });

    // SSL expiry notifications
    if (sslInfo) {
      const prevDays = lastState?.sslDaysLeft;
      if (sslInfo.daysLeft <= 0 && (prevDays === undefined || prevDays > 0)) {
        notifications.push({
          title: `SSL expiré — ${parsedUrl?.hostname}`,
          message: `Le certificat TLS a expiré.`,
          level: 'error', type: 'ssl_expiry',
        });
      } else if (sslInfo.daysLeft <= sslAlertDays && (prevDays === undefined || prevDays > sslAlertDays)) {
        notifications.push({
          title: `SSL expire bientôt — ${parsedUrl?.hostname}`,
          message: `Le certificat expire dans ${sslInfo.daysLeft} jour(s).`,
          level: 'warning', type: 'ssl_expiry',
        });
      }
    }
  }

  const sslStatus = sslInfo
    ? (sslInfo.daysLeft <= 0 ? 'expired' : sslInfo.daysLeft <= sslAlertDays ? 'expiring' : 'ok')
    : null;

  return {
    status: ok ? (isSlow || sslStatus === 'expired' ? 'warning' : 'online') : (statusCode ? 'warning' : 'offline'),
    state: { ok, statusCode, responseTime, errMsg, sslDaysLeft: sslInfo?.daysLeft, slowAlerted: isSlow },
    metrics: { url, statusCode, responseTime, ok, faviconUrl, errMsg, sslInfo, sslStatus },
    notifications,
  };
}

async function report(config, state) {
  const { url } = config;
  const msg = state?.ok
    ? `${url}\nStatut : ${state.statusCode} — ${state.responseTime}ms`
    : `${url}\n${state?.errMsg || 'Inaccessible'}`;
  return { title: `Rapport HTTP — ${url}`, message: msg };
}

module.exports = { check, report };
