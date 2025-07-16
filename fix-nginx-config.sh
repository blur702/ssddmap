#!/bin/bash

# Fix nginx configuration for ssddmap API routing
# This script needs to be run with sudo

echo "Fixing nginx configuration for ssddmap API routing..."

# Create a backup of the current config
sudo cp /etc/nginx/sites-available/kevinalthaus.com /etc/nginx/sites-available/kevinalthaus.com.backup.$(date +%Y%m%d_%H%M%S)

# Update the proxy_pass line to include the full path
sudo sed -i 's|proxy_pass http://127.0.0.1:3001/api/;|proxy_pass http://127.0.0.1:3001/ssddmap/api/;|' /etc/nginx/sites-available/kevinalthaus.com

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration is valid. Reloading nginx..."
    sudo systemctl reload nginx
    echo "nginx reloaded successfully!"
else
    echo "Configuration test failed. Restoring backup..."
    sudo cp /etc/nginx/sites-available/kevinalthaus.com.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/kevinalthaus.com
    echo "Backup restored. Please check the configuration manually."
    exit 1
fi

echo "Done! The API endpoint should now be accessible at https://kevinalthaus.com/ssddmap/api/validate-address"