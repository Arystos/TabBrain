# Contributing to TabBrain

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Load the extension in Firefox via `about:debugging` > "This Firefox" > "Load Temporary Add-on" and select `manifest.json`
4. Make your changes and test them

## Development

TabBrain is a vanilla JS Firefox extension with no build step. Just edit the files and reload the extension.

**Project structure:**
- `background.js` — Central orchestration, event listeners, processing loop
- `lib/` — Feature modules (tracker, classifier, clusterer, rescue, snooze, frequency, etc.)
- `popup/` — Popup UI and settings page
- `icons/` — Extension icons (SVG)

## Submitting Changes

1. Create a branch for your change (`git checkout -b feat/my-feature`)
2. Make your changes and test thoroughly in Firefox
3. Commit with a clear message (`feat:`, `fix:`, `chore:` prefixes)
4. Push and open a Pull Request

## Reporting Bugs

Open an issue with:
- Firefox version
- Steps to reproduce
- Expected vs actual behavior
- Console errors if any (from `about:debugging` > Inspect)

## Code Style

- Vanilla JS, no frameworks or build tools
- Use existing patterns (IIFEs for modules, `browser.*` APIs)
- Keep it simple — no over-engineering
