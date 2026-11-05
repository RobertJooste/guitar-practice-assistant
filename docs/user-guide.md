# User Guide

## Getting Started

Run the app using the setup instructions in the [README](../README.md). The dashboard opens with starter exercises, sample songs, and routines. Select **Start practice** to begin the default routine, or use the Routines screen to select another routine.

This app helps you organize and follow your own practice. It is not a course for learning to play guitar and does not provide lessons or assess your playing.

The project includes prototype Electron packages for macOS, Windows, and x64 Linux, plus a production PWA build for secure browser hosting. The Linux Electron package is an AppImage and should be built and tested on a Linux machine. The PWA needs one online visit to load and cache the app; after that, its app shell is designed to reload offline. Installation options and offline behavior vary by browser and are not yet verified across the supported release matrix. Your practice data is stored locally, not in an online account. Browser/PWA and desktop app profiles are separate; use Backup to transfer data between them. The app is free; there is no purchase, license, or activation step.

For development, `npm run desktop` builds and launches the Electron app. `npm run package:mac`, `npm run package:win`, and `npm run package:linux` create prototype downloads in `release/`; the Linux command produces an x64 AppImage. They are engineering builds, not supported release packages.

To try the PWA prototype, build it and serve `dist/` over HTTPS (or use the localhost preview commands in the [README](../README.md)). Open it while online and let the service worker activate; then use the browser's install-app control if that browser provides one. The service worker caches the app shell, not a license or purchase entitlement. Firefox can run the offline-capable browser app, but its standard desktop browser does not provide the same built-in PWA installation flow as Chromium-based browsers.

The main navigation groups pages by purpose: **Practice** contains the dashboard, metronome, routines, and history; **Library** contains exercises and songs; **Explore** contains the fretboard and scale tools; and **Manage** contains backup, settings, and about. On smaller screens, the same navigation becomes a horizontally scrollable row.

## Practice Inspiration

Choose **Inspire me** on the dashboard or **Get inspired** in **Routines** to get a practice idea without first building a routine. Suggestions start at 10 minutes, with longer choices up to 60 minutes. Choose a balanced session, a focus such as technique, songs, or theory/ear training, or one of the categories in your exercise library. The suggestion uses exercises and songs you have saved; it does not add new library content.

The default cadence is three sessions per week. This is a flexible target to help split practice into shorter sessions, not a calendar or an automatically tracked schedule. Adjust the suggested routine name and item durations, or generate another suggestion. **Start suggested session** begins it without saving; **Save as routine** adds it to Routines, where you can edit it later. Suggestions are simple local prompts based on your selected focus and library, not personalized instruction or an assessment of your playing.

## Exercises

Open **Library** to add, search, edit, duplicate, or delete exercises. The form supports a name, category, practice instructions/notes, and default duration. The default duration is copied into a routine item when you add the exercise; changing one routine item later does not change the exercise's default or other routines.

Long exercise descriptions in the library show a three-line preview. Choose **More** to expand the full instructions, or **Less** to collapse them again.

Exercise cards also include an optional five-star **Enjoyment** rating and a **Current challenge** level. The star rating is about how much you enjoy the exercise, not how well you performed it; choose a star to set or change it, or select the active star again to clear it. Challenge levels range from **Very easy** to **Very hard** and reflect your own current experience. Select **Not set** to clear a level, and update it as your skills change. These controls are optional and are never prompted after a session.

If an exercise is used in routines, deleting it asks for confirmation and removes it from those routines. Historical session summaries contain totals rather than exercise references.

## Songs and Tabs

Open **Songs** to save songs with a title and optional artist, tuning, difficulty, practice notes, and plain-text tab/notation. A tab is optional; save a song with only the details you have. The starter library includes ten scale tabs—C major pentatonic, A and E minor pentatonic, G major pentatonic, C major, A natural minor, A minor blues, D Dorian, G Mixolydian, and A harmonic minor—and ten original technique-exercise tabs: chromatic warm-up, spider walk, alternate picking, string crossing, hammer-ons, pull-offs, slides, bend and release, vibrato, and palm-muted rhythm. Exercise examples are stored as tabbed practice-library entries so they can be added to routines and opened in the focused tab view. Song cards are collapsed by default; select a card header to expand its notes, tab/notation, and actions, or select it again to collapse it. Only one song card is expanded at a time. Search, edit, duplicate, or delete saved entries from an expanded card. Use **Add song...** in the Routines screen to include a song or exercise tab as a timed routine item.

Only add tab or song material you have permission to store. The app does not provide licensed song content.

## Fretboard Note Explorer

Open **Fretboard** to see note names on the selected instrument's strings from open through fret 22. Strings follow standard tab order, with the highest string at the top and lowest at the bottom. The diagram shows about 12 frets at a time. Use the always-visible **Scroll along the neck** slider, a trackpad, or the scrollbar to move along the fretboard; moving the slider two steps shows frets 2–14. Choose the instrument and tuning in **Settings**; the current setup is shown above the diagram. Choose sharp or flat note spelling to suit the key or reference you are using.

