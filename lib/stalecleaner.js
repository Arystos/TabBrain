// lib/stalecleaner.js
// Auto-suspends stale tabs by discarding them (frees memory without closing)

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
    const discarded = [];

    for (const [tabId, status] of Object.entries(classifications)) {
      if (status !== "stale") continue;
      const data = allTabData[tabId];
      if (!data) continue;
      if (isDomainExcluded(data.url, excluded)) continue;

      try {
        const tab = await browser.tabs.get(Number(tabId));
        if (tab.pinned) continue;
        if (tab.audible) continue;
        if (tab.discarded) continue;
        if (tab.active) continue;

        await browser.tabs.discard(Number(tabId));
        discarded.push({ tabId: Number(tabId), title: data.title });
      } catch (e) {
        console.warn("TabBrain: failed to discard stale tab", tabId, e);
      }
    }

    if (discarded.length > 0 && options.showNotifications) {
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-96.svg",
        title: "TabBrain",
        message: `Suspended ${discarded.length} stale tab${discarded.length > 1 ? "s" : ""} to free memory.`,
      });
    }

    return discarded;
  }

  return { cleanStaleTabs };
})();
