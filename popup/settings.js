// popup/settings.js

const DEFAULTS = {
  autoCloseDups: true,
  autoCloseStale: true,
  staleDays: 3,
  activeMins: 60,
  saveLaterSecs: 10,
  clusterThreshold: 0.25,
  excludedDomains: "",
};

document.addEventListener("DOMContentLoaded", async () => {
  const data = await browser.storage.local.get("tabbrainSettings");
  const settings = { ...DEFAULTS, ...(data.tabbrainSettings || {}) };
  loadForm(settings);

  document.getElementById("btn-save").addEventListener("click", saveSettings);
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadForm(DEFAULTS);
    saveSettings();
  });
  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = "popup.html";
  });
});

function loadForm(s) {
  document.getElementById("set-auto-dups").checked = s.autoCloseDups;
  document.getElementById("set-auto-stale").checked = s.autoCloseStale;
  document.getElementById("set-stale-days").value = s.staleDays;
  document.getElementById("set-active-mins").value = s.activeMins;
  document.getElementById("set-savelater-secs").value = s.saveLaterSecs;
  document.getElementById("set-cluster-threshold").value = s.clusterThreshold;
  document.getElementById("set-excluded").value = s.excludedDomains;
}

async function saveSettings() {
  const settings = {
    autoCloseDups: document.getElementById("set-auto-dups").checked,
    autoCloseStale: document.getElementById("set-auto-stale").checked,
    staleDays: Number(document.getElementById("set-stale-days").value),
    activeMins: Number(document.getElementById("set-active-mins").value),
    saveLaterSecs: Number(document.getElementById("set-savelater-secs").value),
    clusterThreshold: Number(document.getElementById("set-cluster-threshold").value),
    excludedDomains: document.getElementById("set-excluded").value,
  };
  await browser.storage.local.set({ tabbrainSettings: settings });
  browser.runtime.sendMessage({ action: "reloadSettings" });
  document.getElementById("btn-save").textContent = "Saved!";
  setTimeout(() => {
    document.getElementById("btn-save").textContent = "Save settings";
  }, 1500);
}
