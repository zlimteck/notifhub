function primaryMetric(type, metrics) {
  if (!metrics) return null;
  switch (type) {
    case 'http':       return metrics.responseTime ?? null;
    case 'ping':       return metrics.latency ?? null;
    case 'proxmox':    return metrics.cpuPct ?? null;
    case 'immich':     return metrics.diskPct ?? null;
    case 'ssh':        return metrics.cpuPct ?? metrics.memPct ?? null;
    case 'ultracc':    return metrics.free_pct != null ? 100 - metrics.free_pct : null;
    case 'adguard':      return metrics.pct_requests ?? null;
    case 'adguardhome':  return metrics.blockedPct ?? null;
    case 'cloudflare': return metrics.healthy ?? null;
    case 'portainer':  return metrics.containersRunning ?? null;
    case 'syncthing':  return metrics.folders_synced ?? null;
    case 'hms':        return Array.isArray(metrics.vps) ? metrics.vps.filter(v => v.state === 'running').length : null;
    case 'heartbeat':  return metrics.minutesSince ?? null;
    case 'docker':     return metrics.containersRunning ?? null;
    case 'unraid':     return metrics.diskPct ?? null;
    case 'speedtest':      return metrics.downloadMbps ?? null;
    case 'jellyfin':       return metrics.activeSessions ?? null;
    case 'homeassistant': {
      const key = Object.keys(metrics).find(k => k.startsWith('entity__'));
      return key ? metrics[key] : (metrics.activeEntities ?? null);
    }
    default:           return null;
  }
}

module.exports = primaryMetric;
