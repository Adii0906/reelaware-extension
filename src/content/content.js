// Instagram Reel Awareness Extension
class ReelTracker {
  constructor() {
    this.watchedReels = new Map();
    this.activeReel = null;
    this.observer = null;
    this.notificationElement = null;
    this.settings = {
      extensionEnabled: true,
      showNotifications: true,
      enableLimits: true
      // timeLimit and reelLimit will be loaded from storage
    };
    this.totalReelsScrolled = 0;
    this.scrolledReels = new Set(); // Track reels that have been counted as scrolled
    this.dailyStats = null;
    this.limitAlertInterval = null;
    this.isShowingLimitAlert = false;
    this.snoozeUntil = null;
    this.snoozeTimeout = null; // Timeout ID to auto-resume after snooze ends
    this.limitAlertCount = 0;
    this.lastPositiveNotification = 0; // Timestamp of last positive notification
    this.periodicCheckInterval = null;
    this.statusLogInterval = null;
    this.init();
  }

  async init() {
    console.log('Instagram Reel Awareness: Initializing...');

    // Load settings first
    await this.loadSettings();

    // If extension is disabled, don't initialize tracking
    if (!this.settings.extensionEnabled) {
      console.log('Instagram Reel Awareness: Extension disabled');
      return;
    }

    // Load previously watched reels from storage
    await this.loadWatchedReels();

    // Load scroll counter
    await this.loadScrollCounter();

    // Load daily stats
    await this.loadDailyStats();

    // Start observing DOM changes
    this.startObserving();

    // Check for existing reels on page load
    this.checkForReels();

    // Listen for messages from popup
    this.setupMessageListener();

    // Start periodic checks to ensure videos are being tracked
    this.startPeriodicChecks();

    console.log('✅ Instagram Reel Awareness: Initialization complete');
  }

  startPeriodicChecks() {
    // Clear any existing intervals first
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
    }
    if (this.statusLogInterval) {
      clearInterval(this.statusLogInterval);
    }

    // Check for new videos every 5 seconds
    this.periodicCheckInterval = setInterval(() => {
      if (this.settings.extensionEnabled) {
        this.checkForReels();
      }
    }, 5000);

    // Log current tracking status every 30 seconds
    this.statusLogInterval = setInterval(() => {
      console.log('📈 Tracking Status:', {
        extensionEnabled: this.settings.extensionEnabled,
        totalReelsTracked: this.watchedReels.size,
        totalReelsScrolled: this.totalReelsScrolled,
        activeReel: this.activeReel,
        dailyWatchTime: this.dailyStats ? Math.round(this.dailyStats.watchTime / 1000) : 0,
        dailyReelsWatched: this.dailyStats ? this.dailyStats.reelsWatched : 0
      });
    }, 30000);
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get({
        extensionEnabled: true,
        showNotifications: true,
        enableLimits: true
      });

      // Load user-defined limits separately
      const userLimits = await chrome.storage.local.get(['timeLimit', 'reelLimit']);

      this.settings = {
        ...settings,
        timeLimit: userLimits.timeLimit || 60, // Fallback only if no user setting exists
        reelLimit: userLimits.reelLimit || 100  // Fallback only if no user setting exists
      };

