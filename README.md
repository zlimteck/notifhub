<div align="center">
  <img src="docs/logo.svg" alt="Orveil" width="80" />
  <h1>Orveil</h1>
  <p>Unified monitoring dashboard with notifications via <a href="https://github.com/caronc/apprise/wiki">Apprise</a>.<br>Monitor your self-hosted services, get alerted on incidents, and send notifications to any channel.</p>

  [![Image Size](https://img.shields.io/docker/image-size/zlimteck/orveil/latest?style=flat-square&logo=docker&logoColor=white&color=2496ED)](https://hub.docker.com/r/zlimteck/orveil)
  [![CI](https://img.shields.io/github/actions/workflow/status/zlimteck/orveil/docker.yml?style=flat-square&logo=github-actions&logoColor=white&label=build)](https://github.com/zlimteck/orveil/actions/workflows/docker.yml)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-amd64%20%7C%20arm64-lightgrey?style=flat-square)](https://hub.docker.com/r/zlimteck/orveil)
</div>

![Dashboard](docs/screenshots/1-Dashboard.png)


## Features

- **Unified dashboard** — status overview of all your services at a glance, grid or list view
- **18 monitor types** — HTTP/HTTPS, Ping/TCP, SSH, Proxmox, Cloudflare, AdGuard DNS, AdGuard Home, Home Assistant, Portainer, Docker, Syncthing, Immich, HostMyServers, Ultra.cc, Heartbeat, Unraid, Speedtest Tracker, Jellyfin
- **Public status page** — shareable `/status` page (no login required) with uptime bars, open incidents, and 90-day history per service; toggle visibility per service
- **Search & sort** — filter cards by name, sort by status / name / manual order
- **Drag & drop reordering** — manually reorder cards in grid view
- **Category grouping** — assign a category to each service to group cards on the dashboard
- **Incident tracking** — automatic incident open/close with duration history; P1–P4 severity (auto-assigned, manually overridable); MTTR and severity breakdown on the Stats page
- **Maintenance windows** — per-service maintenance mode (30 min to 8 h presets or custom) — no alerts or incidents during the window
- **Monitor dependencies** — link a monitor to a parent; down alerts are suppressed when the parent is also down
- **Statistics** — 30-day global view: uptime per service, incident count, MTTR, severity breakdown, notifications sent
- **Backup & restore** — export all monitors and settings as JSON; import on another instance (Settings page)
- **Metric graphs** — optional sparkline graphs on dashboard cards (toggle in settings)
- **Apprise notifications** — Pushover, Telegram, Discord, Slack, email, and [100+ more](https://github.com/caronc/apprise/wiki)
- **Weekly report** — optional weekly Apprise summary (services in error, average uptime)
- **Manual notifications** — send a message to all channels directly from the UI
- **Auto / light / dark theme** — follows system preference, persisted per browser
- **FR / EN interface** — language toggle in the sidebar
- **REST API** — full API with Bearer token auth, documented in-app
- **MCP server** — Model Context Protocol server exposing monitors, incidents and stats to AI assistants (Claude Desktop, etc.) via Streamable HTTP and stdio transports

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB |
| Notifications | Apprise (self-hosted sidecar) |
| Deployment | Single Docker image (frontend + backend) |
| CI/CD | GitHub Actions → Docker Hub (amd64 + arm64) |

## Quick start

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/zlimteck/orveil.git
cd orveil
cp .env.example .env
# Edit .env — change JWT_SECRET and ADMIN_PASSWORD before exposing publicly
docker compose up -d
```

| Service | URL |
|---------|-----|
| App (frontend + API) | http://localhost:3050 |
| Apprise API | http://localhost:8008 |

Default credentials: `admin` / `orveil`

## Available monitors

| Type | What it checks |
|------|----------------|
| **HTTP** | HTTP/HTTPS endpoint — status code, keyword match, Bearer/Basic/custom auth, multiple methods (GET/POST/PUT…), SSL certificate expiry |
| **Ping** | ICMP ping or TCP port reachability |
| **SSH** | CPU / RAM via SSH (password or private key) |
| **Heartbeat** | Cron job / script monitor — alerts if no ping received within expected interval |
| **Docker** | Container count and status via Docker socket |
| **Proxmox** | Node CPU / RAM via API token |
| **Cloudflare** | Tunnel status and hostnames via API token |
| **AdGuard DNS** | DNS protection status and request stats via cloud API |
| **AdGuard Home** | Self-hosted DNS protection — blocked queries %, total queries, safebrowsing |
| **Portainer** | Container list per environment via API key |
| **Syncthing** | Synced folders and connected devices via API key |
| **Immich** | Photo / video count and disk usage via API key |
| **HMS (HostMyServers)** | VPS status and specs via API token |
| **Ultra.cc** | Seedbox storage and traffic via Stats API URL |
| **Unraid** | Array state, disk usage, CPU / RAM, temperature via GraphQL API |
| **Home Assistant** | Instance status, version, and selected entity states via Long-lived access token. Numeric entities (temperature, humidity, power…) can be graphed — non-numeric states (on/off, home/away) are displayed but not graphable |
| **Speedtest Tracker** | Latest speedtest result — download, upload, ping, jitter |
| **Jellyfin** | Active sessions, library counts (movies / series / songs), server version |

## Alerts sent per monitor type

All monitor types send exactly **one alert when going down** and **one alert on recovery** — no repeat notifications while the service stays down. Incidents are opened on first alert and closed on recovery.

Additional type-specific alerts:

| Type | Extra alerts |
|------|-------------|
| **HTTP** | SSL expiry warning · SSL expired · Response time threshold exceeded |
| **SSH** | High CPU · High RAM · High disk usage |
| **Proxmox** | High CPU · High RAM |
| **Cloudflare** | Per-tunnel offline / restored |
| **AdGuard DNS** | Protection disabled / re-enabled |
| **AdGuard Home** | Protection disabled / re-enabled |
| **Syncthing** | Folder error · Device disconnected / reconnected |
| **Immich** | Critical disk usage |
| **HMS** | Per-VPS unreachable · High CPU · High memory |
| **Ultra.cc** | Low storage · Low traffic |
| **Unraid** | Array stopped · Disk error |
| **Home Assistant** | Entity becomes unavailable · Entity restored |

## Notifications (Apprise)

Go to **Settings** and add your Apprise URLs — one per line:

```
pover://UserKey@ApiToken/          # Pushover
tgram://BotToken/ChatID/           # Telegram
discord://WebhookID/WebhookToken/  # Discord
slack://TokenA/TokenB/TokenC/      # Slack
mailto://user:pass@gmail.com       # Email
```

Full list: https://github.com/caronc/apprise/wiki

## MCP Server

Orveil exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so AI assistants can query your monitoring data directly.

### Tools available

| Tool | Description |
|------|-------------|
| `list_monitors` | List all monitors with status (filterable by status / category / enabled) |
| `get_monitor` | Full details + metrics + last 20 snapshots for a specific monitor |
| `list_incidents` | Recent incidents (filterable: open only, by monitor) |
| `get_stats` | Global counters — total, online, offline, warning, error, disabled |
| `trigger_check` | Trigger an immediate check for a monitor |

Resources `orveil://monitors/{name}` are also available for direct URI access.

### Streamable HTTP (remote)

The MCP endpoint is available at `/api/mcp`. The API key is auto-generated on first start and visible in **Settings → MCP Server**.

```json
{
  "mcpServers": {
    "orveil": {
      "url": "http://your-server:3050/api/mcp",
      "type": "streamable-http",
      "headers": {
        "Authorization": "Bearer <your-mcp-api-key>"
      }
    }
  }
}
```

### stdio (local / Claude Desktop)

```json
{
  "mcpServers": {
    "orveil": {
      "command": "node",
      "args": ["/path/to/orveil/backend/mcp-stdio.js"],
      "env": {
        "MONGO_URI": "mongodb://orveil:orveil_pass@localhost:27017/orveil"
      }
    }
  }
}
```

The same API key also works as a Bearer token on all `/api` REST endpoints.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USER` | `orveil` | MongoDB username |
| `MONGO_PASS` | `orveil_pass` | MongoDB password |
| `JWT_SECRET` | `orveil-change-me-in-production` | JWT signing secret — **change this** |
| `ENCRYPTION_KEY` | *(none)* | AES-256-GCM key for encrypting sensitive monitor credentials at rest — **strongly recommended** |
| `ADMIN_USERNAME` | `admin` | Admin account username |
| `ADMIN_PASSWORD` | `orveil` | Admin account password — **change this** |

### Setting up encryption at rest

Generate a key and add it to your `.env`:

```bash
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

When set, all sensitive monitor fields (API keys, tokens, passwords, private keys) are encrypted in the database using AES-256-GCM before being stored. The encryption is transparent — credentials are decrypted automatically at runtime.

> **Note:** If you add `ENCRYPTION_KEY` to an existing deployment, credentials saved before that point remain in plaintext until you re-save each monitor. New monitors and any monitor you edit after setting the key will be encrypted automatically.

## License

[MIT](LICENSE)
