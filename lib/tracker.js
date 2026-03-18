// lib/tracker.js
// Tracks tab activity: focus time, duration, parent chain

const tracker = (() => {
  // tabId -> { url, title, openedAt, lastFocusedAt, totalFocusMs, openerTabId, focusStart }
  let tabs = {};
  let currentTabId = null;

  function now() {
    return Date.now();
  }

  function initTab(tabId, tab) {
    if (tabs[tabId]) return;
    tabs[tabId] = {
      url: tab.url || "",
      title: tab.title || "",
      openedAt: now(),
      lastFocusedAt: null,
      totalFocusMs: 0,
      openerTabId: tab.openerTabId || null,
      focusStart: null,
      discarded: false,
    };
  }

  function updateTab(tabId, changeInfo, tab) {
    if (!tabs[tabId]) {
      initTab(tabId, tab);
    }
    if (changeInfo.url) tabs[tabId].url = changeInfo.url;
    if (changeInfo.title) tabs[tabId].title = changeInfo.title;
    if (changeInfo.discarded !== undefined) tabs[tabId].discarded = changeInfo.discarded;
  }

  function focusTab(tabId) {
    const n = now();
    // End focus on previous tab
    if (currentTabId !== null && tabs[currentTabId] && tabs[currentTabId].focusStart) {
      tabs[currentTabId].totalFocusMs += n - tabs[currentTabId].focusStart;
      tabs[currentTabId].focusStart = null;
    }
    // Start focus on new tab
    if (tabs[tabId]) {
      tabs[tabId].lastFocusedAt = n;
      tabs[tabId].focusStart = n;
    }
    currentTabId = tabId;
  }

  function removeTab(tabId) {
    delete tabs[tabId];
    if (currentTabId === tabId) currentTabId = null;
  }

  function getTabData(tabId) {
    const t = tabs[tabId];
    if (!t) return null;
    // Include in-progress focus time
    let totalFocus = t.totalFocusMs;
    if (t.focusStart) {
      totalFocus += now() - t.focusStart;
    }
    return { ...t, totalFocusMs: totalFocus, focusStart: undefined, discarded: t.discarded };
  }

  function getAllTabs() {
    const result = {};
    for (const id of Object.keys(tabs)) {
      result[id] = getTabData(Number(id));
    }
    return result;
  }

  function getParentChain(tabId, maxDepth = 10) {
    const chain = [];
    let current = tabId;
    let depth = 0;
    while (current && tabs[current] && depth < maxDepth) {
      chain.push(current);
      current = tabs[current].openerTabId;
      depth++;
    }
    return chain;
  }

  return { initTab, updateTab, focusTab, removeTab, getTabData, getAllTabs, getParentChain };
})();
