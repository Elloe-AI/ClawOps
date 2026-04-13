# ClawOps Deployment - partners.elloe.ai

## 🎯 Deployment Details

- **Domain**: `partners.elloe.ai`
- **Server IP**: `143.198.12.229`
- **Repository**: `https://gitlab.com/introd1/ClawOps`
- **Status**: ✅ Ready to deploy

---

## 🚀 Deploy in 3 Steps

### Step 0: Configure DNS (Do This First!)

**Add A Record to elloe.ai DNS:**

```
Type: A
Name: clawops
Value: 143.198.12.229
TTL: 300 (or automatic)
```

**Verify DNS propagation:**
```bash
nslookup partners.elloe.ai
# Should return: 143.198.12.229
```

Wait 5-10 minutes after adding the DNS record before proceeding.

---

### Step 1: Connect to Server
```bash
ssh root@143.198.12.229
```

### Step 2: Run Deployment Script
```bash
bash <(curl -s https://gitlab.com/introd1/ClawOps/-/raw/main/scripts/deploy-digitalocean.sh)
```

**When prompted, enter:**
- **Domain name**: `partners.elloe.ai`
- **Email**: `owen@elloe.ai` (or your email)
- **Git repository**: Press `Enter` (uses default)

The script will automatically:
- Install Docker
- Configure firewall
- Get SSL certificate for partners.elloe.ai
- Clone repository
- Start all services

---

### Step 3: Configure Environment

After the script completes:

```bash
cd /opt/clawops
```

**Generate secrets:**
```bash
echo "SHARED_SECRET_TOKEN=$(openssl rand -hex 32)"
echo "AEAD_SECRET_KEY=$(openssl rand -hex 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)"
echo "CLAWOPS_ENGINE_API_KEY=$(openssl rand -hex 32)"
```

**Edit environment file:**
```bash
nano .env
```

**Update these values:**
```bash
# Database passwords (create strong ones)
POSTGRES_PASSWORD=YourStrongPassword123!
CLICKHOUSE_PASSWORD=YourStrongPassword456!
CLICKHOUSE_RO_PASSWORD=YourReadOnlyPassword789!

# Security secrets (paste from above)
SHARED_SECRET_TOKEN=<paste-generated-value>
AEAD_SECRET_KEY=<paste-generated-value>
NEXTAUTH_SECRET=<paste-generated-value>
CLAWOPS_ENGINE_API_KEY=<paste-generated-value>

# Domain configuration
NEXTAUTH_URL=https://partners.elloe.ai

# LLM API Key
OPENAI_API_KEY=sk-your-openai-key-here
# Or use OpenRouter:
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini

# Admin configuration
CLAWOPS_ADMIN_EMAILS=admin@elloe.ai

# Docker configuration
DOCKER_HUB_ORG=clawops
IMAGE_TAG=latest
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

**Recreate services (apply new env values):**
```bash
docker compose -f docker-compose.digitalocean.yml down
docker compose -f docker-compose.digitalocean.yml up -d
```

---

### Step 4: Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.digitalocean.yml ps

# View logs
docker compose -f docker-compose.digitalocean.yml logs -f
```

**Access ClawOps:**
Open browser: **https://partners.elloe.ai**

---

## 📋 DNS Configuration Details

### For elloe.ai Domain

Add this A record in your DNS provider (Cloudflare, Route53, etc.):

| Type | Name | Value | TTL | Proxy |
|------|------|-------|-----|-------|
| A | clawops | 143.198.12.229 | 300 | DNS only (no proxy) |

**Important:** If using Cloudflare, set to "DNS only" (gray cloud), not "Proxied" (orange cloud), during initial setup.

---

## 🔧 Services Running

After deployment, these services will be available:

| Service | Internal Port | External Access |
|---------|---------------|-----------------|
| Frontend | 3000 | https://partners.elloe.ai |
| App Server | 8000, 8001, 8002 | Internal only |
| ClawOps Engine | 8006 | Internal only |
| Query Engine | 8903 | Internal only |
| PostgreSQL | 5432 | Localhost only |
| ClickHouse | 8123 | Localhost only |
| Quickwit | 7280, 7281 | Localhost only |
| Nginx | 80, 443 | Public (HTTPS) |

---

## 🛠️ Common Commands

### Service Management
```bash
# View all services
docker compose -f docker-compose.digitalocean.yml ps

# View logs (all services)
docker compose -f docker-compose.digitalocean.yml logs -f

# View logs (specific service)
docker compose -f docker-compose.digitalocean.yml logs -f frontend
docker compose -f docker-compose.digitalocean.yml logs -f clawops-engine

# Restart all services
docker compose -f docker-compose.digitalocean.yml restart

# Restart specific service
docker compose -f docker-compose.digitalocean.yml restart frontend

# Stop all services
docker compose -f docker-compose.digitalocean.yml down

# Start all services
docker compose -f docker-compose.digitalocean.yml up -d
```

