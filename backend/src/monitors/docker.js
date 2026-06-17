const http = require('http');

function dockerRequest(socketPath, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { socketPath, path, headers: { Host: 'localhost' } },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Réponse invalide du socket Docker')); }
        });
      }
    );
    req.on('error', (err) => {
      const msg = err.code === 'ENOENT' || err.code === 'ECONNREFUSED'
        ? `Socket Docker inaccessible (${socketPath})`
        : err.message;
      reject(new Error(msg));
    });
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout Docker API')); });
  });
}

async function check(config, lastState) {
  const { socketPath = '/var/run/docker.sock' } = config;

  try {
    const containers = await dockerRequest(socketPath, '/containers/json?all=1');

    const running = containers.filter(c => c.State === 'running');
    const stopped = containers.filter(c => c.State !== 'running');

    const containerList = containers.map(c => ({
      id: c.Id.slice(0, 12),
      name: (c.Names[0] || '').replace(/^\//, ''),
      image: c.Image.split(':')[0].split('/').pop(),
      state: c.State,
      status: c.Status,
    }));

    const metrics = {
      containersRunning: running.length,
      containersStopped: stopped.length,
      containers: containerList,
    };

    const status = 'online'; // socket reachable = healthy, stopped containers are informational

    return { status, state: metrics, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'error', state: lastState, metrics: null,
      notifications: [{ title: 'Docker — Erreur socket', message: err.message, level: 'error', type: 'error' }],
    };
  }
}

async function report(config, state) {
  if (!state) return { title: 'Docker', message: 'Aucune donnée.' };
  const lines = (state.containers || [])
    .map(c => `${c.state === 'running' ? '✅' : '⛔'} ${c.name}`)
    .join('\n');
  return {
    title: 'Rapport Docker',
    message: `Actifs : ${state.containersRunning} | Arrêtés : ${state.containersStopped}\n\n${lines}`,
  };
}

module.exports = { check, report };
