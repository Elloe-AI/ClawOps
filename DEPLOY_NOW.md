# 🚀 ClawOps Deployment - Ready to Deploy

**Server IP**: `143.198.12.229`  
**Domain**: `partners.elloe.ai`  
**Repository**: `https://gitlab.com/introd1/ClawOps`  
**Status**: Ready for deployment ✅

---

## Quick Deploy (Copy & Paste Commands)

### Step 1: Connect to Your Server

```bash
ssh root@143.198.12.229
```

### Step 2: Run Automated Deployment

```bash
# Download deployment script
curl -o deploy.sh https://gitlab.com/introd1/ClawOps/-/raw/main/scripts/deploy-digitalocean.sh

# Make executable
chmod +x deploy.sh

# Run deployment
sudo ./deploy.sh
```

**When prompted:**
- **Domain name**: `partners.elloe.ai`
- **Email**: your email for SSL
- **Git repository**: Press Enter (uses default GitLab repo)

### Step 3: Configure Environment

After the script completes:

```bash
cd /opt/clawops
nano .env
```

**Required changes in .env:**

```bash
# 1. Generate strong passwords
POSTGRES_PASSWORD=YourStrongPassword123!
CLICKHOUSE_PASSWORD=YourStrongPassword456!
CLICKHOUSE_RO_PASSWORD=YourReadOnlyPassword789!

# 2. Generate random secrets (run these commands to generate):
# openssl rand -hex 32
SHARED_SECRET_TOKEN=<paste-generated-64-char-hex>
AEAD_SECRET_KEY=<paste-generated-64-char-hex>
NEXTAUTH_SECRET=<paste-generated-64-char-hex>
CLAWOPS_ENGINE_API_KEY=<paste-generated-32-char-hex>

# 3. Set your domain
NEXTAUTH_URL=https://partners.elloe.ai

# 4. Add your LLM API key
OPENAI_API_KEY=sk-your-openai-key-here
# Or use OpenRouter:
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# 5. Set admin email
CLAWOPS_ADMIN_EMAILS=admin@elloe.ai

# 6. Docker Hub settings (use default or your own)
DOCKER_HUB_ORG=clawops
IMAGE_TAG=latest
```

**Save and exit**: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 4: Apply Env Changes

```bash
cd /opt/clawops
docker compose -f docker-compose.digitalocean.yml down
docker compose -f docker-compose.digitalocean.yml up -d
```

### Step 5: Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.digitalocean.yml ps

# View logs
docker compose -f docker-compose.digitalocean.yml logs -f
```

---

## DNS Configuration

DNS for `partners.elloe.ai` is already pointed to `143.198.12.229`.  
If you need to re-check:

```bash
nslookup partners.elloe.ai
```

---

## Useful Commands

```bash
# View all services
docker compose -f docker-compose.digitalocean.yml ps

# View logs (specific service)
docker compose -f docker-compose.digitalocean.yml logs -f frontend
docker compose -f docker-compose.digitalocean.yml logs -f clawops-engine

# Restart services
docker compose -f docker-compose.digitalocean.yml restart
```

---

## Support

**Repository**: https://gitlab.com/introd1/ClawOps  
**Support**: support@elloe.ai
