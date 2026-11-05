# Guitar Practice Companion

A local-first guitar practice app for organizing routines, timing sessions, and reviewing practice history. It is a practice companion, not a learn-to-play course or guitar-teaching app. This is an MVP in active development, not a supported commercial release.

## Current features

- Dashboard with selected/default routines, daily practice totals, and weekly summaries
- Customizable daily or weekday practice-time targets with rolling seven-day progress
- Local practice inspiration with short-first editable suggestions, selectable focus, and save-as-routine
- Exercise library with search, create, edit, duplicate, and delete actions; optional enjoyment ratings and current-challenge levels; long descriptions can expand
- Routine builder with ordered exercises and songs, per-item durations, reordering, default selection, optional enjoyment/challenge ratings, and pause-at-item-end behavior
- Active session controls for pause, resume/continue, skip, previous, and finish
- Focused song and exercise-tab practice during active routines, with an optional tab panel and the existing session timer controls
- Starter tab library with ten scales and ten original technique exercises, each with its own practice routine; existing profiles can add missing examples without replacing their routines
- Grouped navigation for Practice, Library, Explore, and Manage, with a responsive scrollable layout on smaller screens
- Five app-wide themes with restrained, theme-aware hero and primary-action accents
- Compact running/paused session status with pause/resume/continue controls and a return-to-practice action on non-dashboard tabs
- Built-in metronome with adjustable 40–240 BPM tempo, tap tempo, and local audio clicks, on its own tab and inside an active practice session
- Settings tab for instrument profiles and shared tuning, practice-time targets, and routine-specific preferences
- Song library with plain-text tabs, tuning, difficulty, and practice notes
- Scrollable fretboard note explorer through fret 22 for 6-/7-string guitars and 4-/5-string basses, with standard, alternate, and custom tunings
- Standalone major/minor pentatonic patterns plus major, natural minor, and all five other major-scale modes
- Browser-local persistence with invalid-data recovery download and JSON backup export/restore, including instrument/tuning preferences
- Practice history with actual and planned session minutes

## Requirements

- Node.js and npm versions compatible with the dependencies in `package.json`
- A current browser for local use

The project has no-installer Electron package targets for macOS, Windows, and x64 Linux, plus an offline-capable PWA for Linux browsers. These are engineering builds, not production-ready or verified release packages. The PWA requires an initial online visit over HTTPS (or localhost during development); its production build precaches the app shell for later offline launches. Electron loads the bundled app locally. Purchase verification, signing/notarization, production hosting, and an update/distribution service are not implemented. Local browser/PWA and Electron data live in separate app profiles; use backup/restore to move data between them.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validate and build

```sh
npm run lint
npm test -- --run
npm run build
npm run preview
```

`npm run preview` serves the production build locally after `npm run build`. To smoke-test PWA caching, open the preview over localhost while online, reload once to activate its service worker, stop the preview server, then reload again. For prototype delivery builds, use `npm run desktop` to launch the Electron app, `npm run package:mac:arm64` for Apple Silicon, `npm run package:mac:x64` for Intel, or `npm run package:mac:universal` (also `npm run package:mac`) for a build supporting both Mac architectures. `npm run package:win` creates a Windows x64 portable executable. `npm run package:linux` creates an x64 Linux AppImage; verify it on the target Linux machine before relying on it. Packaging artifacts are written to `release/`. These are unsigned engineering builds, not production-ready release packages. The app has been smoke-tested opening on macOS, Windows, and Linux.

## Data and limitations

- Exercises, routines, songs/tabs, history, selection, active-session state, practice-time targets, dashboard layout, and instrument/tuning preferences are stored in this browser's `localStorage`. Fresh profiles receive starter examples; existing profiles can use **Add starter tab examples** to add missing tabbed scales and technique exercises without replacing their routines. Storage is origin-specific and is not synchronized to another browser or device.
- Export a JSON backup from the Backup screen to preserve or move data. It includes practice-time targets, dashboard layout, instrument/tuning preferences, and optional exercise/routine ratings. Import replaces the current app data; export the current data first if you may need it. Version 1 and versionless legacy backups are supported; missing instrument preferences default to six-string guitar in standard tuning; unsupported versions and invalid records are rejected.
- If saved browser data has an invalid shape, the app falls back to safe defaults and offers a download of the original values for recovery. Keep downloaded recovery files private; they may contain practice notes or tab text.
- The production PWA build includes the supplied guitar artwork as resized app icons, a manifest, and a service worker that caches the app shell and updates automatically. It registers only in secure browser contexts; use HTTPS in production. Installability, browser-specific update behavior, and offline operation still need testing across the supported browser/device matrix. Firefox may support offline browser use without offering a native desktop PWA installation flow.
- Electron uses a separate per-user local profile and security-restricted renderer. Its prototype packages use the supplied artwork in native macOS and Windows icon formats, but are not code-signed or notarized. The PWA's hosted origin and Electron's local app origin do not share localStorage; transfer data with a JSON backup.
- The app is free with the full feature set; an optional Ko-fi support link is planned. There is no purchase, activation, or account system.
- Session timing is timestamp-based. Paused time is excluded; skipping and rewinding change routine position without adding practice time. A routine can pause after each item until the player continues. Timer recovery has been verified; background and device-sleep behavior can vary by platform.
- The metronome uses the browser's Web Audio API and does not require network access. Tempo is temporary app memory; audio and tempo have been verified across the app packages.
- This MVP has automated unit and app-level tests, but not a full browser end-to-end suite.

## Project documentation

- [Changelog](CHANGELOG.md) — what changed in each version, including anything that affects stored data