      console.log('Settings loaded:', this.settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async loadWatchedReels() {
    try {
      const result = await chrome.storage.local.get(['watchedReels']);
      if (result.watchedReels) {
        // Convert stored object back to Map
        this.watchedReels = new Map(Object.entries(result.watchedReels));
      }
    } catch (error) {
      console.error('Failed to load watched reels:', error);
    }
  }

  async loadScrollCounter() {
    try {
      const result = await chrome.storage.local.get(['totalReelsScrolled', 'scrolledReels']);
      this.totalReelsScrolled = result.totalReelsScrolled || 0;
      this.scrolledReels = new Set(result.scrolledReels || []);
    } catch (error) {
      console.error('Failed to load scroll counter:', error);
    }
  }

  async saveScrollCounter() {
    try {
      await chrome.storage.local.set({
        totalReelsScrolled: this.totalReelsScrolled,
        scrolledReels: Array.from(this.scrolledReels)
      });
    } catch (error) {
      console.error('Failed to save scroll counter:', error);
    }
  }

  async loadDailyStats() {
    try {
      const result = await chrome.storage.local.get(['dailyStats']);
      const today = new Date().toDateString();

      if (result.dailyStats && result.dailyStats.date === today) {
        this.dailyStats = result.dailyStats;
      } else {
        // New day or no stats yet
        this.dailyStats = {
          date: today,
          watchTime: 0,
          reelsWatched: 0,
          reelsScrolled: 0
        };
        await this.saveDailyStats();
      }

      console.log('Daily stats loaded:', this.dailyStats);
    } catch (error) {
      console.error('Failed to load daily stats:', error);
    }
  }

  async saveDailyStats() {
    try {
      await chrome.storage.local.set({ dailyStats: this.dailyStats });
      console.log('Daily stats saved:', {
        date: this.dailyStats.date,
        watchTime: Math.round(this.dailyStats.watchTime / 1000),
        reelsWatched: this.dailyStats.reelsWatched,
        reelsScrolled: this.dailyStats.reelsScrolled
      });
    } catch (error) {
      console.error('❌ Failed to save daily stats:', error);
      throw error; // Re-throw to catch in calling function
    }
  }

  async saveScrollCounter() {
    try {
      await chrome.storage.local.set({ totalReelsScrolled: this.totalReelsScrolled });
    } catch (error) {
      console.error('Failed to save scroll counter:', error);
    }
  }

  async saveWatchedReels() {
    try {
      // Convert Map to object for storage
      const reelsObject = Object.fromEntries(this.watchedReels);
      const reelsCount = this.watchedReels.size;

      await chrome.storage.local.set({ watchedReels: reelsObject });

      console.log(`Saved ${reelsCount} watched reels to storage`);
    } catch (error) {
      console.error('❌ Failed to save watched reels:', error);
      throw error; // Re-throw to catch in calling function
    }
  }

  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForReels(node);
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  checkForReels(rootElement = document) {
    console.log('Checking for reels in:', rootElement === document ? 'document' : 'element');

    // Try multiple selectors for Instagram Reels - more comprehensive
    const selectors = [
      'video', // General videos
      'article video', // Videos within article elements
      '[role="presentation"] video', // Videos in presentation roles
      '[data-testid*="reel"] video', // Videos with reel test IDs
      '[data-testid*="video"] video', // Videos with video test IDs
      'div[role="button"] video', // Videos in button containers
      '.x1lliihq video', // Common Instagram container class
      '[data-visualcompletion="media-vc"] video', // Instagram media completion
    ];

    let foundVideos = 0;

    selectors.forEach(selector => {
      try {
        const videos = rootElement.querySelectorAll(selector);
        videos.forEach((video) => {
          if (!video.hasAttribute('data-reel-tracked') && this.isReelVideo(video)) {
            console.log('Found untracked video:', video.src?.substring(0, 50), 'with selector:', selector);
            this.trackReel(video);
            foundVideos++;
          }
        });
      } catch (error) {
        console.warn('Error with selector:', selector, error);
      }
    });

    console.log(`Found ${foundVideos} new videos to track`);

    // Also check for videos that might have been missed by periodic scanning
    if (rootElement === document && foundVideos === 0) {
      // Fallback: check all videos on the page
      try {
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach((video) => {
          if (!video.hasAttribute('data-reel-tracked') && this.isReelVideo(video)) {
            console.log('Found missed video via fallback scan:', video.src?.substring(0, 50));
            this.trackReel(video);
            foundVideos++;
          }
        });
      } catch (error) {
        console.warn('Error in fallback video scan:', error);
      }
    }
  }

  isReelVideo(videoElement) {
    // Check if this video is likely a reel
    const rect = videoElement.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;

    // More relaxed detection for Instagram videos
    const hasInstagramSrc = videoElement.src && (
      videoElement.src.includes('instagram.com') ||
      videoElement.src.includes('cdninstagram.com') ||
      videoElement.src.includes('fbcdn.net')
    );

    // Check for various Instagram container patterns
    const hasReelContainer = videoElement.closest('[data-testid*="reel"]') ||
                           videoElement.closest('article') ||
                           videoElement.closest('[role="presentation"]') ||
                           videoElement.closest('[data-testid*="media"]') ||
                           videoElement.closest('.x1lliihq'); // Common Instagram class

    // Check for video attributes that indicate Instagram content
    const hasInstagramAttributes = videoElement.hasAttribute('playsinline') ||
                                  videoElement.hasAttribute('webkit-playsinline') ||
                                  videoElement.closest('[data-testid*="video"]');

    // Check if video is in a reasonable size range for Instagram reels (roughly square or vertical)
    const aspectRatio = rect.width > 0 ? rect.height / rect.width : 0;
    const isReelSize = aspectRatio > 1.2 || (aspectRatio > 0.8 && aspectRatio < 1.3); // Vertical or roughly square

    // More permissive detection
    const isLikelyReel = isVisible && (
      hasInstagramSrc ||
      hasReelContainer ||
      hasInstagramAttributes ||
      isReelSize
    );

    console.log('Video detection for:', {
      src: videoElement.src?.substring(0, 50),
      visible: isVisible,
      hasInstagramSrc,
      hasReelContainer,
      hasInstagramAttributes,
      aspectRatio: aspectRatio.toFixed(2),
      isReelSize,
      isLikelyReel
    });

    return isLikelyReel;
  }

  trackReel(videoElement) {
    try {
      videoElement.setAttribute('data-reel-tracked', 'true');

      // Get reel identifier - try different methods
      const reelId = this.getReelId(videoElement);

      if (reelId) {
        console.log('Tracking reel:', reelId, 'Video src:', videoElement.src?.substring(0, 50));

        // Initialize watch data if not exists
        if (!this.watchedReels.has(reelId)) {
          this.watchedReels.set(reelId, {
            count: 0,
            lastWatched: null,
            totalWatchTime: 0
          });
        }

        // Check if this reel has been watched 3+ times and show notification
        const reelData = this.watchedReels.get(reelId);
        console.log(`Checking notification for reel ${reelId}:`, {
          hasData: !!reelData,
          count: reelData?.count,
          showNotifications: this.settings.showNotifications
        });

        if (reelData && reelData.count >= 3) {
          console.log(`Showing notification for reel ${reelId} (watched ${reelData.count} times)`);
          this.showNotification(reelId);
        }

        // Add event listeners
        this.addVideoListeners(videoElement, reelId);

        console.log(`Successfully tracked reel ${reelId}`);
      } else {
        console.warn('Could not get reel ID for video element');
      }
    } catch (error) {
      console.error('Error tracking reel:', error);
    }
  }

  getReelId(videoElement) {
    console.log('Getting reel ID for video');

    // Method 1: Look for URL patterns in nearby links (most reliable)
    let container = videoElement.closest('article') || videoElement.closest('[role="presentation"]') || videoElement.closest('[data-testid*="reel"]');
    if (container) {
      const links = container.querySelectorAll('a[href*="/reel/"]');
      if (links.length > 0) {
        const href = links[0].getAttribute('href');
        const match = href.match(/\/reel\/([^\/?]+)/);
        if (match) {
          console.log('Found reel ID from URL:', match[1]);
          return match[1];
        }
      }

      // Try other URL patterns
      const allLinks = container.querySelectorAll('a[href]');
      for (const link of allLinks) {
        const href = link.getAttribute('href');
        if (href && href.includes('/p/')) {
          const match = href.match(/\/p\/([^\/?]+)/);
          if (match) {
            console.log('Found post ID from URL:', match[1]);
            return match[1];
          }
        }
      }
    }

    // Method 2: Look for data attributes
    container = videoElement.closest('[data-testid]');
    if (container) {
      const testId = container.getAttribute('data-testid');
      if (testId && (testId.includes('reel') || testId.includes('video'))) {
        console.log('Found reel ID from data-testid:', testId);
        return testId;
      }
    }

    // Method 3: Use video source URL (more reliable)
    if (videoElement.src && videoElement.src.includes('instagram.com')) {
      try {
        const url = new URL(videoElement.src);
        const pathParts = url.pathname.split('/').filter(p => p);
        console.log('Video URL path parts:', pathParts);

        // Look for reel ID in URL path
        const reelIndex = pathParts.findIndex(part => part === 'reel');
        if (reelIndex !== -1 && pathParts[reelIndex + 1]) {
          console.log('Found reel ID from video src:', pathParts[reelIndex + 1]);
          return pathParts[reelIndex + 1];
        }

        // Try to extract ID from query parameters
        const urlParams = new URLSearchParams(url.search);
        const mediaId = urlParams.get('media_id') || urlParams.get('id');
        if (mediaId) {
          console.log('Found media ID from URL params:', mediaId);
          return mediaId;
        }
      } catch (e) {
        console.log('❌ Error parsing video URL:', e);
      }
    }

    // Method 4: Use poster URL or other attributes
    if (videoElement.poster && videoElement.poster.includes('instagram.com')) {
      try {
        const posterUrl = new URL(videoElement.poster);
        const pathParts = posterUrl.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          const id = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
          console.log('Found ID from poster URL:', id);
          return id;
        }
      } catch (e) {
        console.log('❌ Error parsing poster URL:', e);
      }
    }

    // Method 5: Container attributes
    container = videoElement.closest('article') || videoElement.closest('[role="presentation"]') || videoElement.closest('div');
    if (container) {
      const id = container.getAttribute('id') || container.getAttribute('data-id') || container.getAttribute('data-media-id');
      if (id) {
        console.log('Found container ID:', id);
        return id;
      }
    }

    // Method 6: Generate stable ID based on video properties
    const videoProps = [
      videoElement.src?.split('?')[0], // Remove query params
      videoElement.poster,
      videoElement.getAttribute('data-video-id'),
      videoElement.getAttribute('data-media-id')
    ].filter(Boolean);

    if (videoProps.length > 0) {
      const stableId = btoa(videoProps.join('|')).substring(0, 16);
      console.log('Generated stable ID:', stableId);
      return stableId;
    }

    // Method 7: Position-based ID as last resort
    const rect = videoElement.getBoundingClientRect();
    const positionId = `pos_${Math.round(rect.top)}_${Math.round(rect.left)}_${Math.round(rect.width)}_${Math.round(rect.height)}`;
    console.log('Using position-based ID:', positionId);
    return positionId;
  }

