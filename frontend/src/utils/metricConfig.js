// Chartable numeric metrics per monitor type.
// Each entry: { key, fr, en, unit }
const CONFIG = {
  http: [
    { key: 'responseTime', fr: 'Temps de réponse', en: 'Response time', unit: 'ms' },
    { key: 'statusCode',   fr: 'Status HTTP',      en: 'HTTP status',   unit: '' },
  ],
  ping: [
    { key: 'latency', fr: 'Latence',  en: 'Latency', unit: 'ms' },
    { key: 'loss',    fr: 'Perte',    en: 'Loss',    unit: '%' },
  ],
  unraid: [
    { key: 'diskPct',           fr: 'Disque',               en: 'Disk',               unit: '%' },
    { key: 'cpuPct',            fr: 'CPU',                   en: 'CPU',                unit: '%' },
    { key: 'ramPct',            fr: 'RAM',                   en: 'RAM',                unit: '%' },
    { key: 'tempAvg',           fr: 'Température',           en: 'Temperature',         unit: '°C' },
    { key: 'containersRunning', fr: 'Containers actifs',     en: 'Running containers', unit: '' },
    { key: 'diskErrors',        fr: 'Erreurs disque',        en: 'Disk errors',        unit: '' },
  ],
  proxmox: [
    { key: 'cpuPct',     fr: 'CPU',         en: 'CPU',          unit: '%' },
    { key: 'memPct',     fr: 'RAM',         en: 'RAM',          unit: '%' },
    { key: 'vmRunning',  fr: 'VMs actives', en: 'Running VMs',  unit: '' },
    { key: 'lxcRunning', fr: 'LXC actifs',  en: 'Running LXC',  unit: '' },
  ],
  ssh: [
    { key: 'cpuPct',  fr: 'CPU',    en: 'CPU',  unit: '%' },
    { key: 'memPct',  fr: 'RAM',    en: 'RAM',  unit: '%' },
    { key: 'diskPct', fr: 'Disque', en: 'Disk', unit: '%' },
  ],
  homeassistant: [
    { key: 'version', fr: 'Version', en: 'Version', unit: '' },
  ],
  adguardhome: [
    { key: 'blockedPct',   fr: 'Bloquées %',   en: 'Blocked %',  unit: '%' },
    { key: 'totalQueries', fr: 'Requêtes',      en: 'Queries',    unit: '' },
    { key: 'blocked',      fr: 'Bloquées',      en: 'Blocked',    unit: '' },
  ],
  adguard: [
    { key: 'pct_requests',   fr: 'Requêtes',          en: 'Requests',      unit: '%' },
    { key: 'devices',        fr: 'Appareils',          en: 'Devices',       unit: '' },
    { key: 'used_requests',  fr: 'Requêtes utilisées', en: 'Used requests', unit: '' },
  ],
  immich: [
    { key: 'diskPct', fr: 'Disque', en: 'Disk',   unit: '%' },
    { key: 'photos',  fr: 'Photos', en: 'Photos',  unit: '' },
    { key: 'videos',  fr: 'Vidéos', en: 'Videos',  unit: '' },
  ],
  portainer: [
    { key: 'containersRunning', fr: 'Containers actifs',  en: 'Running containers', unit: '' },
    { key: 'containersStopped', fr: 'Containers arrêtés', en: 'Stopped containers', unit: '' },
    { key: 'environments',      fr: 'Environnements',     en: 'Environments',       unit: '' },
  ],
  docker: [
    { key: 'containersRunning', fr: 'Containers actifs',  en: 'Running containers', unit: '' },
    { key: 'containersStopped', fr: 'Containers arrêtés', en: 'Stopped containers', unit: '' },
  ],
  hms: [
    { key: 'vps_count',      fr: 'VPS actifs',     en: 'Active VPS',  unit: '' },
    { key: 'avg_cpu',        fr: 'CPU moyen',       en: 'Avg CPU',     unit: '%' },
    { key: 'avg_memory_pct', fr: 'RAM moyenne',     en: 'Avg RAM',     unit: '%' },
  ],
  cloudflare: [
    { key: 'total',   fr: 'Tunnels actifs', en: 'Active tunnels',  unit: '' },
    { key: 'healthy', fr: 'Tunnels sains',  en: 'Healthy tunnels', unit: '' },
  ],
  syncthing: [
    { key: 'folders_synced',    fr: 'Dossiers sync.',  en: 'Synced folders',    unit: '' },
    { key: 'devices_connected', fr: 'Appareils',       en: 'Connected devices', unit: '' },
    { key: 'folders_total',     fr: 'Dossiers total',  en: 'Total folders',     unit: '' },
  ],
  ultracc: [
    { key: 'free_pct', fr: 'Stockage libre', en: 'Free storage', unit: '%' },
  ],
  heartbeat: [
    { key: 'minutesSince', fr: 'Depuis dernier ping', en: 'Since last ping', unit: 'min' },
  ],
  speedtest: [
    { key: 'downloadMbps', fr: 'Download',  en: 'Download', unit: 'Mbps' },
    { key: 'uploadMbps',   fr: 'Upload',    en: 'Upload',   unit: 'Mbps' },
    { key: 'pingMs',       fr: 'Ping',      en: 'Ping',     unit: 'ms' },
    { key: 'jitterMs',     fr: 'Jitter',    en: 'Jitter',   unit: 'ms' },
  ],
};

function haEntityMetrics(config) {
  const entityOptions = (config?.entities || []).map(e => ({
    key: `entity__${e.entity_id.replace(/\./g, '__')}`,
    fr: e.friendly_name || e.entity_id,
    en: e.friendly_name || e.entity_id,
    unit: '',
  }));
  return [
    { key: 'activeEntities', fr: 'Entités actives', en: 'Active entities', unit: '' },
    ...entityOptions,
  ];
}

/** Returns the chartable metrics for a given type */
export function getMetrics(type, config) {
  if (type === 'homeassistant') return haEntityMetrics(config);
  return CONFIG[type] || [];
}

/** Returns the label for a specific metric key */
export function getMetricLabel(type, key, lang = 'fr', config) {
  if (type === 'homeassistant') {
    const m = haEntityMetrics(config).find(m => m.key === key);
    if (m) return lang === 'fr' ? m.fr : m.en;
  }
  const m = (CONFIG[type] || []).find(m => m.key === key);
  if (!m) return key;
  return lang === 'fr' ? m.fr : m.en;
}

/** Returns unit suffix for a metric key */
export function getMetricUnit(type, key) {
  const m = (CONFIG[type] || []).find(m => m.key === key);
  return m?.unit ?? '';
}

/** Formats a metric value with its unit */
export function formatMetricValue(type, key, value) {
  if (value == null) return '—';
  const unit = getMetricUnit(type, key);
  const num = Number.isInteger(value) ? value : parseFloat(value.toFixed(1));
  return unit ? `${num}${unit}` : `${num}`;
}

/** Extracts the numeric value to display from a snapshot point */
export function extractValue(point, cardMetric) {
  if (cardMetric && point.metrics && point.metrics[cardMetric] != null) {
    return point.metrics[cardMetric];
  }
  return point.value;
}
