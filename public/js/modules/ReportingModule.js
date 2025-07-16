/**
 * Reporting Module - Handles data management information and status reporting
 * Extracted from scattered UI components to provide centralized reporting functionality
 */
export class ReportingModule {
  constructor () {
    this.lastCacheStatus = null;
    this.refreshInProgress = false;
    this.statusUpdateInterval = null;
  }

  /**
   * Initialize the reporting module
   */
  async initialize () {
    console.log('🔍 ReportingModule: Initializing...');
    await this.updateCacheStatus();
    this.startPeriodicUpdates();
  }

  /**
   * Get current cache status from server with accurate data
   */
  async getCacheStatus () {
    try {
      const response = await fetch('/api/cache-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      this.lastCacheStatus = data;
      return data;
    } catch (error) {
      console.error('Error fetching cache status:', error);
      throw error;
    }
  }

  /**
   * Get detailed reporting data including sync logs and data quality metrics
   */
  async getDetailedReport () {
    try {
      const response = await fetch('/api/reporting/detailed-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching detailed report:', error);
      throw error;
    }
  }

  /**
   * Refresh member cache data
   */
  async refreshMemberCache () {
    if (this.refreshInProgress) {
      return { success: false, message: 'Refresh already in progress' };
    }

    try {
      this.refreshInProgress = true;
      console.log('🔄 ReportingModule: Starting cache refresh...');

      const response = await fetch('/api/refresh-members-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ ReportingModule: Cache refresh completed');

      // Update status after refresh
      await this.updateCacheStatus();

      return result;
    } catch (error) {
      console.error('❌ ReportingModule: Cache refresh failed:', error);
      return { success: false, message: error.message };
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Update cache status display with accurate information
   */
  async updateCacheStatus () {
    try {
      const status = await this.getCacheStatus();

      // Update UI elements if they exist
      const memberCountElement = document.getElementById('member-count');
      const lastUpdateElement = document.getElementById('last-update');
      const cacheStatusElement = document.getElementById('cache-status');

      if (memberCountElement) {
        memberCountElement.textContent = status.memberCount || '0';
      }

      if (lastUpdateElement) {
        const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate) : null;
        lastUpdateElement.textContent = lastUpdate
          ? this.formatLastUpdate(lastUpdate)
          : 'Never';
      }

      if (cacheStatusElement) {
        this.updateStatusIndicator(cacheStatusElement, status);
      }

      return status;
    } catch (error) {
      console.error('Error updating cache status:', error);
      this.showErrorStatus(error.message);
      throw error;
    }
  }

  /**
   * Format last update time for display
   */
  formatLastUpdate (date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) {
      return diffMinutes === 0 ? 'Just now' : `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * Update status indicator with appropriate styling
   */
  updateStatusIndicator (element, status) {
    // Clear existing classes
    element.classList.remove('status-good', 'status-warning', 'status-error');

    const lastUpdate = status.lastUpdate ? new Date(status.lastUpdate) : null;
    const ageHours = lastUpdate ? (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60) : 999;

    if (!lastUpdate) {
      element.classList.add('status-error');
      element.textContent = 'No data';
    } else if (ageHours < 2) {
      element.classList.add('status-good');
      element.textContent = 'Current';
    } else if (ageHours < 24) {
      element.classList.add('status-warning');
      element.textContent = 'Stale';
    } else {
      element.classList.add('status-error');
      element.textContent = 'Outdated';
    }
  }

  /**
   * Show error status in UI
   */
  showErrorStatus (message) {
    const statusElements = document.querySelectorAll('.cache-status');
    statusElements.forEach(element => {
      element.classList.remove('status-good', 'status-warning');
      element.classList.add('status-error');
      element.textContent = 'Error';
      element.title = message;
    });
  }

  /**
   * Generate basic data management report display
   */
  generateBasicReport (status) {
    return `
      <div class="data-management-report">
        <div class="report-section">
          <h4>📊 Database Status</h4>
          <div class="report-grid">
            <div class="report-item">
              <span class="report-label">House Members:</span>
              <span class="report-value">${status.memberCount || 0}</span>
            </div>
            <div class="report-item">
              <span class="report-label">Congressional Districts:</span>
              <span class="report-value">${status.districtCount || 0}</span>
            </div>
            <div class="report-item">
              <span class="report-label">Counties:</span>
              <span class="report-value">${status.countyCount || 0}</span>
            </div>
            <div class="report-item">
              <span class="report-label">Committee Assignments:</span>
              <span class="report-value">${status.committeeMemberCount || 0}</span>
            </div>
          </div>
        </div>
        
        <div class="report-section">
          <h4>🕒 Last Update</h4>
          <div class="report-item">
            <span class="report-value">${status.lastUpdate ? this.formatLastUpdate(new Date(status.lastUpdate)) : 'Never'}</span>
          </div>
        </div>
        
        <div class="report-section">
          <h4>⚡ Actions</h4>
          <button id="refresh-cache-btn" class="btn btn-primary" ${this.refreshInProgress ? 'disabled' : ''}>
            ${this.refreshInProgress ? '🔄 Refreshing...' : '🔄 Refresh Cache'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show data management modal with current information
   */
  async showDataManagementModal () {
    try {
      const status = await this.getCacheStatus();
      const modalContent = this.generateBasicReport(status);

      // Create or update modal
      let modal = document.getElementById('data-management-modal');
      if (!modal) {
        modal = this.createDataManagementModal();
      }

      const modalBody = modal.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = modalContent;
        this.attachModalEventListeners();
      }

      // Show modal (assuming Bootstrap or similar modal system)
      if (modal.style) {
        modal.style.display = 'block';
      }
    } catch (error) {
      console.error('Error showing data management modal:', error);
      alert('Error loading data management information');
    }
  }

  /**
   * Create data management modal element
   */
  createDataManagementModal () {
    const modal = document.createElement('div');
    modal.id = 'data-management-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📊 Data Management</h3>
          <span class="close">&times;</span>
        </div>
        <div class="modal-body">
          <!-- Content will be populated dynamically -->
        </div>
      </div>
    `;

    // Add close functionality
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * Attach event listeners to modal elements
   */
  attachModalEventListeners () {
    const refreshBtn = document.getElementById('refresh-cache-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.handleRefreshClick();
      });
    }
  }

  /**
   * Handle refresh button click
   */
  async handleRefreshClick () {
    const refreshBtn = document.getElementById('refresh-cache-btn');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '🔄 Refreshing...';
    }

    try {
      const result = await this.refreshMemberCache();
      if (result.success) {
        // Refresh the modal content
        setTimeout(() => {
          this.showDataManagementModal();
        }, 1000);
      } else {
        alert('Cache refresh failed: ' + result.message);
      }
    } catch (error) {
      alert('Cache refresh failed: ' + error.message);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 Refresh Cache';
      }
    }
  }

  /**
   * Start periodic status updates
   */
  startPeriodicUpdates () {
    // Update every 5 minutes
    this.statusUpdateInterval = setInterval(() => {
      this.updateCacheStatus().catch(error => {
        console.error('Periodic status update failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Stop periodic status updates
   */
  stopPeriodicUpdates () {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  /**
   * Get current status for external use
   */
  getCurrentStatus () {
    return this.lastCacheStatus;
  }

  /**
   * Cleanup when destroying module
   */
  destroy () {
    this.stopPeriodicUpdates();
    this.lastCacheStatus = null;
    this.refreshInProgress = false;

    // Remove modal if it exists
    const modal = document.getElementById('data-management-modal');
    if (modal) {
      modal.remove();
    }
  }
}
