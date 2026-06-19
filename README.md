<div align="center">
  <img src="docs/logo.svg" alt="NotifHub" width="80" />
  <h1>NotifHub</h1>
  <p>Unified monitoring dashboard with notifications via <a href="https://github.com/caronc/apprise/wiki">Apprise</a>.<br>Monitor your self-hosted services, get alerted on incidents, and send notifications to any channel.</p>

  [![Image Size](https://img.shields.io/docker/image-size/zlimteck/notifhub/latest?style=flat-square&logo=docker&logoColor=white&color=2496ED)](https://hub.docker.com/r/zlimteck/notifhub)
  [![CI](https://img.shields.io/github/actions/workflow/status/zlimteck/notifhub/docker.yml?style=flat-square&logo=github-actions&logoColor=white&label=build)](https://github.com/zlimteck/notifhub/actions/workflows/docker.yml)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-amd64%20%7C%20arm64-lightgrey?style=flat-square)](https://hub.docker.com/r/zlimteck/notifhub)
</div>

## Screenshots

| | |
|---|---|
| ![Dashboard](docs/screenshots/01-Dashboard.png) | ![Services](docs/screenshots/02-Services.png) |
| ![Notifications](docs/screenshots/03-Notications.png) | ![New service](docs/screenshots/04-NewServices.png) |
| ![Incidents](docs/screenshots/05-Incidents.png) | ![Statistics](docs/screenshots/06-Statistiques.png) |
| ![Settings](docs/screenshots/07-Settings.png) | ![API](docs/screenshots/08-Api.png) |
| ![Public status page](docs/screenshots/09-PublicStatusPage.png) | |

## Features

- **Unified dashboard** — status overview of all your services at a glance, grid or list view
- **17 monitor types** — HTTP/HTTPS, Ping/TCP, SSH, Proxmox, Cloudflare, AdGuard DNS, AdGuard Home, Home Assistant, Portainer, Docker, Syncthing, Immich, HostMyServers, Ultra.cc, Heartbeat, Unraid, Speedtest Tracker
- **Public status page** — shareable `/status` page (no login required) with uptime bars, open incidents, and 90-day history per service; toggle visibility per service
- **Search & sort** — filter cards by name, sort by status / name / manual order
- **Drag & drop reordering** — manually reorder cards in grid view
- **Category grouping** — assign a category to each service to group cards on the dashboard
- **Incident tracking** — automatic incident open/close with duration history
- **Maintenance windows** — per-service maintenance mode (30 min to 8 h presets or custom) — no alerts or incidents during the window
- **Statistics** — 30-day global view: uptime per service, incident count, average duration, notifications sent
- **Metric graphs** — optional sparkline graphs on dashboard cards (toggle in settings)
- **Apprise notifications** — Pushover, Telegram, Discord, Slack, email, and [100+ more](https://github.com/caronc/apprise/wiki)
- **Weekly report** — optional weekly Apprise summary (services in error, average uptime)
- **Manual notifications** — send a message to all channels directly from the UI
- **Auto / light / dark theme** — follows system preference, persisted per browser
- **FR / EN interface** — language toggle in the sidebar
- **REST API** — full API with Bearer token auth, documented in-app

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
git clone https://github.com/zlimteck/notifhub.git
cd notifhub
cp .env.example .env
# Edit .env — change JWT_SECRET and ADMIN_PASSWORD before exposing publicly
docker compose up -d
```

| Service | URL |
|---------|-----|
| App (frontend + API) | http://localhost:3050 |
| Apprise API | http://localhost:8008 |

Default credentials: `admin` / `notifhub`

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

## Alerts sent per monitor type

All monitor types automatically send a **down** alert when status changes to error/offline, and a **recovery** alert when coming back online. Incidents are opened on first alert and closed on recovery.

Additional type-specific alerts:

| Type | Extra alerts |
|------|-------------|
| **HTTP** | SSL expiry warning · SSL expired |
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

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USER` | `notifhub` | MongoDB username |
| `MONGO_PASS` | `notifhub_pass` | MongoDB password |
| `JWT_SECRET` | `notifhub-change-me-in-production` | JWT signing secret — **change this** |
| `ADMIN_USERNAME` | `admin` | Admin account username |
| `ADMIN_PASSWORD` | `notifhub` | Admin account password — **change this** |

## License

[MIT](LICENSE)
