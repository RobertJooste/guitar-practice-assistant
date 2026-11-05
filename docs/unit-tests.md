# Unit and App-Level Tests

The repository uses Vitest 5. As of 2026-11-03, the automated suite contains 154 tests across 14 files: pure helper/unit tests and React DOM workflow tests. `src/App.test.tsx` and `src/metronome.test.tsx` run in jsdom; there are no automated end-to-end browser tests.

Run the full suite with:

```sh
npm test -- --run
```

Run one or more focused files with:

```sh
npm test -- --run src/App.test.tsx src/fretboard.test.ts
```

## Test file inventory

- `src/App.test.tsx` — 63 app workflow tests covering sessions and compact cross-tab controls, dashboard layout and backup restore, instrument/tuning selection, fretboard/scales, practice targets, ratings, routines and songs, sharing/import, recovery, practice inspiration, starter tab examples, focused tab practice, metronome access during sessions, exercise/routine create-edit flows, and backup-import confirmation.
- `src/metronome.test.tsx` — 1 Web Audio scheduling, visual-pulse, and cleanup test with a mocked AudioContext.
- `src/data-backup.test.ts` — 20 backup serialization, legacy compatibility, nested validation, preferences, and round-trip tests.
- `src/practice-utils.test.ts` — 16 timer, routine-position, previous/next item, and weekly summary tests.
- `src/scales.test.ts` — 15 pentatonic and diatonic scale interval, position, note, root, range, and automatic degree-spelling tests.
- `src/practice-inspiration.test.ts` — 6 local suggestion selection, duration, and empty-library tests.
- `src/routine-sharing.test.ts` — 6 share-package creation, validation, compatibility, and import-shape tests.
- `src/fretboard.test.ts` — 5 note-name, tuning, spelling, and fret-validation tests.
- `src/dashboard-layout.test.ts` — 7 default layout, validation, migration, and widget-movement tests.
- `src/practice-targets.test.ts` — 4 target defaults, rolling-week calculation, and validation tests.
- `src/song-library.test.ts` — 4 song creation, duplication, validation, and duration-default tests.
- `src/instruments.test.ts` — 3 supported instrument profile and tuning tests.
- `src/practice-ratings.test.ts` — 2 enjoyment and current-difficulty validation tests.
- `src/download-file.test.ts` — 2 object-URL cleanup tests for successful and failed download initiation.

The suite covers selected UI workflows and pure calculations. It does not cover session recovery after refresh, device sleep/background timing, unavailable or full browser storage, or a full backup round-trip in a real browser. Browser viewport and visual checks have been performed manually; they are not automated regression tests.

## Latest verification

On 2026-11-03, `npm test -- --run` passed all 154 tests across 14 files on vitest 5.1.0, and `npm run build` and `npm run lint` passed. Re-run checks after code changes; this snapshot does not replace release verification.
