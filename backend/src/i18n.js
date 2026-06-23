module.exports = {
  en: {
    // ── Common ──────────────────────────────────────────────────────────────
    missingConfig: (svc, detail) => ({ title: `Missing config — ${svc}`, message: detail }),
    apiError: (svc, msg) => ({ title: `${svc} — API error`, message: msg }),
    unreachable: (svc, url, msg) => ({ title: `${svc} — Unreachable`, message: `${url} · ${msg}` }),

    // ── Runner fallbacks ────────────────────────────────────────────────────
    monitorOffline: (name, fallback, status) => ({
      title: `${name} — Offline`,
      message: fallback || `Status: ${status}`,
    }),
    monitorBack: (name) => ({
      title: `${name} — Back online`,
      message: 'Service is back online.',
    }),

    // ── Weekly report ───────────────────────────────────────────────────────
    weeklyReportTitle: 'Orveil Weekly Report',
    weeklyReportBody: (pct, online, total, problems) => {
      let msg = `Global uptime: ${pct}% (${online}/${total} services online)`;
      if (problems.length > 0) {
        msg += '\n\nServices with issues:\n' + problems.map(m => `${m.name} — ${m.status}`).join('\n');
      } else {
        msg += '\n\nAll services are online.';
      }
      return msg;
    },

    // ── AdGuard DNS ─────────────────────────────────────────────────────────
    adguardInvalidToken: (msg) => ({ title: 'AdGuard — Invalid token', message: `Failed to refresh token: ${msg}` }),
    adguardProtectionDisabled: (name) => ({ title: 'AdGuard DNS — Protection disabled', message: `AdGuard DNS protection was disabled on server "${name}".` }),
    adguardProtectionEnabled: (name) => ({ title: 'AdGuard DNS — Protection re-enabled', message: `AdGuard DNS protection is active again on "${name}".` }),
    adguardReport: (state) => {
      const prot = state.protection_enabled ? 'Enabled' : 'Disabled';
      const pct = state.limit_requests ? Math.round((state.used_requests / state.limit_requests) * 100) : 0;
      return {
        title: 'AdGuard DNS Report',
        message: `AdGuard DNS — ${state.server_name}\n\nProtection: ${prot}\nUser rules: ${state.user_rules_count}\nFilter lists: ${state.filter_list_count}\nDevices: ${state.devices}\nRequests: ${state.used_requests} / ${state.limit_requests} (${pct}%)`,
      };
    },

    // ── AdGuard Home ────────────────────────────────────────────────────────
    adguardhomeOnline: (url, queries, pct) => ({ title: 'AdGuard Home — Online', message: `${url} · ${queries} queries · ${pct}% blocked` }),
    adguardhomeProtectionDisabled: (url) => ({ title: 'AdGuard Home — Protection disabled', message: `DNS protection was disabled on ${url}` }),
    adguardhomeProtectionEnabled: (url) => ({ title: 'AdGuard Home — Protection re-enabled', message: `DNS protection is active again on ${url}` }),
    adguardhomeReport: (state) => ({
      title: 'AdGuard Home Report',
      message: `Protection: ${state.protectionEnabled ? 'Active' : 'Disabled'}\nQueries: ${state.totalQueries}\nBlocked: ${state.blocked} (${state.blockedPct}%)\nSafebrowsing: ${state.safebrowsing}\nParental: ${state.parental}`,
    }),

    // ── Cloudflare ──────────────────────────────────────────────────────────
    tunnelRestored: (name) => ({ title: `Tunnel restored — ${name}`, message: `Cloudflare tunnel "${name}" is active again.` }),
    tunnelDown: (name, status) => ({ title: `Tunnel down — ${name}`, message: `Cloudflare tunnel "${name}" is offline (status: ${status}).` }),
    tunnelGone: (name) => ({ title: `Tunnel gone — ${name}`, message: `Tunnel "${name}" is no longer visible.` }),
    cloudflareReport: (tunnels) => {
      let msg = `Cloudflare — ${tunnels.length} active tunnel(s)\n`;
      for (const t of tunnels) {
        msg += `\n${t.name} (${t.status})`;
        if (t.hostnames?.length) msg += '\n' + t.hostnames.map(h => `  └ ${h}`).join('\n');
      }
      return { title: 'Cloudflare Report', message: msg };
    },

    // ── DNS ─────────────────────────────────────────────────────────────────
    dnsUnknownType: (type) => ({ title: 'DNS — Unknown type', message: `Type ${type} not supported` }),
    dnsUnexpectedValue: (hostname, expected, resolved) => ({ title: `DNS ${hostname} — Unexpected value`, message: `Expected value "${expected}" not found — got: ${resolved}` }),
    dnsFailed: (hostname, msg) => ({ title: `DNS ${hostname} — Failed`, message: `DNS resolution failed: ${msg}` }),

    // ── Docker ──────────────────────────────────────────────────────────────
    dockerSocketError: (msg) => ({ title: 'Docker — Socket error', message: msg }),
    dockerReport: (state) => {
      const lines = (state.containers || []).map(c => `${c.name} (${c.state})`).join('\n');
      return { title: 'Docker Report', message: `Running: ${state.containersRunning} | Stopped: ${state.containersStopped}\n\n${lines}` };
    },

    // ── Heartbeat ───────────────────────────────────────────────────────────
    heartbeatMissed: (minutes, expected) => ({ title: '💔 Heartbeat missed', message: `No ping received in ${minutes} min (expected every ${expected} min).` }),
    heartbeatRestored: () => ({ title: '💚 Heartbeat restored', message: 'Ping received after an outage.' }),
    heartbeatReport: (last, expected) => ({ title: '💓 Heartbeat Report', message: `Last ping: ${last}\nExpected every: ${expected} min` }),

    // ── HMS ─────────────────────────────────────────────────────────────────
    hmsHighCpu: (name, ip, cpu) => ({ title: `High CPU — ${name}`, message: `CPU at ${cpu}% on ${name} (${ip})` }),
    hmsHighMemory: (name, used, max, pct) => ({ title: `High memory — ${name}`, message: `RAM at ${pct}% on ${name} (${used}/${max} MB)` }),
    hmsVpsUnreachable: (name, msg) => ({ title: `VPS unreachable — ${name}`, message: msg }),
    hmsReport: (vpsList, errors) => {
      let msg = `VPS report — ${vpsList.length} server(s)\n`;
      for (const v of vpsList) {
        msg += `\n${v.name} (${v.ipv4 || v.id})\n  State: ${v.state} | ${v.vcores} vCore | ${v.ram_gb} GB RAM | ${v.datacenter || ''}`;
      }
      if (errors?.length) msg += `\n\nErrors: ${errors.map(e => e.name).join(', ')}`;
      return { title: 'HMS VPS Report', message: msg };
    },

    // ── Home Assistant ──────────────────────────────────────────────────────
    haOnline: (url, version) => ({ title: 'Home Assistant — Online', message: `${url}${version ? ` · v${version}` : ''}` }),
    haEntityUnavailable: (name, id) => ({ title: 'Home Assistant — Entity unavailable', message: `${name} (${id}) is unavailable` }),
    haEntityRestored: (name, id, state, unit) => ({ title: 'Home Assistant — Entity restored', message: `${name} (${id}): ${state}${unit ? ` ${unit}` : ''}` }),
    haUnreachable: (url, msg) => ({ title: 'Home Assistant — Unreachable', message: `${url} · ${msg}` }),
    haReport: (state) => {
      const lines = state.entityStates?.map(e => `${e.friendly_name}: ${e.state}${e.unit ? ` ${e.unit}` : ''}`) || [];
      return {
        title: `Home Assistant Report${state.version ? ` v${state.version}` : ''}`,
        message: lines.length ? lines.join('\n') : 'No entities configured.',
      };
    },

    // ── HTTP ────────────────────────────────────────────────────────────────
    httpOffline: (url, msg) => ({ title: `${url} — Offline`, message: msg || 'Service unreachable' }),
    httpBack: (url, ms) => ({ title: `${url} — Back online`, message: `Response time: ${ms}ms` }),
    httpSlow: (url, ms, threshold) => ({ title: `${url} — High response time`, message: `${ms}ms (threshold: ${threshold}ms)` }),
    httpNormalized: (url, ms) => ({ title: `${url} — Response time normalized`, message: `${ms}ms` }),
    httpSslExpired: (hostname) => ({ title: `SSL expired — ${hostname}`, message: 'TLS certificate has expired.' }),
    httpSslExpiringSoon: (hostname, days) => ({ title: `SSL expiring soon — ${hostname}`, message: `Certificate expires in ${days} day(s).` }),
    httpReport: (url, state) => ({
      title: `HTTP Report — ${url}`,
      message: state?.ok ? `${url}\nStatus: ${state.statusCode} — ${state.responseTime}ms` : `${url}\n${state?.errMsg || 'Unreachable'}`,
    }),

    // ── Immich ──────────────────────────────────────────────────────────────
    immichStorageCritical: (pct, used, total) => ({ title: 'Immich storage critical', message: `Disk at ${pct}% — ${used} used / ${total}` }),
    immichReport: (state) => ({
      title: 'Immich Report',
      message: `Photos: ${state.photos}\nVideos: ${state.videos}\nDisk: ${state.diskPct}%`,
    }),

    // ── Jellyfin ────────────────────────────────────────────────────────────
    jellyfinReport: (state) => ({
      title: 'Jellyfin Report',
      message: `Active sessions: ${state.activeSessions}\nMovies: ${state.movies} | Series: ${state.series} | Songs: ${state.songs}\nVersion: ${state.version}`,
    }),

    // ── Ollama ──────────────────────────────────────────────────────────────
    ollamaReport: (state) => ({
      title: 'Ollama Report',
      message: `Version: ${state.version || '—'}\nModels: ${state.modelsCount}\n${state.modelNames?.join(', ') || ''}`,
    }),

    // ── Ping ────────────────────────────────────────────────────────────────
    pingUnreachable: (host, port, attempts) => ({ title: `${host} unreachable`, message: `Port ${port} unreachable (${attempts}/${attempts} failed)` }),
    pingBack: (host, latency, port) => ({ title: `${host} back online`, message: `Latency: ${latency}ms — Port ${port}` }),
    pingReport: (host, state) => ({
      title: `Ping Report — ${host}`,
      message: state ? `${state.host}:${state.port}\nLatency: ${state.latency ?? '—'}ms — Loss: ${state.loss}%` : 'No data.',
    }),

    // ── Port Forwarding ─────────────────────────────────────────────────────
    portForwardClosed: (host, port, errorType) => ({ title: `${host}:${port} closed`, message: `Port ${port} is no longer reachable on ${host}. ${errorType === 'refused' ? '(Connection refused — nothing listening)' : '(Timeout — port may be blocked)'}` }),
    portForwardOpen:   (host, port, latency) => ({ title: `${host}:${port} open`, message: `Port ${port} is reachable again on ${host} (${latency}ms).` }),

    // ── Portainer ───────────────────────────────────────────────────────────
    portainerReport: (state) => ({
      title: 'Portainer Report',
      message: `Environments: ${state.environments}\nRunning containers: ${state.containersRunning}\nStopped: ${state.containersStopped}`,
    }),

    // ── Proxmox ─────────────────────────────────────────────────────────────
    proxmoxHighCpu: (pct, node) => ({ title: 'Proxmox high CPU', message: `CPU at ${pct}% on ${node}` }),
    proxmoxHighRam: (pct, node) => ({ title: 'Proxmox high RAM', message: `RAM at ${pct}% on ${node}` }),
    proxmoxReport: (state, node) => ({
      title: `Proxmox Report — ${node || 'pve'}`,
      message: `CPU: ${state.cpuPct}% | RAM: ${state.memPct}%\nVMs: ${state.vmRunning} running | LXC: ${state.lxcRunning} running`,
    }),

    // ── Speedtest ───────────────────────────────────────────────────────────
    speedtestFailedFallback: 'Last speedtest failed',
    speedtestResult: (successful, failReason) => ({
      title: 'Speedtest Tracker',
      message: successful ? 'Speedtest successful' : `Speedtest failed${failReason ? ` — ${failReason}` : ''}`,
    }),
    speedtestReport: (state) => {
      const lines = [];
      if (state.downloadMbps != null) lines.push(`↓ Download: ${state.downloadMbps} Mbps`);
      if (state.uploadMbps   != null) lines.push(`↑ Upload:   ${state.uploadMbps} Mbps`);
      if (state.pingMs       != null) lines.push(`Ping: ${state.pingMs} ms`);
      if (state.jitterMs     != null) lines.push(`Jitter: ${state.jitterMs} ms`);
      return { title: 'Speedtest Report', message: lines.join('\n') };
    },

    // ── SSH ─────────────────────────────────────────────────────────────────
    sshConnected: (host, uptime) => ({ title: `SSH ${host} — Connected`, message: `Uptime: ${uptime || '—'}` }),
    sshConnectionFailed: (host) => ({ title: `SSH ${host} — Connection failed` }),
    sshHighCpu: (host, pct) => ({ title: `High CPU — ${host}`, message: `CPU at ${pct}%` }),
    sshHighRam: (host, pct) => ({ title: `High RAM — ${host}`, message: `RAM at ${pct}%` }),
    sshHighDisk: (host, pct) => ({ title: `High disk usage — ${host}`, message: `Disk at ${pct}%` }),
    sshReport: (state) => {
      const cpu = state.cpuPct != null ? `\nCPU: ${state.cpuPct}%` : '';
      return {
        title: `SSH Report — ${state.host}`,
        message: `Uptime: ${state.uptime || '—'}${cpu}\nRAM: ${state.memUsed}/${state.memTotal} MB (${state.memPct}%)\nDisk: ${state.diskUsed}/${state.diskSize} (${state.diskPct}%)`,
      };
    },

    // ── Syncthing ───────────────────────────────────────────────────────────
    syncthingDeviceDisconnected: (name) => ({ title: 'Syncthing — Device disconnected', message: `"${name}" disconnected from Syncthing.` }),
    syncthingDeviceReconnected: (name) => ({ title: 'Syncthing — Device reconnected', message: `"${name}" is connected again.` }),
    syncthingFolderError: (label) => ({ title: 'Syncthing — Folder error', message: `Folder "${label}" has an error.` }),
    syncthingReport: (state) => {
      const devLines = (state.devices || []).map(d => `${d.name} (${d.connected ? 'connected' : 'disconnected'})`).join('\n');
      const folderLines = (state.folders || []).map(f => `${f.label} — ${f.state} (${f.inSyncFiles}/${f.globalFiles} files)`).join('\n');
      return {
        title: 'Syncthing Report',
        message: `Devices (${(state.devices || []).filter(d => d.connected).length}/${(state.devices || []).length} connected):\n${devLines || 'No devices'}\n\nFolders:\n${folderLines || 'No folders'}`,
      };
    },

    // ── Ultra.cc ────────────────────────────────────────────────────────────
    ultraccLowStorage: (free, total) => ({ title: 'Low storage — Ultra.cc', message: `Free space: ${free} GB out of ${total} GB` }),
    ultraccLowTraffic: (pct, reset) => ({ title: 'Low traffic — Ultra.cc', message: `Available traffic: ${pct}% — Reset: ${reset}` }),
    ultraccReport: (state) => ({
      title: 'Ultra.cc Report',
      message: `Storage: ${state.free_storage} GB free / ${state.total_storage} GB\nAvailable traffic: ${state.traffic_available}%\nTraffic reset: ${state.traffic_reset}`,
    }),

    // ── Unraid ──────────────────────────────────────────────────────────────
    unraidDiskError: (count) => ({ title: 'Unraid — Disk error', message: `${count} disk(s) in error in the array` }),
    unraidArrayStopped: (arrayState) => ({ title: 'Unraid — Array stopped', message: `Array state: ${arrayState}` }),
    unraidReport: (state) => {
      const lines = [
        `Array: ${state.arrayState}`,
        `Disks: ${state.diskCount}${state.diskErrors > 0 ? ` (${state.diskErrors} in error)` : ''}`,
        `Storage: ${state.diskUsed} / ${state.diskTotal} TB (${state.diskPct}%)`,
      ];
      if (state.cpuPct != null) lines.push(`CPU: ${state.cpuPct}%`);
      if (state.ramPct != null) lines.push(`RAM: ${state.ramUsedGB} / ${state.ramTotalGB} GB (${state.ramPct}%)`);
      if (state.tempAvg != null) lines.push(`Avg temp: ${state.tempAvg}°C${state.tempWarn > 0 ? ` ${state.tempWarn} warn` : ''}${state.tempCrit > 0 ? ` ${state.tempCrit} crit` : ''}`);
      lines.push(`Containers: ${state.containersRunning} running`);
      return { title: 'Unraid Report', message: lines.join('\n') };
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  fr: {
    // ── Common ──────────────────────────────────────────────────────────────
    missingConfig: (svc, detail) => ({ title: `Config manquante — ${svc}`, message: detail }),
    apiError: (svc, msg) => ({ title: `${svc} — Erreur API`, message: msg }),
    unreachable: (svc, url, msg) => ({ title: `${svc} — Inaccessible`, message: `${url} · ${msg}` }),

    // ── Runner fallbacks ────────────────────────────────────────────────────
    monitorOffline: (name, fallback, status) => ({
      title: `${name} — Hors ligne`,
      message: fallback || `Statut : ${status}`,
    }),
    monitorBack: (name) => ({
      title: `${name} — De retour`,
      message: 'Le service est de nouveau accessible.',
    }),

    // ── Weekly report ───────────────────────────────────────────────────────
    weeklyReportTitle: 'Rapport hebdomadaire Orveil',
    weeklyReportBody: (pct, online, total, problems) => {
      let msg = `Uptime global : ${pct}% (${online}/${total} services en ligne)`;
      if (problems.length > 0) {
        msg += '\n\nServices en anomalie :\n' + problems.map(m => `${m.name} — ${m.status}`).join('\n');
      } else {
        msg += '\n\nTous les services sont en ligne.';
      }
      return msg;
    },

    // ── AdGuard DNS ─────────────────────────────────────────────────────────
    adguardInvalidToken: (msg) => ({ title: 'AdGuard — Token invalide', message: `Impossible de rafraîchir le token : ${msg}` }),
    adguardProtectionDisabled: (name) => ({ title: 'AdGuard DNS — Protection désactivée', message: `La protection DNS AdGuard a été désactivée sur le serveur "${name}".` }),
    adguardProtectionEnabled: (name) => ({ title: 'AdGuard DNS — Protection réactivée', message: `La protection DNS AdGuard est de nouveau active sur "${name}".` }),
    adguardReport: (state) => {
      const prot = state.protection_enabled ? 'Activée' : 'Désactivée';
      const pct = state.limit_requests ? Math.round((state.used_requests / state.limit_requests) * 100) : 0;
      return {
        title: 'Rapport AdGuard DNS',
        message: `AdGuard DNS — ${state.server_name}\n\nProtection : ${prot}\nRègles utilisateur : ${state.user_rules_count}\nListes de filtres : ${state.filter_list_count}\nAppareils : ${state.devices}\nRequêtes : ${state.used_requests} / ${state.limit_requests} (${pct}%)`,
      };
    },

    // ── AdGuard Home ────────────────────────────────────────────────────────
    adguardhomeOnline: (url, queries, pct) => ({ title: 'AdGuard Home — En ligne', message: `${url} · ${queries} requêtes · ${pct}% bloquées` }),
    adguardhomeProtectionDisabled: (url) => ({ title: 'AdGuard Home — Protection désactivée', message: `La protection DNS a été désactivée sur ${url}` }),
    adguardhomeProtectionEnabled: (url) => ({ title: 'AdGuard Home — Protection réactivée', message: `La protection DNS est de nouveau active sur ${url}` }),
    adguardhomeReport: (state) => ({
      title: 'Rapport AdGuard Home',
      message: `Protection : ${state.protectionEnabled ? 'Active' : 'Désactivée'}\nRequêtes : ${state.totalQueries}\nBloquées : ${state.blocked} (${state.blockedPct}%)\nSafebrowsing : ${state.safebrowsing}\nParental : ${state.parental}`,
    }),

    // ── Cloudflare ──────────────────────────────────────────────────────────
    tunnelRestored: (name) => ({ title: `Tunnel rétabli — ${name}`, message: `Le tunnel Cloudflare "${name}" est de nouveau actif.` }),
    tunnelDown: (name, status) => ({ title: `Tunnel hors ligne — ${name}`, message: `Le tunnel Cloudflare "${name}" est hors ligne (status : ${status}).` }),
    tunnelGone: (name) => ({ title: `Tunnel disparu — ${name}`, message: `Le tunnel "${name}" n'est plus visible.` }),
    cloudflareReport: (tunnels) => {
      let msg = `Cloudflare — ${tunnels.length} tunnel(s) actif(s)\n`;
      for (const t of tunnels) {
        msg += `\n${t.name} (${t.status})`;
        if (t.hostnames?.length) msg += '\n' + t.hostnames.map(h => `  └ ${h}`).join('\n');
      }
      return { title: 'Rapport Cloudflare', message: msg };
    },

    // ── DNS ─────────────────────────────────────────────────────────────────
    dnsUnknownType: (type) => ({ title: 'DNS — Type inconnu', message: `Type ${type} non supporté` }),
    dnsUnexpectedValue: (hostname, expected, resolved) => ({ title: `DNS ${hostname} — Valeur inattendue`, message: `Valeur attendue "${expected}" non trouvée — obtenu : ${resolved}` }),
    dnsFailed: (hostname, msg) => ({ title: `DNS ${hostname} — Échec`, message: `Résolution DNS échouée : ${msg}` }),

    // ── Docker ──────────────────────────────────────────────────────────────
    dockerSocketError: (msg) => ({ title: 'Docker — Erreur socket', message: msg }),
    dockerReport: (state) => {
      const lines = (state.containers || []).map(c => `${c.name} (${c.state})`).join('\n');
      return { title: 'Rapport Docker', message: `Actifs : ${state.containersRunning} | Arrêtés : ${state.containersStopped}\n\n${lines}` };
    },

    // ── Heartbeat ───────────────────────────────────────────────────────────
    heartbeatMissed: (minutes, expected) => ({ title: '💔 Heartbeat manqué', message: `Aucun ping reçu depuis ${minutes} min (attendu toutes les ${expected} min).` }),
    heartbeatRestored: () => ({ title: '💚 Heartbeat rétabli', message: 'Ping reçu après une interruption.' }),
    heartbeatReport: (last, expected) => ({ title: '💓 Rapport Heartbeat', message: `Dernier ping : ${last}\nFréquence attendue : toutes les ${expected} min` }),

    // ── HMS ─────────────────────────────────────────────────────────────────
    hmsHighCpu: (name, ip, cpu) => ({ title: `CPU élevé — ${name}`, message: `CPU à ${cpu}% sur ${name} (${ip})` }),
    hmsHighMemory: (name, used, max, pct) => ({ title: `Mémoire saturée — ${name}`, message: `RAM à ${pct}% sur ${name} (${used}/${max} Mo)` }),
    hmsVpsUnreachable: (name, msg) => ({ title: `VPS inaccessible — ${name}`, message: msg }),
    hmsReport: (vpsList, errors) => {
      let msg = `Rapport VPS — ${vpsList.length} serveur(s)\n`;
      for (const v of vpsList) {
        msg += `\n${v.name} (${v.ipv4 || v.id})\n  État : ${v.state} | ${v.vcores} vCore | ${v.ram_gb} Go RAM | ${v.datacenter || ''}`;
      }
      if (errors?.length) msg += `\n\nErreurs : ${errors.map(e => e.name).join(', ')}`;
      return { title: 'Rapport VPS HMS', message: msg };
    },

    // ── Home Assistant ──────────────────────────────────────────────────────
    haOnline: (url, version) => ({ title: 'Home Assistant — En ligne', message: `${url}${version ? ` · v${version}` : ''}` }),
    haEntityUnavailable: (name, id) => ({ title: 'Home Assistant — Entité indisponible', message: `${name} (${id}) est indisponible` }),
    haEntityRestored: (name, id, state, unit) => ({ title: 'Home Assistant — Entité restaurée', message: `${name} (${id}) : ${state}${unit ? ` ${unit}` : ''}` }),
    haUnreachable: (url, msg) => ({ title: 'Home Assistant — Inaccessible', message: `${url} · ${msg}` }),
    haReport: (state) => {
      const lines = state.entityStates?.map(e => `${e.friendly_name} : ${e.state}${e.unit ? ` ${e.unit}` : ''}`) || [];
      return {
        title: `Rapport Home Assistant${state.version ? ` v${state.version}` : ''}`,
        message: lines.length ? lines.join('\n') : 'Aucune entité configurée.',
      };
    },

    // ── HTTP ────────────────────────────────────────────────────────────────
    httpOffline: (url, msg) => ({ title: `${url} — Hors ligne`, message: msg || 'Service inaccessible' }),
    httpBack: (url, ms) => ({ title: `${url} — De retour`, message: `Temps de réponse : ${ms}ms` }),
    httpSlow: (url, ms, threshold) => ({ title: `${url} — Temps de réponse élevé`, message: `${ms}ms (seuil : ${threshold}ms)` }),
    httpNormalized: (url, ms) => ({ title: `${url} — Temps de réponse normalisé`, message: `${ms}ms` }),
    httpSslExpired: (hostname) => ({ title: `SSL expiré — ${hostname}`, message: 'Le certificat TLS a expiré.' }),
    httpSslExpiringSoon: (hostname, days) => ({ title: `SSL expire bientôt — ${hostname}`, message: `Le certificat expire dans ${days} jour(s).` }),
    httpReport: (url, state) => ({
      title: `Rapport HTTP — ${url}`,
      message: state?.ok ? `${url}\nStatut : ${state.statusCode} — ${state.responseTime}ms` : `${url}\n${state?.errMsg || 'Inaccessible'}`,
    }),

    // ── Immich ──────────────────────────────────────────────────────────────
    immichStorageCritical: (pct, used, total) => ({ title: 'Stockage Immich critique', message: `Disque à ${pct}% — ${used} utilisés / ${total}` }),
    immichReport: (state) => ({
      title: 'Rapport Immich',
      message: `Photos : ${state.photos}\nVidéos : ${state.videos}\nDisque : ${state.diskPct}%`,
    }),

    // ── Jellyfin ────────────────────────────────────────────────────────────
    jellyfinReport: (state) => ({
      title: 'Rapport Jellyfin',
      message: `Sessions actives : ${state.activeSessions}\nFilms : ${state.movies} | Séries : ${state.series} | Musiques : ${state.songs}\nVersion : ${state.version}`,
    }),

    // ── Ollama ──────────────────────────────────────────────────────────────
    ollamaReport: (state) => ({
      title: 'Rapport Ollama',
      message: `Version : ${state.version || '—'}\nModèles : ${state.modelsCount}\n${state.modelNames?.join(', ') || ''}`,
    }),

    // ── Ping ────────────────────────────────────────────────────────────────
    pingUnreachable: (host, port, attempts) => ({ title: `${host} inaccessible`, message: `Port ${port} injoignable (${attempts}/${attempts} échecs)` }),
    pingBack: (host, latency, port) => ({ title: `${host} de retour`, message: `Latence : ${latency}ms — Port ${port}` }),
    pingReport: (host, state) => ({
      title: `Rapport Ping — ${host}`,
      message: state ? `${state.host}:${state.port}\nLatence : ${state.latency ?? '—'}ms — Perte : ${state.loss}%` : 'Aucune donnée.',
    }),

    // ── Port Forwarding ─────────────────────────────────────────────────────
    portForwardClosed: (host, port, errorType) => ({ title: `${host}:${port} fermé`, message: `Le port ${port} n'est plus accessible sur ${host}. ${errorType === 'refused' ? "(Connexion refusée — rien n'écoute)" : '(Timeout — port peut-être bloqué)'}` }),
    portForwardOpen:   (host, port, latency) => ({ title: `${host}:${port} ouvert`, message: `Le port ${port} est à nouveau accessible sur ${host} (${latency}ms).` }),

    // ── Portainer ───────────────────────────────────────────────────────────
    portainerReport: (state) => ({
      title: 'Rapport Portainer',
      message: `Environnements : ${state.environments}\nContainers actifs : ${state.containersRunning}\nArrêtés : ${state.containersStopped}`,
    }),

    // ── Proxmox ─────────────────────────────────────────────────────────────
    proxmoxHighCpu: (pct, node) => ({ title: 'CPU Proxmox élevé', message: `CPU à ${pct}% sur ${node}` }),
    proxmoxHighRam: (pct, node) => ({ title: 'RAM Proxmox saturée', message: `RAM à ${pct}% sur ${node}` }),
    proxmoxReport: (state, node) => ({
      title: `Rapport Proxmox — ${node || 'pve'}`,
      message: `CPU : ${state.cpuPct}% | RAM : ${state.memPct}%\nVMs : ${state.vmRunning} actives | LXC : ${state.lxcRunning} actifs`,
    }),

    // ── Speedtest ───────────────────────────────────────────────────────────
    speedtestFailedFallback: 'Le dernier test speedtest a échoué',
    speedtestResult: (successful, failReason) => ({
      title: 'Speedtest Tracker',
      message: successful ? 'Test speedtest réussi' : `Test speedtest échoué${failReason ? ` — ${failReason}` : ''}`,
    }),
    speedtestReport: (state) => {
      const lines = [];
      if (state.downloadMbps != null) lines.push(`↓ Download : ${state.downloadMbps} Mbps`);
      if (state.uploadMbps   != null) lines.push(`↑ Upload   : ${state.uploadMbps} Mbps`);
      if (state.pingMs       != null) lines.push(`Ping : ${state.pingMs} ms`);
      if (state.jitterMs     != null) lines.push(`Jitter : ${state.jitterMs} ms`);
      return { title: 'Rapport Speedtest', message: lines.join('\n') };
    },

    // ── SSH ─────────────────────────────────────────────────────────────────
    sshConnected: (host, uptime) => ({ title: `SSH ${host} — Connecté`, message: `Uptime : ${uptime || '—'}` }),
    sshConnectionFailed: (host) => ({ title: `SSH ${host} — Connexion échouée` }),
    sshHighCpu: (host, pct) => ({ title: `CPU élevé — ${host}`, message: `CPU à ${pct}%` }),
    sshHighRam: (host, pct) => ({ title: `RAM élevée — ${host}`, message: `RAM à ${pct}%` }),
    sshHighDisk: (host, pct) => ({ title: `Disque plein — ${host}`, message: `Disque à ${pct}%` }),
    sshReport: (state) => {
      const cpu = state.cpuPct != null ? `\nCPU : ${state.cpuPct}%` : '';
      return {
        title: `Rapport SSH — ${state.host}`,
        message: `Uptime : ${state.uptime || '—'}${cpu}\nRAM : ${state.memUsed}/${state.memTotal} Mo (${state.memPct}%)\nDisque : ${state.diskUsed}/${state.diskSize} (${state.diskPct}%)`,
      };
    },

    // ── Syncthing ───────────────────────────────────────────────────────────
    syncthingDeviceDisconnected: (name) => ({ title: 'Syncthing — Appareil déconnecté', message: `"${name}" s'est déconnecté de Syncthing.` }),
    syncthingDeviceReconnected: (name) => ({ title: 'Syncthing — Appareil reconnecté', message: `"${name}" est de nouveau connecté.` }),
    syncthingFolderError: (label) => ({ title: 'Syncthing — Erreur dossier', message: `Le dossier "${label}" est en erreur.` }),
    syncthingReport: (state) => {
      const devLines = (state.devices || []).map(d => `${d.name} (${d.connected ? 'connecté' : 'déconnecté'})`).join('\n');
      const folderLines = (state.folders || []).map(f => `${f.label} — ${f.state} (${f.inSyncFiles}/${f.globalFiles} fichiers)`).join('\n');
      return {
        title: 'Rapport Syncthing',
        message: `Appareils (${(state.devices || []).filter(d => d.connected).length}/${(state.devices || []).length} connectés) :\n${devLines || 'Aucun appareil'}\n\nDossiers :\n${folderLines || 'Aucun dossier'}`,
      };
    },

    // ── Ultra.cc ────────────────────────────────────────────────────────────
    ultraccLowStorage: (free, total) => ({ title: 'Stockage bas — Ultra.cc', message: `Espace libre : ${free} Go sur ${total} Go` }),
    ultraccLowTraffic: (pct, reset) => ({ title: 'Trafic bas — Ultra.cc', message: `Trafic disponible : ${pct}% — Reset : ${reset}` }),
    ultraccReport: (state) => ({
      title: 'Rapport Ultra.cc',
      message: `Stockage : ${state.free_storage} Go libres / ${state.total_storage} Go\nTrafic disponible : ${state.traffic_available}%\nReset trafic : ${state.traffic_reset}`,
    }),

    // ── Unraid ──────────────────────────────────────────────────────────────
    unraidDiskError: (count) => ({ title: 'Unraid — Erreur disque', message: `${count} disque(s) en erreur dans l'array` }),
    unraidArrayStopped: (arrayState) => ({ title: 'Unraid — Array arrêté', message: `État de l'array : ${arrayState}` }),
    unraidReport: (state) => {
      const lines = [
        `Array : ${state.arrayState}`,
        `Disques : ${state.diskCount}${state.diskErrors > 0 ? ` (${state.diskErrors} en erreur)` : ''}`,
        `Stockage : ${state.diskUsed} / ${state.diskTotal} To (${state.diskPct}%)`,
      ];
      if (state.cpuPct != null) lines.push(`CPU : ${state.cpuPct}%`);
      if (state.ramPct != null) lines.push(`RAM : ${state.ramUsedGB} / ${state.ramTotalGB} Go (${state.ramPct}%)`);
      if (state.tempAvg != null) lines.push(`Temp moy : ${state.tempAvg}°C${state.tempWarn > 0 ? ` ${state.tempWarn} warn` : ''}${state.tempCrit > 0 ? ` ${state.tempCrit} crit` : ''}`);
      lines.push(`Containers : ${state.containersRunning} actifs`);
      return { title: 'Rapport Unraid', message: lines.join('\n') };
    },
  },
};
