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

  document.getElementById("btn-save").addEventListener("click", saveSettings);
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadForm(DEFAULTS);
    saveSettings();
  });
  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = "popup.html";
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
        alert("Unsupported export format.");
        return;
      }
      let tabCount = 0;
      for (const cluster of (importData.clusters || [])) {
        for (const tabId of cluster.tabIds) {
          const td = importData.tabData[tabId];
          if (td && td.url) {
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
      alert("Failed to import: " + err.message);
    }
    e.target.value = "";
  });
});

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
