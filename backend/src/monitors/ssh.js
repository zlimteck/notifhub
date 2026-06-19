const { Client } = require('ssh2');

function sshExec(config) {
  return new Promise((resolve, reject) => {
    const { host, port = 22, username, password, privateKey } = config;
    const cmd = 'uptime && free -m | grep Mem && df -h / | tail -1 && top -bn1 | grep -iE "^(%Cpu|Cpu\\(s\\))" | head -1';
    const conn = new Client();

    const timer = setTimeout(() => { conn.end(); reject(new Error('Timeout SSH')); }, 12000);

    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }
        let out = '';
        stream.on('data', d => { out += d; });
        stream.stderr.on('data', () => {});
        stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(out); });
      });
    });

    conn.on('error', err => { clearTimeout(timer); reject(err); });

    const connCfg = { host, port: parseInt(port) || 22, username, readyTimeout: 10000 };
    if (privateKey) connCfg.privateKey = privateKey;
    else connCfg.password = password;

    conn.connect(connCfg);
  });
}

function parseOutput(out) {
  const metrics = {};

  // uptime: " 10:32:01 up 5 days, 3:12, ..."
  const uptimeMatch = out.match(/up\s+([^,]+(?:,\s*\d+:\d+)?)/);
  if (uptimeMatch) metrics.uptime = uptimeMatch[1].trim();

  // free -m: "Mem: total used free ..."
  const memMatch = out.match(/Mem:\s+(\d+)\s+(\d+)/);
  if (memMatch) {
    metrics.memTotal = parseInt(memMatch[1]);
    metrics.memUsed  = parseInt(memMatch[2]);
    metrics.memPct   = Math.round((metrics.memUsed / metrics.memTotal) * 100);
  }

  // df -h: "overlay 100G 42G 58G 43% /"
  const dfMatch = out.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)%\s+\/$/m);
  if (dfMatch) {
    metrics.diskSize = dfMatch[2];
    metrics.diskUsed = dfMatch[3];
    metrics.diskPct  = parseInt(dfMatch[5]);
  }

  // top -bn1: "%Cpu(s): 2.3 us, ... 96.7 id, ..."
  const idleMatch = out.match(/(\d+[\.,]\d*)\s*%?\s*id/i);
  if (idleMatch) {
    const idle = parseFloat(idleMatch[1].replace(',', '.'));
    metrics.cpuPct = Math.round((100 - idle) * 10) / 10;
  }

  return metrics;
}

async function check(config, lastState) {
  const { host } = config;
  if (!host || !config.username) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — SSH', message: 'Hôte et nom d\'utilisateur requis', level: 'error', type: 'error' }
  ]};

  const wasOnline = lastState !== null;

  try {
    const out = await sshExec(config);
    const metrics = { host, ...parseOutput(out) };

    const notifications = [];
    if (!wasOnline) notifications.push({
      title: `🟢 SSH ${host} — Connecté`,
      message: `Uptime : ${metrics.uptime || '—'}`,
      level: 'success', type: 'status_change',
    });
    if (lastState && metrics.cpuPct > 90 && (lastState.cpuPct ?? 0) <= 90)
      notifications.push({ title: `⚠️ CPU élevé — ${host}`, message: `CPU à ${metrics.cpuPct}%`, level: 'warning', type: 'status_change' });
    if (lastState && metrics.memPct > 90 && (lastState.memPct ?? 0) <= 90)
      notifications.push({ title: `⚠️ RAM élevée — ${host}`, message: `RAM à ${metrics.memPct}%`, level: 'warning', type: 'status_change' });
    if (lastState && metrics.diskPct > 90 && (lastState.diskPct ?? 0) <= 90)
      notifications.push({ title: `⚠️ Disque plein — ${host}`, message: `Disque à ${metrics.diskPct}%`, level: 'warning', type: 'status_change' });

    return { status: 'online', state: metrics, metrics, notifications };
  } catch (err) {
    const notifications = wasOnline ? [{
      title: `🔴 SSH ${host} — Connexion échouée`,
      message: err.message,
      level: 'error', type: 'status_change',
    }] : [];
    return { status: 'offline', state: null, metrics: null, notifications };
  }
}

async function report(config, state) {
  if (!state) return { title: `🔒 SSH ${config.host}`, message: 'Inaccessible.' };
  const cpu = state.cpuPct != null ? `\nCPU : ${state.cpuPct}%` : '';
  return {
    title: `🔒 Rapport SSH — ${state.host}`,
    message: `Uptime : ${state.uptime || '—'}${cpu}\nRAM : ${state.memUsed}/${state.memTotal} MB (${state.memPct}%)\nDisque : ${state.diskUsed}/${state.diskSize} (${state.diskPct}%)`,
  };
}

module.exports = { check, report };
