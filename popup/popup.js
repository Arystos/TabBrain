// popup/popup.js
// Renders TabBrain popup UI from pre-computed state

document.addEventListener("DOMContentLoaded", async () => {
  const data = await browser.storage.local.get(["tabbrainState", "rescueList"]);
  const state = data.tabbrainState || {};
  const rescueList = data.rescueList || [];

  const classifications = state.classifications || {};
  const clusters = state.clusters || [];
  const tabData = state.tabData || {};

  renderStats(classifications, clusters);
  renderGroups(clusters, classifications, tabData);
  renderRescueList(rescueList);
  setupSearch();
  setupActions();
});

function renderStats(classifications, clusters) {
  const statuses = Object.values(classifications);
  const total = statuses.length;
  const dups = statuses.filter((s) => s === "duplicate").length;
  const stale = statuses.filter((s) => s === "stale").length;
  const topics = clusters.length;

  document.getElementById("total-count").textContent = `${total} tab${total !== 1 ? "s" : ""}`;
  document.getElementById("dup-count").textContent = `${dups} duplicate${dups !== 1 ? "s" : ""}`;
  document.getElementById("stale-count").textContent = `${stale} stale`;
  document.getElementById("topic-count").textContent = `${topics} topic${topics !== 1 ? "s" : ""}`;

  document.getElementById("btn-close-dups").style.display = dups > 0 ? "" : "none";
  document.getElementById("btn-close-stale").style.display = stale > 0 ? "" : "none";
}

function renderGroups(clusters, classifications, tabData) {
  const container = document.getElementById("groups-container");
  container.innerHTML = "";

  if (clusters.length === 0) {
    container.innerHTML = '<div class="empty-state">No tabs to organize yet.</div>';
    return;
  }

  for (const cluster of clusters) {
    const card = document.createElement("div");
    card.className = "group-card";

    const tabCount = cluster.tabIds.length;

    card.innerHTML = `
      <div class="group-header">
        <span class="group-name">
          ${escapeHtml(cluster.name)}
          <span class="group-count">${tabCount}</span>
        </span>
        <div class="group-actions">
          <button class="action-btn secondary btn-bookmark-group" data-tabs='${JSON.stringify(cluster.tabIds)}'>Bookmark</button>
          <button class="action-btn secondary btn-close-group" data-tabs='${JSON.stringify(cluster.tabIds)}'>Close</button>
        </div>
      </div>
      <div class="group-body"></div>
    `;

    const body = card.querySelector(".group-body");
    for (const tabId of cluster.tabIds) {
      const tab = tabData[tabId];
      if (!tab) continue;
      const status = classifications[tabId] || "active";
      const faviconUrl = getFaviconUrl(tab.url);

      const row = document.createElement("div");
      row.className = "tab-row";
      row.dataset.tabId = tabId;
      row.innerHTML = `
        <img class="tab-favicon" src="${faviconUrl}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect fill=%22%23ddd%22 width=%2216%22 height=%2216%22 rx=%222%22/></svg>'" />
        <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title || tab.url)}</span>
        <span class="tab-status ${status}">${formatStatus(status)}</span>
        <button class="tab-close-btn" data-tab-id="${tabId}" title="Close tab">&times;</button>
      `;

      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("tab-close-btn")) return;
        browser.tabs.update(Number(tabId), { active: true });
        window.close();
      });

      body.appendChild(row);
    }

    // Toggle collapse
    const header = card.querySelector(".group-header");
    header.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
      body.classList.toggle("collapsed");
    });

    container.appendChild(card);
  }

  // Close individual tab buttons
  container.querySelectorAll(".tab-close-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const tabId = Number(btn.dataset.tabId);
      try {
        await browser.tabs.remove(tabId);
        btn.closest(".tab-row").remove();
      } catch (err) {
        console.warn("Failed to close tab", err);
      }
    });
  });

  // Close group buttons
  container.querySelectorAll(".btn-close-group").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const tabIds = JSON.parse(btn.dataset.tabs);
      for (const id of tabIds) {
        try { await browser.tabs.remove(Number(id)); } catch {}
      }
      btn.closest(".group-card").remove();
    });
  });

  // Bookmark group buttons
  container.querySelectorAll(".btn-bookmark-group").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const tabIds = JSON.parse(btn.dataset.tabs);
      const groupName = btn.closest(".group-card").querySelector(".group-name").textContent.trim();
      try {
        const folder = await browser.bookmarks.create({ title: `TabBrain: ${groupName}` });
        for (const id of tabIds) {
          const td = tabData[id];
          if (td) {
            await browser.bookmarks.create({ parentId: folder.id, title: td.title, url: td.url });
          }
        }
        btn.textContent = "Saved!";
        btn.disabled = true;
      } catch (err) {
        console.warn("Failed to bookmark group", err);
      }
    });
  });
}

function renderRescueList(rescueList) {
  const countEl = document.getElementById("rescue-count");
  const listEl = document.getElementById("rescue-list");
  countEl.textContent = rescueList.length;

  listEl.innerHTML = "";
  if (rescueList.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No rescued tabs.</div>';
    return;
  }

  for (let i = 0; i < rescueList.length; i++) {
    const entry = rescueList[i];
    const row = document.createElement("div");
    row.className = "rescue-row";
    row.innerHTML = `
      <span class="tab-title">${escapeHtml(entry.title || entry.url)}</span>
      <span class="rescue-reason">${entry.reason}</span>
      <span class="rescue-time">${timeAgo(entry.closedAt)}</span>
    `;
    row.addEventListener("click", () => {
      browser.runtime.sendMessage({ action: "rescueReopen", index: i });
      row.remove();
    });
    listEl.appendChild(row);
  }
}

function setupSearch() {
  const input = document.getElementById("search-input");
  input.addEventListener("input", () => {
    const query = input.value.toLowerCase().trim();
    document.querySelectorAll(".tab-row").forEach((row) => {
      const title = row.querySelector(".tab-title").textContent.toLowerCase();
      row.style.display = !query || title.includes(query) ? "" : "none";
    });
    document.querySelectorAll(".group-card").forEach((card) => {
      const visibleTabs = card.querySelectorAll(".tab-row:not([style*='display: none'])");
      card.style.display = visibleTabs.length > 0 || !query ? "" : "none";
    });
  });
}

function setupActions() {
  document.getElementById("btn-close-dups").addEventListener("click", () => {
    browser.runtime.sendMessage({ action: "closeDuplicates" });
    window.close();
  });

  document.getElementById("btn-close-stale").addEventListener("click", () => {
    browser.runtime.sendMessage({ action: "closeStale" });
    window.close();
  });

  document.getElementById("btn-clear-rescue").addEventListener("click", () => {
    browser.runtime.sendMessage({ action: "rescueClear" });
    document.getElementById("rescue-list").innerHTML = '<div class="empty-state">No rescued tabs.</div>';
    document.getElementById("rescue-count").textContent = "0";
  });

  document.getElementById("btn-settings").addEventListener("click", () => {
    window.location.href = "settings.html";
  });
}

// Helpers
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatStatus(status) {
  return status.replace(/-/g, " ");
}

function getFaviconUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
