# Complete feature list

## Dashboard & navigation

- **Unified dashboard** — status overview of all your services at a glance, grid or list view
- **Search & sort** — filter cards by name, sort by status / name / manual order
- **Drag & drop reordering** — manually reorder cards in grid view
- **Category grouping** — assign a category to each service to group cards on the dashboard
- **Pin monitors** — pin any monitor to always show it in a dedicated "Pinned" group at the top of the dashboard, above all categories
- **Bulk actions** — select multiple monitors with checkboxes and pin, enable, disable, or delete them in one click; floating action bar slides up when a selection is active
- **Global search** — `Cmd+K` / `Ctrl+K` modal searches across monitors, incidents, annotations, and post-mortems simultaneously; results grouped by type with keyboard navigation; click any result to navigate directly to the relevant page or open the service detail
- **Real-time toast notifications** — live in-app alerts when a monitor changes status (via SSE), with coloured toasts per status (error / warning / online)
- **Clone monitor** — duplicate any monitor with one click (opens in disabled state for safe editing before enabling)

## Monitoring

- **26 monitor types** — HTTP/HTTPS, Multi-step HTTP, Ping/TCP, Port Forwarding, SSH, DNS, MySQL, Redis, MongoDB, Tailscale, Proxmox, Cloudflare, AdGuard DNS, AdGuard Home, Home Assistant, Portainer, Docker, Syncthing, Immich, HostMyServers, Ultra.cc, Heartbeat, Unraid, Speedtest Tracker, Jellyfin, Ollama
- **Multi-step HTTP** — chain multiple HTTP requests with variable extraction (JSONPath or response headers) and interpolation between steps; full step-by-step failure reporting
- **Adaptive polling** — when a service goes down, check interval drops automatically to 30 s (configurable) for near-instant recovery detection; reverts to the normal interval once the service is back up
- **Monitor dependencies** — link a monitor to a parent; down alerts are suppressed when the parent is also down
- **Metric graphs** — sparkline graphs on dashboard cards and in service detail; smooth Bézier curves, incident overlays, user annotations, and per-monitor changelog markers
- **Status badges** — embeddable SVG badge per service (`/api/badge/:id`) with live status color; Markdown and HTML snippets available in the service detail modal

## Incidents & SLA

- **Incident tracking** — automatic incident open/close with duration history; P1–P4 severity (auto-assigned, manually overridable); failure reason displayed inline; incidents grouped by date; configurable confirm-after threshold
- **War room** — dedicated full-screen view of all active incidents sorted by severity, with auto-refresh every 30 s
- **Post-mortem reports** — attach a structured post-mortem (summary, root cause, impact, resolution, lessons learned) to any resolved incident
- **SLA tracking** — set a target uptime % per monitor; met/breached indicator displayed on the Stats page; SLA uptime excludes maintenance periods
- **Statistics** — 30-day global view: uptime per service with trend (raw + maintenance-adjusted), SLA status, incident count, MTTR, MTTD, severity breakdown, maintenance summary, notification log, incident heatmap by day/hour

## Maintenance

- **Maintenance windows** — per-service maintenance mode, immediate or scheduled (date/time picker); presets 30 min to 8 h or custom duration; checks keep running during maintenance — alerts and incident creation are suppressed; full history with ended/canceled distinction; maintenance periods visible as interactive amber bands on the Timeline; incidents that occurred during a maintenance are flagged; SLA uptime is calculated excluding maintenance time

## Alerts & notifications

- **Apprise notifications** — Pushover, Telegram, Discord, Slack, email, and [100+ more](https://github.com/caronc/apprise/wiki)
- **Notification cooldown** — configurable minimum delay between repeated down alerts for the same service; prevents alert storms during flapping; recovery notifications always pass through
- **Weekly report** — optional weekly Apprise summary (services in error, average uptime)
- **Manual notifications** — send a message to all channels directly from the UI

## Integrations & automation

- **MCP server** — Model Context Protocol server exposing monitors, incidents, stats, annotations, changelogs and uptime history to AI assistants via Streamable HTTP and stdio transports; includes write tools: create annotations, set/cancel maintenance, resolve incidents, add changelog entries — [full docs](mcp.md)
- **Prometheus metrics** — `GET /api/metrics` exposes all monitor metrics in Prometheus text format; secured by API key or static `METRICS_TOKEN` — [full docs](prometheus.md)
- **REST API** — full API with Bearer API key auth, documented in-app with copy button
- **Per-monitor changelog** — structured version/deployment log per service; entries appear as labeled markers on the metric graph; CRUD from the service detail modal; inbound webhook for CI/CD integration
- **Proxy library** — save multiple named proxies (HTTP, HTTPS, SOCKS5, SSH tunnel); activate/deactivate any proxy as the global default; assign a specific proxy per monitor; passwords and private keys encrypted at rest
- **Backup & restore** — export all monitors and settings as JSON; import on another instance (Settings page)

## Security

- **httpOnly session cookie** — JWT stored in an httpOnly, SameSite=Strict cookie; never exposed to JavaScript
- **Token revocation** — logout blacklists the JWT by JTI in MongoDB (TTL-indexed); reusing a logged-out token returns 401 immediately
- **Content Security Policy** — strict CSP via helmet (`script-src 'self'`, no `unsafe-eval`, no `unsafe-inline` scripts)
- **Rate limiting** — login (10 req/15 min), AI chat (20 req/min), settings writes (30 req/min), manual notifications (10 req/min)
- **Docker socket proxy** — the app never mounts the Docker socket directly; a read-only socket proxy exposes only container list and info endpoints
- **Credential encryption** — all sensitive monitor fields (API keys, tokens, passwords, private keys) encrypted at rest with AES-256-GCM when `ENCRYPTION_KEY` is set
- **Input validation** — monitor fields whitelisted on create/update; URL protocol validated (`http:`/`https:` only); AI messages capped at 50 messages × 8000 chars
- **Secure defaults** — JWT_SECRET required at startup (crashes if absent); admin password randomly generated on first start if not set; Apprise and Prometheus bound to localhost only

## AI & UX

- **Orveil AI** — built-in AI assistant (powered by Anthropic Claude) answering questions about your monitors, incidents, and SLA directly from the dashboard; API key stored encrypted in the database; model selectable from live Anthropic catalogue
- **Public status page** — shareable `/status` page (no login required) with uptime bars, open incidents, and 90-day history per service; toggle visibility per service
- **Auto / light / dark theme** — follows system preference, persisted per browser
- **FR / EN interface** — language toggle synced to notification language
- **Mobile PWA** — installable on iOS and Android, safe area insets, touch-optimized
