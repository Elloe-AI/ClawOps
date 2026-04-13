# ClawOps Deployment - Server 143.198.12.229

## 🎯 Your Deployment Details

- **Server IP**: `143.198.12.229`
- **Repository**: `https://gitlab.com/introd1/ClawOps`
- **Status**: ✅ Ready to deploy

---

## 🚀 Deploy in 60 Seconds

### Step 1: Connect to Server
```bash
ssh root@143.198.12.229
```

### Step 2: Run One-Command Deploy
```bash
bash <(curl -s https://gitlab.com/introd1/ClawOps/-/raw/main/scripts/deploy-digitalocean.sh)
```

**When prompted, enter:**
- Your domain name (`partners.elloe.ai`)
- Your email for SSL certificate
- Press Enter for repository (uses default: `https://gitlab.com/introd1/ClawOps`)

### Step 3: Configure Environment
```bash
cd /opt/clawops
nano .env
```

**Generate secrets first:**
```bash
# Run these 4 times and copy each output
openssl rand -hex 32
```

**Update these values in .env:**
```bash
POSTGRES_PASSWORD=YourStrongPassword123!
CLICKHOUSE_PASSWORD=YourStrongPassword456!
SHARED_SECRET_TOKEN=<paste-secret-1>
AEAD_SECRET_KEY=<paste-secret-2>
NEXTAUTH_SECRET=<paste-secret-3>
CLAWOPS_ENGINE_API_KEY=<paste-secret-4>
NEXTAUTH_URL=https://partners.elloe.ai
OPENAI_API_KEY=sk-your-openai-key
CLAWOPS_ADMIN_EMAILS=admin@elloe.ai
```

Save: `Ctrl+X`, `Y`, `Enter`

### Step 4: Recreate Services (Apply New Env)
```bash
docker compose -f docker-compose.digitalocean.yml down
docker compose -f docker-compose.digitalocean.yml up -d
```

### Step 5: Verify
```bash
docker compose -f docker-compose.digitalocean.yml ps
```

**Access ClawOps**: `https://partners.elloe.ai`

---

## 📍 DNS Configuration (Do This First!)

Before deploying, point your domain to the server:

1. Go to your domain registrar (Namecheap, GoDaddy, etc.)
2. Add an **A Record**:
   ```
   Type: A
   Name: @ (or subdomain like "clawops")
   Value: 143.198.12.229
   TTL: 300
   ```
3. Wait 5-10 minutes for DNS propagation
4. Verify: `nslookup partners.elloe.ai` should return `143.198.12.229`

---

## 📋 Pre-Deployment Checklist

Before you start, make sure you have:

- [ ] Domain name registered
- [ ] DNS A record pointing to `143.198.12.229`
- [ ] OpenAI API key (or other LLM provider)
- [ ] Email address for SSL certificate
- [ ] SSH access to the server

---

## 🔧 What Gets Installed

The deployment script automatically installs and configures:

✅ **Docker & Docker Compose**  
✅ **Nginx** (reverse proxy with SSL)  
✅ **Let's Encrypt SSL** (auto-renewing)  
✅ **UFW Firewall** (ports 22, 80, 443)  
✅ **PostgreSQL** (database)  
✅ **ClickHouse** (analytics)  
✅ **Quickwit** (search)  
✅ **ClawOps Services** (frontend, app-server, clawops-engine, query-engine)  
✅ **Automatic Backups** (daily at 2 AM)  
✅ **SSL Auto-Renewal** (daily at 3 AM)  

---

## 📊 Services Running

After deployment, these services will be running:

| Service | Port | Access |
|---------|------|--------|
| **Frontend** | 3000 | Via Nginx (HTTPS) |
| **App Server** | 8000, 8001, 8002 | Internal |
| **ClawOps Engine** | 8006 | Internal |
| **Query Engine** | 8903 | Internal |
| **PostgreSQL** | 5432 | Localhost only |
| **ClickHouse** | 8123 | Localhost only |
| **Quickwit** | 7280, 7281 | Localhost only |
| **Nginx** | 80, 443 | Public |

---

## 🛠️ Common Commands

### Service Management
```bash
# View all services
docker compose -f docker-compose.digitalocean.yml ps

# View logs (all)
docker compose -f docker-compose.digitalocean.yml logs -f

# View logs (specific service)
docker compose -f docker-compose.digitalocean.yml logs -f frontend
docker compose -f docker-compose.digitalocean.yml logs -f clawops-engine

# Restart all
docker compose -f docker-compose.digitalocean.yml restart

# Restart specific service
docker compose -f docker-compose.digitalocean.yml restart frontend

# Stop all
docker compose -f docker-compose.digitalocean.yml down

# Start all
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
curl http://localhost:3000
curl http://localhost:8006/api/v1/health
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

# Restore
gunzip < /opt/clawops/backups/postgres_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i clawops-production-postgres-1 psql -U postgres
```

---

## 🔍 Troubleshooting

### Services won't start
```bash
# Check logs
docker compose -f docker-compose.digitalocean.yml logs

# Check ports
netstat -tulpn | grep -E ':(80|443|5432)'

# Restart Docker
systemctl restart docker
```

### Can't access website
```bash
# Check Nginx
docker compose -f docker-compose.digitalocean.yml logs nginx

# Verify DNS
nslookup partners.elloe.ai

# Check firewall
ufw status
```

### Database errors
```bash
# Check PostgreSQL
docker compose -f docker-compose.digitalocean.yml logs postgres

# Test connection
docker exec -it clawops-production-postgres-1 psql -U postgres

# Verify .env
cat .env | grep POSTGRES
```

### SSL issues
```bash
# Check certificate
certbot certificates

# Renew manually
certbot renew

# Restart Nginx
docker compose -f docker-compose.digitalocean.yml restart nginx
```

---

## 🔒 Security Checklist

After deployment:

- [ ] Strong passwords set for all databases
- [ ] Random secrets generated (64-char hex)
- [ ] Firewall enabled (only 22, 80, 443 open)
- [ ] SSL certificate installed and working
- [ ] Database ports not exposed externally
- [ ] `.env` file secured: `chmod 600 /opt/clawops/.env`
- [ ] Backups configured and running
- [ ] SSL auto-renewal configured
- [ ] Admin emails set
- [ ] SSH key authentication enabled

---

## 💰 Cost Estimate

**Recommended Setup (8GB Droplet):**
- Droplet: $48/month
- Domain: ~$1/month (amortized)
- Backups: $9.60/month (optional)
- **Total**: ~$50-60/month

---

## 📞 Support

**Server**: `143.198.12.229`  
**Repository**: https://gitlab.com/introd1/ClawOps  

**Documentation:**
- Quick Start: This file
- Detailed Guide: `DIGITALOCEAN_DEPLOYMENT.md`
- Quick Reference: `QUICK_DEPLOY.txt`

**Need Help?**
- Check logs: `docker compose -f docker-compose.digitalocean.yml logs -f`
- Review troubleshooting section above
- Contact: support@elloe.ai

---

## ✅ Post-Deployment

After successful deployment:

1. **Access ClawOps**: `https://partners.elloe.ai`
2. **Create admin account**: Follow on-screen instructions
3. **Configure OAuth** (optional): Add GitHub/Google credentials to `.env`
4. **Create first project**: Use ClawOps UI
5. **Connect first agent**: Follow the agent setup wizard

---

**Ready to deploy!** 🚀

Start with Step 1 and you'll be live in minutes.
