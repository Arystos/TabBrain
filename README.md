# TabBrain

Smart tab manager for Firefox — automatically groups tabs by topic, detects duplicates, cleans stale tabs, and keeps a rescue list so you never lose a tab again.

[![Mozilla Add-on Version](https://img.shields.io/amo/v/tabbrain?label=AMO&color=FF7139&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/addon/tabbrain/)
[![Mozilla Add-on Users](https://img.shields.io/amo/users/tabbrain?color=FF7139)](https://addons.mozilla.org/addon/tabbrain/)
[![Mozilla Add-on Rating](https://img.shields.io/amo/rating/tabbrain?color=FF7139)](https://addons.mozilla.org/addon/tabbrain/)
![Firefox](https://img.shields.io/badge/Firefox-140%2B-FF7139?logo=firefox-browser&logoColor=white)
![Android](https://img.shields.io/badge/Firefox%20Android-142%2B-FF7139?logo=firefox-browser&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20this%20project-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/arystos)

## Why TabBrain?

If you're the kind of person who has 50+ tabs open and loses track of what you were doing, TabBrain is for you. It runs locally in your browser — no external servers, no AI APIs, no data leaves your machine.

- **Topic clustering** — tabs are automatically grouped by content using TF-IDF analysis
- **Duplicate detection** — auto-closes duplicate tabs before they pile up
- **Stale tab cleanup** — suspends tabs you haven't touched in days
- **Snooze** — hide a tab and have it come back later (1 hour, tomorrow, next week)
- **Rescue list** — accidentally closed tabs are saved and recoverable
- **Container support** — works with Firefox Multi-Account Containers
- **Window grouping** — view tabs organized by window
- **Frequency learning** — protects domains you visit often from auto-close
- **Drag & drop** — manually reorganize tabs between groups
- **Export/Import** — save your tab groups as JSON

## Install

### From Firefox Add-ons (AMO)

**[Install TabBrain from Firefox Add-ons](https://addons.mozilla.org/addon/tabbrain/)** — recommended for most users.

### Manual Install (for development)

1. Clone this repository:
   ```bash
   git clone https://github.com/Arystos/TabBrain.git
   ```
2. Open Firefox and go to `about:debugging`
3. Click **"This Firefox"** > **"Load Temporary Add-on"**
4. Select the `manifest.json` file from the cloned folder
5. Click the TabBrain icon in the toolbar

## Usage

Click the TabBrain icon in your toolbar to open the popup:

- **By Topic** — tabs grouped automatically by content similarity
- **By Window** — tabs grouped by browser window
- **By Container** — tabs grouped by Firefox container (Personal, Work, etc.)

Use the **search bar** to find tabs by title or URL. Click a tab to switch to it, or use the close/snooze buttons.

### Settings

Click the gear icon to open settings (opens in a new tab):

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-close duplicates | On | Automatically close duplicate tabs |
| Auto-suspend stale tabs | On | Discard tabs not visited for X days |
| Stale threshold | 3 days | How long before a tab is considered stale |
| Active threshold | 60 min | How long a tab stays "active" after last focus |
| Similarity threshold | 0.25 | How similar tabs must be to group together (lower = more groups) |
| Excluded domains | — | Domains that are never auto-closed |
| Show notifications | Off | Browser notifications when tabs are closed |

### Snooze

Click the clock icon on any tab to snooze it. The tab will close and automatically reopen at the time you choose:
- In 1 hour
- In 3 hours
- Tomorrow at 9am
- Next week

### Keyboard Shortcuts

The search bar is focused by default when you open the popup — just start typing.

## Project Structure

```
TabBrain/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Central processing loop
├── lib/
│   ├── tracker.js         # Tab activity tracking
│   ├── classifier.js      # Tab state classification
│   ├── clusterer.js       # TF-IDF topic clustering
│   ├── deduplicator.js    # Duplicate detection
│   ├── stalecleaner.js    # Stale tab suspension
│   ├── snooze.js          # Snooze & wake-up
│   ├── rescue.js          # Closed tab recovery
│   └── frequency.js       # Domain visit frequency
├── popup/
│   ├── popup.html         # Main popup UI
│   ├── popup.js           # Popup/sidebar rendering & interactions
│   ├── popup.css          # Popup/sidebar styles (responsive)
│   ├── settings.html      # Settings page
│   ├── settings.js        # Settings logic
│   └── themes.css         # Light/dark theme variables
├── sidebar/
│   └── sidebar.html       # Sidebar panel (reuses popup JS/CSS)
└── icons/                 # Extension icons (SVG)
```

## How It Works

1. **Tracking** — every tab's URL, title, focus time, and parent chain is tracked in memory
2. **Classification** — tabs are classified as active, reference, save-for-later, duplicate, stale, or suspended based on focus patterns
3. **Clustering** — tab titles and URLs are tokenized, converted to TF-IDF vectors, and clustered using agglomerative clustering with cosine similarity
4. **Processing** — a central loop runs on tab events (debounced) and every 5 minutes, updating classifications, clusters, and badge counts
5. **Storage** — all state is saved to `browser.storage.local` and read by the popup on open

No data ever leaves your browser. Everything runs locally.

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Read tab URLs, titles, and states for grouping |
| `storage` | Save settings, rescue list, and snooze data |
| `alarms` | Wake up snoozed tabs at the scheduled time |
| `bookmarks` | Bookmark or archive tab groups |
| `notifications` | Optional — notify when tabs are auto-closed |
| `contextualIdentities` | Read Firefox container names for container view |

## Troubleshooting

**Tabs all show as "Default" in container view**
Make sure you have the [Firefox Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/) extension installed and have created some containers.

**The popup doesn't show my latest tabs**
The popup now updates in real-time. If it seems stuck, close and reopen it. Check `about:debugging` > TabBrain > Inspect for console errors.

**My custom group assignments disappeared**
Custom groups persist across re-clustering. If a tab is closed, its custom assignment is cleaned up automatically. Reopening the same URL creates a new tab that will be re-clustered.

**Settings page looks weird / too small**
Settings now open in a full browser tab. If it's still opening in the popup, reload the extension from `about:debugging`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

If you enjoy this project, consider buying me a coffee!

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/arystos)

## License

MIT
