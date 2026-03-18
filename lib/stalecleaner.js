// lib/stalecleaner.js
// Auto-closes stale tabs (inactive for X days)

const staleCleaner = (() => {
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

  async function cleanStaleTabs(allTabData, classifications, excludedDomains, options = {}) {
    const excluded = parseExcluded(excludedDomains);
    const closed = [];

    for (const [tabId, status] of Object.entries(classifications)) {
      if (status !== "stale") continue;
      const data = allTabData[tabId];
      if (!data) continue;
      if (isDomainExcluded(data.url, excluded)) continue;

      // Don't close pinned tabs
      try {
        const tab = await browser.tabs.get(Number(tabId));
        if (tab.pinned) continue;
        if (tab.audible) continue;
      } catch {
        continue;
      }

      try {
        await rescue.add(data, "stale");
        await browser.tabs.remove(Number(tabId));
        tracker.removeTab(Number(tabId));
        closed.push({ tabId: Number(tabId), title: data.title });
      } catch (e) {
        console.warn("TabBrain: failed to close stale tab", tabId, e);
      }
    }

    if (closed.length > 0 && options.showNotifications) {
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.svg",
        title: "TabBrain",
        message: `Closed ${closed.length} stale tab${closed.length > 1 ? "s" : ""}. Check rescue list to recover.`,
      });
    }

    return closed;
  }

  return { cleanStaleTabs };
})();
