// lib/deduplicator.js
// Detects and auto-closes duplicate tabs

const deduplicator = (() => {
  function parseExcluded(str) {
    if (!str) return [];
    return str.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  function isDomainExcluded(url, excludedList) {
    if (excludedList.length === 0) return false;
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return excludedList.some((ex) => domain === ex || domain.endsWith("." + ex));
    } catch {
      return false;
    }
  }

  async function closeDuplicates(allTabData, excludedDomains, options = {}) {
    const duplicateIds = classifier.findDuplicates(allTabData);
    const excluded = parseExcluded(excludedDomains);
    const closed = [];

    for (const tabId of duplicateIds) {
      const data = allTabData[tabId];
      if (!data) continue;
      if (isDomainExcluded(data.url, excluded)) continue;
      try {
        await rescue.add(data, "duplicate");
        await browser.tabs.remove(tabId);
        tracker.removeTab(tabId);
        closed.push({ tabId, title: data.title, url: data.url });
      } catch (e) {
        console.warn("TabBrain: failed to close duplicate tab", tabId, e);
      }
    }

    if (closed.length > 0 && options.showNotifications) {
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.svg",
        title: "TabBrain",
        message: `Closed ${closed.length} duplicate tab${closed.length > 1 ? "s" : ""}. Click the TabBrain icon to undo.`,
      });
    }

    return closed;
  }

  return { closeDuplicates };
})();
