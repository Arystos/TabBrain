// lib/classifier.js
// Classifies tabs into statuses: active, reference, save-for-later, duplicate, stale

const classifier = (() => {
  const DEFAULTS = {
    activeThresholdMs: 60 * 60 * 1000,         // 1 hour
    staleThresholdMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    saveLaterMaxFocusMs: 10 * 1000,             // 10 seconds
  };

  let settings = { ...DEFAULTS };

  function updateSettings(newSettings) {
    settings = { ...DEFAULTS, ...newSettings };
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      u.hash = "";
      const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "fbclid", "gclid"];
      for (const p of trackingParams) {
        u.searchParams.delete(p);
      }
      return u.origin + u.pathname.replace(/\/+$/, "") + (u.search || "");
    } catch {
      return url;
    }
  }

  function findDuplicates(allTabData) {
    const urlMap = {};
    for (const [tabId, data] of Object.entries(allTabData)) {
      if (!data.url || data.url.startsWith("about:") || data.url.startsWith("moz-extension:")) continue;
      const norm = normalizeUrl(data.url);
      if (!urlMap[norm]) urlMap[norm] = [];
      urlMap[norm].push({ tabId: Number(tabId), ...data });
    }
    const duplicateIds = new Set();
    for (const tabs of Object.values(urlMap)) {
      if (tabs.length <= 1) continue;
      tabs.sort((a, b) => (b.lastFocusedAt || 0) - (a.lastFocusedAt || 0));
      for (let i = 1; i < tabs.length; i++) {
        duplicateIds.add(tabs[i].tabId);
      }
    }
    return duplicateIds;
  }

  function classify(tabId, tabData, duplicateIds) {
    const now = Date.now();

    if (tabData.discarded) {
      return "suspended";
    }

    if (duplicateIds.has(tabId)) {
      return "duplicate";
    }

    const timeSinceLastFocus = tabData.lastFocusedAt ? now - tabData.lastFocusedAt : now - tabData.openedAt;
    const timeSinceOpened = now - tabData.openedAt;

    if (timeSinceLastFocus > settings.staleThresholdMs) {
      return "stale";
    }

    if (tabData.totalFocusMs < settings.saveLaterMaxFocusMs && timeSinceOpened > settings.activeThresholdMs) {
      return "save-for-later";
    }

    if (timeSinceLastFocus < settings.activeThresholdMs) {
      return "active";
    }

    return "reference";
  }

  function classifyAll(allTabData) {
    const duplicateIds = findDuplicates(allTabData);
    const results = {};
    for (const [tabId, data] of Object.entries(allTabData)) {
      results[tabId] = classify(Number(tabId), data, duplicateIds);
    }
    return results;
  }

  return { classifyAll, findDuplicates, normalizeUrl, updateSettings };
})();
