// Instagram Reel Awareness Popup Script

class PopupManager {
  constructor() {
    this.elements = {};
    this.init();
  }

  async init() {
    this.cacheElements();
    this.attachEventListeners();
    await this.loadSettings();
    await this.loadStatistics();
    this.updateStatus();
  }

  cacheElements() {
    this.elements = {
      totalReels: document.getElementById('total-reels'),
      repeatedViews: document.getElementById('repeated-views'),
      totalTime: document.getElementById('total-time'),
      extensionEnabled: document.getElementById('extension-enabled'),
      showNotifications: document.getElementById('show-notifications'),
      clearData: document.getElementById('clear-data'),
      openInstagram: document.getElementById('open-instagram'),
      status: document.getElementById('status'),
      timeLimit: document.getElementById('time-limit'),
      reelLimit: document.getElementById('reel-limit'),
      enableLimits: document.getElementById('enable-limits'),
      todayUsage: document.getElementById('today-usage')
    };
  }

  attachEventListeners() {
    this.elements.extensionEnabled.addEventListener('change', (e) => {
      this.saveSetting('extensionEnabled', e.target.checked);
      this.updateStatus();
      this.notifyContentScript('toggleExtension', e.target.checked);
      this.notifyBackgroundScript('updateSettings');
    });

    this.elements.showNotifications.addEventListener('change', (e) => {
      this.saveSetting('showNotifications', e.target.checked);
      this.notifyContentScript('updateSettings');
      this.notifyBackgroundScript('updateSettings');
    });

    this.elements.clearData.addEventListener('click', () => {
      this.confirmClearData();
    });

    // Add debug button functionality
    const debugButton = document.getElementById('debug-extension');
    if (debugButton) {
      debugButton.addEventListener('click', () => {
        this.debugExtension();
      });
    }

    this.elements.openInstagram.addEventListener('click', () => {
      this.openInstagram();
    });


    // Limit settings event listeners
    this.elements.timeLimit.addEventListener('change', (e) => {
      const value = Math.max(1, Math.min(480, parseInt(e.target.value) || 60));
      e.target.value = value;
      this.saveSetting('timeLimit', value);
      this.notifyContentScript('updateSettings');
      this.notifyBackgroundScript('updateSettings');
    });

    this.elements.reelLimit.addEventListener('change', (e) => {
      const value = Math.max(10, Math.min(1000, parseInt(e.target.value) || 100));
      e.target.value = value;
      this.saveSetting('reelLimit', value);
      this.notifyContentScript('updateSettings');
      this.notifyBackgroundScript('updateSettings');
    });

    this.elements.enableLimits.addEventListener('change', (e) => {
      this.saveSetting('enableLimits', e.target.checked);
      this.notifyContentScript('updateSettings');
      this.notifyBackgroundScript('updateSettings');
    });
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get({
        extensionEnabled: true,
        showNotifications: true,
        enableLimits: true
      });

      this.elements.extensionEnabled.checked = settings.extensionEnabled;
      this.elements.showNotifications.checked = settings.showNotifications;
      this.elements.enableLimits.checked = settings.enableLimits;

      // Load user-defined limits (no defaults)
      const userLimits = await chrome.storage.local.get(['timeLimit', 'reelLimit']);

      // If no user limits set, prompt user to set them
      if (!userLimits.timeLimit || !userLimits.reelLimit) {
        await this.promptForInitialLimits();
        // Reload settings after prompting
        const updatedLimits = await chrome.storage.local.get(['timeLimit', 'reelLimit']);
        document.getElementById('time-limit').value = updatedLimits.timeLimit || '';
        document.getElementById('reel-limit').value = updatedLimits.reelLimit || '';
      } else {
        document.getElementById('time-limit').value = userLimits.timeLimit;
        document.getElementById('reel-limit').value = userLimits.reelLimit;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async promptForInitialLimits() {
    return new Promise((resolve) => {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      modal.innerHTML = `
        <div style="
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          max-width: 400px;
          width: 90%;
          text-align: center;
        ">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">Welcome to Instagram Reel Awareness!</h3>
          <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
            Set your daily limits to help maintain healthy social media habits.
          </p>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">
              Daily Time Limit (minutes):
            </label>
            <input type="number" id="initial-time-limit" min="1" max="480" value="60"
                   style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;">
          </div>

          <div style="margin-bottom: 25px;">
            <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">
              Daily Reel Limit:
            </label>
            <input type="number" id="initial-reel-limit" min="10" max="1000" value="100"
                   style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;">
          </div>

          <div style="display: flex; gap: 10px;">
            <button id="save-limits-btn" style="
              flex: 1;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              padding: 12px;
              border-radius: 6px;
              font-size: 16px;
              font-weight: 500;
              cursor: pointer;
              transition: transform 0.2s;
            ">Save Limits</button>
            <button id="skip-setup-btn" style="
              flex: 1;
              background: #f5f5f5;
              color: #666;
              border: 2px solid #ddd;
              padding: 12px;
              border-radius: 6px;
              font-size: 16px;
              cursor: pointer;
              transition: background 0.2s;
            ">Skip for Now</button>
          </div>

          <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
            You can change these limits anytime in the settings.
          </p>
        </div>
      `;

      document.body.appendChild(modal);

      const saveBtn = modal.querySelector('#save-limits-btn');
      const skipBtn = modal.querySelector('#skip-setup-btn');
      const timeInput = modal.querySelector('#initial-time-limit');
      const reelInput = modal.querySelector('#initial-reel-limit');

      saveBtn.addEventListener('click', async () => {
        const timeLimit = Math.max(1, Math.min(480, parseInt(timeInput.value) || 60));
        const reelLimit = Math.max(10, Math.min(1000, parseInt(reelInput.value) || 100));

        await this.saveSetting('timeLimit', timeLimit);
        await this.saveSetting('reelLimit', reelLimit);

        document.body.removeChild(modal);
        resolve();
      });

      skipBtn.addEventListener('click', async () => {
        // Set default values that user can change later
        const timeLimit = 60;
        const reelLimit = 100;

        await this.saveSetting('timeLimit', timeLimit);
        await this.saveSetting('reelLimit', reelLimit);

        document.body.removeChild(modal);
        resolve();
      });

      // Add hover effects
      saveBtn.addEventListener('mouseenter', () => saveBtn.style.transform = 'scale(1.02)');
      saveBtn.addEventListener('mouseleave', () => saveBtn.style.transform = 'scale(1)');

      skipBtn.addEventListener('mouseenter', () => skipBtn.style.background = '#e8e8e8');
      skipBtn.addEventListener('mouseleave', () => skipBtn.style.background = '#f5f5f5');
    });
  }

  async saveSetting(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  }

  async loadStatistics() {
    try {
      const data = await chrome.storage.local.get([
        'watchedReels',
        'totalReelsScrolled',
        'dailyStats'
      ]);
      const reels = data.watchedReels || {};
      const totalReelsScrolled = data.totalReelsScrolled || 0;
      const dailyStats = data.dailyStats || this.getDefaultDailyStats();

      // Check if we need to reset daily stats (new day)
      const today = new Date().toDateString();
      if (dailyStats.date !== today) {
        dailyStats.date = today;
        dailyStats.watchTime = 0;
        dailyStats.reelsWatched = 0;
        dailyStats.reelsScrolled = 0;
        await chrome.storage.local.set({ dailyStats });
      }

      let uniqueReels = 0;
      let repeatedViews = 0;
      let totalWatchTime = 0;

      Object.values(reels).forEach(reel => {
        if (reel.count > 0) {
          uniqueReels += 1; // Count unique reels watched at least once
        }
        if (reel.count > 1) {
          repeatedViews += (reel.count - 1); // Count repeated views (total extra watches)
        }
        totalWatchTime += reel.totalWatchTime || 0;
      });

      this.elements.totalReels.textContent = uniqueReels;
      this.elements.repeatedViews.textContent = repeatedViews;

      // Add scrolled counter to popup
      const scrolledElement = document.getElementById('total-scrolled');
      if (scrolledElement) {
        scrolledElement.textContent = totalReelsScrolled;
      }

      this.elements.totalTime.textContent = this.formatTime(totalWatchTime);

      // Update today's usage display
      this.elements.todayUsage.textContent = `${this.formatTime(dailyStats.watchTime)} / ${dailyStats.reelsScrolled} reels`;

      // Show awareness message if scrolled a lot
      this.showScrollAwareness(totalReelsScrolled);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  getDefaultDailyStats() {
    return {
      date: new Date().toDateString(),
      watchTime: 0, // in milliseconds
      reelsWatched: 0,
      reelsScrolled: 0
    };
  }

  showScrollAwareness(totalScrolled) {
    const awarenessElement = document.getElementById('scroll-awareness');
    if (!awarenessElement) return;

    let message = '';
    if (totalScrolled >= 50) {
      message = `You've scrolled through ${totalScrolled} reels today. Consider taking a break to focus on other activities.`;
    } else if (totalScrolled >= 25) {
      message = `You've viewed ${totalScrolled} reels. Remember to balance your screen time with other productive tasks.`;
    } else if (totalScrolled >= 10) {
      message = `You've scrolled through ${totalScrolled} reels. Stay mindful of your viewing habits.`;
    }

    if (message) {
      awarenessElement.textContent = message;
      awarenessElement.style.display = 'block';
    } else {
      awarenessElement.style.display = 'none';
    }
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  updateStatus() {
    const isEnabled = this.elements.extensionEnabled.checked;
    const statusElement = this.elements.status;

    statusElement.textContent = isEnabled ? 'Extension is active' : 'Extension is disabled';
    statusElement.className = isEnabled ? 'status active' : 'status inactive';
  }

  async confirmClearData() {
    const confirmed = confirm(
      'Are you sure you want to clear all reel tracking data?\n\nThis action cannot be undone.'
    );

    if (confirmed) {
      await this.clearAllData();
      await this.loadStatistics(); // Refresh stats display
      alert('All data has been cleared.');
    }
  }

  async clearAllData() {
    try {
      // Get current user-defined limits before clearing
      const currentLimits = await chrome.storage.local.get(['timeLimit', 'reelLimit']);

      await chrome.storage.local.clear();

      // Re-save settings and preserve user-defined limits
      const settings = {
        extensionEnabled: this.elements.extensionEnabled.checked,
        showNotifications: this.elements.showNotifications.checked,
        timeLimit: currentLimits.timeLimit || parseInt(document.getElementById('time-limit').value) || 60,
        reelLimit: currentLimits.reelLimit || parseInt(document.getElementById('reel-limit').value) || 100,
        enableLimits: document.getElementById('enable-limits').checked,
        totalReelsScrolled: 0,
        scrolledReels: [],
        dailyStats: {
          date: new Date().toDateString(),
          watchTime: 0,
          reelsWatched: 0,
          reelsScrolled: 0
        }
      };
      await chrome.storage.local.set(settings);
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  }

  openInstagram() {
    chrome.tabs.create({ url: 'https://www.instagram.com' });
  }


  async notifyContentScript(action, data) {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // If we're on Instagram, send message to content script
      if (tab && tab.url && tab.url.includes('instagram.com')) {
        await chrome.tabs.sendMessage(tab.id, { action, data });
      }
    } catch (error) {
      console.error('Failed to notify content script:', error);
    }
  }

  notifyBackgroundScript(action) {
    try {
      chrome.runtime.sendMessage({ action });
    } catch (error) {
      console.error('Failed to notify background script:', error);
    }
  }

  async debugExtension() {
    console.log('🔍 Starting extension debug...');

    try {
      // Get all storage data
      const allData = await chrome.storage.local.get(null);
      console.log('📦 Storage data:', allData);

      // Send debug message to content script
      await this.notifyContentScript('debug', null);

      // Show debug info in popup
      alert(`Debug Info:\n\nExtension Enabled: ${allData.extensionEnabled}\nTime Limit: ${allData.timeLimit} min\nReel Limit: ${allData.reelLimit}\nShow Notifications: ${allData.showNotifications}\nEnable Limits: ${allData.enableLimits}\n\nTotal Reels Scrolled: ${allData.totalReelsScrolled || 0}\n\nCheck browser console for detailed logs!`);

    } catch (error) {
      console.error('Debug failed:', error);
      alert('Debug failed. Check console for details.');
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.popupManager = new PopupManager();
});

