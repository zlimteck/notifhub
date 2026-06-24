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

## Table of contents

- [Features](#features)
- [Stack](#stack)
- [Quick start](#quick-start)
- [Available monitors](#available-monitors)
- [Alerts sent per monitor type](#alerts-sent-per-monitor-type)
- [Notifications (Apprise)](#notifications-apprise)
- [MCP Server](#mcp-server)
- [Orveil AI](#orveil-ai)
- [Environment variables](#environment-variables)
- [License](#license)

## Features

- **Unified dashboard** — status overview of all your services at a glance, grid or list view
- **24 monitor types** — HTTP/HTTPS, Multi-step HTTP, Ping/TCP, Port Forwarding, SSH, DNS, MySQL, Redis, Proxmox, Cloudflare, AdGuard DNS, AdGuard Home, Home Assistant, Portainer, Docker, Syncthing, Immich, HostMyServers, Ultra.cc, Heartbeat, Unraid, Speedtest Tracker, Jellyfin, Ollama
- **Multi-step HTTP** — chain multiple HTTP requests with variable extraction (JSONPath or response headers) and interpolation between steps; full step-by-step failure reporting
- **Public status page** — shareable `/status` page (no login required) with uptime bars, open incidents, and 90-day history per service; toggle visibility per service
- **Global search** — `Cmd+K` / `Ctrl+K` modal searches across monitors, incidents, annotations, and post-mortems simultaneously; results grouped by type with keyboard navigation; click any result to navigate directly to the relevant page or open the service detail
- **Search & sort** — filter cards by name, sort by status / name / manual order
- **Drag & drop reordering** — manually reorder cards in grid view
- **Category grouping** — assign a category to each service to group cards on the dashboard
- **Pin monitors** — pin any monitor to always show it in a dedicated "Pinned" group at the top of the dashboard, above all categories
- **Bulk actions** — select multiple monitors with checkboxes and pin, enable, disable, or delete them in one click; floating action bar slides up when a selection is active
- **Incident tracking** — automatic incident open/close with duration history; P1–P4 severity (auto-assigned, manually overridable); failure reason displayed inline; incidents grouped by date; configurable confirm-after threshold (require N consecutive errors before opening an incident, default 1 = immediate)
- **War room** — dedicated full-screen view of all active incidents sorted by severity, with auto-refresh every 30 s
- **Post-mortem reports** — attach a structured post-mortem (summary, root cause, impact, resolution, lessons learned) to any resolved incident
- **SLA tracking** — set a target uptime % per monitor; met/breached indicator displayed on the Stats page; SLA uptime excludes maintenance periods
- **Statistics** — 30-day global view: uptime per service with trend (raw + maintenance-adjusted), SLA status, incident count, MTTR, MTTD, severity breakdown, maintenance summary, notification log, incident heatmap by day/hour
- **Prometheus metrics** — `GET /api/metrics` exposes all monitor metrics in Prometheus text format: `orveil_monitor_status`, `orveil_monitor_latency_ms`, `orveil_monitor_uptime_24h/7d/30d_pct`, `orveil_incidents_open_total`; secured by API key or static `METRICS_TOKEN`
- **Maintenance windows** — per-service maintenance mode, immediate or scheduled (date/time picker); presets 30 min to 8 h or custom duration; upcoming windows shown as a badge on the card; checks keep running during maintenance so the real status stays visible — alerts and incident creation are suppressed; full history with ended/canceled distinction; maintenance periods visible as interactive amber bands on the Timeline (hover for details, click to open); incidents that occurred during a maintenance are flagged in the Incidents page; SLA uptime is calculated excluding maintenance time; maintenance summary on the Stats page
- **Adaptive polling** — when a service goes down, check interval drops automatically to 30 s (configurable) for near-instant recovery detection; reverts to the normal interval once the service is back up; Speedtest and Heartbeat monitors are excluded
- **Notification cooldown** — configurable minimum delay (in minutes) between repeated down alerts for the same service; prevents alert storms during flapping; recovery notifications always pass through
- **Monitor dependencies** — link a monitor to a parent; down alerts are suppressed when the parent is also down
- **Backup & restore** — export all monitors and settings as JSON; import on another instance (Settings page)
- **Status badges** — embeddable SVG badge per service (`/api/badge/:id`) with live status color; Markdown and HTML snippets available in the service detail modal
- **Metric graphs** — sparkline graphs on dashboard cards and in service detail; smooth Bézier curves, incident overlays, user annotations, and per-monitor changelog markers (green vertical lines with version label and hover tooltip)
- **Per-monitor changelog** — structured version/deployment log per service (`version` + `date` + `description`); entries appear as labeled markers on the metric graph; CRUD from the service detail modal; inbound webhook (`POST /api/webhook/changelog`) with per-monitor token for CI/CD integration (generate, regenerate, and revoke from the service edit modal)
- **Apprise notifications** — Pushover, Telegram, Discord, Slack, email, and [100+ more](https://github.com/caronc/apprise/wiki)
- **Weekly report** — optional weekly Apprise summary (services in error, average uptime)
- **Manual notifications** — send a message to all channels directly from the UI
- **Proxy library** — save multiple named proxies (HTTP, HTTPS, SOCKS5, SSH tunnel); activate/deactivate any proxy as the global default in one click; assign a specific proxy per monitor; test each proxy from the UI; passwords and private keys encrypted at rest
- **Clone monitor** — duplicate any monitor with one click (opens in disabled state for safe editing before enabling)
- **Real-time toast notifications** — live in-app alerts when a monitor changes status (via SSE), with coloured toasts per status (error / warning / online)
- **Auto / light / dark theme** — follows system preference, persisted per browser
- **FR / EN interface** — language toggle synced to notification language (one setting controls both UI and alerts)
- **REST API** — full API with Bearer API key auth (same key as MCP), documented in-app with copy button
- **MCP server** — Model Context Protocol server exposing monitors, incidents, stats, annotations, changelogs and uptime history to AI assistants (Claude Desktop, etc.) via Streamable HTTP and stdio transports; includes write tools: create annotations, set/cancel maintenance, resolve incidents, add changelog entries
- **Orveil AI** — built-in AI assistant (powered by Anthropic Claude) answering questions about your monitors, incidents, and SLA directly from the dashboard; API key stored encrypted in the database; model selectable from live Anthropic catalogue

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
| **HTTP** | HTTP/HTTPS endpoint — status code or custom accepted codes list, keyword present/absent match, Bearer/Basic/custom auth, multiple methods (GET/POST/PUT…), SSL certificate expiry with issuer and exact date displayed on the card, response time threshold |
| **Ping** | ICMP ping or TCP port reachability — latency and packet loss |
| **DNS** | DNS record resolution (A, AAAA, CNAME, MX, TXT, NS) — optionally assert expected value |
| **MySQL** | Ping a MySQL/MariaDB server and retrieve version via `mysql2` |
| **Redis** | PING a Redis instance and retrieve version via `ioredis` |
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
| **Ollama** | Running model list and server availability via Ollama API |
| **Port Forwarding** | TCP connect check to verify a forwarded port is reachable from outside (router/firewall NAT verification) |

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

**Read**

| Tool | Description |
|------|-------------|
| `list_monitors` | List all monitors with status, SLA target, category, confirmAfter, maintenance state (filterable by status / category / enabled) |
| `get_monitor` | Full details, metrics, recent snapshots, and changelog entries for a specific monitor |
| `list_incidents` | Recent incidents with severity, duration, postmortem — filterable by open/resolved or monitor |
| `get_stats` | Global counts per status |
| `get_stats_detailed` | Full statistics: MTTR, MTTD, uptime per monitor (30d), SLA compliance, incidents/day, severity breakdown |
| `list_annotations` | Manual event markers attached to monitors |
| `list_postmortems` | Incidents with a written post-mortem (summary, root cause, impact, resolution, lessons) |
| `get_uptime` | Daily uptime history per monitor (up to 90 days) |

**Write**

| Tool | Description |
|------|-------------|
| `trigger_check` | Trigger an immediate check for a monitor |
| `create_annotation` | Add an event marker on a monitor's metric graph (e.g. "backup started", "deployed v2.1") |
| `set_maintenance` | Put a monitor in maintenance mode for N minutes — suppresses alerts |
| `cancel_maintenance` | Cancel an active maintenance window immediately |
| `resolve_incident` | Manually close an open incident with an optional postmortem summary |
| `create_changelog` | Add a deployment/version entry to a monitor's graph |

Resources `orveil://monitors/{name}` are also available for direct URI access.

### Streamable HTTP (remote)

The MCP endpoint is available at `/api/mcp`. The API key is auto-generated on first start and visible in **Settings → Integrations → MCP Server**.

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

## Orveil AI

Orveil embeds an AI assistant powered by [Anthropic Claude](https://www.anthropic.com) that can answer natural-language questions about your infrastructure directly from the dashboard.

**How it works:**
- A floating button appears in the bottom-right corner once an Anthropic API key is configured
- The assistant has access to your monitors, incidents, statistics, annotations, and SLA data via the same tools as the MCP server
- Conversations are scoped strictly to Orveil — the assistant will not answer unrelated questions
- Responses are given in the same language as the user (FR/EN auto-detected)

**Setup:**
1. Go to **Settings → Integrations → Orveil AI**
2. Enter your Anthropic API key (`sk-ant-...`)
3. Select the Claude model to use (loaded live from the Anthropic catalogue)
4. Save — the AI button appears immediately

The API key is encrypted at rest using AES-256-GCM (same as monitor credentials). It is never exposed to the frontend.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USER` | `orveil` | MongoDB username |
| `MONGO_PASS` | `orveil_pass` | MongoDB password |
| `JWT_SECRET` | `orveil-change-me-in-production` | JWT signing secret — **change this** |
| `ENCRYPTION_KEY` | *(none)* | AES-256-GCM key for encrypting sensitive monitor credentials at rest — **strongly recommended** |
| `ADMIN_USERNAME` | `admin` | Admin account username |
| `ADMIN_PASSWORD` | `orveil` | Admin account password — **change this** |
| `METRICS_TOKEN` | *(none)* | Static Bearer token for the Prometheus metrics endpoint — generate with `openssl rand -hex 32` |

### Setting up encryption at rest

Generate a key and add it to your `.env`:

```bash
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

When set, all sensitive monitor fields (API keys, tokens, passwords, private keys) **and proxy credentials** are encrypted in the database using AES-256-GCM before being stored. The encryption is transparent — credentials are decrypted automatically at runtime.

> **Note:** If you add `ENCRYPTION_KEY` to an existing deployment, credentials saved before that point remain in plaintext until you re-save each monitor. New monitors and any monitor you edit after setting the key will be encrypted automatically.

## Prometheus & Grafana integration

Orveil exposes a Prometheus-compatible metrics endpoint at `GET /api/metrics` (authenticated with your MCP/REST API key). To wire it up with Grafana, a Prometheus scraper is required as an intermediary.

### Starting Prometheus alongside Orveil

The repository ships with a pre-configured `prometheus.yml`. The metrics endpoint uses a dedicated static token (`METRICS_TOKEN`) that you define — no need to wait for the MCP key to be generated.

**Step 1 — generate a token and add it to your `.env`:**

```bash
echo "METRICS_TOKEN=$(openssl rand -hex 32)" >> .env
```

**Step 2 — copy the example config and set your token:**

```bash
cp prometheus.yml.example prometheus.yml
```

Then edit `prometheus.yml` and replace `VOTRE_METRICS_TOKEN`:

```yaml
bearer_token: your_token_here   # same value as METRICS_TOKEN in .env
```

**Step 3 — start everything with the `monitoring` profile:**

```bash
docker compose --profile monitoring up -d
```

Prometheus will be available on **http://localhost:9090** and scrapes Orveil every 30 seconds.

### Connecting Grafana

1. In Grafana, go to **Connections → Data sources → Add data source**
2. Choose **Prometheus**
3. Set the URL to `http://orveil-prometheus:9090` (if Grafana runs in the same Docker network) or `http://localhost:9090` (if Grafana runs on the host)
4. Click **Save & test**

### Available metrics

| Metric | Type | Description |
|--------|------|-------------|
| `orveil_monitor_status` | gauge | `1` = online, `0` = offline/error/unknown |
| `orveil_monitor_latency_ms` | gauge | Last recorded latency in milliseconds |
| `orveil_monitor_uptime_24h_pct` | gauge | Uptime over the last 24 hours (%) |
| `orveil_monitor_uptime_7d_pct` | gauge | Uptime over the last 7 days (%) |
| `orveil_monitor_uptime_30d_pct` | gauge | Uptime over the last 30 days (%) |
| `orveil_incidents_open_total` | gauge | Number of currently open incidents |

All metrics carry labels `id`, `name`, `type`, and `category` for easy filtering.

### Adding Grafana to the stack (optional)

If you also want Grafana managed by Docker Compose, add this service to your `docker-compose.yml`:

```yaml
grafana:
  image: grafana/grafana:latest
  container_name: orveil-grafana
  restart: unless-stopped
  ports:
    - "3000:3000"
  volumes:
    - grafana_data:/var/lib/grafana
  depends_on:
    - prometheus
  networks:
    - orveil
  profiles:
    - monitoring
```

And add `grafana_data:` under the `volumes:` key. Then access Grafana at **http://localhost:3000** (default credentials: `admin` / `admin`).

## License

[MIT](LICENSE)
