# Digital Ocean Deployment Guide for ClawOps

This guide walks you through deploying ClawOps on a single Digital Ocean droplet.

## Prerequisites

- Digital Ocean account
- Domain name (for SSL/HTTPS)
- Docker Hub account (if using custom images)
- SSH access to your droplet

## Recommended Droplet Specifications

### Minimum (Testing/Small Scale)
- **Size**: 4 GB RAM / 2 vCPUs
- **Storage**: 80 GB SSD
- **OS**: Ubuntu 24.04 LTS

### Recommended (Production)
- **Size**: 8 GB RAM / 4 vCPUs
- **Storage**: 160 GB SSD
- **OS**: Ubuntu 24.04 LTS

### High Traffic
- **Size**: 16 GB RAM / 8 vCPUs
- **Storage**: 320 GB SSD
- **OS**: Ubuntu 24.04 LTS

## Quick Deployment (Automated)

### Step 1: Create Digital Ocean Droplet

1. Log into Digital Ocean
2. Create a new Droplet:
   - Choose **Ubuntu 24.04 LTS**
   - Select your preferred size (minimum 4GB RAM)
   - Choose a datacenter region
   - Add your SSH key
   - Create droplet

### Step 2: Configure DNS

Point your domain to the droplet (DNS already updated for `partners.elloe.ai`):
1. Go to your domain registrar
2. Add an A record:
   - **Name**: @ (or subdomain like `clawops`)
   - **Value**: `143.198.12.229`
   - **TTL**: 300 (or default)

Wait 5-10 minutes for DNS propagation.

### Step 3: Connect to Droplet

```bash
ssh root@your-droplet-ip
```

### Step 4: Run Automated Deployment

```bash
# Download the deployment script
curl -o deploy.sh https://gitlab.com/introd1/ClawOps/-/raw/main/scripts/deploy-digitalocean.sh

# Make it executable
chmod +x deploy.sh

# Run deployment
sudo ./deploy.sh
```

The script will:
- Install Docker and dependencies
- Configure firewall
- Set up SSL certificate with Let's Encrypt (and sync certs into `/opt/clawops/ssl` for Nginx)
- Clone your repository
- Configure environment variables
- Start all services
- Set up automatic backups

### Step 5: Configure Environment

Edit the production environment file:

```bash
cd /opt/clawops
nano .env
```

**Required changes:**

1. **Database passwords** - Set strong passwords:
   ```bash
   POSTGRES_PASSWORD=your-strong-password-here
   CLICKHOUSE_PASSWORD=your-strong-password-here
   ```

2. **Security secrets** - Generate random values:
   ```bash
   # Generate secrets
   openssl rand -hex 32  # Run this 3 times for different secrets
   
   # Then set:
   SHARED_SECRET_TOKEN=<generated-value-1>
   AEAD_SECRET_KEY=<generated-value-2>
   NEXTAUTH_SECRET=<generated-value-3>
   CLAWOPS_ENGINE_API_KEY=<generated-value-4>
   ```

3. **Domain configuration**:
   ```bash
   NEXTAUTH_URL=https://partners.elloe.ai
   ```

4. **LLM API keys**:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   # Or use OpenRouter:
   OPENAI_BASE_URL=https://openrouter.ai/api/v1
   ```

5. **Admin email**:
   ```bash
   CLAWOPS_ADMIN_EMAILS=admin@elloe.ai
   ```

### Step 6: Recreate Services (Apply New Env)

After editing `.env`:

```bash
cd /opt/clawops
docker compose -f docker-compose.digitalocean.yml down
docker compose -f docker-compose.digitalocean.yml up -d
```

### Step 7: Verify Deployment

1. **Check service status**:
   ```bash
   docker compose -f docker-compose.digitalocean.yml ps
   ```

2. **View logs**:
   ```bash
   docker compose -f docker-compose.digitalocean.yml logs -f
   ```

3. **Access ClawOps**:
   - Open browser: `https://partners.elloe.ai`
   - You should see the ClawOps login page

## Manual Deployment (Step-by-Step)

If you prefer manual control, follow these steps:

### 1. Install Docker

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Install Docker Compose

```bash
sudo apt-get install docker-compose-plugin
```

### 3. Configure Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 4. Set Up SSL Certificate

```bash
# Install Certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone \
  --preferred-challenges http \
  --email your-email@example.com \
  --agree-tos \
  -d partners.elloe.ai

# Copy certs for Docker Nginx
sudo mkdir -p /opt/clawops/ssl
sudo cp -a /etc/letsencrypt/. /opt/clawops/ssl/
```

### 5. Clone Repository

```bash
sudo mkdir -p /opt/clawops
cd /opt/clawops
sudo git clone https://gitlab.com/introd1/ClawOps.git .
```

### 6. Configure Environment

