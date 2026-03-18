// popup/popup.js
// Renders TabBrain popup UI from pre-computed state

document.addEventListener("DOMContentLoaded", async () => {
  const settingsData = await browser.storage.local.get("tabbrainSettings");
  const theme = (settingsData.tabbrainSettings || {}).theme || "system";
  document.documentElement.setAttribute("data-theme", theme);

  const data = await browser.storage.local.get(["tabbrainState", "rescueList"]);
  const state = data.tabbrainState || {};
  const rescueList = data.rescueList || [];

  const classifications = state.classifications || {};
  const clusters = state.clusters || [];
  const tabData = state.tabData || {};

  renderStats(classifications, clusters);
  renderGroups(clusters, classifications, tabData);
  renderRescueList(rescueList);

  const snoozedData = await browser.runtime.sendMessage({ action: "getSnoozed" });
  renderSnoozedList(snoozedData || []);

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
    const saveForLaterIds = cluster.tabIds.filter((id) => classifications[id] === "save-for-later");

    card.innerHTML = `
      <div class="group-header">
        <span class="group-name">
          ${escapeHtml(cluster.name)}
          <span class="group-count">${tabCount}</span>
        </span>
        <div class="group-actions">
          <button class="action-btn secondary btn-bookmark-group" data-tabs='${JSON.stringify(cluster.tabIds)}'>Bookmark</button>
          <button class="action-btn secondary btn-close-group" data-tabs='${JSON.stringify(cluster.tabIds)}'>Close</button>
          ${saveForLaterIds.length > 0 ? `<button class="action-btn secondary btn-archive-group" data-tabs='${JSON.stringify(saveForLaterIds)}'>Archive</button>` : ""}
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
        <button class="tab-snooze-btn" data-tab-id="${tabId}" title="Snooze tab">&#9203;</button>
        <button class="tab-close-btn" data-tab-id="${tabId}" title="Close tab">&times;</button>
      `;

      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("tab-close-btn") || e.target.classList.contains("tab-snooze-btn")) return;
        browser.tabs.update(Number(tabId), { active: true });
        window.close();
      });

      row.draggable = true;
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", tabId);
        e.dataTransfer.effectAllowed = "move";
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
      });

      body.appendChild(row);
    }

    // Toggle collapse
    const header = card.querySelector(".group-header");
    header.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
      body.classList.toggle("collapsed");
    });

    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      card.classList.add("drag-over");
    });
    body.addEventListener("dragleave", (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove("drag-over");
      }
    });
    body.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const draggedTabId = e.dataTransfer.getData("text/plain");
      const draggedRow = document.querySelector(`.tab-row[data-tab-id="${draggedTabId}"]`);
      if (!draggedRow || draggedRow.closest(".group-card") === card) return;

      const sourceCard = draggedRow.closest(".group-card");
      body.appendChild(draggedRow);

      // Update source group
      const sourceRemaining = sourceCard.querySelectorAll(".tab-row");
      if (sourceRemaining.length === 0) {
        sourceCard.remove();
      } else {
        sourceCard.querySelector(".group-count").textContent = sourceRemaining.length;
      }
      // Update target group
      card.querySelector(".group-count").textContent = body.querySelectorAll(".tab-row").length;

      // Persist custom assignment
      const groupName = card.querySelector(".group-name").firstChild.textContent.trim();
      browser.runtime.sendMessage({
        action: "assignTabToGroup",
        tabId: Number(draggedTabId),
        groupName,
      });
    });

    header.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
      // Auto-expand collapsed groups
      body.classList.remove("collapsed");
    });

    container.appendChild(card);
  }

  // New group drop zone
  const newGroupZone = document.createElement("div");
  newGroupZone.className = "group-card new-group-drop";
  newGroupZone.innerHTML = `<div class="group-header"><span class="group-name">+ Drop here to create new group</span></div>`;

  newGroupZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    newGroupZone.classList.add("drag-over");
  });
  newGroupZone.addEventListener("dragleave", () => {
    newGroupZone.classList.remove("drag-over");
  });
  newGroupZone.addEventListener("drop", (e) => {
    e.preventDefault();
    newGroupZone.classList.remove("drag-over");
    const draggedTabId = e.dataTransfer.getData("text/plain");
    const draggedRow = document.querySelector(`.tab-row[data-tab-id="${draggedTabId}"]`);
    if (!draggedRow) return;

    // Show input for group name
    const input = document.createElement("input");
    input.className = "new-group-input";
    input.placeholder = "Enter group name...";
    input.autofocus = true;
    newGroupZone.appendChild(input);
    input.focus();

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && input.value.trim()) {
        const groupName = input.value.trim();
        // Create new group card
        const newCard = document.createElement("div");
        newCard.className = "group-card";
        newCard.innerHTML = `
          <div class="group-header">
            <span class="group-name">${escapeHtml(groupName)} <span class="group-count">1</span></span>
            <div class="group-actions">
              <button class="action-btn secondary btn-close-group" data-tabs='[${draggedTabId}]'>Close</button>
            </div>
          </div>
          <div class="group-body"></div>
        `;
        const newBody = newCard.querySelector(".group-body");

        // Move tab from source
        const sourceCard = draggedRow.closest(".group-card");
        newBody.appendChild(draggedRow);

        if (sourceCard) {
          const sourceRemaining = sourceCard.querySelectorAll(".tab-row");
          if (sourceRemaining.length === 0) sourceCard.remove();
          else sourceCard.querySelector(".group-count").textContent = sourceRemaining.length;
        }

        container.insertBefore(newCard, newGroupZone);
        input.remove();

        // Persist
        browser.runtime.sendMessage({
          action: "assignTabToGroup",
          tabId: Number(draggedTabId),
          groupName,
        });
      } else if (ev.key === "Escape") {
        input.remove();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => input.remove(), 200);
    });
  });

  container.appendChild(newGroupZone);

  // Close individual tab buttons
  container.querySelectorAll(".tab-close-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const tabId = Number(btn.dataset.tabId);
      try {
        await browser.tabs.remove(tabId);
        const card = btn.closest(".group-card");
        btn.closest(".tab-row").remove();
        // Remove empty group card
        const remaining = card.querySelectorAll(".tab-row");
        if (remaining.length === 0) {
          card.remove();
        } else {
          // Update count badge
          card.querySelector(".group-count").textContent = remaining.length;
        }
      } catch (err) {
        console.warn("Failed to close tab", err);
      }
    });
  });

  // Snooze tab buttons
  container.querySelectorAll(".tab-snooze-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Remove any existing snooze dropdown
      document.querySelectorAll(".snooze-dropdown").forEach((d) => d.remove());

      const dropdown = document.createElement("div");
      dropdown.className = "snooze-dropdown";
      const options = getSnoozeOptions();
      for (const opt of options) {
        const item = document.createElement("div");
        item.className = "snooze-option";
        item.textContent = opt.label;
        item.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const tid = Number(btn.dataset.tabId);
          const td = tabData[tid];
          if (td) {
            await browser.runtime.sendMessage({
              action: "snoozeTab",
              tabData: { url: td.url, title: td.title },
              tabId: tid,
              wakeAt: opt.wakeAt,
            });
          }
          const card = btn.closest(".group-card");
          btn.closest(".tab-row").remove();
          const remaining = card.querySelectorAll(".tab-row");
          if (remaining.length === 0) card.remove();
          else card.querySelector(".group-count").textContent = remaining.length;
          dropdown.remove();
        });
        dropdown.appendChild(item);
      }
      btn.parentElement.appendChild(dropdown);

      // Close dropdown on outside click
      setTimeout(() => {
        document.addEventListener("click", function handler() {
          dropdown.remove();
          document.removeEventListener("click", handler);
        }, { once: true });
      }, 0);
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

  // Archive group buttons
  container.querySelectorAll(".btn-archive-group").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const archiveTabIds = JSON.parse(btn.dataset.tabs);
      const groupName = btn.closest(".group-card").querySelector(".group-name").firstChild.textContent.trim();
      try {
        const folder = await browser.bookmarks.create({ title: `TabBrain Archive: ${groupName}` });
        for (const id of archiveTabIds) {
          const td = tabData[id];
          if (td) {
            await browser.bookmarks.create({ parentId: folder.id, title: td.title, url: td.url });
          }
          try { await browser.tabs.remove(Number(id)); } catch {}
        }
        // Remove archived tab rows from UI
        archiveTabIds.forEach((id) => {
          const row = document.querySelector(`.tab-row[data-tab-id="${id}"]`);
          if (row) row.remove();
        });
        const card = btn.closest(".group-card");
        const remaining = card.querySelectorAll(".tab-row");
        if (remaining.length === 0) {
          card.remove();
        } else {
          card.querySelector(".group-count").textContent = remaining.length;
        }
        btn.textContent = "Archived!";
        btn.disabled = true;
      } catch (err) {
        console.warn("Failed to archive", err);
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

function getSnoozeOptions() {
  const now = new Date();
  const in1h = now.getTime() + 60 * 60 * 1000;
  const in3h = now.getTime() + 3 * 60 * 60 * 1000;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + ((8 - nextWeek.getDay()) % 7 || 7));
  nextWeek.setHours(9, 0, 0, 0);

  return [
    { label: "In 1 hour", wakeAt: in1h },
    { label: "In 3 hours", wakeAt: in3h },
    { label: "Tomorrow 9am", wakeAt: tomorrow.getTime() },
    { label: "Next week", wakeAt: nextWeek.getTime() },
  ];
}

function renderSnoozedList(snoozedList) {
  const countEl = document.getElementById("snooze-count");
  const listEl = document.getElementById("snooze-list");
  countEl.textContent = snoozedList.length;

  listEl.innerHTML = "";
  if (snoozedList.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No snoozed tabs.</div>';
    return;
  }

  for (let i = 0; i < snoozedList.length; i++) {
    const entry = snoozedList[i];
    const row = document.createElement("div");
    row.className = "rescue-row";
    row.innerHTML = `
      <span class="tab-title">${escapeHtml(entry.title || entry.url)}</span>
      <span class="rescue-time">wakes ${timeAgo(entry.wakeAt).replace(" ago", "")}</span>
    `;
    row.addEventListener("click", () => {
      browser.runtime.sendMessage({ action: "cancelSnooze", index: i });
      row.remove();
      countEl.textContent = Number(countEl.textContent) - 1;
    });
    listEl.appendChild(row);
  }
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
