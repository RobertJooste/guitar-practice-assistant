# Changelog

All notable changes to Guitar Practice Companion are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/): pre-1.0 versions are betas where minor releases may add features and patch releases contain fixes.

Entries call out when a change affects stored data or backups, so users can tell whether an update touches their saved practice information.

## [Unreleased]

### Added

- About page (under Manage) showing the app version, a GitHub issue link for bug reports and ideas, and an optional Ko-fi support link.
- Backup import now asks for confirmation before replacing current data, explaining that the restore overwrites exercises, routines, songs, history, settings, and any active session.
- UI tests for exercise create/edit/duplicate, routine creation and item management, backup-import confirmation, and invalid-backup rejection.
- GitHub Actions CI workflow running lint, tests, and the production build on every pull request and push to `main`.

### Changed

- Distribution model decision: the app will be free with an optional Ko-fi support link instead of a paid one-time purchase. This removes purchase activation, entitlement, and refund scope from the release plan.
- Upgraded vitest 3.x → 5.1.0, clearing the critical `tinypool`/`@vitest/mocker` audit findings in the test tooling.
- Applied pre-release dependency patches: vite 8.3.5, oxlint 1.90.0, electron 45.2.1. (`@vitejs/plugin-react` 6.2.1 is deferred pending an upstream `@babel/core` 8 peer-dependency conflict.)

### Data and storage notes

- No changes to stored data or the backup format. The new import confirmation changes only the restore workflow, not what is stored.

## [0.1.0] - 2026-11-02

First beta release.

### Added

- Dashboard with daily/weekly practice progress against configurable practice-time targets, and a customizable widget layout.
- Exercise library with categories, instructions, default durations, optional enjoyment ratings, and current-challenge levels.
- Routine builder with mixed exercise/song items, drag-and-drop and button reordering, per-item durations, duplication, renaming, and a default routine.
- Active practice session with timestamp-based timer, pause/resume, skip, previous, early finish, per-routine pause-at-item-end, and a compact session indicator on other tabs.
- Practice history with actual versus planned minutes.
- Song library with plain-text tab/notation, plus a focused tab view during practice sessions.
- Starter content: example exercises, routines, ten scale tabs, and ten technique-exercise tabs with individual routines; existing profiles can merge missing examples explicitly.
- Fretboard note explorer through fret 22 for 6-/7-string guitars and 4-/5-string basses, with standard, alternate, and custom tunings and sharp/flat spelling.
- Scale practice view with major/minor pentatonic box positions and all seven diatonic modes, with automatic key- and degree-aware note spelling.
- Built-in metronome (40–240 BPM, tap tempo, visual pulse) available on its own tab and inside an active session.
- Five app-wide themes.
- JSON backup export/restore with version handling, invalid-data recovery downloads, and shareable `.gproutine` routine files.
- Practice inspiration generator for suggested routines.
- Delivery prototypes: installable PWA with offline app-shell caching, and unsigned Electron packages for macOS (Apple Silicon, Intel, universal), Windows (x64 portable), and Linux (x64 AppImage), using the supplied guitar artwork for icons.

### Data and storage notes

- All data is stored locally in the browser origin's `localStorage` or the Electron app profile. There is no account, sync, or server.
- Backups from this version use backup format version 1; versionless legacy backups are also accepted on import.

### Known limitations

- Session timer behavior across device sleep, backgrounding, and reloads is not yet verified on all platforms.
- Metronome audio, PWA offline behavior, and the Windows/Linux desktop packages still need platform-by-platform verification.
- Packages are unsigned and not notarized; no purchase verification or update service is included.
