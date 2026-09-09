# Self-Hosted n8n on AWS EC2

[n8n](https://n8n.io) (a workflow-automation tool) running in Docker on a single
free-tier EC2 instance, served over HTTPS at **`https://n8n.builtbydhruv.com`**.
A [Caddy](https://caddyserver.com) container in front of n8n terminates TLS and
fetches/renews a free Let's Encrypt certificate automatically. DNS is handled by
Route 53: the `builtbydhruv.com` apex stays on AWS Amplify (my portfolio site),
and only the `n8n` subdomain points at this instance.

## Why this setup

| Considered | Rejected because |
|---|---|
| **ngrok free** | A `*.ngrok-free.app` URL with a browser-warning interstitial reads as temporary, and it demonstrates no transferable skill. The interstitial also breaks OAuth redirect callbacks. |
| **ECS / Fargate** | n8n is a single, stateful service. Fargate has no free tier, needs EFS or RDS for state, and typically an ALB (~$18/mo). Orchestration for one container is over-engineering. |
| **EC2 + Docker + Caddy** | Fits the 12-month free tier, no ALB cost, and exercises the fundamentals a cloud role expects: EC2, VPC security groups, Elastic IP, Route 53, a reverse proxy with automatic TLS, and running a service persistently. |

## Architecture

```
                        Internet
                           │  HTTPS :443
                           ▼
         ┌─────────────────────────────────────┐
         │  EC2  t3.micro (Amazon Linux 2023)   │
         │  Elastic IP  ·  SG: 22 / 80 / 443    │
         │                                     │
         │   caddy container  (:80, :443)      │
         │     · TLS termination                │
         │     · Let's Encrypt auto-renew       │
         │            │  http  n8n:5678         │
         │            ▼                         │
         │   n8n container  (:5678, internal)   │
         │     · volume: n8n_data → ~/.n8n      │
         └─────────────────────────────────────┘

Route 53  (builtbydhruv.com hosted zone)
  builtbydhruv.com          ALIAS → AWS Amplify   (portfolio site, unchanged)
  n8n.builtbydhruv.com   A        → Elastic IP    (this instance)
```

n8n's port `5678` is never published to the host or opened in the security group —
only Caddy, on the Docker network, can reach it.

## What I Did

1. **Launched an EC2 instance** — `t3.micro` (free-tier eligible), Amazon Linux
   2023, 20 GB gp3 root volume, auto-assigned public IP, in the default VPC.
2. **Locked down the security group** to three inbound rules only: SSH (22) from
   my IP, HTTP (80) and HTTPS (443) from anywhere. Port 80 is required for
   Let's Encrypt's HTTP-01 challenge and the HTTP→HTTPS redirect.
3. **Allocated an Elastic IP** and associated it with the instance, so the public
   address survives a stop/start and the DNS record stays valid.
4. **Added a Route 53 record** — an `A` record for `n8n` pointing at the Elastic
   IP, in the existing `builtbydhruv.com` hosted zone. This is independent of the
   Amplify apex/`www` records.
5. **Installed Docker and the Compose plugin** on the instance, and enabled the
   Docker service to start on boot.
6. **Added a 2 GB swap file** — the `t3.micro` has only 1 GB of RAM, which is
   tight for the n8n + Caddy containers.
7. **Wrote `docker-compose.yml` and `Caddyfile`** defining the two containers and
   the single routing rule (`n8n.builtbydhruv.com` → `n8n:5678`).
8. **Brought the stack up** with `docker compose up -d` and watched Caddy obtain
   the TLS certificate in its logs.
9. **Created the n8n owner account** on first load and confirmed workflows and
   Code nodes (using the `cheerio` package) run correctly.
10. **Hardened the box** — enabled automatic security updates and kept SSH scoped
    to my IP.

## Configuration

### `docker-compose.yml` environment variables

| Variable | Purpose |
|---|---|
| `N8N_HOST` / `N8N_PROTOCOL` / `N8N_PORT` | Tell n8n its public identity so generated URLs are correct. |
| `WEBHOOK_URL` | Base URL n8n hands to external services for webhook callbacks. |
| `N8N_SECURE_COOKIE` | `true` — the session cookie is HTTPS-only (safe behind Caddy). |
| `N8N_RUNNERS_ENABLED` | `true` — runs Code nodes in a separate task-runner process (recent n8n warns if off). |
| `GENERIC_TIMEZONE` | n8n's app timezone — schedule/cron triggers fire in this zone. |
| `TZ` | The container OS timezone — affects `new Date()` in Code nodes and log timestamps. Set to the same value. |
| `NODE_FUNCTION_ALLOW_EXTERNAL` | Allowlist of external npm packages importable in Code nodes. Set to `cheerio` (HTML parsing) for my scraping workflow — kept minimal since the instance is internet-facing. |

### `Caddyfile`

```
n8n.builtbydhruv.com {
	reverse_proxy n8n:5678
}
```

That one block is the whole reverse-proxy config: match the hostname, get a
certificate for it, and forward decrypted traffic to the n8n container.

## Commands

All commands run **on the EC2 instance** unless marked *(local)*.

### Connect

```bash
chmod 400 ~/Downloads/n8n.pem                                   # (local, once)
ssh -i ~/Downloads/n8n.pem ec2-user@n8n.builtbydhruv.com        # (local)
```

### Install Docker + Compose

```bash
sudo dnf update -y && sudo dnf install -y docker && sudo systemctl enable --now docker && sudo usermod -aG docker ec2-user
```

Log out and back in so the `docker` group applies, then:

```bash
mkdir -p ~/.docker/cli-plugins && curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o ~/.docker/cli-plugins/docker-compose && chmod +x ~/.docker/cli-plugins/docker-compose && docker compose version
```

### Add swap

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Deploy

Create `~/n8n/` and drop `docker-compose.yml` and `Caddyfile` into it (scp them
up, or paste). Confirm DNS resolves to the Elastic IP first — Caddy can't get a
certificate otherwise:

```bash
dig +short n8n.builtbydhruv.com
```

```bash
cd ~/n8n && docker compose up -d && docker compose logs -f caddy
```

Wait for `certificate obtained successfully`, then `Ctrl-C`. Verify:

```bash
curl -I https://n8n.builtbydhruv.com
```

### Hardening

```bash
sudo dnf install -y dnf-automatic && sudo systemctl enable --now dnf-automatic.timer
```

### Update n8n later

```bash
cd ~/n8n && docker compose pull && docker compose up -d
```

## Gotcha: `Caddyfile` mounted as a directory

Running `docker compose up` **before** creating `Caddyfile` makes Docker
auto-create the missing bind-mount source as an empty **directory**, and the next
start fails with:

```
error mounting ".../Caddyfile" to rootfs at "/etc/caddy/Caddyfile": not a directory
```

Fix — remove the bogus directory, create the real file, restart:

```bash
cd ~/n8n && docker compose down && rm -rf Caddyfile
cat > Caddyfile <<'EOF'
n8n.builtbydhruv.com {
	reverse_proxy n8n:5678
}
EOF
docker compose up -d
```

Always create the config files before the first `docker compose up`.

## Operations & resilience

| Event | Result |
|---|---|
| Reboot / AWS host maintenance | Self-healing — Docker starts on boot, `restart: unless-stopped` brings the containers back, Caddy reuses its stored cert. |
| Stop / Start | Same — the Elastic IP stays attached and the root volume persists. |
| **Terminate** | The root EBS volume is deleted by default, taking the `n8n_data` volume (workflows, credentials, encryption key) with it. |

Mitigations for termination:

- **Enable termination protection** on the instance.
- **Nightly backup to S3** — [`scripts/backup.sh`](./scripts/backup.sh) tars the
  `n8n_data` volume and uploads it (`aws s3 cp`); install it as
  `/etc/cron.daily/n8n-backup`. RPO ≈ 24 h.
- **Recovery**: launch a new instance, restore the latest tarball into a fresh
  volume, `docker compose up -d`, re-point the Route 53 record if the IP changed.
  RTO ≈ 15 min.
- The "no data loss" version: move n8n's state to **Multi-AZ RDS Postgres** and
  run the container under an **ASG (desired = 1)** or an **ECS service** so a
  terminated instance is replaced automatically.

## Files in This Directory

| File | Description |
|---|---|
| `docker-compose.yml` | The n8n + Caddy stack, with all n8n environment variables |
| `Caddyfile` | Caddy reverse-proxy config — one hostname → the n8n container |
| `scripts/backup.sh` | Nightly `tar` of the n8n data volume to S3, for `cron.daily` |
| `screenshots/` | EC2 / security group / Route 53 / Caddy cert / n8n login screenshots |

## Tech / Services Used

- **Amazon EC2** – the `t3.micro` instance running the containers
- **Amazon VPC security groups** – inbound restricted to 22 / 80 / 443
- **Elastic IP** – stable public address for the DNS record
- **Amazon Route 53** – `n8n` subdomain `A` record alongside the Amplify apex
- **Docker + Docker Compose** – container runtime and orchestration for the two services
- **Caddy** – reverse proxy and automatic Let's Encrypt TLS
- **Let's Encrypt** – free, auto-renewing TLS certificate
- **n8n** – the self-hosted workflow-automation application

## Why This Project

It shows the end-to-end path of getting a real, stateful application onto AWS and
onto my own domain over HTTPS, using the primitives directly rather than a managed
platform: a locked-down EC2 instance, an Elastic IP, a Route 53 subdomain that
coexists with the Amplify-hosted apex, and a reverse proxy handling TLS. It also
covers the operational side — automatic updates, a scripted off-box backup, and a
concrete recovery plan with an RPO/RTO — and documents a real deployment bug and
its fix.
