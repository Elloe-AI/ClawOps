#!/bin/bash
# ClawOps One-Command Deployment
# Server: 143.198.12.229
# Repository: https://gitlab.com/introd1/ClawOps

echo "========================================="
echo "ClawOps Deployment to 143.198.12.229"
echo "========================================="
echo ""

# Check if running on the correct server
CURRENT_IP=$(curl -s ifconfig.me)
if [ "$CURRENT_IP" != "143.198.12.229" ]; then
    echo "⚠️  Warning: This script is designed for server 143.198.12.229"
    echo "Current IP: $CURRENT_IP"
    read -p "Continue anyway? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        exit 1
    fi
fi

# Run the main deployment script
curl -o /tmp/deploy.sh https://gitlab.com/introd1/ClawOps/-/raw/main/scripts/deploy-digitalocean.sh
chmod +x /tmp/deploy.sh
/tmp/deploy.sh
