#!/bin/bash
# Digital Ocean Droplet Deployment Script for ClawOps
# This script sets up a fresh Ubuntu droplet with ClawOps

set -e

echo "========================================="
echo "ClawOps Digital Ocean Deployment"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Get domain name
read -p "Enter your domain name (default: clawops.elloe.ai): " DOMAIN_NAME
DOMAIN_NAME=${DOMAIN_NAME:-clawops.elloe.ai}
read -p "Enter your email for SSL certificate: " SSL_EMAIL

echo ""
echo -e "${GREEN}Step 1: Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

echo ""
echo -e "${GREEN}Step 2: Installing Docker...${NC}"
# Install Docker
apt-get install -y ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker

echo ""
echo -e "${GREEN}Step 3: Installing additional tools...${NC}"
apt-get install -y git certbot python3-certbot-nginx ufw

echo ""
echo -e "${GREEN}Step 4: Configuring firewall...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
ufw status

echo ""
echo -e "${GREEN}Step 5: Creating ClawOps directory...${NC}"
mkdir -p /opt/clawops
cd /opt/clawops

echo ""
echo -e "${GREEN}Step 6: Cloning ClawOps repository...${NC}"
read -p "Enter your Git repository URL (default: https://gitlab.com/introd1/ClawOps): " GIT_REPO
GIT_REPO=${GIT_REPO:-https://gitlab.com/introd1/ClawOps}
if [ ! -z "$GIT_REPO" ]; then
    git clone "$GIT_REPO" .
else
    echo -e "${YELLOW}Skipping git clone. Please manually copy your files to /opt/clawops${NC}"
fi

echo ""
echo -e "${GREEN}Step 7: Setting up environment file...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Created .env from .env.example${NC}"
        echo -e "${YELLOW}IMPORTANT: Edit /opt/clawops/.env with your production values!${NC}"
        echo ""
        echo "Required changes:"
        echo "  - Set strong passwords for POSTGRES_PASSWORD, CLICKHOUSE_PASSWORD"
        echo "  - Generate random secrets for SHARED_SECRET_TOKEN, AEAD_SECRET_KEY, NEXTAUTH_SECRET"
        echo "  - Set NEXTAUTH_URL=https://$DOMAIN_NAME"
        echo "  - Add your OPENAI_API_KEY and other LLM credentials"
        echo "  - Set DOCKER_HUB_ORG and IMAGE_TAG if using custom images"
        echo ""
        read -p "Press Enter after you've edited the .env file..."
    else
        echo -e "${RED}No .env.example found. Please create .env manually.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Step 8: Setting up SSL certificate...${NC}"
# Stop any running nginx
systemctl stop nginx 2>/dev/null || true

# Get SSL certificate
certbot certonly --standalone \
    --preferred-challenges http \
    --email "$SSL_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN_NAME"

# Create SSL directory for Docker
mkdir -p /opt/clawops/ssl
cp -a /etc/letsencrypt/. /opt/clawops/ssl/

echo ""
echo -e "${GREEN}Step 9: Updating Nginx configuration...${NC}"
# Update nginx.conf with domain name
if [ -f nginx.conf ]; then
    sed -i "s/server_name _;/server_name $DOMAIN_NAME;/g" nginx.conf
    sed -i "s/clawops.elloe.ai/$DOMAIN_NAME/g" nginx.conf
    sed -i "s/your-domain.com/$DOMAIN_NAME/g" nginx.conf
fi

echo ""
echo -e "${GREEN}Step 10: Pulling Docker images...${NC}"
docker compose -f docker-compose.digitalocean.yml pull

echo ""
echo -e "${GREEN}Step 11: Starting ClawOps services...${NC}"
docker compose -f docker-compose.digitalocean.yml up -d

echo ""
echo -e "${GREEN}Step 12: Setting up auto-renewal for SSL...${NC}"
# Add cron job for SSL renewal + sync into /opt/clawops/ssl
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp -a /etc/letsencrypt/. /opt/clawops/ssl/ && docker compose -f /opt/clawops/docker-compose.digitalocean.yml restart nginx") | crontab -

echo ""
echo -e "${GREEN}Step 13: Setting up automatic backups...${NC}"
mkdir -p /opt/clawops/backups
mkdir -p /opt/clawops/scripts
cat > /opt/clawops/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/clawops/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker exec clawops-production-postgres-1 pg_dumpall -U postgres | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup ClickHouse (if needed)
# docker exec clickhouse clickhouse-client --query "BACKUP DATABASE default TO Disk('backups', '$DATE')"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "postgres_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/clawops/scripts/backup.sh

# Add daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/clawops/scripts/backup.sh >> /var/log/clawops-backup.log 2>&1") | crontab -

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "ClawOps is now running at: https://$DOMAIN_NAME"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose -f /opt/clawops/docker-compose.digitalocean.yml logs -f"
echo "  - Restart services: docker compose -f /opt/clawops/docker-compose.digitalocean.yml restart"
echo "  - Stop services: docker compose -f /opt/clawops/docker-compose.digitalocean.yml down"
echo "  - Update services: cd /opt/clawops && git pull && docker compose -f docker-compose.digitalocean.yml pull && docker compose -f docker-compose.digitalocean.yml up -d"
echo ""
echo "Backups are stored in: /opt/clawops/backups"
echo "Logs are in: /var/log/clawops-backup.log"
echo ""
echo -e "${YELLOW}IMPORTANT: Make sure to:${NC}"
echo "  1. Point your domain DNS A record to this droplet's IP"
echo "  2. Review and secure your .env file"
echo "  3. Set up monitoring (optional)"
echo "  4. Configure your OAuth providers (GitHub, Google) if needed"
echo ""
