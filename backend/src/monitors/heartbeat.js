async function check(config, lastState) {
  const { expectedEvery = 60 } = config; // minutes

  if (!lastState?.lastPing) {
    return {
      status: 'unknown',
      state: lastState || {},
      metrics: { lastPing: null, expectedEvery },
      notifications: [],
    };
  }

  const lastPing = new Date(lastState.lastPing);
  const minutesSince = (Date.now() - lastPing.getTime()) / 60000;
  const late = minutesSince > expectedEvery * 1.5; // 50% grace period
  const status = late ? 'offline' : 'online';

  const notifications = [];
  const wasOnline = lastState?.wasOnline !== false;

  if (late && wasOnline) {
    notifications.push({
      title: `💔 Heartbeat manqué`,
      message: `Aucun ping reçu depuis ${Math.round(minutesSince)} min (attendu toutes les ${expectedEvery} min).`,
      level: 'error', type: 'status_change',
    });
  } else if (!late && !wasOnline) {
    notifications.push({
      title: `💚 Heartbeat rétabli`,
      message: `Ping reçu après une interruption.`,
      level: 'success', type: 'status_change',
    });
  }

  return {
    status,
    state: { ...lastState, wasOnline: !late },
    metrics: { lastPing: lastState.lastPing, minutesSince: Math.round(minutesSince), expectedEvery },
    notifications,
  };
}

async function report(config, state) {
  const { expectedEvery = 60 } = config;
  const last = state?.lastPing ? new Date(state.lastPing).toLocaleString('fr-FR') : 'jamais';
  return {
    title: '💓 Rapport Heartbeat',
    message: `Dernier ping : ${last}\nFréquence attendue : toutes les ${expectedEvery} min`,
  };
}

module.exports = { check, report };
