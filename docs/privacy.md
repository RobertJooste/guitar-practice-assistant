# Privacy and Data Handling

Guitar Practice Companion has browser/PWA and Electron delivery prototypes that store practice data locally. This page describes the current application code; it is not a complete commercial privacy notice or legal advice.

## Data Stored by the App

The app stores the following in the current browser origin's `localStorage`:

- Exercise names, categories, instructions, durations, optional fields, enjoyment ratings, and current-challenge levels.
- Routine names, descriptions, ordered items, durations, default selection, per-routine pause-at-item-end preference, enjoyment ratings, and current-challenge levels.
- Song titles, artist, tuning, difficulty, practice notes, and user-entered tab/notation text.
- Practice-time target settings, including the selected schedule mode and daily/weekday minute values.
- Selected routine, dashboard layout, and selected app theme preferences.
- Instrument selection and per-instrument open-string tuning preferences for six- and seven-string guitars and four- and five-string basses.
- Session history, including routine name, actual and planned minutes, and completion time.
- Active-session state used to resume a session, including routine/item snapshots, timer timestamps, and pause-at-item-end state.
- Fretboard and Scales use the shared instrument/tuning preference saved above. Note spelling and scale-view choices (key, scale, position, and view) are temporary and are not saved or included in backups. Metronome tempo is held in app memory only and is not saved or included in backups.
- If stored data fails validation, a local recovery record may contain the original raw values from affected `localStorage` entries. The app offers a JSON download of this record so the user can attempt recovery.

This data is associated with the current app profile and origin. In a browser/PWA, it belongs to that browser's profile and hosted origin; Electron stores it in the local app profile under Electron's per-user data directory. These profiles are separate and do not synchronize. Clearing site/browser or desktop app data may delete it. Private browsing or browser storage restrictions may affect persistence; storage failure handling is not yet comprehensive.

## Backups

Export creates a JSON file on the user's device containing the persisted app data listed above, including practice-time targets, dashboard layout, app theme, instrument/tuning preferences, notes, and tab text. Temporary view preferences such as note spelling and scale selections are not included. Anyone with access to the backup file may be able to read its contents. Store it accordingly. Recovery downloads can also contain raw routine, exercise, song, or session data and are not encrypted by the app.

Import reads a selected JSON file, validates it, and asks for confirmation before replacing the app's current local data. Version 1 and versionless legacy backups are supported; nested records are validated and unsupported versions or malformed records are rejected without changing current data. Users should keep a separate export before restoring a file.

## Network and Third Parties

The app code has no account system, analytics integration, advertising integration, cloud synchronization, or application backend. Electron loads bundled app assets locally. The PWA service worker requests same-origin app assets to load/update the app shell; it does not send practice content. A public host may process connection or server-log data under its own policies; review and disclose the selected host before release.

The app is free. An optional Ko-fi support link may be shown; following it leaves the app and any support payment is processed by Ko-fi under its own privacy policy. The app itself sends Ko-fi no data.

## User Control

Users can edit or delete exercises, routines, and songs in the app and can export a backup. Individual history records cannot currently be deleted in the app. There is no account-based deletion workflow because there are no user accounts. Browser data can also be cleared through browser settings, but doing so may permanently remove unexported practice data.

## Before Public Release

Confirm the production hosting provider, support contact route, applicable jurisdictions, retention practices, and legal disclosure requirements. Update this notice if any analytics, remote service, or data flow is introduced.
