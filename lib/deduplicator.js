// lib/deduplicator.js
// Detects and auto-closes duplicate tabs

const deduplicator = (() => {
  async function closeDuplicates(allTabData) {
    const duplicateIds = classifier.findDuplicates(allTabData);
    const closed = [];

    for (const tabId of duplicateIds) {
      const data = allTabData[tabId];
      if (!data) continue;
      try {
        await rescue.add(data, "duplicate");
        await browser.tabs.remove(tabId);
        tracker.removeTab(tabId);
        closed.push({ tabId, title: data.title, url: data.url });
      } catch (e) {
        console.warn("TabBrain: failed to close duplicate tab", tabId, e);
      }
    }

    if (closed.length > 0) {
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
