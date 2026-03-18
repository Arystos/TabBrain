// background.js
// All lib scripts are loaded via manifest.json background.scripts

// Initialize existing tabs, settings, and rescue list — then run first process
let initialized = false;
let isProcessing = false;

async function init() {
  await rescue.load();
  await loadSettings();

  const existingTabs = await browser.tabs.query({});
  for (const tab of existingTabs) {
    tracker.initTab(tab.id, tab);
  }
  const active = existingTabs.find((t) => t.active);
  if (active) tracker.focusTab(active.id);

  await snooze.checkWakeups();

  initialized = true;
  await runProcess();
}

init();

// Snooze alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("snooze-")) {
    await snooze.checkWakeups();
  }
});

// Listen to tab events
browser.tabs.onCreated.addListener((tab) => {
  tracker.initTab(tab.id, tab);
  scheduleProcess();
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tracker.updateTab(tabId, changeInfo, tab);
  scheduleProcess();
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  tracker.focusTab(tabId);
  scheduleProcess();
});

browser.tabs.onRemoved.addListener((tabId) => {
  tracker.removeTab(tabId);
  setTimeout(scheduleProcess, 100);
});

// --- Settings ---
async function loadSettings() {
  const data = await browser.storage.local.get("tabbrainSettings");
  const s = data.tabbrainSettings || {};
  classifier.updateSettings({
    activeThresholdMs: (s.activeMins || 60) * 60 * 1000,
    staleThresholdMs: (s.staleDays || 3) * 24 * 60 * 60 * 1000,
    saveLaterMaxFocusMs: (s.saveLaterSecs || 10) * 1000,
  });
  self.tabbrainSettings = s;
}

// --- Central processing loop ---
let processTimeout = null;

function scheduleProcess() {
  if (!initialized) return;
  if (processTimeout) clearTimeout(processTimeout);
  processTimeout = setTimeout(runProcess, 500);
}

async function runProcess() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const settings = self.tabbrainSettings || {};
    const allTabData = tracker.getAllTabs();
    const classifications = classifier.classifyAll(allTabData);
    const threshold = settings.clusterThreshold || 0.25;
    const clusters = clusterer.clusterTabs(allTabData, tracker.getParentChain, threshold);

    const opts = { showNotifications: !!settings.showNotifications };

    // Auto-close duplicates (if enabled)
    if (settings.autoCloseDups !== false) {
      await deduplicator.closeDuplicates(allTabData, settings.excludedDomains, opts);
    }

    // Auto-close stale tabs (if enabled)
    if (settings.autoCloseStale !== false) {
      await staleCleaner.cleanStaleTabs(allTabData, classifications, settings.excludedDomains, opts);
    }

    // Store state for popup
    await browser.storage.local.set({
      tabbrainState: {
        classifications,
        clusters,
        tabData: allTabData,
        lastUpdated: Date.now(),
      },
    });

    // Update badge
    const dupCount = Object.values(classifications).filter((s) => s === "duplicate").length;
    const staleCount = Object.values(classifications).filter((s) => s === "stale").length;
    const actionable = dupCount + staleCount;
    if (actionable > 0) {
      await browser.action.setBadgeText({ text: String(actionable) });
      await browser.action.setBadgeBackgroundColor({ color: "#e53e3e" });
    } else {
      await browser.action.setBadgeText({ text: "" });
    }
  } finally {
    isProcessing = false;
  }
}

// Run periodically (every 5 minutes) for stale detection
setInterval(runProcess, 5 * 60 * 1000);

// Handle messages from popup
browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === "closeDuplicates") {
    const s = self.tabbrainSettings || {};
    await deduplicator.closeDuplicates(tracker.getAllTabs(), s.excludedDomains, { showNotifications: !!s.showNotifications });
  } else if (msg.action === "closeStale") {
    const s2 = self.tabbrainSettings || {};
    const allTabData = tracker.getAllTabs();
    const classifications = classifier.classifyAll(allTabData);
    await staleCleaner.cleanStaleTabs(allTabData, classifications, s2.excludedDomains, { showNotifications: !!s2.showNotifications });
  } else if (msg.action === "rescueReopen") {
    await rescue.reopen(msg.index);
  } else if (msg.action === "rescueClear") {
    await rescue.clear();
  } else if (msg.action === "snoozeTab") {
    await snooze.snoozeTab(msg.tabData, msg.tabId, msg.wakeAt);
  } else if (msg.action === "cancelSnooze") {
    await snooze.cancelSnooze(msg.index);
  } else if (msg.action === "getSnoozed") {
    return snooze.getSnoozed();
  } else if (msg.action === "assignTabToGroup") {
    const data = await browser.storage.local.get("tabbrainCustomGroups");
    const custom = data.tabbrainCustomGroups || {};
    custom[msg.tabId] = msg.groupName;
    await browser.storage.local.set({ tabbrainCustomGroups: custom });
  } else if (msg.action === "reloadSettings") {
    await loadSettings();
  }
});

console.log("TabBrain loaded");