  addVideoListeners(videoElement, reelId) {
    let playStartTime = null;
    let hasBeenCounted = false;

    const handlePlay = () => {
      try {
        // Don't track if extension is disabled
        if (!this.settings.extensionEnabled) {
          return;
        }

        console.log('🎬 Reel started playing:', reelId, 'at', new Date().toLocaleTimeString());
        playStartTime = Date.now();
        hasBeenCounted = false;

        // Set as active reel
        this.activeReel = reelId;

        // Count this reel as seen/scrolled if not already counted
        if (!this.scrolledReels.has(reelId)) {
          this.scrolledReels.add(reelId);
          this.totalReelsScrolled += 1;

          console.log(`📊 Reel ${reelId} counted as scrolled. Total scrolled: ${this.totalReelsScrolled}`);

          // Update daily stats
          if (this.dailyStats) {
            this.dailyStats.reelsScrolled += 1;
            this.saveDailyStats().catch(error => console.error('Failed to save daily stats:', error));
          }

          this.saveScrollCounter().catch(error => console.error('Failed to save scroll counter:', error));

          // Show milestone notification for milestones
          this.showScrollMilestoneNotification(this.totalReelsScrolled);

          // Check if limits are exceeded and start periodic alerts
          this.checkLimitsAndStartAlerts();
        }
      } catch (error) {
        console.error('Error in handlePlay:', error);
      }
    };

    const handlePause = () => {
      try {
        if (playStartTime && !hasBeenCounted) {
          const watchDuration = Date.now() - playStartTime;
          console.log(`⏸️ Reel ${reelId} paused after ${Math.round(watchDuration/1000)}s`);
          this.recordWatch(reelId, watchDuration);
          hasBeenCounted = true;
        }
        playStartTime = null;
      } catch (error) {
        console.error('Error in handlePause:', error);
      }
    };

    const handleEnded = () => {
      try {
        if (playStartTime && !hasBeenCounted) {
          const watchDuration = Date.now() - playStartTime;
          console.log(`⏹️ Reel ${reelId} ended after ${Math.round(watchDuration/1000)}s`);
          this.recordWatch(reelId, watchDuration);
          hasBeenCounted = true;
        }
        playStartTime = null;
      } catch (error) {
        console.error('Error in handleEnded:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && playStartTime && !hasBeenCounted) {
        const watchDuration = Date.now() - playStartTime;
        this.recordWatch(reelId, watchDuration);
        hasBeenCounted = true;
        playStartTime = null;
      }
    };

    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Store listeners for cleanup if needed
    videoElement._reelListeners = {
      play: handlePlay,
      pause: handlePause,
      ended: handleEnded,
      visibilitychange: handleVisibilityChange
    };
  }

  async recordWatch(reelId, duration) {
    // Don't track if extension is disabled
    if (!this.settings.extensionEnabled) {
      console.log('Extension disabled - not recording watch');
      return;
    }

    console.log(`⏱️ Recording watch for ${reelId}, duration: ${Math.round(duration/1000)}s`);

    // Only count watches longer than 1 second to avoid accidental taps
    if (duration < 1000) {
      console.log(`Reel ${reelId} watch too short (${Math.round(duration/1000)}s), not counting`);
      return;
    }

    const reelData = this.watchedReels.get(reelId);
    if (reelData) {
      reelData.count += 1;
      reelData.lastWatched = Date.now();
      reelData.totalWatchTime += duration;

      console.log(`📊 Reel ${reelId} stats updated - Count: ${reelData.count}, Total time: ${Math.round(reelData.totalWatchTime/1000)}s`);

      // Update daily stats
      if (this.dailyStats) {
        const oldWatchTime = this.dailyStats.watchTime;
        const oldReelsWatched = this.dailyStats.reelsWatched;

        this.dailyStats.watchTime += duration;
        this.dailyStats.reelsWatched += 1;

        console.log(`📈 Daily stats: Watch time ${Math.round(oldWatchTime/1000)}s -> ${Math.round(this.dailyStats.watchTime/1000)}s, Reels ${oldReelsWatched} -> ${this.dailyStats.reelsWatched}`);

        try {
          await this.saveDailyStats();
          console.log('✅ Daily stats saved successfully');
        } catch (error) {
          console.error('❌ Failed to save daily stats:', error);
        }
      } else {
        console.log('⚠️ Daily stats not initialized');
      }

      // Save watched reels data
      try {
        await this.saveWatchedReels();
        console.log('✅ Watched reels data saved successfully');
      } catch (error) {
        console.error('❌ Failed to save watched reels:', error);
      }

      // Check if we should show repeated watch notification
      if (reelData.count >= 3) {
        console.log(`🔔 Showing notification for repeated reel ${reelId} (${reelData.count} views)`);
        this.showNotification(reelId);
      }

      // Check if limits are exceeded and start periodic alerts
      this.checkLimitsAndStartAlerts();

      console.log(`✅ Reel ${reelId} watch recorded successfully`);
    } else {
      console.error(`❌ No reel data found for ${reelId} - this shouldn't happen`);
    }
  }

  showNotification(reelId) {
    console.log(`🔔 showNotification called for reel ${reelId}`);
    const reelData = this.watchedReels.get(reelId);
    console.log(`Reel data:`, reelData);
    console.log(`Settings showNotifications:`, this.settings.showNotifications);

    if (!reelData || reelData.count < 3 || !this.settings.showNotifications) {
      console.log(`❌ Notification not shown. Conditions: reelData=${!!reelData}, count=${reelData?.count}, showNotifications=${this.settings.showNotifications}`);
      return;
    }

    console.log('Creating notification element...');

    // Remove existing notification
    this.hideNotification();

    // Create new notification
    this.notificationElement = document.createElement('div');
    this.notificationElement.className = 'limit-alert';
    this.notificationElement.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>You've watched this reel ${reelData.count} times already!</span>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            margin-left: 8px;
          ">×</button>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(this.notificationElement);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideNotification();
    }, 5000);
  }

  hideNotification() {
    if (this.notificationElement && this.notificationElement.parentNode) {
      // Clear any auto-hide timeout if it exists
      if (this.notificationElement._autoHideTimeout) {
        clearTimeout(this.notificationElement._autoHideTimeout);
        this.notificationElement._autoHideTimeout = null;
      }

      this.notificationElement.remove();
      this.notificationElement = null;
    }
  }

  stopAllTracking() {
    console.log('🛑 Stopping all tracking - extension disabled');

    // Remove all video event listeners
    const allVideos = document.querySelectorAll('video[data-reel-tracked]');
    allVideos.forEach(video => {
      if (video._reelListeners) {
        // Remove all listeners from this video
        Object.values(video._reelListeners).forEach(listener => {
          if (typeof listener === 'function') {
            try {
              video.removeEventListener('play', listener);
              video.removeEventListener('pause', listener);
              video.removeEventListener('ended', listener);
              document.removeEventListener('visibilitychange', listener);
            } catch (e) {
              // Ignore errors if listener already removed
            }
          }
        });
        // Clear the stored listeners
        video._reelListeners = null;
      }
    });

    // Stop periodic checks
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }

    // Stop status logging
    if (this.statusLogInterval) {
      clearInterval(this.statusLogInterval);
      this.statusLogInterval = null;
    }

    // Stop limit alerts
    this.stopPeriodicAlerts();

    // Clear active reel
    this.activeReel = null;

    console.log('✅ All tracking stopped');
  }

  restartTracking() {
    console.log('▶️ Restarting tracking - extension enabled');

    // Restart periodic checks
    this.startPeriodicChecks();

    // Re-check for existing reels on the page
    this.checkForReels();

    console.log('✅ Tracking restarted');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggleExtension') {
        this.settings.extensionEnabled = message.data;
        console.log('Extension toggled:', message.data);
        if (!message.data) {
          // If disabled, stop all tracking and hide notifications
          this.stopAllTracking();
          this.hideNotification();
        } else {
          // If enabled, restart tracking
          this.restartTracking();
        }
      } else if (message.action === 'updateSettings') {
        // Reload settings when popup updates them
        this.loadSettings().then(() => {
          console.log('Settings reloaded from popup update');
        });
      }
    });
  }

  showScrollMilestoneNotification(totalScrolled) {
      // Show notifications at milestones
      let message = '';

      if (totalScrolled === 5) {
        message = "You've scrolled through 5 reels.";
      } else if (totalScrolled === 10) {
        message = "You've viewed 10 reels today.";
      } else if (totalScrolled === 20) {
        message = "You've scrolled through 20 reels.";
      } else if (totalScrolled === 50) {
        message = "You've viewed 50 reels today.";
      } else if (totalScrolled % 25 === 0 && totalScrolled >= 25) {
        message = `You've scrolled through ${totalScrolled} reels.`;
      }

      if (message && this.settings.showNotifications) {
        this.hideNotification();

        this.notificationElement = document.createElement('div');
        this.notificationElement.className = 'scroll-milestone-notification';
        this.notificationElement.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 9999;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            animation: bounceIn 0.5s ease-out;
            border: 2px solid rgba(255,255,255,0.2);
          ">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${message}</span>
              <button onclick="
                const notification = this.closest('.scroll-milestone-notification');
                if (notification && notification.parentNode) {
                  notification.remove();
                  notification.style.display = 'none';
                }
              " style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                margin-left: 8px;
                opacity: 0.8;
              ">✕</button>
            </div>
          </div>
          <style>
            @keyframes bounceIn {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.05); }
              70% { transform: scale(0.9); }
              100% { transform: scale(1); opacity: 1; }
            }
          </style>
        `;

        document.body.appendChild(this.notificationElement);

        // Auto-hide after 4 seconds (shorter for milestone notifications)
        const autoHideTimeout = setTimeout(() => {
          if (this.notificationElement && this.notificationElement.className === 'scroll-milestone-notification') {
            this.hideNotification();
          }
        }, 4000);

        // Store timeout reference for cleanup if needed
        this.notificationElement._autoHideTimeout = autoHideTimeout;
      }
    }

  showScrollMilestoneNotification(totalScrolled) {
    // Show notifications at milestones
    let message = '';

    if (totalScrolled === 5) {
      message = "You've scrolled through 5 reels.";
    } else if (totalScrolled === 10) {
      message = "You've viewed 10 reels today.";
    } else if (totalScrolled === 20) {
      message = "You've scrolled through 20 reels.";
    } else if (totalScrolled === 50) {
      message = "You've viewed 50 reels today.";
    } else if (totalScrolled % 25 === 0 && totalScrolled >= 25) {
      message = `You've scrolled through ${totalScrolled} reels.`;
    }

    if (message && this.settings.showNotifications) {
      this.hideNotification();

      this.notificationElement = document.createElement('div');
      this.notificationElement.className = 'scroll-milestone-notification';
      this.notificationElement.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 600;
          z-index: 9999;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          animation: bounceIn 0.5s ease-out;
          border: 2px solid rgba(255,255,255,0.2);
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${message}</span>
            <button onclick="
              const notification = this.closest('.scroll-milestone-notification');
              if (notification && notification.parentNode) {
                notification.remove();
                notification.style.display = 'none';
              }
            " style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              font-size: 16px;
              line-height: 1;
              margin-left: 8px;
              opacity: 0.8;
            ">✕</button>
          </div>
        </div>
        <style>
          @keyframes bounceIn {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.05); }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      `;

      document.body.appendChild(this.notificationElement);

      // Auto-hide after 4 seconds (shorter for milestone notifications)
      const autoHideTimeout = setTimeout(() => {
        if (this.notificationElement && this.notificationElement.className === 'scroll-milestone-notification') {
          this.hideNotification();
        }
      }, 4000);

      // Store timeout reference for cleanup if needed
      this.notificationElement._autoHideTimeout = autoHideTimeout;
    }
  }

  checkLimitsAndStartAlerts() {
    if (!this.settings.enableLimits || !this.settings.showNotifications || !this.dailyStats) return;

    // Check if we're in snooze period
    if (this.snoozeUntil && Date.now() < this.snoozeUntil) {
      console.log('😴 In snooze period, skipping alerts');
      return;
    }

    const timeLimitMs = this.settings.timeLimit * 60 * 1000; // Convert minutes to ms
    const reelLimit = this.settings.reelLimit;

    const timeExceeded = this.dailyStats.watchTime >= timeLimitMs;
    const reelsExceeded = this.dailyStats.reelsScrolled >= reelLimit;

    if ((timeExceeded || reelsExceeded) && !this.isShowingLimitAlert) {
      console.log('🎯 Limits exceeded, starting periodic alerts');
      this.startPeriodicAlerts();
    } else if (!timeExceeded && !reelsExceeded && this.limitAlertInterval) {
      console.log('Limits no longer exceeded, stopping alerts');
      this.stopPeriodicAlerts();
      // Show positive reinforcement when they get back within limits
      this.showPositiveReinforcement();
    } else if (!timeExceeded && !reelsExceeded) {
      // Show occasional positive reinforcement even when staying within limits
      this.showOccasionalEncouragement();
    }
  }

  showPositiveReinforcement() {
    if (!this.settings.showNotifications) return;

    // Only show once per limit recovery session
    const now = Date.now();
    if (now - this.lastPositiveNotification < 3600000) return; // Max once per hour
    this.lastPositiveNotification = now;

    this.hideNotification();

    const messages = [
      "Great job staying within your limits today! 🌟",
      "You're doing amazing with your screen time balance! 💪",
      "Mindful scrolling in action! Keep it up! ✨",
      "Your future self will thank you for this balance! 🙏"
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    this.notificationElement = document.createElement('div');
    this.notificationElement.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(76, 175, 80, 0.3);
        animation: gentleBounce 0.5s ease-out;
        border: 2px solid rgba(255,255,255,0.2);
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${randomMessage}</span>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            opacity: 0.8;
          ">✕</button>
        </div>
      </div>
      <style>
        @keyframes gentleBounce {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(this.notificationElement);

    setTimeout(() => {
      this.hideNotification();
    }, 5000);
  }

  showOccasionalEncouragement() {
    if (!this.settings.showNotifications) return;

    // Show encouragement roughly every 25 reels watched, but not too frequently
    const reelsWatched = this.dailyStats.reelsWatched;
    if (reelsWatched > 0 && reelsWatched % 25 === 0 && Math.random() < 0.3) { // 30% chance
      const now = Date.now();
      if (now - this.lastPositiveNotification > 1800000) { // At least 30 minutes apart
        this.showPositiveReinforcement();
      }
    }
  }

  startPeriodicAlerts() {
    if (this.limitAlertInterval) return; // Already running

    this.isShowingLimitAlert = true;
    this.limitAlertCount = 0;

    // Graduated notification frequency: more gentle approach
    this.limitAlertInterval = setInterval(() => {
      this.limitAlertCount++;
      this.showLimitAlert();
    }, this.getNotificationInterval()); // Dynamic interval

    // Show first alert immediately
    this.showLimitAlert();
  }

  getNotificationInterval() {
    // When user hits the limit, show reminders every 2.5 seconds as requested
    return 2500; // 2500ms = 2.5 seconds
  }

  stopPeriodicAlerts() {
    if (this.limitAlertInterval) {
      clearInterval(this.limitAlertInterval);
      this.limitAlertInterval = null;
    }
    this.isShowingLimitAlert = false;
    this.hideNotification(); // Hide any current limit alert
  }

  showLimitAlert() {
    if (!this.settings.enableLimits || !this.settings.showNotifications || !this.dailyStats) return;

    const timeLimitMs = this.settings.timeLimit * 60 * 1000;
    const timeExceeded = this.dailyStats.watchTime >= timeLimitMs;
    const reelsExceeded = this.dailyStats.reelsScrolled >= this.settings.reelLimit;

    if (!timeExceeded && !reelsExceeded) {
      this.stopPeriodicAlerts();
      return;
    }

    // If a limit alert is already visible, keep it - don't recreate or auto-hide
    if (this.notificationElement) {
      if (this.notificationElement.className === 'limit-alert') return;
      // Remove any other non-limit notifications before showing the persistent limit alert
      this.hideNotification();
    }

    let title = 'Daily Limit Reached';
    let message = '';
    let suggestion = '';

    if (timeExceeded && reelsExceeded) {
      message = `You've reached both your ${this.settings.timeLimit}min time and ${this.settings.reelLimit} reel limits today.`;
      suggestion = 'Consider taking a meaningful break to recharge.';
    } else if (timeExceeded) {
      message = `You've reached your ${this.settings.timeLimit} minute daily time limit for watching reels.`;
      suggestion = 'Try some offline activities or hobbies instead.';
    } else if (reelsExceeded) {
      message = `You've scrolled through ${this.settings.reelLimit} reels today.`;
      suggestion = 'Your brain deserves a break from the scroll.';
    }

    this.notificationElement = document.createElement('div');
    // Mark this as the persistent limit alert so repeated calls don't recreate it
    this.notificationElement.className = 'limit-alert';
    this.notificationElement.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
        animation: gentleSlide 0.4s ease-out;
        border: 2px solid rgba(255,255,255,0.2);
        max-width: 320px;
      ">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 15px;">${title}</div>
        <div style="margin-bottom: 12px; line-height: 1.4;">${message}</div>
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 16px; font-style: italic;">${suggestion}</div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="snooze-alert" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.2s;
          ">Remind me later</button>
        </div>
      </div>
      <style>
        @keyframes gentleSlide {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        #snooze-alert:hover {
          background: rgba(255,255,255,0.3);
        }
      </style>
    `;

    document.body.appendChild(this.notificationElement);

    // Add snooze functionality
    const snoozeBtn = this.notificationElement.querySelector('#snooze-alert');
    if (snoozeBtn) {
      snoozeBtn.addEventListener('click', () => {
        // Ask user how many minutes to snooze (default 30)
        try {
          const input = prompt('Snooze reminders for how many minutes?', '30');
          let minutes = parseInt(input, 10);
          if (isNaN(minutes) || minutes <= 0) minutes = 30;
          this.snoozeAlerts(minutes);
        } catch (e) {
          // Fallback to default if prompt fails
          this.snoozeAlerts(30);
        }
        // Hide the persistent alert once user snoozes
        this.hideNotification();
      });
    }
  }

  snoozeAlerts(minutes = 30) {
    // Stop current alerts and snooze for specified minutes
    this.stopPeriodicAlerts();
    const ms = Math.max(1, Math.floor(minutes)) * 60 * 1000; // at least 1 minute
    this.snoozeUntil = Date.now() + ms;

    // Clear any previously scheduled resume
    if (this.snoozeTimeout) {
      clearTimeout(this.snoozeTimeout);
      this.snoozeTimeout = null;
    }

    // Schedule automatic resume when snooze expires
    this.snoozeTimeout = setTimeout(() => {
      this.snoozeTimeout = null;
      this.snoozeUntil = null;

      console.log('🔔 Snooze period ended, checking limits and resuming alerts');

      // Re-check limits and start alerts if still exceeded
      try {
        this.checkLimitsAndStartAlerts();
      } catch (e) {
        console.error('Error while resuming alerts after snooze:', e);
      }

      // Show small confirmation that reminders have resumed
      try {
        this.showSnoozeEndedNotification(minutes);
      } catch (e) {
        console.error('Failed to show snooze-ended notification:', e);
      }
    }, ms);

    console.log(`🔔 Alerts snoozed for ${minutes} minutes`);

    // Show confirmation with actual minutes
    this.showSnoozeConfirmation(minutes);
  }

  showSnoozeConfirmation(minutes = 30) {
    this.hideNotification();

    const plural = minutes === 1 ? 'minute' : 'minutes';
    this.notificationElement = document.createElement('div');
    this.notificationElement.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        animation: gentlePulse 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>✅ Reminders snoozed for ${minutes} ${plural}</span>
        </div>
      </div>
      <style>
        @keyframes gentlePulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(this.notificationElement);

    setTimeout(() => {
      this.hideNotification();
    }, 3000);
  }

  // Small notification shown when snooze period ends and reminders resume
  showSnoozeEndedNotification(minutes = 0) {
    // Only show a short confirmation if the user chose a snooze
    this.hideNotification();

    const message = minutes > 0 ? `🔔 Reminders resumed after ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` : '🔔 Reminders resumed.';

    this.notificationElement = document.createElement('div');
    this.notificationElement.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 10px 14px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        opacity: 0.98;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${message} You'll see alerts again.</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.notificationElement);

    setTimeout(() => {
      this.hideNotification();
    }, 4000);
  }

}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ReelTracker();
  });
} else {
  new ReelTracker();
}
