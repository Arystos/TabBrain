// lib/snooze.js
// Snooze tabs — close now, reopen later

const snooze = (() => {
  const STORAGE_KEY = "tabbrain_snoozed";

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || [];
  }

  async function save(list) {
    await browser.storage.local.set({ [STORAGE_KEY]: list });
  }

  async function snoozeTab(tabData, tabId, wakeAt) {
    const list = await load();
    list.push({
      url: tabData.url,
      title: tabData.title,
      snoozedAt: Date.now(),
      wakeAt,
    });
    await save(list);

    try {
      await browser.tabs.remove(tabId);
      tracker.removeTab(tabId);
    } catch (e) {
      console.warn("TabBrain: failed to close snoozed tab", e);
    }

    await browser.alarms.create(`snooze-${Date.now()}`, { when: wakeAt });
  }

  async function checkWakeups() {
    const list = await load();
    const now = Date.now();
    const wake = list.filter((s) => s.wakeAt <= now);
    const remaining = list.filter((s) => s.wakeAt > now);

    for (const entry of wake) {
      if (entry.url && (entry.url.startsWith("http://") || entry.url.startsWith("https://"))) {
        await browser.tabs.create({ url: entry.url, active: false });
      }
    }

    if (wake.length > 0) {
      await save(remaining);
    }
  }

  async function getSnoozed() {
    return await load();
  }

  async function cancelSnooze(index) {
    const list = await load();
    if (index >= 0 && index < list.length) {
      const entry = list[index];
      if (entry.url && (entry.url.startsWith("http://") || entry.url.startsWith("https://"))) {
        await browser.tabs.create({ url: entry.url });
      }
      list.splice(index, 1);
      await save(list);
    }
  }

  return { snoozeTab, checkWakeups, getSnoozed, cancelSnooze };
})();