On a phone or narrow window, scroll the fretboard horizontally. The tool works locally and does not require an account or network connection. It is a note reference only; scale and chord highlighting are not included.

## Scale Practice

Open **Scales** to view major or minor pentatonic patterns, or one of the seven major-scale modes: major (Ionian), Dorian, Phrygian, Lydian, Mixolydian, natural minor (Aeolian), and Locrian. Choose any key; note names are automatically spelled for the selected key and scale so each scale degree uses its own letter name (for example, F major uses Bb rather than A#). Root notes are highlighted in gold.

Pentatonic scales include five selectable box positions. **Box (4–5 frets)** shows the selected shape; **Zoom out (up to 12 frets)** shows more of it. The seven-note scales show every fret from open through fret 22. Use the **Scroll along the neck** slider or scroll the diagram horizontally to see different parts of the neck; the visible fret range adjusts to the available width. Strings follow standard tab order, with the highest string at the top and lowest at the bottom. The tool uses the same instrument and tuning selected in **Settings**; scale notes and pentatonic positions recalculate for those open-string pitches.

This is a standalone visual practice reference; scale choices are not saved, added to routines, or shown in active-session items. Interactive note highlighting is not included.

## Routines

Open **Routines** to create a routine. Add exercises or songs, change each item's duration, drag items by their ↕ handle to reorder them, use the up/down buttons as an alternative, or remove them. These controls work for mixed exercise/song routines; up/down buttons are available to keyboard and touch users. The starter library includes a separate five-minute routine for each tabbed scale and technique exercise. Existing profiles can add any missing examples with **Add starter tab examples**; this does not change the selected or default routine. Expand one of the 20 tab routines, choose **Select routine**, then choose **Start selected routine** to practise it in the focused tab view. The regular starter routines contain exercises only, so they do not show tab controls. Use **Select routine** to choose the routine shown on the dashboard, or choose one with the dashboard's **Practice routine** menu. Selection does not start a session. Use **Start selected routine** in the Routines tab or **Practice selected routine** on the dashboard when you are ready; **Start practice** starts the routine marked **Default**. Use **Make default** to change it; the active default is labeled **Current default**. The total planned duration is shown on each routine.

Use **Rename** to change a routine's name; blank names cannot be saved, and **Cancel rename** discards changes. Use **Duplicate** to make an independent copy of a routine, including its ordered items, durations, and settings. The copy is not made the default or selected automatically.

Routine cards have the same optional enjoyment and current-challenge controls. Rate the routine independently of its exercises; its challenge level is your own assessment and is not calculated from the items in the routine.

Choose **Share routine** on a routine card to download that routine as a separate `.gproutine` file. Its referenced exercises and song details are included; song tab/notation text is excluded unless **Include song tab/notation text** is checked. Only the selected routine and its needed library entries are exported, never practice history, active-session data, or unrelated library items.

Use **Pause at the end of each item** on a routine card, or **Pause at item end** for that routine in **Settings**, to stop the session timer at each exercise or song boundary. The player can keep playing; when ready, choose **Continue** to move to the next item and resume. Time after the planned boundary is not counted. Changing this setting also updates an active session using that routine. The final item completes the session automatically.

The **Settings** tab lets you choose one of five built-in app themes—Classic Indigo, Forest, Ember, Midnight, or Lavender. The selected theme applies across the app, is saved in this browser, and is included in full backups.

Settings also lets you choose a six-string or seven-string guitar, or a four-string or five-string bass, and select an instrument-specific standard or alternate tuning. Presets are Standard, Drop D, D Standard, Open G, and Open D for six-string guitar; Standard, Drop A, and A Standard for seven-string guitar; Standard, Drop D, and D Standard for four-string bass; and Standard, Drop A, and C Standard for five-string bass. You can also customize each open string from E0 to E6. The app remembers the tuning separately for each instrument and applies it to both Fretboard and Scales. Twelve-string guitar is not included because paired-course diagrams have not been designed. Instrument preferences are saved in this browser and included in full backups, but not in shared routine files.

Settings also contains practice-time targets and routine-specific preferences. Choose one shared daily target or set a separate target for each day; zero minutes marks a rest day. Targets can be from 0 to 600 minutes per day. The dashboard compares completed practice with today's target and the combined targets for the last seven days. Targets are saved in this browser and included in backups.

The **About** page (under Manage) shows the app version, explains that your data stays on the device, and links to the GitHub issue tracker for bug reports and ideas. If the app helps your practice, there is also an optional Ko-fi support link; it unlocks nothing and the app is free and complete either way.

On the **Dashboard**, choose **Customize dashboard** to arrange its five content blocks: activity stats, weekly summary, weekly goal, seven-day practice chart, and selected-routine preview. Use the drag handle or **Move up**/**Move down** buttons to change their order; uncheck a block to hide it, or check it again to restore it. Choose a block's **Size** as full or half width on desktop; blocks use full width automatically on narrow screens. By default, activity stats use the full row and the remaining blocks pair up to keep the overview compact. The welcome/start-practice area and active-session controls remain fixed. Changes save automatically in this browser. **Reset dashboard layout** restores the defaults and asks for confirmation if the layout has been customized. Dashboard layout is included in full backups and is not part of shared routine files.

## Practice Sessions

Start from the dashboard. The active-session panel shows separate countdowns for the whole routine and the current exercise or song, along with progress and controls:

- **Pause / Resume:** Paused time is not counted as actual practice time. **Continue** appears after a routine's item-end pause and advances to the next item while resuming the timer.
- **Skip:** Moves to the end of the current item. The skipped remainder is not added to actual practice time.
- **Previous:** Rewinds to the start of the current item, or to the prior item when pressed near an item boundary. It does not erase time already practised.
- **Finish:** Ends the session and records actual elapsed practice time against the routine's planned duration.

The active-session panel includes a **Metronome** with a tempo slider from 40 to 240 BPM, **Start**/**Stop**, and **Tap tempo**. It uses a steady beat at the selected tempo and a visual pulse. The tempo starts at 100 BPM and is kept while the app is open; it is not saved or included in backups. The metronome is also available on its own tab. It uses the device's audio output and does not change or pause the practice-session timer. Time signatures, subdivisions, accents, and volume controls are not currently provided.

The focused tab panel and **Hide tab**/**Show tab** button appear only when the current routine item is a song or exercise tab with saved tab/notation. The regular starter routines contain exercises only, so they will not show these controls; use one of the 20 tab-practice routines in **Routines** to try them. Choose **Hide tab** when you do not need it; the choice lasts for the active session and the panel can be shown again on a tabbed item. Items without saved tab text do not show an empty panel. While the panel is visible, the existing **Pause / Resume** or **Continue** control appears beneath the tab with the session's elapsed time; hiding the panel returns that same control to the normal session controls. This only controls the practice-session timer—there is no audio playback, recording, or audio input. A session uses a snapshot of its routine, so add a song or exercise tab to a routine and start a new session for the change to appear.

When you navigate to another tab during a running or paused session, a compact session indicator shows its status, routine, current item, progress, and time remaining. Use **Pause** while a session is running or **Resume** while paused to control the timer without leaving the current tab; an item-end pause shows **Continue**. Choose **Return to practice** to reopen the full session panel. Completed sessions are not shown as active.

The session keeps a snapshot of its routine items and exercise/song details from when it started. Editing or deleting the source routine or library entries does not rewrite those items. The per-routine pause-at-item-end setting is an exception: changing it also updates an active session using that routine.

Running sessions use timestamps and are saved locally. If you leave the app, close the browser, or the device sleeps while a session is running, elapsed wall-clock time may count when the app resumes. Pause first if you do not want that time included. Recovery behavior should still be treated as unverified across all browsers/devices.

## History and Dashboard

Completed sessions appear in **History** with routine name, actual minutes, planned minutes, and date. The dashboard summarizes daily and recent weekly practice. History does not currently list per-exercise completion or skipped-item details. Completed sessions are retained without a fixed entry cap.

## Backup and Restore

Open **Backup** and choose **Export backup** to download a JSON file containing exercises, routines, songs/tabs, history, selected routine, active-session state, practice-time targets, dashboard layout, instrument/tuning preferences, and the selected app theme. Optional exercise and routine enjoyment ratings and current-challenge levels are included. Older backups without ratings remain supported; backups without targets use the default schedule of 30 minutes on weekdays and zero on weekends, backups without a dashboard layout restore the default dashboard arrangement, backups without instrument settings select six-string guitar in standard tuning, and backups without a theme use Classic Indigo.

Choose **Import backup** to restore a JSON backup. After the file is validated, the app asks for confirmation before replacing anything: import overwrites all current exercises, routines, songs, history, settings, and any active session. Export your current data first if you may want to keep it, and choose **Cancel** to leave your data untouched. The app accepts version 1 and versionless legacy backups, validates record shapes, and rejects unsupported versions or malformed records without changing your data. Keep backup files somewhere separate from browser storage.

To receive an individual routine, choose **Choose routine file** under **Import a shared routine**. Review the routine name and item list, then choose **Add as new routine** or select a routine and choose **Replace selected routine**. Imported exercises and songs are always added as fresh library entries; replacing changes the selected routine's content while preserving its identity, default setting, and personal ratings. Existing library records, practice history, and active-session snapshots are not replaced. Tab/notation text appears in the preview when the sender chose to include it; only share text you have permission to share.

## Data and Troubleshooting

Data is stored in this browser's local storage. It is not synced to another browser or device. Clearing browser data can remove it. Export backups regularly, especially before switching browsers/devices or importing another backup.

If saved browser data fails validation, the app uses safe defaults and displays a warning with an option to download the original invalid values as a recovery file. Download this file before continuing if you need to recover the saved data. It may contain personal practice notes or tab text; store it privately. Browser storage being unavailable or full is not yet comprehensively handled.

If a backup is rejected, confirm that it is a supported version and has valid records. Versionless legacy backups are treated as version 1; backups with unsupported versions are rejected without being imported.
