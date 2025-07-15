#!/bin/bash

# Daily update script for SSDD House member data
# This script runs the comprehensive import from House.gov JSON feed

# Set working directory
cd /var/www/kevinalthaus.com/apps/ssddmap

# Log file
LOG_FILE="/var/www/kevinalthaus.com/apps/ssddmap/logs/daily-update.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Starting daily House data update ==="

# Run the import script
NODE_PATH=/var/www/kevinalthaus.com/apps/ssddmap/node_modules node /var/www/kevinalthaus.com/apps/ssddmap/database/import-house-json.js >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log "Import completed successfully"
    
    # Optional: Send success notification (uncomment if needed)
    # echo "SSDD House data updated successfully at $(date)" | mail -s "SSDD Update Success" admin@example.com
else
    log "ERROR: Import failed"
    
    # Optional: Send failure notification (uncomment if needed)
    # echo "SSDD House data update FAILED at $(date). Check logs at $LOG_FILE" | mail -s "SSDD Update FAILED" admin@example.com
fi

log "=== Daily update complete ==="
echo "" >> "$LOG_FILE"