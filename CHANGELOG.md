# Changelog

All notable changes to TabBrain are documented here.

## [0.3.0] - 2025-03-25

### Added
- Published to [Firefox Add-ons (AMO)](https://addons.mozilla.org/addon/tabbrain/)
- Ko-fi funding link for project support
- Privacy policy (PRIVACY.md)
- Contributing guide and issue/PR templates

### Fixed
- Pre-launch polish and bug fixes
- AMO submission compatibility (data_collection_permissions, Android support)
- Bumped minimum Firefox version to 140+ (Android 142+)

## [0.2.0] - 2025-03-19

### Added
- Per-window and per-container grouping views (Firefox Multi-Account Containers support)
- Frequency learning — auto-protect frequently visited domains from cleanup
- Export/import tab groups as JSON
- Drag-and-drop tab organization with custom group creation
- Theme system — light, dark, and system (auto) modes
- Tab count badge on extension icon
- Better topic names (filter garbage words, domain fallback, merge singles into "Other")
- Tab snooze — close now, reopen later (1h / 3h / tomorrow / next week)
- Archive action for save-for-later tabs (bookmark + close)
- Suspend (discard) stale tabs instead of closing them

### Fixed
- Prevent auto-close loop; notifications now opt-in (disabled by default)

## [0.1.0] - 2025-03-18

### Added
- Initial release
- Tab activity tracker (focus time, parent chains, metadata)
- Tab classifier (active / reference / save-for-later / duplicate / stale)
- Topic clustering engine (TF-IDF + agglomerative clustering with cosine similarity)
- Duplicate auto-close with rescue list and notifications
- Stale tab auto-close with periodic processing loop
- Popup UI with stats, topic groups, search, and rescue list
- Settings panel with configurable thresholds and excluded domains
- Excluded domains support for deduplicator and stale cleaner
- Custom brain-with-tabs icons (SVG)