```bash
# Copy example
sudo cp .env.example .env

# Edit with your values
sudo nano .env
```

### 7. Update Nginx Configuration

```bash
# Edit nginx.conf
sudo nano nginx.conf

# Replace 'partners.elloe.ai' if you use a different domain
# HTTPS is already configured in the repo nginx.conf
```

### 8. Build or Pull Images

**Option A: Use pre-built images from Docker Hub**
```bash
# Set in .env:
DOCKER_HUB_ORG=clawops
IMAGE_TAG=latest

# Pull images
docker compose -f docker-compose.digitalocean.yml pull
```

**Option B: Build images locally**
```bash
# Build all services
./scripts/build-and-push.sh latest

# Or build without pushing
docker compose -f docker-compose.digitalocean.yml build
```

### 9. Start Services

```bash
docker compose -f docker-compose.digitalocean.yml up -d
```

### 10. Set Up Backups

```bash
# Create backup script
sudo mkdir -p /opt/clawops/backups
sudo nano /opt/clawops/scripts/backup.sh
```

Add the backup script content (see automated deployment section).

```bash
# Make executable
sudo chmod +x /opt/clawops/scripts/backup.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /opt/clawops/scripts/backup.sh >> /var/log/clawops-backup.log 2>&1
```

## Post-Deployment

### Monitoring

**View logs:**
```bash
# All services
docker compose -f docker-compose.digitalocean.yml logs -f

# Specific service
docker compose -f docker-compose.digitalocean.yml logs -f frontend
docker compose -f docker-compose.digitalocean.yml logs -f clawops-engine
```

**Check resource usage:**
```bash
docker stats
```

**Check disk space:**
```bash
df -h
docker system df
```

### Maintenance

**Update ClawOps:**
```bash
cd /opt/clawops
git pull
docker compose -f docker-compose.digitalocean.yml pull
docker compose -f docker-compose.digitalocean.yml up -d
```

**Restart services:**
```bash
docker compose -f docker-compose.digitalocean.yml restart
```

**Clean up old images:**
```bash
docker system prune -a
```

### Backup and Restore

**Manual backup:**
```bash
/opt/clawops/scripts/backup.sh
```

**Restore from backup:**
```bash
# Stop services
docker compose -f docker-compose.digitalocean.yml down

# Restore PostgreSQL
gunzip < /opt/clawops/backups/postgres_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i clawops-production-postgres-1 psql -U postgres

# Start services
docker compose -f docker-compose.digitalocean.yml up -d
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker compose -f docker-compose.digitalocean.yml logs

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(80|443|5432|8123)'

# Restart Docker
sudo systemctl restart docker
```

### SSL certificate issues

```bash
# Renew certificate manually
sudo certbot renew

# Restart nginx
docker compose -f docker-compose.digitalocean.yml restart nginx
```

### Database connection errors

```bash
# Check PostgreSQL logs
docker compose -f docker-compose.digitalocean.yml logs postgres

# Verify credentials in .env match
cat .env | grep POSTGRES
```

### Out of disk space

```bash
# Check usage
df -h
docker system df

# Clean up
docker system prune -a --volumes
```

## Security Checklist

- [ ] Strong passwords for all database users
- [ ] Random secrets generated for all tokens
- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] SSL certificate installed and auto-renewing
- [ ] Database ports not exposed externally (127.0.0.1 only)
- [ ] Regular backups configured
- [ ] Admin emails configured
- [ ] OAuth providers configured (if using)
- [ ] `.env` file permissions restricted (`chmod 600 .env`)
- [ ] Regular security updates enabled

## Performance Optimization

### For high traffic:

1. **Increase database connections:**
   ```bash
   # In .env
   DATABASE_MAX_CONNECTIONS=20
   ```

2. **Enable Redis caching:**
   ```bash
   # Add Redis service to docker-compose
   # Set REDIS_URL in .env
   ```

3. **Scale services:**
   ```bash
   # Scale specific services
   docker compose -f docker-compose.digitalocean.yml up -d --scale app-server=2
   ```

4. **Upgrade droplet:**
   - Resize to larger droplet in Digital Ocean dashboard
   - No data loss, minimal downtime

## Cost Estimation

**Monthly costs (approximate):**

- **4GB Droplet**: $24/month
- **8GB Droplet**: $48/month
- **16GB Droplet**: $96/month
- **Domain**: $10-15/year
- **Backups (optional)**: $4.80-$19.20/month (20% of droplet cost)

## Support

For issues:
- Check logs: `docker compose -f docker-compose.digitalocean.yml logs`
- Review [DEPLOYMENT.md](DEPLOYMENT.md)
- Open issue on GitLab
- Contact: support@elloe.ai

---

**Next Steps:**
1. Configure OAuth providers (Google, Microsoft)
2. Set up monitoring (optional)
3. Configure custom branding
4. Invite team members
5. Connect your first agent
