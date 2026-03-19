// lib/rescue.js
// Manages the rescue list — closed tabs that can be recovered

const rescue = (() => {
  const MAX_ENTRIES = 500;
  let list = [];

  async function load() {
    const data = await browser.storage.local.get("rescueList");
    list = data.rescueList || [];
  }

  async function save() {
    await browser.storage.local.set({ rescueList: list });
  }

  async function add(tabData, reason) {
    list.unshift({
      url: tabData.url,
      title: tabData.title,
      closedAt: Date.now(),
      reason, // "duplicate", "stale", "manual"
    });
    if (list.length > MAX_ENTRIES) {
      list = list.slice(0, MAX_ENTRIES);
    }
    await save();
  }

  async function reopen(index) {
    if (index < 0 || index >= list.length) return;
    const entry = list[index];
    if (!entry.url || !(entry.url.startsWith("http://") || entry.url.startsWith("https://"))) return;
    await browser.tabs.create({ url: entry.url });
    list.splice(index, 1);
    await save();
  }

  async function clear() {
    list = [];
    await save();
  }

  function getList() {
    return [...list];
  }

  return { load, add, reopen, clear, getList };
})();
