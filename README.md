# Instagram Reel Awareness Extension

A smart browser extension that promotes mindful social media consumption through personalized limits, gentle reminders, and positive reinforcement. Help yourself maintain healthy Instagram Reel viewing habits without feeling restricted.

## ✨ Key Features

### 🎯 **Personalized Daily Limits**
- Set your own daily time and reel limits
- User-defined settings (no arbitrary defaults)
- Welcome prompt for first-time setup

### 🔔 **Smart Notification System**
- **Graduated reminders**: Gentle → persistent (30s → 1min → 2min intervals)
- **Snooze functionality**: "Remind me later" for 30-minute breaks
- **Positive reinforcement**: Encouraging messages for good habits
- **Respectful design**: User control with multiple stop options

### 📊 **Comprehensive Tracking**
- Real-time reel and time tracking
- Detailed statistics in popup dashboard
- Daily usage summaries
- Watch history with repeat detection

### 🔒 **Privacy-First**
- 100% local storage (no external servers)
- No account creation required
- No analytics or data collection
- Open-source and transparent

## 🚀 Quick Start

### Installation
1. **Download** the extension files
2. **Open** `chrome://extensions/` in Chrome/Edge
3. **Enable** "Developer mode"
4. **Click** "Load unpacked" → select this folder
5. **Done!** Extension is ready to use

### First Use
1. **Click** the extension icon on Instagram
2. **Set** your daily limits in the welcome prompt
3. **Start** scrolling mindfully!

## 🎛️ How It Works

### Smart Detection
- Automatically detects Instagram Reels across all layouts
- Robust video identification using multiple methods
- Handles Instagram's frequent UI changes

### Limit Management
- **Time limits**: Set daily viewing time (minutes)
- **Reel limits**: Set maximum daily reels
- **Flexible enforcement**: Snooze, disable, or adjust anytime

### Notification Intelligence
```
Approaching Limit → Gentle reminders start
Hit Limit → Graduated notifications (30s → 1min → 2min)
Snooze Clicked → 30-minute break
Back Within Limits → Positive encouragement
```

## 📱 User Experience

### When Within Limits
- ✅ Silent operation
- ✅ Occasional positive reinforcement
- ✅ Full statistics tracking

### When Approaching Limits
- 🔔 Gentle notifications every 30 seconds
- 💜 Positive, supportive messaging
- 🎯 Helpful suggestions for breaks

### When Limits Exceeded
- 📢 Graduated escalation (not spam)
- 😴 Snooze option always available
- 🔧 Multiple ways to stop/disable

## 🔧 Advanced Features

### Debug Tools
- **Debug button** in popup for troubleshooting
- **Console logging** with detailed tracking info
- **Status monitoring** every 30 seconds

### Data Management
- **Clear all data** option in popup
- **Daily reset** at midnight
- **Preserved user settings** across data clears

### Customization
- **Enable/disable** notifications
- **Enable/disable** limits
- **Adjust limits** anytime
- **Extension on/off** toggle

## Development

To modify the extension:
1. Edit `content.js` for the main functionality
2. Edit `manifest.json` for permissions and metadata
3. Reload the extension in your browser's extension manager

## Privacy

- No data is sent to external servers
- All tracking happens locally in your browser
- Data is stored using Chrome's local storage API
- You can clear all data by uninstalling the extension or clearing browser data

## Troubleshooting

If the extension isn't working:
1. Make sure you're on instagram.com
2. Check that the extension is enabled in your browser
3. Try refreshing the Instagram page
4. Check browser console for any errors

Instagram frequently changes their DOM structure, so the reel detection logic may need updates over time.