### Monitoring
```bash
# Resource usage
docker stats

# Disk space
df -h
docker system df

# Service health
curl https://partners.elloe.ai
curl http://localhost:8006/api/v1/health
curl http://localhost:8000/health
```

### Updates
```bash
cd /opt/clawops
git pull
docker compose -f docker-compose.digitalocean.yml pull
docker compose -f docker-compose.digitalocean.yml up -d
```

### Backups
```bash
# Manual backup
/opt/clawops/scripts/backup.sh

# List backups
ls -lh /opt/clawops/backups/

# View backup logs
tail -f /var/log/clawops-backup.log

# Restore from backup
gunzip < /opt/clawops/backups/postgres_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i clawops-production-postgres-1 psql -U postgres
```

---

## 🔍 Troubleshooting

### Can't access partners.elloe.ai

```bash
# 1. Check DNS
nslookup partners.elloe.ai
# Should return: 143.198.12.229

# 2. Check Nginx
docker compose -f docker-compose.digitalocean.yml logs nginx

# 3. Check SSL certificate
certbot certificates

# 4. Check firewall
ufw status
# Should show: 80/tcp, 443/tcp ALLOW
```

### Services won't start

```bash
# Check logs
docker compose -f docker-compose.digitalocean.yml logs

# Check if ports are in use
netstat -tulpn | grep -E ':(80|443|5432)'

# Restart Docker
systemctl restart docker
```

### Database connection errors

```bash
# Check PostgreSQL
docker compose -f docker-compose.digitalocean.yml logs postgres

# Test connection
docker exec -it clawops-production-postgres-1 psql -U postgres

# Verify credentials
cat .env | grep POSTGRES
```

### SSL certificate issues

```bash
# Check certificate status
certbot certificates

# Renew manually
certbot renew

# Restart Nginx
docker compose -f docker-compose.digitalocean.yml restart nginx
```

---

## 🔒 Security Checklist

After deployment, verify:

- [ ] DNS A record for partners.elloe.ai points to 143.198.12.229
- [ ] Strong passwords set for PostgreSQL and ClickHouse
- [ ] Random 64-char hex secrets generated for all tokens
- [ ] Firewall enabled (only ports 22, 80, 443 open)
- [ ] SSL certificate installed for partners.elloe.ai
- [ ] Database ports not exposed externally (127.0.0.1 only)
- [ ] `.env` file permissions: `chmod 600 /opt/clawops/.env`
- [ ] Backups configured (daily at 2 AM)
- [ ] SSL auto-renewal configured (daily at 3 AM)
- [ ] Admin emails set to @elloe.ai addresses

---

## 📊 What Gets Installed

The deployment script automatically installs:

✅ **Docker & Docker Compose**  
✅ **Nginx** (reverse proxy with SSL)  
✅ **Let's Encrypt SSL** (for partners.elloe.ai)  
✅ **UFW Firewall** (ports 22, 80, 443)  
✅ **PostgreSQL 16** (database)  
✅ **ClickHouse** (analytics database)  
✅ **Quickwit** (search engine)  
✅ **ClawOps Services**:
  - Frontend (Next.js)
  - App Server (Rust)
  - ClawOps Engine (Python)
  - Query Engine (Python)  
✅ **Automatic Backups** (daily at 2 AM UTC)  
✅ **SSL Auto-Renewal** (daily at 3 AM UTC)  

---

## 📞 Support & Access

**Production URL**: https://partners.elloe.ai  
**Server IP**: 143.198.12.229  
**Repository**: https://gitlab.com/introd1/ClawOps  

**Admin Email**: admin@elloe.ai  
**Support Email**: support@elloe.ai  

**Documentation:**
- Quick Reference: `QUICK_DEPLOY_ELLOE.txt`
- Detailed Guide: `DIGITALOCEAN_DEPLOYMENT.md`
- Full Walkthrough: `README_DEPLOY.md`

---

## ✅ Post-Deployment Steps

After successful deployment:

1. **Access ClawOps**: https://partners.elloe.ai
2. **Create admin account**: Use admin@elloe.ai email
3. **Configure OAuth** (optional):
   - Add GitHub/Google OAuth credentials to `.env`
   - Restart frontend: `docker compose -f docker-compose.digitalocean.yml restart frontend`
4. **Create first project**: Use ClawOps UI
5. **Register first agent**: Follow agent setup wizard
6. **Run mandatory demo**: Required before going live
7. **Go live**: Start monitoring your AI agents

---

## 💰 Cost Estimate

**Recommended Setup (8GB Droplet):**
- Digital Ocean Droplet (8GB): $48/month
- Domain (elloe.ai already owned): $0
- Backups (optional): $9.60/month
- SSL Certificate (Let's Encrypt): Free
- **Total**: ~$48-58/month

---

**Ready to deploy to partners.elloe.ai!** 🚀

Start with DNS configuration, then run the deployment script.
