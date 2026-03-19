// popup/settings.js

const DEFAULTS = {
  autoCloseDups: true,
  autoCloseStale: true,
  staleDays: 3,
  activeMins: 60,
  saveLaterSecs: 10,
  clusterThreshold: 0.25,
  showNotifications: false,
  excludedDomains: "",
  theme: "system",
};

document.addEventListener("DOMContentLoaded", async () => {
  const data = await browser.storage.local.get("tabbrainSettings");
  const settings = { ...DEFAULTS, ...(data.tabbrainSettings || {}) };
  document.documentElement.setAttribute("data-theme", settings.theme);
  loadForm(settings);
  loadFrequencyData();

  document.getElementById("btn-save").addEventListener("click", saveSettings);
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadForm(DEFAULTS);
    saveSettings();
  });
  document.getElementById("btn-back").addEventListener("click", () => {
    window.close();
  });

  document.getElementById("set-theme").addEventListener("change", (e) => {
    document.documentElement.setAttribute("data-theme", e.target.value);
  });

  document.getElementById("btn-export").addEventListener("click", async () => {
    const data = await browser.storage.local.get(["tabbrainState", "rescueList", "tabbrain_snoozed"]);
    const state = data.tabbrainState || {};
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clusters: state.clusters || [],
      tabData: state.tabData || {},
      rescueList: data.rescueList || [],
      snoozed: data.tabbrain_snoozed || [],
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabbrain-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      if (importData.version !== 1) {
        document.getElementById("btn-import").textContent = "Unsupported format";
        setTimeout(() => { document.getElementById("btn-import").textContent = "Import tabs"; }, 2000);
        return;
      }
      let tabCount = 0;
      for (const cluster of (importData.clusters || [])) {
        for (const tabId of cluster.tabIds) {
          const td = importData.tabData[tabId];
          if (td && td.url && (td.url.startsWith("http://") || td.url.startsWith("https://"))) {
            await browser.tabs.create({ url: td.url, active: false });
            tabCount++;
          }
        }
      }
      document.getElementById("btn-import").textContent = `Imported ${tabCount} tabs!`;
      setTimeout(() => {
        document.getElementById("btn-import").textContent = "Import tabs";
      }, 2000);
    } catch (err) {
      document.getElementById("btn-import").textContent = "Import failed";
      setTimeout(() => { document.getElementById("btn-import").textContent = "Import tabs"; }, 2000);
    }
    e.target.value = "";
  });
});

async function loadFrequencyData() {
  const data = await browser.storage.local.get("tabbrain_frequency");
  const counts = data.tabbrain_frequency || {};
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const container = document.getElementById("freq-domains");
  if (sorted.length === 0) {
    container.textContent = "No data yet — visit some sites and check back.";
    return;
  }

  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
  for (const [domain, count] of sorted) {
    const pill = document.createElement("span");
    pill.style.cssText = "padding:2px 8px;border-radius:10px;background:var(--bg-card);border:1px solid var(--border);";
    const isProtected = count >= 10;
    if (isProtected) pill.style.borderColor = "var(--focus-border)";
    pill.textContent = `${domain} (${count})`;
    pill.title = isProtected ? "Auto-protected" : `${10 - count} more visits to auto-protect`;
    list.appendChild(pill);
  }
  container.appendChild(list);
}

function loadForm(s) {
  document.getElementById("set-auto-dups").checked = s.autoCloseDups;
  document.getElementById("set-auto-stale").checked = s.autoCloseStale;
  document.getElementById("set-stale-days").value = s.staleDays;
  document.getElementById("set-active-mins").value = s.activeMins;
  document.getElementById("set-savelater-secs").value = s.saveLaterSecs;
  document.getElementById("set-cluster-threshold").value = s.clusterThreshold;
  document.getElementById("set-notifications").checked = s.showNotifications;
  document.getElementById("set-excluded").value = s.excludedDomains;
  document.getElementById("set-theme").value = s.theme;
}

async function saveSettings() {
  const settings = {
    autoCloseDups: document.getElementById("set-auto-dups").checked,
    autoCloseStale: document.getElementById("set-auto-stale").checked,
    staleDays: Number(document.getElementById("set-stale-days").value),
    activeMins: Number(document.getElementById("set-active-mins").value),
    saveLaterSecs: Number(document.getElementById("set-savelater-secs").value),
    clusterThreshold: Number(document.getElementById("set-cluster-threshold").value),
    showNotifications: document.getElementById("set-notifications").checked,
    excludedDomains: document.getElementById("set-excluded").value,
    theme: document.getElementById("set-theme").value,
  };
  await browser.storage.local.set({ tabbrainSettings: settings });
  browser.runtime.sendMessage({ action: "reloadSettings" });
  document.getElementById("btn-save").textContent = "Saved!";
  setTimeout(() => {
    document.getElementById("btn-save").textContent = "Save settings";
  }, 1500);
}
