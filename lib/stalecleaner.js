// lib/stalecleaner.js
// Auto-closes stale tabs (inactive for X days)

const staleCleaner = (() => {
  async function cleanStaleTabs(allTabData, classifications) {
    const closed = [];

    for (const [tabId, status] of Object.entries(classifications)) {
      if (status !== "stale") continue;
      const data = allTabData[tabId];
      if (!data) continue;

      // Don't close pinned tabs
      try {
        const tab = await browser.tabs.get(Number(tabId));
        if (tab.pinned) continue;
        if (tab.audible) continue; // playing audio
      } catch {
        continue; // Tab doesn't exist anymore
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

    if (closed.length > 0) {
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
