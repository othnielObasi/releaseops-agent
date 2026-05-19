# Deploy ReleaseOps Agent on Vultr

This repo is ready to run on a single Vultr Cloud Compute Ubuntu instance with Docker Compose:

- `postgres` stores users, sessions, gates, teams, audit logs, and share tokens.
- `backend` serves FastAPI on container port `3001`.
- `frontend` serves the Vite build through Nginx on ports `80` and `443`, and proxies `/api/*` to the backend.

## 1. Create the Vultr Instance

Use a Vultr Cloud Compute Ubuntu LTS instance. For a first deployment, choose at least:

- 2 vCPU
- 4 GB RAM
- 80 GB disk

Open inbound firewall ports:

- `22/tcp` for SSH
- `80/tcp` for HTTP
- `443/tcp` for HTTPS, if you add certificates

Attach the cloud-init file in this folder when provisioning, or run its commands manually after SSH.

## 2. SSH to the Server

```bash
ssh root@YOUR_VULTR_IP
```

Confirm Docker is installed:

```bash
docker --version
docker compose version
```

## 3. Clone the Repo

```bash
mkdir -p /opt/releaseops
cd /opt/releaseops
git clone https://github.com/othnielObasi/releaseops-agent.git .
```

## 4. Create Environment Files

Create the root compose env:

```bash
cat > .env <<'EOF'
POSTGRES_PASSWORD=replace-with-a-long-random-password
EOF
```

Create the backend env:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

At minimum, set:

```env
JWT_SECRET=replace-with-a-long-random-token
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=replace-with-a-strong-password
DEMO_MODE=true
DATABASE_URL=postgresql://launchguard:replace-with-a-long-random-password@postgres:5432/launchguard
```

Use the same password in `.env` and `backend/.env`.

For real LLM calls, set `DEMO_MODE=false` and provide either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

## 5. Start Backend and Frontend

```bash
docker compose up -d --build postgres backend frontend
```

Check health:

```bash
docker compose ps
curl -f http://127.0.0.1/health
```

Visit:

```text
http://YOUR_VULTR_IP/
```

The frontend container proxies `/api/*` to the backend container, so login/signup should work from the same public URL.

## Current Deployment

ReleaseOps Agent is currently deployed to:

```text
http://45.32.176.216/
```

Vultr instance:

```text
label: releaseops-agent
region: lhr
plan: vc2-2c-4gb
instance_id: e058866a-b047-4a39-a99e-de1da60bad53
```

SSH from this workstation:

```powershell
ssh -i .vultr\releaseops_vultr -o UserKnownHostsFile=.vultr\known_hosts root@45.32.176.216
```

The private key lives at `.vultr\releaseops_vultr` and is ignored by git.

## 6. Add HTTPS

The frontend image automatically switches to HTTPS if these files exist on the host:

```text
./certs/fullchain.pem
./certs/privkey.pem
```

After adding certificates:

```bash
docker compose restart frontend
```

Without certificates, the app serves HTTP on port `80`.

## 7. Update Deployment

```bash
cd /opt/releaseops
git pull
docker compose up -d --build postgres backend frontend
docker compose ps
```

## Troubleshooting

If login shows that the backend API is unavailable:

```bash
docker compose logs --tail=120 backend
docker compose ps
curl -i http://127.0.0.1/health
```

If the backend cannot connect to Postgres, verify that `POSTGRES_PASSWORD` and `DATABASE_URL` use the same password.

If the frontend loads but API calls fail, confirm the `backend` service is healthy and that the Nginx config is active:

```bash
docker compose exec frontend nginx -T | grep backend:3001
```
