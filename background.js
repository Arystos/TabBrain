// background.js
importScripts("lib/tracker.js");
importScripts("lib/classifier.js");

// Initialize existing tabs
browser.tabs.query({}).then((existingTabs) => {
  for (const tab of existingTabs) {
    tracker.initTab(tab.id, tab);
  }
  // Focus the active tab
  const active = existingTabs.find((t) => t.active);
  if (active) tracker.focusTab(active.id);
});

// Listen to tab events
browser.tabs.onCreated.addListener((tab) => {
  tracker.initTab(tab.id, tab);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tracker.updateTab(tabId, changeInfo, tab);
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  tracker.focusTab(tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  tracker.removeTab(tabId);
});

console.log("TabBrain loaded");
