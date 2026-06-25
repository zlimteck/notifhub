<div align="center">
  <img src="docs/logo.svg" alt="Orveil" width="80" />
  <h1>Orveil</h1>
  <p>Self-hosted monitoring that goes beyond uptime checks.<br>
  Incidents with severity, SLA tracking, post-mortems, AI assistant, and MCP integration — in a single Docker container.</p>

  [![Image Size](https://img.shields.io/docker/image-size/zlimteck/orveil/latest?style=flat-square&logo=docker&logoColor=white&color=2496ED)](https://hub.docker.com/r/zlimteck/orveil)
  [![CI](https://img.shields.io/github/actions/workflow/status/zlimteck/orveil/docker.yml?style=flat-square&logo=github-actions&logoColor=white&label=build)](https://github.com/zlimteck/orveil/actions/workflows/docker.yml)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-amd64%20%7C%20arm64-lightgrey?style=flat-square)](https://hub.docker.com/r/zlimteck/orveil)
</div>

---

![Dashboard](docs/screenshots/1-Dashboard.png)

---

## Quick start

**Prerequisites:** Docker + Docker Compose

Create a `docker-compose.yml` with the following content, then run `docker compose up -d`:

```yaml
services:
  mongodb:
    image: mongo:8
    container_name: orveil-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: orveil
      MONGO_INITDB_ROOT_PASSWORD: orveil_pass
      MONGO_INITDB_DATABASE: orveil
    volumes:
      - orveil_mongo:/data/db
    networks:
      - orveil
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 15s

  docker-proxy:
    image: tecnativa/docker-socket-proxy:latest
    container_name: orveil-docker-proxy
    restart: unless-stopped
    environment:
      CONTAINERS: 1
      INFO: 1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - orveil

  apprise:
    image: caronc/apprise:latest
    container_name: orveil-apprise
    restart: unless-stopped
    ports:
      - "127.0.0.1:8008:8000"                   # bound to localhost only
    networks:
      - orveil

  orveil:
    image: zlimteck/orveil:latest
    container_name: orveil
    restart: unless-stopped
    ports:
      - "3050:5050"
    environment:
      MONGODB_URI: mongodb://orveil:orveil_pass@mongodb:27017/orveil?authSource=admin
      APPRISE_API_URL: http://apprise:8000
      DOCKER_PROXY_URL: http://docker-proxy:2375
      PORT: 5050
      NODE_ENV: production
      JWT_SECRET: ""                             # REQUIRED: openssl rand -hex 32
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: ""                         # REQUIRED: random password generated on first start if omitted
      COOKIE_SECURE: "false"                     # set to "true" if behind an HTTPS reverse proxy
      ENCRYPTION_KEY:                            # optional: openssl rand -hex 32
      METRICS_TOKEN:                             # optional: openssl rand -hex 32
    depends_on:
      mongodb:
        condition: service_healthy
      apprise:
        condition: service_started
      docker-proxy:
        condition: service_started
    networks:
      - orveil

volumes:
  orveil_mongo:

networks:
  orveil:
    driver: bridge
```

| Service | URL |
|---------|-----|
| App (frontend + API) | http://localhost:3050 |
| Apprise API | http://localhost:8008 |

If `ADMIN_PASSWORD` is not set, a random password is generated on first start and printed once in the container logs:

```bash
docker logs orveil
```

Set `ADMIN_PASSWORD` in your `.env` to control the initial password.

---

## Features

**Monitoring**
- **26 monitor types** — HTTP/HTTPS, Multi-step HTTP, Ping, TCP, Port Forwarding, SSH, DNS, MySQL, Redis, MongoDB, Docker, Proxmox, Cloudflare, AdGuard DNS, AdGuard Home, Portainer, Tailscale, Home Assistant, Syncthing, Immich, Unraid, Speedtest Tracker, Jellyfin, Ollama, HMS, Ultra.cc, Heartbeat
- Adaptive polling — faster rechecks when a service is down
- Monitor dependencies — suppress alerts when a parent is already down
- SSL certificate monitoring with expiry warning

**Incidents & SLA**
- Auto-open / auto-close incidents with P1–P4 severity
- War room — full-screen view of all active incidents
- Post-mortem reports attached to resolved incidents
- SLA targets per monitor — met/breached indicator on the Stats page
- 30-day statistics: MTTR, MTTD, incident heatmap, maintenance-adjusted uptime

![Stats](docs/screenshots/2-stats.png)

![War room](docs/screenshots/4-war-room.png)

**Alerts**
- Apprise notifications — [100+ channels](https://github.com/caronc/apprise/wiki): Pushover, Telegram, Discord, Slack, email and more
- Notification cooldown — prevents alert storms during flapping
- Weekly summary report

**Automation & integrations**
- [MCP server](docs/mcp.md) — let AI assistants query monitors, incidents, and stats (Claude Desktop, etc.)
- [Prometheus metrics](docs/prometheus.md) — `GET /api/metrics` with Grafana-ready labels
- REST API with Bearer auth, fully documented in-app
- Per-monitor changelog webhooks for CI/CD integration
- Backup & restore (JSON export/import)

**UX**
- Public status page — shareable `/status` with 90-day uptime history
- Global search `Cmd+K` — monitors, incidents, annotations, post-mortems
- Drag & drop reordering, category grouping, pin monitors, bulk actions
- Orveil AI — built-in Claude assistant for natural-language infra Q&A
- FR / EN interface · Auto / light / dark theme · Mobile PWA

→ [Complete feature list](docs/features.md)

![Status page](docs/screenshots/3-status_page.png)

---

## Available monitors

| Type | What it checks |
|------|----------------|
| **HTTP** | HTTP/HTTPS endpoint — status code, keyword match, auth, SSL expiry, response time threshold |
| **Multi-step HTTP** | Chain multiple requests with variable extraction and interpolation between steps |
| **Ping / TCP** | ICMP ping or TCP port reachability — latency and packet loss |
| **Port Forwarding** | TCP connect check to verify a forwarded port is reachable from outside |
| **DNS** | DNS record resolution (A, AAAA, CNAME, MX, TXT, NS) with optional value assertion |
| **SSH** | CPU / RAM via SSH (password or private key) |
| **MySQL** | Ping a MySQL/MariaDB server and retrieve version |
| **Redis** | PING a Redis instance and retrieve version |
| **MongoDB** | Ping a MongoDB instance and retrieve version — supports optional authentication |
| **Docker** | Container count and status via Docker socket |
| **Proxmox** | Node CPU / RAM via API token |
| **Cloudflare** | Tunnel status and hostnames via API token |
| **AdGuard DNS** | DNS protection status and request stats via cloud API |
| **AdGuard Home** | Self-hosted DNS protection — blocked queries %, total queries, safebrowsing |
| **Portainer** | Container list per environment via API key |
| **Tailscale** | Tailnet device list with online/offline status via Tailscale cloud API |
| **Home Assistant** | Instance status, version, and selected entity states via long-lived access token |
| **Syncthing** | Synced folders and connected devices via API key |
| **Immich** | Photo / video count and disk usage via API key |
| **Unraid** | Array state, disk usage, CPU / RAM, temperature via GraphQL API |
| **Speedtest Tracker** | Latest speedtest result — download, upload, ping, jitter |
| **Jellyfin** | Active sessions, library counts, server version |
| **Ollama** | Running model list and server availability |
| **HMS (HostMyServers)** | VPS status and specs via API token |
| **Ultra.cc** | Seedbox storage and traffic via Stats API URL |
| **Heartbeat** | Cron job / script monitor — alerts if no ping received within expected interval |

→ [Alerts sent per monitor type](docs/alerts.md)

---

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

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_USER` | `orveil` | MongoDB username |
| `MONGO_PASS` | `orveil_pass` | MongoDB password |
| `JWT_SECRET` | **required** | JWT signing secret — `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | *(none)* | AES-256-GCM key for encrypting sensitive credentials at rest — **strongly recommended** |
| `ADMIN_USERNAME` | `admin` | Admin account username |
| `ADMIN_PASSWORD` | *(random)* | Admin account password — printed in logs on first start if not set. **Set this explicitly.** |
| `DOCKER_PROXY_URL` | *(none)* | URL of the Docker socket proxy — set to `http://docker-proxy:2375` when using the compose above |
| `COOKIE_SECURE` | `false` | Set to `true` if serving behind an HTTPS reverse proxy — enables `Secure` flag on the session cookie |
| `FRONTEND_URL` | *(none)* | Required only for split deployments where frontend and backend are on different origins — restricts CORS to this URL in production |
| `METRICS_TOKEN` | *(none)* | Static Bearer token for the Prometheus metrics endpoint |

**Generate an encryption key:**

```bash
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

When set, all sensitive monitor fields (API keys, tokens, passwords, private keys, proxy credentials) are encrypted in the database using AES-256-GCM.

---

## License

[MIT](LICENSE)
