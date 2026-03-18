// background.js
importScripts("lib/tracker.js");
importScripts("lib/classifier.js");
importScripts("lib/clusterer.js");
importScripts("lib/rescue.js");
importScripts("lib/deduplicator.js");
importScripts("lib/stalecleaner.js");

// Initialize existing tabs
browser.tabs.query({}).then((existingTabs) => {
  for (const tab of existingTabs) {
    tracker.initTab(tab.id, tab);
  }
  const active = existingTabs.find((t) => t.active);
  if (active) tracker.focusTab(active.id);
});

// Initialize rescue list
rescue.load();

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

// --- Central processing loop ---
let processTimeout = null;

function scheduleProcess() {
  if (processTimeout) clearTimeout(processTimeout);
  processTimeout = setTimeout(runProcess, 500);
}

async function runProcess() {
  const allTabData = tracker.getAllTabs();
  const classifications = classifier.classifyAll(allTabData);
  const clusters = clusterer.clusterTabs(allTabData, tracker.getParentChain);

  // Auto-close duplicates
  await deduplicator.closeDuplicates(allTabData);

  // Auto-close stale tabs
  await staleCleaner.cleanStaleTabs(allTabData, classifications);

  // Store state for popup
  await browser.storage.local.set({
    tabbrainState: {
      classifications,
      clusters,
      tabData: allTabData,
      lastUpdated: Date.now(),
    },
  });
}

// Run periodically (every 5 minutes) for stale detection
setInterval(runProcess, 5 * 60 * 1000);

// Initial run after 1 second
setTimeout(runProcess, 1000);

// Handle messages from popup
browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === "closeDuplicates") {
    await deduplicator.closeDuplicates(tracker.getAllTabs());
  } else if (msg.action === "closeStale") {
    const allTabData = tracker.getAllTabs();
    const classifications = classifier.classifyAll(allTabData);
    await staleCleaner.cleanStaleTabs(allTabData, classifications);
  } else if (msg.action === "rescueReopen") {
    await rescue.reopen(msg.index);
  } else if (msg.action === "rescueClear") {
    await rescue.clear();
  }
});

console.log("TabBrain loaded");
