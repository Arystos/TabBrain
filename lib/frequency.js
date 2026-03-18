// lib/frequency.js
// Tracks domain visit frequency to protect frequently-used domains

const frequency = (() => {
  const STORAGE_KEY = "tabbrain_frequency";
  let domainCounts = {};

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    domainCounts = data[STORAGE_KEY] || {};
  }

  async function save() {
    await browser.storage.local.set({ [STORAGE_KEY]: domainCounts });
  }

  function recordVisit(url) {
    try {
      const domain = new URL(url).hostname.replace("www.", "").toLowerCase();
      if (!domain) return;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch {}
  }

  function isFrequent(url, threshold = 10) {
    try {
      const domain = new URL(url).hostname.replace("www.", "").toLowerCase();
      return (domainCounts[domain] || 0) >= threshold;
    } catch {
      return false;
    }
  }

  function getTopDomains(limit = 20) {
    return Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([domain, count]) => ({ domain, count }));
  }

  async function decay() {
    for (const domain of Object.keys(domainCounts)) {
      domainCounts[domain] = Math.floor(domainCounts[domain] * 0.9);
      if (domainCounts[domain] <= 0) delete domainCounts[domain];
    }
    await save();
  }

  return { load, save, recordVisit, isFrequent, getTopDomains, decay };
})();
