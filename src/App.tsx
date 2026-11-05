import {
  startTransition,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  deriveElapsedMs,
  deriveSessionPositionMs,
  getProgressForElapsed,
  getRoutineTotalMinutes,
  getNextExercisePositionMs,
  getPreviousExerciseElapsedMs,
  summariseWeeklyPractice,
} from './practice-utils'
import { exportAppData, importAppData } from './data-backup'
import {
  isArrayOf,
  isStoredActiveSession,
  isStoredExercise,
  isStoredRoutine,
  isStoredSelectedRoutineId,
  isStoredSessionRecord,
  isStoredSong,
  isStoredPracticeTargets,
  isInstrumentSettings,
  type StoredActiveSession as ActiveSession,
  type StoredExercise as Exercise,
  type StoredRoutine as Routine,
  type StoredRoutineItem as RoutineItem,
  type StoredSessionRecord as SessionRecord,
  type StoredSessionRoutineItem as SessionRoutineItem,
} from './data-validation'
import {
  createSongFromDraft,
  DEFAULT_SONG_DRAFT,
  getDefaultSongDuration,
  validateSongDraft,
  duplicateSong as createSongDuplicate,
  type Song,
  type SongDraft,
} from './song-library'
import { createPracticeSuggestion, type InspirationFocus } from './practice-inspiration'
import {
  createDefaultPracticeTargets,
  DAY_OF_WEEK_KEYS,
  getDailyPracticeTarget,
  getWeeklyPracticeTarget,
  MAX_DAILY_PRACTICE_TARGET_MINUTES,
  type DayOfWeekKey,
  type PracticeTargets,
} from './practice-targets'
import {
  CURRENT_DIFFICULTY_LEVELS,
  isCurrentDifficulty,
  MAX_ENJOYMENT_RATING,
  type CurrentDifficulty,
} from './practice-ratings'
import { downloadBlob } from './download-file'
import {
  createRoutineSharePackage,
  parseRoutineSharePackage,
  type RoutineSharePackage,
} from './routine-sharing'
import {
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDGET_LABELS,
  DEFAULT_DASHBOARD_LAYOUT,
  isDashboardLayout,
  isDefaultDashboardLayout,
  migrateDashboardLayout,
  moveDashboardWidget,
  type DashboardLayout,
  type DashboardWidget,
} from './dashboard-layout'
import FretboardExplorer from './FretboardExplorer'
import ScalePractice from './ScalePractice'
import {
  createDefaultInstrumentSettings,
  findInstrumentTuningPreset,
  INSTRUMENT_PROFILES,
  MAX_TUNING_MIDI_NOTE,
  MIN_TUNING_MIDI_NOTE,
} from './instruments'
import {
  APP_THEMES,
  DEFAULT_APP_THEME,
  isAppTheme,
  type AppTheme,
} from './app-themes'
import { getTuningNoteName } from './fretboard'
import MetronomeControls from './MetronomeControls'
import { useMetronome } from './metronome'
import './App.css'

type AppTab =
  | 'dashboard'
  | 'metronome'
  | 'library'
  | 'routines'
  | 'history'
  | 'backup'
  | 'songs'
  | 'fretboard'
  | 'scales'
  | 'settings'
  | 'about'

type SessionRoutine = Omit<Routine, 'items'> & {
  items: SessionRoutineItem[]
}

type RoutineDragState = {
  routineId: string
  itemId: string
  targetIndex: number
  pointerId: number
}

type DashboardDragState = {
  widget: DashboardWidget
  targetIndex: number
  pointerId: number
}

const ExerciseDescription = ({ exercise }: { exercise: Exercise }) => {
  const [expanded, setExpanded] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const descriptionId = `exercise-description-${useId()}`

  useLayoutEffect(() => {
    const measureOverflow = () => {
      const element = descriptionRef.current
      if (element) {
        setHasOverflow(element.scrollHeight > element.clientHeight)
      }
    }

    measureOverflow()
    window.addEventListener('resize', measureOverflow)
    return () => window.removeEventListener('resize', measureOverflow)
  }, [exercise.description])

  return (
    <>
      <p
        ref={descriptionRef}
        id={descriptionId}
        className={`exercise-description${expanded ? ' expanded' : ''}`}
      >
        {exercise.description}
      </p>
      {hasOverflow && (
        <button
          type="button"
          className="secondary-button exercise-description-toggle"
          aria-expanded={expanded}
          aria-controls={descriptionId}
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </>
  )
}

const EnjoymentRating = ({
  label,
  value,
  onChange,
}: {
  label: string
  value?: number
  onChange: (rating: number | undefined) => void
}) => (
  <div className="enjoyment-rating" role="group" aria-label={`Enjoyment rating for ${label}`}>
    <span>Enjoyment</span>
    <div className="enjoyment-stars">
      {Array.from({ length: MAX_ENJOYMENT_RATING }, (_, index) => {
        const rating = index + 1
        const selected = value === rating
        return (
          <button
            key={rating}
            type="button"
            className={selected ? 'enjoyment-star selected' : 'enjoyment-star'}
            aria-label={selected
              ? `Clear ${label} enjoyment rating`
              : `Rate ${label} enjoyment ${rating} out of ${MAX_ENJOYMENT_RATING} stars`}
            aria-pressed={selected}
            title={selected ? `Clear ${label} enjoyment rating` : `${rating} of 5 stars`}
            onClick={() => onChange(selected ? undefined : rating)}
          >
            {selected || (value !== undefined && rating <= value) ? '★' : '☆'}
          </button>
        )
      })}
    </div>
  </div>
)

const CurrentDifficultyControl = ({
  label,
  value,
  onChange,
}: {
  label: string
  value?: CurrentDifficulty
  onChange: (difficulty: CurrentDifficulty | undefined) => void
}) => (
  <label className="current-difficulty-control">
    <span>Current challenge</span>
    <select
      aria-label={`Current difficulty for ${label}`}
      value={value ?? ''}
      onChange={(event) => {
        const selected = event.target.value
        if (!selected) {
          onChange(undefined)
        } else if (isCurrentDifficulty(selected)) {
          onChange(selected)
        }
      }}
    >
      <option value="">Not set</option>
      {CURRENT_DIFFICULTY_LEVELS.map((difficulty) => (
        <option key={difficulty} value={difficulty}>{difficulty}</option>
      ))}
    </select>
  </label>
)

const STORAGE_KEYS = {
  exercises: 'guitar-practice-exercises',
  routines: 'guitar-practice-routines',
  songs: 'guitar-practice-songs',
  activeSession: 'guitar-practice-active-session',
  history: 'guitar-practice-history',
  selectedRoutine: 'guitar-practice-selected-routine',
  practiceTargets: 'guitar-practice-targets',
  dashboardLayout: 'guitar-practice-dashboard-layout',
  instrumentSettings: 'guitar-practice-instrument-settings',
  appTheme: 'guitar-practice-app-theme',
  recovery: 'guitar-practice-recovery-data',
}

type StoredDataProblem = { key: string; label: string; raw: string }

const isNullableActiveSession = (value: unknown): value is ActiveSession | null =>
  value === null || isStoredActiveSession(value)

const storedDataEntries = [
  { key: STORAGE_KEYS.exercises, label: 'Exercises', isValid: isArrayOf(isStoredExercise) },
  { key: STORAGE_KEYS.routines, label: 'Routines', isValid: isArrayOf(isStoredRoutine) },
  { key: STORAGE_KEYS.songs, label: 'Songs', isValid: isArrayOf(isStoredSong) },
  { key: STORAGE_KEYS.activeSession, label: 'Active session', isValid: isNullableActiveSession },
  { key: STORAGE_KEYS.history, label: 'Practice history', isValid: isArrayOf(isStoredSessionRecord) },
  { key: STORAGE_KEYS.selectedRoutine, label: 'Selected routine', isValid: isStoredSelectedRoutineId },
  { key: STORAGE_KEYS.practiceTargets, label: 'Practice-time targets', isValid: isStoredPracticeTargets },
  { key: STORAGE_KEYS.dashboardLayout, label: 'Dashboard layout', isValid: isDashboardLayout },
  { key: STORAGE_KEYS.instrumentSettings, label: 'Instrument and tuning', isValid: isInstrumentSettings },
  { key: STORAGE_KEYS.appTheme, label: 'App theme', isValid: isAppTheme },
]

const findInvalidStoredData = (): StoredDataProblem[] =>
  storedDataEntries.flatMap(({ key, label, isValid }) => {
    let raw: string | null
    try {
      raw = localStorage.getItem(key)
    } catch {
      return []
    }

    if (raw === null) {
      return []
    }

    try {
      return isValid(JSON.parse(raw)) ? [] : [{ key, label, raw }]
    } catch {
      return [{ key, label, raw }]
    }
  })

const isStoredDataProblem = (value: unknown): value is StoredDataProblem =>
  typeof value === 'object' &&
  value !== null &&
  'key' in value && typeof value.key === 'string' &&
  'label' in value && typeof value.label === 'string' &&
  'raw' in value && typeof value.raw === 'string'

const readRecoveryData = (): StoredDataProblem[] => {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEYS.recovery)
  } catch {
    return findInvalidStoredData()
  }

  if (raw === null) {
    return findInvalidStoredData()
  }

  try {
    const saved: unknown = JSON.parse(raw)
    if (Array.isArray(saved) && saved.every(isStoredDataProblem)) {
      return saved
    }
  } catch {
    return [{ key: STORAGE_KEYS.recovery, label: 'Recovery data', raw }]
  }

  return [{ key: STORAGE_KEYS.recovery, label: 'Recovery data', raw }]
}

const EXERCISES: Exercise[] = [
  {
    id: 'warmup-1',
    name: 'Finger warm-up',
    category: 'Warm-up',
    description: 'Light finger independence and relaxed fretting across the first three frets.',
    defaultDuration: 5,
    notes: 'Keep the wrist calm and relaxed.',
  },
  {
    id: 'technique-1',
    name: 'String skipping',
    category: 'Technique',
    description: 'Alternate across strings with a steady pulse and minimal tension.',
    defaultDuration: 8,
    targetTempo: 88,
  },
  {
    id: 'scale-1',
    name: 'Major scale box',
    category: 'Scales',
    description: 'Practice a clean, even scale pattern with focus on fingering consistency.',
    defaultDuration: 10,
    targetTempo: 96,
  },
  {
    id: 'chords-1',
    name: 'Open chords',
    category: 'Chords',
    description: 'Switch cleanly between the chord shapes while keeping rhythm steady.',
    defaultDuration: 7,
  },
  {
    id: 'rhythm-1',
    name: 'Metronome rhythm',
    category: 'Rhythm',
    description: 'Play simple strumming patterns with a visible count and relaxed timing.',
    defaultDuration: 6,
    targetTempo: 72,
  },
]

const STARTER_SCALE_SONGS: Song[] = [
  {
    id: 'song-c-major-pentatonic',
    title: 'C major pentatonic scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Play C, D, E, G, and A ascending and descending in standard tuning.',
    tab: 'e|-----------------------------------------------3-5-8-5-3-----------|\nB|--------------------------------------3-5-------------5-3----------|\nG|-----------------------------2-5---------------------------5-2-----|\nD|-------------------2-5-------------------------------------------5-2|\nA|----------3-5---------------------------------------------------5-3-|\nE|--------------------------------------------------------------------|',
  },
  {
    id: 'song-a-minor-pentatonic',
    title: 'A minor pentatonic scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Practice the familiar fifth-position shape using A, C, D, E, and G.',
    tab: 'e|------------------------------5-8-5------------------------------|\nB|-------------------------5-8--------8-5--------------------------|\nG|--------------------5-7-------------------7-5--------------------|\nD|---------------5-7------------------------------7-5--------------|\nA|----------5-7-----------------------------------------7-5---------|\nE|-----5-8---------------------------------------------------8-5----|',
  },
  {
    id: 'song-e-minor-pentatonic',
    title: 'E minor pentatonic scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Use the open-position E, G, A, B, and D notes; keep the picking even.',
    tab: 'e|------------------------------0-3-0------------------------------|\nB|-------------------------0-3--------3-0--------------------------|\nG|--------------------0-2-------------------2-0--------------------|\nD|---------------0-2------------------------------2-0--------------|\nA|----------0-2-----------------------------------------2-0---------|\nE|-----0-3---------------------------------------------------3-0----|',
  },
  {
    id: 'song-g-major-pentatonic',
    title: 'G major pentatonic scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Play G, A, B, D, and E through an open-position pattern.',
    tab: 'e|------------------------------3-5-3------------------------------|\nB|-------------------------3-5--------5-3--------------------------|\nG|--------------------2-4-------------------4-2--------------------|\nD|---------------2-5------------------------------5-2--------------|\nA|----------2-5-----------------------------------------5-2---------|\nE|-----3-5---------------------------------------------------5-3----|',
  },
  {
    id: 'song-c-major',
    title: 'C major scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Play the C major notes across two octaves, starting at C on the A string.',
    tab: 'e|-----------------------------------------------0-1-3-5-7-8-7-5-3-1-0|\nB|--------------------------------------0-1-3--------------------------|\nG|-----------------------------0-2------------------------------------|\nD|----------------------2-3-------------------------------------------|\nA|----------3-5--------------------------------------------------------|\nE|---------------------------------------------------------------------|',
  },
  {
    id: 'song-a-natural-minor',
    title: 'A natural minor scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Practice the natural minor notes A, B, C, D, E, F, and G in open position.',
    tab: 'e|---------------------------------------------0-1-3-5-3-1-0------|\nB|------------------------------------0-1-3-------------------3-1-|\nG|---------------------------0-2----------------------------------|\nD|----------------0-2-3-------------------------------------------|\nA|--------0-2-3---------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-a-minor-blues',
    title: 'A minor blues scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Add the blues note Eb to A, C, D, E, and G; play slowly and listen to its tension.',
    tab: 'e|------------------------------5-8-5------------------------------|\nB|-------------------------5-8--------8-5--------------------------|\nG|--------------------5-7-8----------------8-7-5-------------------|\nD|---------------5-7------------------------------7-5--------------|\nA|----------5-6-7-----------------------------------------7-6-5-----|\nE|-----5-8------------------------------------------------------8-5-|',
  },
  {
    id: 'song-d-dorian',
    title: 'D Dorian mode',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Intermediate',
    notes: 'Play D, E, F, G, A, B, and C; notice the major sixth B against D.',
    tab: 'e|--------------------------------1-3-5-7-8-10-8-7----------------|\nB|-----------------------1-3-5-----------------------5-3-1--------|\nG|-----------------0-2-4------------------------------------4-2-0--|\nD|----------0-2-3--------------------------------------------------|\nA|-----------------------------------------------------------------|\nE|-----------------------------------------------------------------|',
  },
  {
    id: 'song-g-mixolydian',
    title: 'G Mixolydian mode',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Intermediate',
    notes: 'Play G, A, B, C, D, E, and F; compare its flat seventh with G major.',
    tab: 'e|------------------------------3-5-7-8-7-5-3---------------------|\nB|-------------------------3-5-----------------5-3----------------|\nG|--------------------2-4---------------------------4-2------------|\nD|---------------2-3-5---------------------------------5-3-2------|\nA|----------2-3-5---------------------------------------------5-3-2|\nE|-----3-5---------------------------------------------------------|',
  },
  {
    id: 'song-a-harmonic-minor',
    title: 'A harmonic minor scale',
    artist: 'Practice example',
    tuning: 'E A D G B E',
    difficulty: 'Intermediate',
    notes: 'Practice A, B, C, D, E, F, and G sharp; hear the raised seventh leading to A.',
    tab: 'e|---------------------------------------------0-1-4-5-4-1-0------|\nB|------------------------------------0-1-3-------------------3-1-|\nG|---------------------------1-2----------------------------------|\nD|----------------0-2-3-------------------------------------------|\nA|--------0-2-3---------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
]

const STARTER_TECHNIQUE_SONGS: Song[] = [
  {
    id: 'song-chromatic-fingering',
    title: 'Chromatic 1-2-3-4 warm-up',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Use index, middle, ring, and little fingers for frets 1-2-3-4. Keep each note even and relaxed.',
    tab: 'e|------------------------------------------------1-2-3-4-4-3-2-1-|\nB|------------------------------------1-2-3-4---------------------|\nG|------------------------1-2-3-4---------------------------------|\nD|------------1-2-3-4---------------------------------------------|\nA|1-2-3-4---------------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-spider-walk',
    title: 'Spider walk finger independence',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Keep one finger down at a time and lift only as needed. Move slowly without letting notes ring into each other.',
    tab: 'e|----------------------------1-3-2-4-----------------------------|\nB|--------------------1-3-2-4-------------------------------------|\nG|------------1-3-2-4---------------------------------------------|\nD|----1-3-2-4-----------------------------------------------------|\nA|----------------------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-alternate-picking',
    title: 'Alternate-picking string run',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Use strict down-up picking on every note; start slowly and keep the pick motion small.',
    tab: 'e|-------------------------1-2-3-4-3-2-1--------------------------|\nB|-----------------1-2-3-4-------------4-3-2-1--------------------|\nG|---------1-2-3-4-----------------------------4-3-2-1------------|\nD|-1-2-3-4---------------------------------------------4-3-2-1----|\nA|----------------------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-string-crossing',
    title: 'String-crossing accuracy',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Alternate pick while crossing between non-adjacent strings. Let unused strings stay quiet.',
    tab: 'e|----------------0-------0-------0-------0-----------------------|\nB|----------------------------------------------------------------|\nG|----------0-------0-------0-------0-----------------------------|\nD|----------------------------------------------------------------|\nA|----0-------0-------0-------0-----------------------------------|\nE|0-------0-------0-------0---------------------------------------|',
  },
  {
    id: 'song-hammer-ons',
    title: 'Hammer-on control',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Pick the first note of each pair, then hammer onto the higher fret with a clear, even sound.',
    tab: 'e|-------------------------------5h7-5----------------------------|\nB|-------------------------5h7-----------7-5----------------------|\nG|-------------------4h6-----------------------6-4----------------|\nD|-------------4h6-------------------------------6-4--------------|\nA|-------5h7-------------------------------------------7-5--------|\nE|-5h7-------------------------------------------------------7-5--|',
  },
  {
    id: 'song-pull-offs',
    title: 'Pull-off control',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Pick the higher note, then pull off to sound the lower note without pulling the string out of tune.',
    tab: 'e|-------------------------------7p5-7----------------------------|\nB|-------------------------7p5-----------5-7----------------------|\nG|-------------------6p4-----------------------4-6----------------|\nD|-------------6p4-------------------------------4-6--------------|\nA|-------7p5-------------------------------------------5-7--------|\nE|-7p5-------------------------------------------------------5-7--|',
  },
  {
    id: 'song-slides',
    title: 'Slide accuracy',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Keep fretting pressure while sliding between the marked notes, then release cleanly.',
    tab: 'e|-----------------------------5/7\\5------------------------------|\nB|-----------------------5/7-----------7\\5------------------------|\nG|-----------------4/6-----------------------6\\4------------------|\nD|-----------4/6-------------------------------6\\4----------------|\nA|-----5/7-------------------------------------------7\\5----------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-bend-release',
    title: 'Bend and release control',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Intermediate',
    notes: 'Bend the G-string seventh fret up to the pitch of fret 9, hold briefly, then release in tune.',
    tab: 'e|----------------------------------------------------------------|\nB|----------------------------------------------------------------|\nG|-----7b9r7-----7b9r7-----7b9r7-----7----------------------------|\nD|----------------------------------------------------------------|\nA|----------------------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-vibrato',
    title: 'Vibrato steadiness',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Hold each fretted note and add slow, even vibrato from the fretting hand; keep the pitch centered.',
    tab: 'e|----------------------------------------------------------------|\nB|----------------------------------------------------------------|\nG|-----5~~~~~~~~~~~-----7~~~~~~~~~~~-----5------------------------|\nD|----------------------------------------------------------------|\nA|----------------------------------------------------------------|\nE|----------------------------------------------------------------|',
  },
  {
    id: 'song-palm-muted-rhythm',
    title: 'Palm-muted rhythm control',
    artist: 'Practice exercise',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Lightly rest the picking hand near the bridge for the muted notes (PM). Keep the pulse steady.',
    tab: 'e|----------------------------------------------------------------|\nB|----------------------------------------------------------------|\nG|----------------------------------------------------------------|\nD|----------------------------------------------------------------|\nA|----------------------------------------------------------------|\nE|PM--0-0-0---0-0---0-0-0---0-0---0-0-0---0-0---0-0-0---0-0-------|',
  },
]

const STARTER_TAB_SONGS = [...STARTER_SCALE_SONGS, ...STARTER_TECHNIQUE_SONGS]

const createStarterTabRoutines = (songs: Song[], category: 'scale' | 'technique'): Routine[] =>
  songs.map((song): Routine => {
    const routineId = `starter-${song.id.slice('song-'.length)}`

    return {
      id: routineId,
      name: song.id === 'song-c-major-pentatonic'
        ? 'C major pentatonic tab practice'
        : `${song.title} practice`,
      description: `A five-minute ${category} practice routine using a tab example.`,
      items: [{
        id: `${routineId}-item`,
        kind: 'song',
        songId: song.id,
        duration: 5,
      }],
    }
  })

const STARTER_SCALE_ROUTINES = createStarterTabRoutines(STARTER_SCALE_SONGS, 'scale')
const STARTER_TECHNIQUE_ROUTINES = createStarterTabRoutines(
  STARTER_TECHNIQUE_SONGS,
  'technique',
)

const STARTER_ROUTINES: Routine[] = [
  {
    id: 'starter-20',
    name: '20-minute practice',
    description: 'Quick, balanced routine for a focused daily session.',
    isDefault: true,
    items: [
      { id: 'r-1', exerciseId: 'warmup-1', duration: 5 },
      { id: 'r-2', exerciseId: 'technique-1', duration: 5 },
      { id: 'r-3', exerciseId: 'scale-1', duration: 5 },
      { id: 'r-4', exerciseId: 'rhythm-1', duration: 5 },
    ],
  },
  {
    id: 'starter-30',
    name: '30-minute practice',
    description: 'A fuller routine covering warm-up, technique, and chord work.',
    items: [
      { id: 'r-5', exerciseId: 'warmup-1', duration: 5 },
      { id: 'r-6', exerciseId: 'technique-1', duration: 8 },
      { id: 'r-7', exerciseId: 'scale-1', duration: 7 },
      { id: 'r-8', exerciseId: 'chords-1', duration: 5 },
      { id: 'r-9', exerciseId: 'rhythm-1', duration: 5 },
    ],
  },
  {
    id: 'starter-60',
    name: '60-minute practice',
    description: 'A longer structured routine for more complete development.',
    items: [
      { id: 'r-10', exerciseId: 'warmup-1', duration: 10 },
      { id: 'r-11', exerciseId: 'technique-1', duration: 12 },
      { id: 'r-12', exerciseId: 'scale-1', duration: 12 },
      { id: 'r-13', exerciseId: 'chords-1', duration: 10 },
      { id: 'r-14', exerciseId: 'rhythm-1', duration: 10 },
      { id: 'r-15', exerciseId: 'technique-1', duration: 6 },
    ],
  },
  ...STARTER_SCALE_ROUTINES,
  ...STARTER_TECHNIQUE_ROUTINES,
]

const STARTER_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Sample rhythm riff',
    artist: 'Practice set',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: 'Work this slowly and keep the downstroke even.',
    tab: 'e|-------------------|\nB|-------------------|\nG|-------------------|\nD|---0-2-0-2-0-2-----|\nA|-2---------------2-|\nE|-------------------|',
  },
  {
    id: 'song-2',
    title: 'Pentatonic warm-up',
    artist: 'Practice set',
    tuning: 'E A D G B E',
    difficulty: 'Intermediate',
    notes: 'Alternate between ascending and descending positions while keeping tension low.',
    tab: 'e|-------------------|\nB|-------------------|\nG|-------------------|\nD|---2-3-5-3-2-------|\nA|-5-----------5-3-2-|\nE|-------------------|',
  },
  ...STARTER_TAB_SONGS,
]

const readStoredData = <T,>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return fallback
    }

    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

const formatDurations = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const getExerciseById = (exerciseId: string, exercises: Exercise[]) =>
  exercises.find((exercise) => exercise.id === exerciseId)

const getSongById = (songId: string, songs: Song[]) => songs.find((song) => song.id === songId)

const getRoutineItemLabel = (item: RoutineItem, exercises: Exercise[], songs: Song[]) => {
  if (item.kind === 'song' && item.songId) {
    return getSongById(item.songId, songs)?.title ?? 'Song practice'
  }

  if (item.exerciseId) {
    return getExerciseById(item.exerciseId, exercises)?.name ?? 'Exercise'
  }

  return 'Practice item'
}

const createSessionFromRoutine = (
  routine: Routine,
  exercises: Exercise[],
  songs: Song[],
): ActiveSession => {
  const totalMs = getRoutineTotalMinutes(routine) * 60_000

  return {
    id: crypto.randomUUID(),
    routineId: routine.id,
    routineName: routine.name,
    totalMs,
    status: 'running',
    elapsedMs: 0,
    positionOffsetMs: 0,
    lastUpdatedAt: Date.now(),
    pauseAtItemEnd: Boolean(routine.pauseAtItemEnd),
    items: routine.items.map((item) => {
      const exercise = item.exerciseId ? getExerciseById(item.exerciseId, exercises) : undefined
      const song = item.songId ? getSongById(item.songId, songs) : undefined

      return {
        ...item,
        ...(exercise ? { exerciseSnapshot: { ...exercise } } : {}),
        ...(song ? { songSnapshot: { ...song } } : {}),
      }
    }),
  }
}

function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="page-hero">
      <div className="page-hero-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="page-hero-description">{description}</p>
      </div>
      {actions && <div className="page-hero-actions">{actions}</div>}
    </header>
  )
}

function App() {
  const [tab, setTab] = useState<AppTab>('dashboard')
  const metronome = useMetronome()
  const [storageRecoveryItems, setStorageRecoveryItems] = useState<StoredDataProblem[]>(readRecoveryData)
  const [storageError, setStorageError] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    readStoredData(STORAGE_KEYS.exercises, EXERCISES, isArrayOf(isStoredExercise)),
  )
  const [routines, setRoutines] = useState<Routine[]>(() =>
    readStoredData(STORAGE_KEYS.routines, STARTER_ROUTINES, isArrayOf(isStoredRoutine)),
  )
  const [songs, setSongs] = useState<Song[]>(() =>
    readStoredData(STORAGE_KEYS.songs, STARTER_SONGS, isArrayOf(isStoredSong)),
  )
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(() => {
    const storedSelection = readStoredData(
      STORAGE_KEYS.selectedRoutine,
      STARTER_ROUTINES[0].id,
      isStoredSelectedRoutineId,
    )
    return routines.some((routine) => routine.id === storedSelection)
      ? storedSelection
      : routines[0]?.id ?? ''
  })
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null)
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null)
  const [routineDrag, setRoutineDrag] = useState<RoutineDragState | null>(null)
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>(() =>
    migrateDashboardLayout(
      readStoredData(STORAGE_KEYS.dashboardLayout, DEFAULT_DASHBOARD_LAYOUT, isDashboardLayout),
    ),
  )
  const [instrumentSettings, setInstrumentSettings] = useState(() =>
    readStoredData(
      STORAGE_KEYS.instrumentSettings,
      createDefaultInstrumentSettings(),
      isInstrumentSettings,
    ),
  )
  const [appTheme, setAppTheme] = useState<AppTheme>(() =>
    readStoredData(STORAGE_KEYS.appTheme, DEFAULT_APP_THEME, isAppTheme),
  )
  const [dashboardCustomizationOpen, setDashboardCustomizationOpen] = useState(false)
  const [dashboardDrag, setDashboardDrag] = useState<DashboardDragState | null>(null)
  const [history, setHistory] = useState<SessionRecord[]>(() =>
    readStoredData(STORAGE_KEYS.history, [], isArrayOf(isStoredSessionRecord)),
  )
  const [practiceTargets, setPracticeTargets] = useState<PracticeTargets>(() =>
    readStoredData(
      STORAGE_KEYS.practiceTargets,
      createDefaultPracticeTargets(),
      isStoredPracticeTargets,
    ),
  )
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => {
    const saved = readStoredData<ActiveSession | null>(
      STORAGE_KEYS.activeSession,
      null,
      isNullableActiveSession,
    )

    if (!saved) {
      return null
    }

    const savedRoutine = routines.find((routine) => routine.id === saved.routineId)
    const pauseAtItemEnd = saved.pauseAtItemEnd ?? Boolean(savedRoutine?.pauseAtItemEnd)
    const now = Date.now()

    if (saved.status === 'running') {
      return {
        ...saved,
        elapsedMs: saved.elapsedMs + Math.max(0, now - saved.lastUpdatedAt),
        positionOffsetMs: saved.positionOffsetMs ?? 0,
        lastUpdatedAt: now,
        pauseAtItemEnd,
      }
    }

    return { ...saved, positionOffsetMs: saved.positionOffsetMs ?? 0, pauseAtItemEnd }
  })
  const [hiddenTabSessionId, setHiddenTabSessionId] = useState<string | null>(null)
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    category: 'Technique',
    description: '',
    defaultDuration: 5,
  })
  const [songForm, setSongForm] = useState<SongDraft>({ ...DEFAULT_SONG_DRAFT })
  const [exerciseFilter, setExerciseFilter] = useState('')
  const [songFilter, setSongFilter] = useState('')
  const [routineName, setRoutineName] = useState('')
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [editingSongId, setEditingSongId] = useState<string | null>(null)
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null)
  const [editingRoutineName, setEditingRoutineName] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [routineExportId, setRoutineExportId] = useState<string | null>(null)
  const [includeTabsInRoutineExport, setIncludeTabsInRoutineExport] = useState(false)
  const [routineImportPackage, setRoutineImportPackage] = useState<RoutineSharePackage | null>(null)
  const [routineImportTargetId, setRoutineImportTargetId] = useState('')
  const [routineShareMessage, setRoutineShareMessage] = useState('')
  const [songMessage, setSongMessage] = useState('')
  const [inspirationOpen, setInspirationOpen] = useState(false)
  const [inspirationDuration, setInspirationDuration] = useState(10)
  const [inspirationFrequency, setInspirationFrequency] = useState(3)
  const [inspirationFocus, setInspirationFocus] = useState<InspirationFocus>('balanced')
  const [inspirationVariation, setInspirationVariation] = useState(0)
  const [suggestion, setSuggestion] = useState<Routine | null>(null)
  const [suggestionName, setSuggestionName] = useState('')
  const [suggestionSaved, setSuggestionSaved] = useState(false)
  const [suggestionMessage, setSuggestionMessage] = useState('')

  useLayoutEffect(() => {
    document.documentElement.dataset.appTheme = appTheme
    return () => {
      delete document.documentElement.dataset.appTheme
    }
  }, [appTheme])

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      startTransition(() => { setStorageError(true) })
    }
  }

  useEffect(() => {
    if (storageRecoveryItems.length > 0) {
      safeSetItem(STORAGE_KEYS.recovery, JSON.stringify(storageRecoveryItems))
    }
  }, [storageRecoveryItems])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.exercises, JSON.stringify(exercises))
  }, [exercises])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.routines, JSON.stringify(routines))
  }, [routines])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.songs, JSON.stringify(songs))
  }, [songs])

  useEffect(() => {
    if (selectedRoutineId) {
      safeSetItem(STORAGE_KEYS.selectedRoutine, JSON.stringify(selectedRoutineId))
    }
  }, [selectedRoutineId])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.history, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.practiceTargets, JSON.stringify(practiceTargets))
  }, [practiceTargets])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.dashboardLayout, JSON.stringify(dashboardLayout))
  }, [dashboardLayout])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.instrumentSettings, JSON.stringify(instrumentSettings))
  }, [instrumentSettings])

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.appTheme, JSON.stringify(appTheme))
  }, [appTheme])

  useEffect(() => {
    if (activeSession) {
      safeSetItem(STORAGE_KEYS.activeSession, JSON.stringify(activeSession))
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.activeSession)
      } catch {
        startTransition(() => { setStorageError(true) })
      }
    }
  }, [activeSession])

  const runningSessionId = activeSession?.status === 'running' ? activeSession.id : null

  useEffect(() => {
    if (!runningSessionId) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveSession((previous) => {
        if (!previous || previous.status !== 'running') {
          return previous
        }

        const now = Date.now()
        const positionOffsetMs = previous.positionOffsetMs ?? 0
        const previousPositionMs = Math.max(0, previous.elapsedMs + positionOffsetMs)
        const updatedElapsedMs = deriveElapsedMs(previous, now)
        const nextPositionMs = Math.min(
          previous.totalMs,
          deriveSessionPositionMs(previous, now),
        )

        if (nextPositionMs >= previous.totalMs) {
          const completedSession = {
            ...previous,
            elapsedMs: updatedElapsedMs,
            positionOffsetMs,
            status: 'completed' as const,
            pauseReason: undefined,
            lastUpdatedAt: now,
          }
          return completedSession
        }

        if (previous.pauseAtItemEnd) {
          const progressBeforeTick = getProgressForElapsed(
            { items: previous.items },
            previousPositionMs,
          )
          const currentItem = previous.items[progressBeforeTick.currentIndex]
          const itemEndMs = currentItem
            ? progressBeforeTick.beforeCurrentMs + currentItem.duration * 60_000
            : previous.totalMs

          if (currentItem && previousPositionMs < itemEndMs && nextPositionMs >= itemEndMs) {
            return {
              ...previous,
              elapsedMs: Math.max(previous.elapsedMs, itemEndMs - positionOffsetMs),
              positionOffsetMs,
              status: 'paused',
              pauseReason: 'item-end',
              lastUpdatedAt: now,
            }
          }
        }

        return {
          ...previous,
          elapsedMs: updatedElapsedMs,
          positionOffsetMs,
          lastUpdatedAt: now,
        }
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [runningSessionId])

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'completed') {
      return
    }

    const record: SessionRecord = {
      id: activeSession.id,
      routineName: activeSession.routineName,
      actualMinutes: Math.round(activeSession.elapsedMs / 60000),
      plannedMinutes: Math.round(activeSession.totalMs / 60000),
      completedAt: new Date().toISOString(),
    }

    startTransition(() => {
      setHistory((previous) => {
        if (previous.some((entry) => entry.id === record.id)) {
          return previous
        }

        return [record, ...previous]
      })
    })
  }, [activeSession])

  useEffect(() => {
    if (!routineDrag) {
      return
    }

    const updateDropTarget = (event: PointerEvent) => {
      if (event.pointerId !== routineDrag.pointerId) {
        return
      }

      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-routine-id][data-routine-index]')

      if (!target || target.dataset.routineId !== routineDrag.routineId) {
        return
      }

      const targetIndex = Number(target.dataset.routineIndex)
      if (!Number.isInteger(targetIndex)) {
        return
      }

      setRoutineDrag((previous) =>
        previous && previous.targetIndex !== targetIndex
          ? { ...previous, targetIndex }
          : previous,
      )
    }

    const finishDrag = (event: PointerEvent, shouldReorder: boolean) => {
      if (event.pointerId !== routineDrag.pointerId) {
        return
      }

      if (shouldReorder) {
        setRoutines((previous) =>
          previous.map((routine) => {
            if (routine.id !== routineDrag.routineId) {
              return routine
            }

            const fromIndex = routine.items.findIndex((item) => item.id === routineDrag.itemId)
            const toIndex = Math.max(0, Math.min(routineDrag.targetIndex, routine.items.length - 1))
            if (fromIndex < 0 || fromIndex === toIndex) {
              return routine
            }

            const items = [...routine.items]
            const [draggedItem] = items.splice(fromIndex, 1)
            items.splice(toIndex, 0, draggedItem)
            return { ...routine, items }
          }),
        )
      }

      setRoutineDrag(null)
    }

    const handlePointerUp = (event: PointerEvent) => finishDrag(event, true)
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, false)

    window.addEventListener('pointermove', updateDropTarget)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      window.removeEventListener('pointermove', updateDropTarget)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [routineDrag])

  useEffect(() => {
    if (!dashboardDrag) {
      return
    }

    const updateDropTarget = (event: PointerEvent) => {
      if (event.pointerId !== dashboardDrag.pointerId) {
        return
      }

      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-dashboard-widget][data-dashboard-index]')
      if (!target) {
        return
      }

      const targetIndex = Number(target.dataset.dashboardIndex)
      if (!Number.isInteger(targetIndex)) {
        return
      }

      setDashboardDrag((previous) =>
        previous && previous.targetIndex !== targetIndex
          ? { ...previous, targetIndex }
          : previous,
      )
    }

    const finishDrag = (event: PointerEvent, shouldReorder: boolean) => {
      if (event.pointerId !== dashboardDrag.pointerId) {
        return
      }

      if (shouldReorder) {
        setDashboardLayout((previous) => ({
          ...previous,
          order: moveDashboardWidget(
            previous.order,
            dashboardDrag.widget,
            dashboardDrag.targetIndex,
          ),
        }))
      }
      setDashboardDrag(null)
    }

    const handlePointerUp = (event: PointerEvent) => finishDrag(event, true)
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, false)

    window.addEventListener('pointermove', updateDropTarget)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      window.removeEventListener('pointermove', updateDropTarget)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [dashboardDrag])

  const selectedRoutine =
    routines.find((routine) => routine.id === selectedRoutineId) ?? routines[0] ?? null

  const defaultRoutine = routines.find((routine) => routine.isDefault) ?? routines[0] ?? null

  const { todayPracticeMinutes, currentDate } = useMemo(() => {
    // eslint-disable-next-line react/purity -- intentional: date is needed to determine today; re-renders from the active-session timer keep this current
    const currentDate = new Date()
    const today = currentDate.toDateString()
    const todayPracticeMinutes = history
      .filter((entry) => new Date(entry.completedAt).toDateString() === today)
      .reduce((sum, entry) => sum + entry.actualMinutes, 0)

    return { todayPracticeMinutes, currentDate }
  }, [history])

  const visibleExercises = exercises.filter((exercise) => {
    if (!exerciseFilter.trim()) {
      return true
    }

    const query = exerciseFilter.toLowerCase()
    return (
      exercise.name.toLowerCase().includes(query) ||
      exercise.category.toLowerCase().includes(query) ||
      exercise.description.toLowerCase().includes(query)
    )
  })

  const visibleSongs = songs.filter((song) => {
    if (!songFilter.trim()) {
      return true
    }

    const query = songFilter.toLowerCase()
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      song.notes.toLowerCase().includes(query) ||
      song.tuning.toLowerCase().includes(query) ||
      song.difficulty.toLowerCase().includes(query)
    )
  })

  const startPractice = (routine: Routine) => {
    const newSession = createSessionFromRoutine(routine, exercises, songs)
    if (routines.some((savedRoutine) => savedRoutine.id === routine.id)) {
      setSelectedRoutineId(routine.id)
    }
    setTab('dashboard')
    setDashboardCustomizationOpen(false)
    setInspirationOpen(false)
    setActiveSession(newSession)
  }

  const generateInspiration = () => {
    const plan = createPracticeSuggestion({
      durationMinutes: inspirationDuration,
      focus: inspirationFocus,
      exercises,
      songs,
      variation: inspirationVariation,
    })
    setInspirationVariation((previous) => previous + 1)

    if (!plan) {
      setSuggestion(null)
      setSuggestionMessage('Add an exercise or song to your library to get a practice suggestion.')
      return
    }

    const focusLabel = inspirationFocus === 'balanced'
      ? 'balanced'
      : inspirationFocus === 'theory-ear'
        ? 'theory and ear'
        : inspirationFocus === 'songs'
          ? 'song practice'
          : inspirationFocus
    const nextName = `${plan.durationMinutes}-minute ${focusLabel} practice`

    setSuggestion({
      id: crypto.randomUUID(),
      name: nextName,
      description: plan.reason,
      items: plan.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      pauseAtItemEnd: false,
    })
    setSuggestionName(nextName)
    setSuggestionSaved(false)
    setSuggestionMessage('')
  }

  const toggleInspiration = () => {
    if (inspirationOpen) {
      setInspirationOpen(false)
      return
    }

    setInspirationOpen(true)
    generateInspiration()
  }

  const updateSuggestionItem = (itemId: string, duration: number) => {
    setSuggestion((previous) => previous && ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === itemId ? { ...item, duration: Math.max(1, duration) } : item,
      ),
    }))
    setSuggestionSaved(false)
  }

  const saveSuggestionAsRoutine = () => {
    if (!suggestion || suggestionSaved) {
      return
    }

    const isExistingRoutine = routines.some((routine) => routine.id === suggestion.id)
    const savedRoutine: Routine = {
      ...suggestion,
      id: isExistingRoutine ? suggestion.id : crypto.randomUUID(),
      name: suggestionName.trim() || suggestion.name,
      description: `${suggestion.description.split(' Suggested cadence: ')[0]} Suggested cadence: ${inspirationFrequency} sessions per week.`,
      items: isExistingRoutine
        ? suggestion.items
        : suggestion.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      isDefault: false,
    }

    setRoutines((previous) => isExistingRoutine
      ? previous.map((routine) => routine.id === savedRoutine.id ? savedRoutine : routine)
      : [savedRoutine, ...previous])
    setSelectedRoutineId(savedRoutine.id)
    setSuggestion(savedRoutine)
    setSuggestionName(savedRoutine.name)
    setSuggestionSaved(true)
    setSuggestionMessage('Saved to your routines.')
  }

  const pauseSession = () => {
    setActiveSession((previous) => {
      if (!previous || previous.status !== 'running') {
        return previous
      }

      const now = Date.now()
      const nextElapsedMs = deriveElapsedMs(previous, now)

      return {
        ...previous,
        elapsedMs: nextElapsedMs,
        lastUpdatedAt: now,
        status: 'paused',
        pauseReason: 'manual',
      }
    })
  }

  const resumeSession = () => {
    setActiveSession((previous) => {
      if (!previous || previous.status !== 'paused') {
        return previous
      }

      return {
        ...previous,
        status: 'running',
        lastUpdatedAt: Date.now(),
        pauseReason: undefined,
      }
    })
  }

  const finishSession = () => {
    setActiveSession((previous) => {
      if (!previous) {
        return previous
      }

      const now = Date.now()
      const finalElapsedMs = deriveElapsedMs(previous, now)

      const completedSession = {
        ...previous,
        elapsedMs: finalElapsedMs,
        positionOffsetMs: previous.totalMs - finalElapsedMs,
        status: 'completed' as const,
        lastUpdatedAt: now,
        pauseReason: undefined,
      }

      return completedSession
    })
  }

  const skipCurrentExercise = () => {
    setActiveSession((previous) => {
      if (!previous || previous.status === 'completed') {
        return previous
      }

      const now = Date.now()
      const elapsedMs = deriveElapsedMs(previous, now)
      const currentPositionMs = Math.min(
        previous.totalMs,
        deriveSessionPositionMs(previous, now),
      )
      const nextPositionMs = getNextExercisePositionMs(previous.items, currentPositionMs)
      const nextSession = {
        ...previous,
        elapsedMs,
        positionOffsetMs: nextPositionMs - elapsedMs,
        lastUpdatedAt: now,
        status: nextPositionMs >= previous.totalMs ? ('completed' as const) : previous.status,
        pauseReason: undefined,
      }

      return nextSession
    })
  }

  const previousExercise = () => {
    setActiveSession((previous) => {
      if (!previous) {
        return previous
      }

      const now = Date.now()
      const currentElapsed = deriveElapsedMs(previous, now)
      const currentPosition = Math.min(
        previous.totalMs,
        deriveSessionPositionMs(previous, now),
      )
      const previousPosition = getPreviousExerciseElapsedMs(previous.items, currentPosition)

      return {
        ...previous,
        elapsedMs: currentElapsed,
        positionOffsetMs: previousPosition - currentElapsed,
        lastUpdatedAt: now,
        status: previous.status === 'completed' ? 'paused' : previous.status,
        pauseReason: undefined,
      }
    })
  }

  const addExercise = (event: React.FormEvent) => {
    event.preventDefault()

    if (!exerciseForm.name.trim()) {
      return
    }

    const nextExercise: Exercise = {
      ...exercises.find((exercise) => exercise.id === editingExerciseId),
      id: editingExerciseId ?? crypto.randomUUID(),
      name: exerciseForm.name.trim(),
      category: exerciseForm.category,
      description: exerciseForm.description.trim() || 'Add practice instructions here.',
      defaultDuration: Math.max(1, Number(exerciseForm.defaultDuration) || 5),
    }

    if (editingExerciseId) {
      setExercises((previous) =>
        previous.map((exercise) => (exercise.id === editingExerciseId ? nextExercise : exercise)),
      )
      setEditingExerciseId(null)
    } else {
      setExercises((previous) => [nextExercise, ...previous])
    }

    setExerciseForm({
      name: '',
      category: 'Technique',
      description: '',
      defaultDuration: 5,
    })
  }

  const editExercise = (exercise: Exercise) => {
    setEditingExerciseId(exercise.id)
    setExerciseForm({
      name: exercise.name,
      category: exercise.category,
      description: exercise.description,
      defaultDuration: exercise.defaultDuration,
    })
  }

  const duplicateExercise = (exercise: Exercise) => {
    const duplicate: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
      name: `${exercise.name} (Copy)`,
    }

    setExercises((previous) => [duplicate, ...previous])
  }

  const deleteExercise = (exerciseId: string) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const routinesUsingExerciseCount = routines.filter((routine) =>
      routine.items.some((routineItem) => routineItem.exerciseId === exerciseId)
    ).length;

    if (exercise && routinesUsingExerciseCount > 0) {
      const shouldDelete = window.confirm(
        `Delete "${exercise.name}"? It's used in ${routinesUsingExerciseCount} routine(s). Deleting it will remove it from those routines. Historical records will not be affected. Are you sure?`
      )

      if (!shouldDelete) {
        return
      }
    }

    setExercises((previous) => previous.filter((item) => item.id !== exerciseId))
    setRoutines((previous) =>
      previous.map((routine) => ({
        ...routine,
        items: routine.items.filter((item) => item.exerciseId !== exerciseId),
      })),
    )
  }

  const createRoutine = () => {
    const trimmedName = routineName.trim()

    if (!trimmedName) {
      return
    }

    const newRoutine: Routine = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: 'Custom practice routine',
      items: [],
      isDefault: routines.length === 0,
      pauseAtItemEnd: false,
    }

    setRoutines((previous) => [newRoutine, ...previous])
    setSelectedRoutineId(newRoutine.id)
    setExpandedRoutineId(newRoutine.id)
    setRoutineName('')
  }

  const addExerciseToRoutine = (routineId: string, exerciseId: string) => {
    setRoutines((previous) =>
      previous.map((routine) => {
        if (routine.id !== routineId) {
          return routine
        }

        const exercise = getExerciseById(exerciseId, exercises)

        return {
          ...routine,
          items: [
            ...routine.items,
            {
              id: crypto.randomUUID(),
              exerciseId,
              kind: 'exercise' as const,
              duration: exercise?.defaultDuration ?? 5,
            },
          ],
        }
      }),
    )
  }

  const addSongToRoutine = (routineId: string, songId: string) => {
    setRoutines((previous) =>
      previous.map((routine) => {
        if (routine.id !== routineId) {
          return routine
        }

        const song = getSongById(songId, songs)

        return {
          ...routine,
          items: [
            ...routine.items,
            {
              id: crypto.randomUUID(),
              songId,
              kind: 'song' as const,
              duration: getDefaultSongDuration(song?.difficulty ?? 'Beginner'),
            },
          ],
        }
      }),
    )
  }

  const addStarterTabExamples = () => {
    setSongs((previous) =>
      [
        ...previous,
        ...STARTER_TAB_SONGS.filter(
          (starterSong) => !previous.some((song) => song.id === starterSong.id),
        ),
      ],
    )
    setRoutines((previous) =>
      [
        ...previous,
        ...[...STARTER_SCALE_ROUTINES, ...STARTER_TECHNIQUE_ROUTINES].filter(
          (starterRoutine) => !previous.some((routine) => routine.id === starterRoutine.id),
        ),
      ],
    )
  }

  const removeRoutineItem = (routineId: string, itemId: string) => {
    setRoutines((previous) =>
      previous.map((routine) =>
        routine.id === routineId
          ? {
              ...routine,
              items: routine.items.filter((item) => item.id !== itemId),
            }
          : routine,
      ),
    )
  }

  const updateRoutineItemDuration = (routineId: string, itemId: string, duration: number) => {
    setRoutines((previous) =>
      previous.map((routine) =>
        routine.id === routineId
          ? {
              ...routine,
              items: routine.items.map((item) =>
                item.id === itemId ? { ...item, duration: Math.max(1, duration) } : item,
              ),
            }
          : routine,
      ),
    )
  }

  const moveRoutineItemToIndex = (routineId: string, itemId: string, targetIndex: number) => {
    setRoutines((previous) =>
      previous.map((routine) => {
        if (routine.id !== routineId) {
          return routine
        }

        const index = routine.items.findIndex((item) => item.id === itemId)
        if (index < 0) {
          return routine
        }

        if (targetIndex < 0 || targetIndex >= routine.items.length || targetIndex === index) {
          return routine
        }

        const nextItems = [...routine.items]
        const [item] = nextItems.splice(index, 1)
        nextItems.splice(targetIndex, 0, item)

        return { ...routine, items: nextItems }
      }),
    )
  }

  const moveRoutineItem = (routineId: string, itemId: string, direction: -1 | 1) => {
    const routine = routines.find((item) => item.id === routineId)
    const index = routine?.items.findIndex((item) => item.id === itemId) ?? -1
    if (index >= 0) {
      moveRoutineItemToIndex(routineId, itemId, index + direction)
    }
  }

  const deleteRoutine = (routineId: string) => {
    const remaining = routines.filter((routine) => routine.id !== routineId)
    setRoutines(remaining)
    if (expandedRoutineId === routineId) {
      setExpandedRoutineId(null)
    }

    if (editingRoutineId === routineId) {
      setEditingRoutineId(null)
      setEditingRoutineName('')
    }

    if (selectedRoutineId === routineId) {
      const nextSelected = remaining[0]
      setSelectedRoutineId(nextSelected?.id ?? '')
    }
  }

  const editRoutine = (routine: Routine) => {
    setEditingRoutineId(routine.id)
    setEditingRoutineName(routine.name)
  }

  const toggleRoutineEditor = (routineId: string) => {
    setExpandedRoutineId((previous) => previous === routineId ? null : routineId)
    setEditingRoutineId(null)
    setEditingRoutineName('')
  }

  const saveRoutineName = (routineId: string) => {
    const name = editingRoutineName.trim()
    if (!name) {
      return
    }

    setRoutines((previous) =>
      previous.map((routine) =>
        routine.id === routineId ? { ...routine, name } : routine,
      ),
    )
    setEditingRoutineId(null)
    setEditingRoutineName('')
  }

  const duplicateRoutine = (routine: Routine) => {
    const duplicate: Routine = {
      ...routine,
      id: crypto.randomUUID(),
      name: `${routine.name} (Copy)`,
      isDefault: false,
      items: routine.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    }

    setRoutines((previous) => [duplicate, ...previous])
    setExpandedRoutineId(duplicate.id)
  }

  const setDefaultRoutine = (routineId: string) => {
    setRoutines((previous) =>
      previous.map((routine) => ({
        ...routine,
        isDefault: routine.id === routineId,
      })),
    )
  }

  const updateExerciseRatings = (
    exerciseId: string,
    update: { enjoymentRating?: number; difficulty?: CurrentDifficulty },
  ) => {
    setExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, ...update }
          : exercise,
      ),
    )
  }

  const updateRoutineRatings = (
    routineId: string,
    update: { enjoymentRating?: number; difficulty?: CurrentDifficulty },
  ) => {
    setRoutines((previous) =>
      previous.map((routine) =>
        routine.id === routineId
          ? { ...routine, ...update }
          : routine,
      ),
    )
  }

  const setRoutinePauseAtItemEnd = (routineId: string, enabled: boolean) => {
    setRoutines((previous) =>
      previous.map((routine) =>
        routine.id === routineId ? { ...routine, pauseAtItemEnd: enabled } : routine,
      ),
    )
    setActiveSession((previous) =>
      previous && previous.routineId === routineId && previous.status !== 'completed'
        ? { ...previous, pauseAtItemEnd: enabled }
        : previous,
    )
  }

  const activeRoutine = useMemo(() => {
    if (!activeSession) {
      return null
    }

    const routine: SessionRoutine = {
      id: activeSession.routineId,
      name: activeSession.routineName,
      description: '',
      items: activeSession.items,
    }

    const positionMs = Math.min(
      activeSession.totalMs,
      // eslint-disable-next-line react/purity -- intentional: timer derives position from wall clock on each render; this is the core of the timestamp-based timer design
      deriveSessionPositionMs(activeSession, Date.now()),
    )
    const progress = getProgressForElapsed(routine, positionMs)
    const isWaitingAtItemEnd = activeSession.pauseReason === 'item-end'
    const displayIndex = isWaitingAtItemEnd
      ? Math.max(0, progress.currentIndex - 1)
      : progress.currentIndex
    const currentItem = routine.items[displayIndex]
    const currentExercise =
      currentItem && currentItem.kind !== 'song' && currentItem.exerciseId
        ? currentItem.exerciseSnapshot ?? getExerciseById(currentItem.exerciseId, exercises)
        : null

    return {
      routine,
      currentItem,
      currentExercise,
      progress,
      displayIndex,
      positionMs,
      currentItemRemainingMs: isWaitingAtItemEnd ? 0 : progress.remainingInCurrentItemMs,
      totalMinutes: activeSession.totalMs / 60_000,
    }
  }, [activeSession, exercises])

  const weeklySummary = useMemo(() => summariseWeeklyPractice(history), [history])
  const activeInstrument = INSTRUMENT_PROFILES.find(
    (profile) => profile.id === instrumentSettings.activeInstrumentId,
  ) ?? INSTRUMENT_PROFILES[0]
  const activeTuning = instrumentSettings.tunings[activeInstrument.id]
  const activeTuningPreset = findInstrumentTuningPreset(activeInstrument, activeTuning)
  const customTuningNotes = Array.from(
    { length: MAX_TUNING_MIDI_NOTE - MIN_TUNING_MIDI_NOTE + 1 },
    (_, index) => MIN_TUNING_MIDI_NOTE + index,
  )
  const todayTarget = getDailyPracticeTarget(practiceTargets, currentDate)
  const weeklyPracticeTarget = getWeeklyPracticeTarget(practiceTargets, currentDate)
  const progressPercent = weeklyPracticeTarget > 0
    ? Math.min(100, (weeklySummary.totalMinutes / weeklyPracticeTarget) * 100)
    : 0

  const moveDashboardItem = (widget: DashboardWidget, direction: -1 | 1) => {
    setDashboardLayout((previous) => {
      const currentIndex = previous.order.indexOf(widget)
      return {
        ...previous,
        order: moveDashboardWidget(previous.order, widget, currentIndex + direction),
      }
    })
  }

  const toggleDashboardWidget = (widget: DashboardWidget, visible: boolean) => {
    setDashboardLayout((previous) => ({
      ...previous,
      hidden: visible
        ? previous.hidden.filter((hiddenWidget) => hiddenWidget !== widget)
        : [...previous.hidden, widget],
    }))
  }

  const resizeDashboardWidget = (widget: DashboardWidget, size: 'half' | 'full') => {
    setDashboardLayout((previous) => ({
      ...previous,
      sizes: { ...previous.sizes, [widget]: size },
    }))
  }

  const resetDashboardLayout = () => {
    if (
      !isDefaultDashboardLayout(dashboardLayout) &&
      !window.confirm('Reset your dashboard layout to its defaults?')
    ) {
      return
    }
    setDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)
  }

  const handleExportBackup = () => {
    const payload = exportAppData({
      exercises,
      routines,
      songs,
      history,
      selectedRoutineId,
      activeSession,
      practiceTargets,
      dashboardLayout,
      instrumentSettings,
      appTheme,
    })

    const blob = new Blob([payload], { type: 'application/json' })
    downloadBlob(blob, `guitar-practice-backup-${new Date().toISOString().slice(0, 10)}.json`)
    setBackupMessage('Backup downloaded successfully.')
  }

  const handleExportRoutine = (routine: Routine) => {
    try {
      const payload = createRoutineSharePackage(
        routine,
        exercises,
        songs,
        includeTabsInRoutineExport,
      )
      const filename = routine.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'practice-routine'
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        `${filename}.gproutine`,
      )
      setRoutineShareMessage(`"${routine.name}" was exported as a routine file.`)
    } catch (error) {
      setRoutineShareMessage(
        error instanceof Error ? error.message : 'The routine could not be exported.',
      )
    }
  }

  const handleImportRoutineFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setRoutineShareMessage('')
    try {
      const packageData = parseRoutineSharePackage(await file.text())
      setRoutineImportPackage(packageData)
      setRoutineImportTargetId('')
    } catch (error) {
      setRoutineImportPackage(null)
      setRoutineShareMessage(
        error instanceof Error ? error.message : 'The shared routine file could not be read.',
      )
    } finally {
      event.target.value = ''
    }
  }

  const handleImportRoutine = (replaceRoutineId?: string) => {
    if (!routineImportPackage) {
      return
    }

    const targetRoutine = replaceRoutineId
      ? routines.find((routine) => routine.id === replaceRoutineId)
      : undefined
    if (replaceRoutineId && !targetRoutine) {
      setRoutineShareMessage('Select a routine to replace.')
      return
    }

    try {
      const exerciseIdMap = new Map<string, string>()
      const importedExercises: Exercise[] = routineImportPackage.exercises.map((exercise) => {
        const { id: sourceId, ...details } = exercise
        const id = crypto.randomUUID()
        exerciseIdMap.set(sourceId, id)
        return { ...details, id }
      })
      const songIdMap = new Map<string, string>()
      const importedSongs: Song[] = routineImportPackage.songs.map((song) => {
        const { id: sourceId, ...details } = song
        const id = crypto.randomUUID()
        songIdMap.set(sourceId, id)
        return { ...details, notes: '', tab: song.tab ?? '', id }
      })
      const items: RoutineItem[] = routineImportPackage.items.map((item) => {
        const sourceId =
          item.kind === 'exercise'
            ? exerciseIdMap.get(item.sourceId)
            : songIdMap.get(item.sourceId)
        if (!sourceId) {
          throw new Error('The shared routine contains an unresolved item reference.')
        }
        return item.kind === 'exercise'
          ? { id: crypto.randomUUID(), kind: 'exercise', exerciseId: sourceId, duration: item.duration }
          : { id: crypto.randomUUID(), kind: 'song', songId: sourceId, duration: item.duration }
      })
      const importedRoutine: Routine = targetRoutine
        ? {
            ...targetRoutine,
            name: routineImportPackage.routine.name,
            description: routineImportPackage.routine.description,
            items,
            pauseAtItemEnd: routineImportPackage.routine.pauseAtItemEnd,
          }
        : {
            id: crypto.randomUUID(),
            name: routineImportPackage.routine.name,
            description: routineImportPackage.routine.description,
            items,
            isDefault: routines.length === 0,
            pauseAtItemEnd: routineImportPackage.routine.pauseAtItemEnd,
          }

      setExercises((previous) => [...importedExercises, ...previous])
      setSongs((previous) => [...importedSongs, ...previous])
      setRoutines((previous) =>
        targetRoutine
          ? previous.map((routine) =>
              routine.id === targetRoutine.id ? importedRoutine : routine,
            )
          : [importedRoutine, ...previous],
      )
      setSelectedRoutineId(importedRoutine.id)
      setRoutineImportPackage(null)
      setRoutineShareMessage(
        targetRoutine
          ? `"${targetRoutine.name}" was replaced. Existing library entries and practice history were kept.`
          : `"${importedRoutine.name}" was added as a new routine.`,
      )
    } catch (error) {
      setRoutineShareMessage(
        error instanceof Error ? error.message : 'The shared routine could not be imported.',
      )
    }
  }

  const handleDownloadStorageRecovery = () => {
    if (storageRecoveryItems.length === 0) {
      return
    }

    const payload = JSON.stringify(
      { recoveredAt: new Date().toISOString(), entries: storageRecoveryItems },
      null,
      2,
    )
    const blob = new Blob([payload], { type: 'application/json' })
    downloadBlob(blob, `guitar-practice-recovery-${new Date().toISOString().slice(0, 10)}.json`)
    localStorage.removeItem(STORAGE_KEYS.recovery)
    setStorageRecoveryItems([])
  }

  const updatePracticeTargetMinutes = (
    target: 'daily' | DayOfWeekKey,
    value: string,
  ) => {
    const minutes = Number(value)
    const normalizedMinutes = Number.isFinite(minutes)
      ? Math.min(MAX_DAILY_PRACTICE_TARGET_MINUTES, Math.max(0, Math.trunc(minutes)))
      : 0

    setPracticeTargets((previous) =>
      target === 'daily'
        ? { ...previous, dailyMinutes: normalizedMinutes }
        : {
            ...previous,
            dayMinutes: { ...previous.dayMinutes, [target]: normalizedMinutes },
          },
    )
  }

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const importedData = importAppData(text)
      const shouldReplace = window.confirm(
        'Importing this backup replaces all current exercises, routines, songs, history, settings, and any active session. Export your current data first if you may need it. Continue?',
      )
      if (!shouldReplace) {
        return
      }
      const importedExercises = importedData.exercises as Exercise[]
      const importedRoutines = importedData.routines as Routine[]
      const importedSongs = (importedData.songs as Song[] | undefined) ?? []
      const importedHistory = importedData.history as SessionRecord[]
      const importedActiveSession = (importedData.activeSession as ActiveSession | null) ?? null

      setExercises(importedExercises)
      setRoutines(importedRoutines)
      setSongs(importedSongs)
      setHistory(importedHistory)
      setPracticeTargets(
        importedData.practiceTargets ?? createDefaultPracticeTargets(),
      )
      setDashboardLayout(
        migrateDashboardLayout(importedData.dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT),
      )
      setInstrumentSettings(
        importedData.instrumentSettings ?? createDefaultInstrumentSettings(),
      )
      setAppTheme(importedData.appTheme ?? DEFAULT_APP_THEME)
      setSelectedRoutineId(importedData.selectedRoutineId || importedRoutines[0]?.id || '')
      setActiveSession(
        importedActiveSession
          ? {
              ...importedActiveSession,
              positionOffsetMs: importedActiveSession.positionOffsetMs ?? 0,
              pauseAtItemEnd:
                importedActiveSession.pauseAtItemEnd ??
                Boolean(
                  importedRoutines.find((routine) => routine.id === importedActiveSession.routineId)
                    ?.pauseAtItemEnd,
                ),
            }
          : null,
      )
      localStorage.removeItem(STORAGE_KEYS.recovery)
      setStorageRecoveryItems([])
      setBackupMessage('Backup restored successfully.')
    } catch {
      setBackupMessage('That file is not a valid practice backup.')
    } finally {
      event.target.value = ''
    }
  }

  const inspirationPanel = inspirationOpen && (
    <section className="inspiration-panel" aria-labelledby="inspiration-title">
      <div className="section-header">
        <div>
          <p className="eyebrow">A practice idea</p>
          <h3 id="inspiration-title">Start small. Build your own session.</h3>
        </div>
      </div>
      <div className="inspiration-options">
        <label>
          Session length
          <select
            aria-label="Suggestion session length"
            value={inspirationDuration}
            onChange={(event) => setInspirationDuration(Number(event.target.value))}
          >
            {[10, 20, 30, 45, 60].map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} minutes</option>
            ))}
          </select>
        </label>
        <label>
          Focus
          <select
            aria-label="Suggestion focus"
            value={inspirationFocus}
            onChange={(event) => setInspirationFocus(event.target.value)}
          >
            <option value="balanced">Balanced practice</option>
            <option value="technique">Technique</option>
            <option value="songs">Song practice</option>
            <option value="theory-ear">Theory and ear training</option>
            {Array.from(new Set(exercises.map((exercise) => exercise.category)))
              .filter((category) => !['Technique'].includes(category))
              .map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
          </select>
        </label>
        <label>
          Sessions per week
          <select
            aria-label="Suggested sessions per week"
            value={inspirationFrequency}
            onChange={(event) => {
              setInspirationFrequency(Number(event.target.value))
              setSuggestionSaved(false)
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((sessions) => (
              <option key={sessions} value={sessions}>{sessions} {sessions === 1 ? 'session' : 'sessions'}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" onClick={generateInspiration}>
          {suggestion ? 'Generate another' : 'Generate suggestion'}
        </button>
      </div>

      {suggestion && (
        <div className="suggestion-preview">
          <div className="suggestion-heading">
            <div>
              <p className="eyebrow">Suggested session · {getRoutineTotalMinutes(suggestion)} min</p>
              <p>{suggestion.description}</p>
            </div>
            <span className="duration-badge">{inspirationFrequency}× / week</span>
          </div>
          <label className="suggestion-name">
            Routine name
            <input
              aria-label="Suggested routine name"
              value={suggestionName}
              onChange={(event) => {
                setSuggestionName(event.target.value)
                setSuggestionSaved(false)
              }}
            />
          </label>
          <div className="suggestion-items">
            {suggestion.items.map((item, index) => {
              const exercise = item.exerciseId ? getExerciseById(item.exerciseId, exercises) : undefined
              const song = item.songId ? getSongById(item.songId, songs) : undefined

              return (
                <div className="suggestion-item" key={item.id}>
                  <div>
                    <small>Part {index + 1}</small>
                    <strong>{getRoutineItemLabel(item, exercises, songs)}</strong>
                    {(exercise?.description || song?.notes) && <p>{exercise?.description ?? song?.notes}</p>}
                  </div>
                  <label>
                    Minutes
                    <input
                      aria-label={`Minutes for ${getRoutineItemLabel(item, exercises, songs)}`}
                      type="number"
                      min="1"
                      value={item.duration}
                      onChange={(event) => updateSuggestionItem(item.id, Number(event.target.value) || 1)}
                    />
                  </label>
                </div>
              )
            })}
          </div>
          <p className="suggestion-cadence">
            Try this session {inspirationFrequency} {inspirationFrequency === 1 ? 'time' : 'times'} this week. It is a flexible target, not a fixed schedule.
          </p>
          <div className="form-actions">
            <button className="secondary-button" onClick={saveSuggestionAsRoutine} disabled={suggestionSaved}>
              {suggestionSaved ? 'Saved as routine' : 'Save as routine'}
            </button>
            <button
              className="primary-button"
              disabled={activeSession !== null && activeSession.status !== 'completed'}
              title={activeSession && activeSession.status !== 'completed' ? 'Finish the active session before starting another.' : undefined}
              onClick={() => startPractice({ ...suggestion, name: suggestionName.trim() || suggestion.name })}
            >
              Start suggested session
            </button>
          </div>
        </div>
      )}
      {suggestionMessage && <p className="status-message">{suggestionMessage}</p>}
      {!suggestion && exercises.length === 0 && songs.length === 0 && (
        <p className="empty-inline">Add an exercise or song to get a suggestion.</p>
      )}
    </section>
  )

  const renderDashboard = () => (
    <section className={`panel dashboard-panel${dashboardCustomizationOpen ? ' customizing-dashboard' : ''}`}>
      <div className="hero-row">
        <div>
          <p className="eyebrow">Daily practice</p>
          <h2>Pick up where your routine left off.</h2>
        </div>
        <div className="dashboard-actions">
          <button
            className="secondary-button"
            aria-expanded={dashboardCustomizationOpen}
            onClick={() => setDashboardCustomizationOpen((open) => !open)}
          >
            {dashboardCustomizationOpen ? 'Done customizing' : 'Customize dashboard'}
          </button>
          <button
            className="secondary-button"
            aria-expanded={inspirationOpen}
            onClick={toggleInspiration}
          >
            {inspirationOpen ? 'Close inspiration' : 'Inspire me'}
          </button>
          <button
            className="primary-button"
            disabled={!defaultRoutine || (activeSession !== null && activeSession.status !== 'completed')}
            title={activeSession && activeSession.status !== 'completed' ? 'Finish the active session before starting another.' : undefined}
            onClick={() => defaultRoutine && startPractice(defaultRoutine)}
          >
            Start practice
          </button>
        </div>
      </div>

      {inspirationPanel}

      {dashboardCustomizationOpen && (
        <div className="dashboard-customization-panel">
          <div>
            <h3>Arrange your dashboard</h3>
            <p>Changes save automatically in this browser. Hidden blocks can be restored here.</p>
          </div>
          <fieldset className="dashboard-visibility-controls">
            <legend>Show dashboard blocks</legend>
            {DASHBOARD_WIDGETS.map((widget) => (
              <label key={widget}>
                <input
                  type="checkbox"
                  aria-label={`Show ${DASHBOARD_WIDGET_LABELS[widget]}`}
                  checked={!dashboardLayout.hidden.includes(widget)}
                  onChange={(event) => toggleDashboardWidget(widget, event.target.checked)}
                />
                {DASHBOARD_WIDGET_LABELS[widget]}
              </label>
            ))}
          </fieldset>
          <button className="secondary-button" onClick={resetDashboardLayout}>
            Reset dashboard layout
          </button>
        </div>
      )}

      <div className="dashboard-widgets">
        {dashboardLayout.order.map((widget, index) => {
          if (dashboardLayout.hidden.includes(widget)) {
            return null
          }

          let content: ReactNode
          switch (widget) {
            case 'activity-stats':
              content = (
                <div className="stats-grid">
                  <div className="stat-card">
                    <span>Default routine</span>
                    <strong>{defaultRoutine?.name ?? 'No routine yet'}</strong>
                    <small>{defaultRoutine ? `${getRoutineTotalMinutes(defaultRoutine)} min` : 'Create one to begin'}</small>
                  </div>
                  <div className="stat-card">
                    <span>Today</span>
                    <strong>{todayPracticeMinutes} min</strong>
                    <small>
                      {todayTarget === 0
                        ? 'Rest day · 0 min target'
                        : `${Math.max(0, todayTarget - todayPracticeMinutes)} min to daily target`}
                    </small>
                  </div>
                  <div className="stat-card">
                    <span>Total sessions</span>
                    <strong>{history.length}</strong>
                    <small>Saved in this browser</small>
                  </div>
                </div>
              )
              break
            case 'weekly-summary':
              content = (
                <div className="summary-grid">
                  <div className="stat-card">
                    <span>Weekly total</span>
                    <strong>{Math.round(weeklySummary.totalMinutes)} min</strong>
                    <small>{weeklySummary.streak} day streak</small>
                  </div>
                  <div className="stat-card">
                    <span>Average/day</span>
                    <strong>{Math.round(weeklySummary.averageMinutes)} min</strong>
                    <small>Last 7 days</small>
                  </div>
                  <div className="stat-card">
                    <span>Best day</span>
                    <strong>{weeklySummary.bestDay.minutes} min</strong>
                    <small>{weeklySummary.bestDay.label}</small>
                  </div>
                </div>
              )
              break
            case 'weekly-goal':
              content = (
                <div className="goal-card">
                  <div className="goal-header">
                    <strong>Weekly aim</strong>
                    <span>
                      {weeklyPracticeTarget === 0
                        ? `${Math.round(weeklySummary.totalMinutes)} min · no target set`
                        : `${Math.round(weeklySummary.totalMinutes)}/${weeklyPracticeTarget} min`}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )
              break
            case 'weekly-chart':
              content = (
                <div className="weekly-chart">
                  {weeklySummary.daySummaries.map((day) => (
                    <div key={day.label} className="day-bar-wrap">
                      <span className="day-bar" style={{ height: `${Math.max(8, (day.minutes / Math.max(1, weeklySummary.bestDay.minutes || 1)) * 100)}%` }} />
                      <small>{day.label}</small>
                      <strong>{day.minutes}</strong>
                    </div>
                  ))}
                </div>
              )
              break
            case 'routine-preview':
              content = selectedRoutine ? (
                <div className="routine-preview">
                  <label>
                    Practice routine
                    <select
                      aria-label="Practice routine"
                      value={selectedRoutine.id}
                      onChange={(event) => setSelectedRoutineId(event.target.value)}
                    >
                      {routines.map((routine) => (
                        <option key={routine.id} value={routine.id}>
                          {routine.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="eyebrow">Selected routine</p>
                    <h3>{selectedRoutine.name}</h3>
                  </div>
                  <div className="routine-items-preview">
                    {selectedRoutine.items.map((item) => (
                      <div key={item.id} className="mini-pill">
                        <span>{getRoutineItemLabel(item, exercises, songs)}</span>
                        <strong>{item.duration} min</strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className="secondary-button"
                    disabled={selectedRoutine.items.length === 0 || (activeSession !== null && activeSession.status !== 'completed')}
                    title={activeSession && activeSession.status !== 'completed' ? 'Finish the active session before starting another.' : undefined}
                    onClick={() => startPractice(selectedRoutine)}
                  >
                    Practice selected routine
                  </button>
                </div>
              ) : (
                <p className="empty-inline">Create a routine to preview it here.</p>
              )
              break
          }

          return (
            <section
              key={widget}
              className={`dashboard-widget dashboard-widget-${dashboardLayout.sizes[widget]}${dashboardDrag?.widget === widget ? ' dashboard-widget-dragging' : ''}${dashboardDrag?.targetIndex === index && dashboardDrag.widget !== widget ? ' dashboard-widget-drop-target' : ''}`}
              data-dashboard-widget={widget}
              data-dashboard-index={index}
              aria-label={DASHBOARD_WIDGET_LABELS[widget]}
            >
              {dashboardCustomizationOpen && (
                <div className="dashboard-widget-controls">
                  <button
                    type="button"
                    className="dashboard-drag-handle"
                    aria-label={`Drag to reorder ${DASHBOARD_WIDGET_LABELS[widget]}`}
                    title="Drag to reorder"
                    onPointerDown={(event) => {
                      if (event.isPrimary === false || event.button !== 0) {
                        return
                      }
                      event.preventDefault()
                      event.currentTarget.setPointerCapture?.(event.pointerId)
                      setDashboardDrag({ widget, targetIndex: index, pointerId: event.pointerId })
                    }}
                  >
                    ↕
                  </button>
                  <div className="dashboard-widget-move-controls">
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`Move ${DASHBOARD_WIDGET_LABELS[widget]} up`}
                      disabled={index === 0}
                      onClick={() => moveDashboardItem(widget, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`Move ${DASHBOARD_WIDGET_LABELS[widget]} down`}
                      disabled={index === dashboardLayout.order.length - 1}
                      onClick={() => moveDashboardItem(widget, 1)}
                    >
                      Move down
                    </button>
                  </div>
                  <label>
                    Size
                    <select
                      aria-label={`Size for ${DASHBOARD_WIDGET_LABELS[widget]}`}
                      value={dashboardLayout.sizes[widget]}
                      onChange={(event) => {
                        if (event.target.value === 'half' || event.target.value === 'full') {
                          resizeDashboardWidget(widget, event.target.value)
                        }
                      }}
                    >
                      <option value="full">Full width</option>
                      <option value="half">Half width</option>
                    </select>
                  </label>
                </div>
              )}
              {content}
            </section>
          )
        })}
        {dashboardCustomizationOpen &&
          dashboardLayout.hidden.length === DASHBOARD_WIDGETS.length && (
            <p className="empty-inline">All dashboard blocks are hidden. Use the controls above to show one.</p>
          )}
      </div>
    </section>
  )

  const renderLibrary = () => (
    <section className="panel">
      <PageHero
        eyebrow="Build your toolkit"
        title="Exercise library"
        description="Collect the drills and ideas that help you make progress, then bring them into a routine when you're ready."
      />

      <form className="stack-form" onSubmit={addExercise}>
        <div className="field-row">
          <label>
            Name
            <input
              value={exerciseForm.name}
              onChange={(event) =>
                setExerciseForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Alternate picking drills"
            />
          </label>
          <label>
            Category
            <select
              value={exerciseForm.category}
              onChange={(event) =>
                setExerciseForm((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option>Warm-up</option>
              <option>Technique</option>
              <option>Alternate picking</option>
              <option>Legato</option>
              <option>Bending</option>
              <option>Vibrato</option>
              <option>Chords</option>
              <option>Scales</option>
              <option>Arpeggios</option>
              <option>Rhythm</option>
              <option>Ear training</option>
              <option>Song practice</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            Default length (min)
            <input
              type="number"
              min="1"
              value={exerciseForm.defaultDuration}
              onChange={(event) =>
                setExerciseForm((current) => ({
                  ...current,
                  defaultDuration: Number(event.target.value) || 1,
                }))
              }
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={exerciseForm.description}
            onChange={(event) =>
              setExerciseForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Describe the exercise and the key focus points."
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingExerciseId ? 'Update exercise' : 'Add exercise'}
          </button>
          {editingExerciseId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingExerciseId(null)
                setExerciseForm({
                  name: '',
                  category: 'Technique',
                  description: '',
                  defaultDuration: 5,
                })
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="search-row">
        <input
          value={exerciseFilter}
          onChange={(event) => setExerciseFilter(event.target.value)}
          placeholder="Search your exercises"
        />
      </div>

      {visibleExercises.length === 0 ? (
        <p className="empty-inline">No matching exercises yet. Try a different search or add a new one.</p>
      ) : (
        <div className="library-grid">
          {visibleExercises.map((exercise) => (
            <article key={exercise.id} className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">{exercise.category}</p>
                  <h3>{exercise.name}</h3>
                </div>
                <span className="duration-badge">{exercise.defaultDuration} min</span>
              </div>
              <ExerciseDescription key={`${exercise.id}-${exercise.description}`} exercise={exercise} />
              <div className="practice-ratings">
                <EnjoymentRating
                  label={exercise.name}
                  value={exercise.enjoymentRating}
                  onChange={(enjoymentRating) =>
                    updateExerciseRatings(exercise.id, { enjoymentRating })
                  }
                />
                <CurrentDifficultyControl
                  label={exercise.name}
                  value={exercise.difficulty}
                  onChange={(difficulty) =>
                    updateExerciseRatings(exercise.id, { difficulty })
                  }
                />
              </div>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => editExercise(exercise)}>
                  Edit
                </button>
                <button className="secondary-button" onClick={() => duplicateExercise(exercise)}>
                  Duplicate
                </button>
                <button className="danger-button" onClick={() => deleteExercise(exercise.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  const renderRoutines = () => (
    <section className="panel">
      <PageHero
        eyebrow="Shape your session"
        title="Practice routines"
        description="Put exercises and songs in order, set your timing, and choose a routine when it’s time to play."
        actions={
          <div className="dashboard-actions">
            {(STARTER_TAB_SONGS.some(
              (starterSong) => !songs.some((song) => song.id === starterSong.id),
            ) || [...STARTER_SCALE_ROUTINES, ...STARTER_TECHNIQUE_ROUTINES].some(
              (starterRoutine) => !routines.some((routine) => routine.id === starterRoutine.id),
            )) && (
              <button
                className="secondary-button"
                onClick={addStarterTabExamples}
              >
                Add starter tab examples
              </button>
            )}
            <button
              className="secondary-button"
              aria-expanded={inspirationOpen}
              onClick={toggleInspiration}
            >
              {inspirationOpen ? 'Close inspiration' : 'Get inspired'}
            </button>
            <button
              className="primary-button"
              disabled={
                !selectedRoutine ||
                selectedRoutine.items.length === 0 ||
                (activeSession !== null && activeSession.status !== 'completed')
              }
              onClick={() => selectedRoutine && startPractice(selectedRoutine)}
              title={
                activeSession && activeSession.status !== 'completed'
                  ? 'Finish the active session before starting another routine.'
                  : !selectedRoutine?.items.length
                    ? 'Add an exercise or song to the selected routine first.'
                    : undefined
              }
            >
              Start selected routine
            </button>
          </div>
        }
      />

      {inspirationPanel}

      <div className="stack-form">
        <label>
          New routine name
          <input
            value={routineName}
            onChange={(event) => setRoutineName(event.target.value)}
            placeholder="Evening technique reset"
          />
        </label>
        <button className="primary-button" onClick={createRoutine}>
          Add routine
        </button>
      </div>

      <div className="routine-list">
        {routines.map((routine) => {
          const isSelected = selectedRoutineId === routine.id
          const isExpanded = expandedRoutineId === routine.id
          return (
            <article
              key={routine.id}
              className={`card routine-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
              data-routine-id={routine.id}
            >
              <button
                type="button"
                className="routine-card-header"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Edit'} routine ${routine.name}`}
                onClick={() => toggleRoutineEditor(routine.id)}
              >
                <div className="routine-card-header-left">
                  <div className="routine-card-meta">
                    <p className="eyebrow">{routine.isDefault ? 'Default routine' : 'Custom routine'}</p>
                    {isSelected && <span className="routine-status-pill">Selected</span>}
                  </div>
                  <h3>{routine.name}</h3>
                </div>
                <span className="duration-badge">{getRoutineTotalMinutes(routine)} min</span>
              </button>

              {isExpanded && (
                <>
                  {editingRoutineId === routine.id && (
                    <input
                      className="routine-name-input"
                      aria-label={`Routine name for ${routine.name}`}
                      value={editingRoutineName}
                      onChange={(event) => setEditingRoutineName(event.target.value)}
                    />
                  )}

                  <div className="practice-ratings">
                    <EnjoymentRating
                      label={routine.name}
                      value={routine.enjoymentRating}
                      onChange={(enjoymentRating) =>
                        updateRoutineRatings(routine.id, { enjoymentRating })
                      }
                    />
                    <CurrentDifficultyControl
                      label={routine.name}
                      value={routine.difficulty}
                      onChange={(difficulty) =>
                        updateRoutineRatings(routine.id, { difficulty })
                      }
                    />
                  </div>

                  <div className="routine-builder">
                    {routine.items.length === 0 ? (
                      <p className="empty-inline">Add exercises from the library to build this routine.</p>
                    ) : (
                      routine.items.map((item, itemIndex) => (
                        <div
                          key={item.id}
                          className={[
                            'routine-item-row',
                            routineDrag?.routineId === routine.id &&
                            routineDrag.itemId === item.id
                              ? 'dragging'
                              : '',
                            routineDrag?.routineId === routine.id &&
                            routineDrag.targetIndex === itemIndex &&
                            routineDrag.itemId !== item.id
                              ? 'drop-target'
                              : '',
                          ].filter(Boolean).join(' ')}
                          data-routine-id={routine.id}
                          data-routine-index={itemIndex}
                          data-routine-item-id={item.id}
                        >
                          <div className="routine-item-label">
                            <button
                              type="button"
                              className="routine-item-drag-handle"
                              aria-label={`Drag to reorder ${getRoutineItemLabel(item, exercises, songs)}`}
                              title="Drag to reorder"
                              onPointerDown={(event) => {
                                if (event.button !== 0) {
                                  return
                                }
                                event.preventDefault()
                                event.currentTarget.setPointerCapture?.(event.pointerId)
                                setRoutineDrag({
                                  routineId: routine.id,
                                  itemId: item.id,
                                  targetIndex: itemIndex,
                                  pointerId: event.pointerId,
                                })
                              }}
                            >
                              ↕
                            </button>
                            <span>{itemIndex + 1}. {getRoutineItemLabel(item, exercises, songs)}</span>
                          </div>
                          <div className="routine-item-controls">
                            <input
                              type="number"
                              min="1"
                              value={item.duration}
                              onChange={(event) =>
                                updateRoutineItemDuration(routine.id, item.id, Number(event.target.value) || 1)
                              }
                            />
                            <button
                              aria-label={`Move ${getRoutineItemLabel(item, exercises, songs)} up`}
                              disabled={itemIndex === 0}
                              onClick={() => moveRoutineItem(routine.id, item.id, -1)}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`Move ${getRoutineItemLabel(item, exercises, songs)} down`}
                              disabled={itemIndex === routine.items.length - 1}
                              onClick={() => moveRoutineItem(routine.id, item.id, 1)}
                            >
                              ↓
                            </button>
                            <button
                              aria-label={`Remove ${getRoutineItemLabel(item, exercises, songs)}`}
                              onClick={() => removeRoutineItem(routine.id, item.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <label className="routine-pause-setting">
                    <input
                      type="checkbox"
                      aria-label={`Pause at item end for ${routine.name}`}
                      checked={Boolean(routine.pauseAtItemEnd)}
                      onChange={(event) =>
                        setRoutinePauseAtItemEnd(routine.id, event.target.checked)
                      }
                    />
                    Pause at the end of each item
                  </label>

                  <div className="routine-add-controls">
                    <select
                      aria-label={`Add exercise to ${routine.name}`}
                      value=""
                      onChange={(event) => {
                        if (event.target.value) {
                          addExerciseToRoutine(routine.id, event.target.value)
                        }
                        event.target.value = ''
                      }}
                    >
                      <option value="">Add exercise...</option>
                      {exercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label={`Add song to ${routine.name}`}
                      value=""
                      onChange={(event) => {
                        if (event.target.value) {
                          addSongToRoutine(routine.id, event.target.value)
                        }
                        event.target.value = ''
                      }}
                    >
                      <option value="">Add song...</option>
                      {songs.map((song) => (
                        <option key={song.id} value={song.id}>
                          {song.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="routine-action-groups">
                    <div className="routine-action-group">
                      <p className="routine-action-label">Use routine</p>
                      <div className="routine-action-buttons">
                        <button
                          className="secondary-button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedRoutineId(routine.id)}
                        >
                          {isSelected ? 'Selected' : 'Select routine'}
                        </button>
                        <button
                          className="secondary-button"
                          aria-pressed={Boolean(routine.isDefault)}
                          disabled={routine.isDefault}
                          onClick={() => setDefaultRoutine(routine.id)}
                        >
                          {routine.isDefault ? 'Current default' : 'Make default'}
                        </button>
                      </div>
                    </div>

                    <div className="routine-action-group">
                      <p className="routine-action-label">Manage routine</p>
                      <div className="routine-action-buttons">
                        {editingRoutineId === routine.id ? (
                          <>
                            <button
                              className="primary-button"
                              aria-label={`Save routine name for ${routine.name}`}
                              disabled={!editingRoutineName.trim()}
                              onClick={() => saveRoutineName(routine.id)}
                            >
                              Save name
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => {
                                setEditingRoutineId(null)
                                setEditingRoutineName('')
                              }}
                            >
                              Cancel rename
                            </button>
                          </>
                        ) : (
                          <button
                            className="secondary-button"
                            aria-label={`Rename routine ${routine.name}`}
                            onClick={() => editRoutine(routine)}
                          >
                            Rename
                          </button>
                        )}
                        <button
                          className="secondary-button"
                          aria-label={`Duplicate routine ${routine.name}`}
                          onClick={() => duplicateRoutine(routine)}
                        >
                          Duplicate
                        </button>
                        <button className="danger-button" onClick={() => deleteRoutine(routine.id)}>
                          Delete
                        </button>
                        <button
                          className="secondary-button"
                          aria-expanded={routineExportId === routine.id}
                          onClick={() => {
                            setRoutineExportId((previous) =>
                              previous === routine.id ? null : routine.id,
                            )
                            setIncludeTabsInRoutineExport(false)
                            setRoutineShareMessage('')
                          }}
                        >
                          {routineExportId === routine.id ? 'Close sharing options' : 'Share routine'}
                        </button>
                      </div>
                      {routineExportId === routine.id && (
                        <div className="routine-share-options">
                          <label>
                            <input
                              type="checkbox"
                              aria-label="Include song tab/notation text"
                              checked={includeTabsInRoutineExport}
                              onChange={(event) =>
                                setIncludeTabsInRoutineExport(event.target.checked)
                              }
                            />
                            Include song tab/notation text
                          </label>
                          <button
                            className="primary-button"
                            onClick={() => handleExportRoutine(routine)}
                          >
                            Download routine file
                          </button>
                          {routineShareMessage && (
                            <p className="status-message" role="status">{routineShareMessage}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )

  const renderHistory = () => (
    <section className="panel">
      <PageHero
        eyebrow="Look back, keep moving"
        title="Practice history"
        description="See the sessions you’ve completed and the time you’ve put into your practice."
      />

      <div className="history-list">
        {history.length === 0 ? (
          <p className="empty-inline">As soon as you finish a session, the saved summary will show up here.</p>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="history-row">
              <div>
                <strong>{entry.routineName}</strong>
                <small>{new Date(entry.completedAt).toLocaleDateString()}</small>
              </div>
              <div>
                <span>{entry.actualMinutes} min</span>
                <small>Planned {entry.plannedMinutes} min</small>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )

  const renderSettings = () => (
    <section className="panel">
      <PageHero
        eyebrow="Make it yours"
        title="Settings"
        description="Choose the look and feel of your practice space, set up your instrument, and tune your goals."
      />
      <p className="settings-intro">
        Choose an app theme, instrument, and tuning. Practice targets are compared with completed practice. Routine preferences apply to new and active sessions; changes to an active routine take effect immediately.
      </p>
      <div className="settings-list">
        <div className="settings-row">
          <div>
            <strong>App theme</strong>
            <small>Choose the color theme used throughout the app. Your choice is saved in this browser.</small>
          </div>
          <label>
            Theme
            <select
              aria-label="App theme"
              value={appTheme}
              onChange={(event) => {
                if (isAppTheme(event.target.value)) {
                  setAppTheme(event.target.value)
                }
              }}
            >
              {APP_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-row">
          <div>
            <strong>Instrument</strong>
            <small>Choose the instrument used by the fretboard and scale diagrams.</small>
          </div>
          <label>
            Instrument
            <select
              aria-label="Instrument"
              value={activeInstrument.id}
              onChange={(event) => {
                const profile = INSTRUMENT_PROFILES.find(
                  (item) => item.id === event.target.value,
                )
                if (profile) {
                  setInstrumentSettings((previous) => ({
                    ...previous,
                    activeInstrumentId: profile.id,
                  }))
                }
              }}
            >
              {INSTRUMENT_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-row">
          <div>
            <strong>Tuning</strong>
            <small>
              Select a preset or customize each open string. Custom pitches are available from E0 through E6.
            </small>
          </div>
          <label>
            Tuning preset
            <select
              aria-label="Instrument tuning preset"
              value={activeTuningPreset?.id ?? 'custom'}
              onChange={(event) => {
                const preset = activeInstrument.tuningPresets.find(
                  (item) => item.id === event.target.value,
                )
                if (preset) {
                  setInstrumentSettings((previous) => ({
                    ...previous,
                    tunings: {
                      ...previous.tunings,
                      [activeInstrument.id]: [...preset.midiNotes],
                    },
                  }))
                }
              }}
            >
              {activeInstrument.tuningPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
              {!activeTuningPreset && <option value="custom">Custom tuning</option>}
            </select>
          </label>
        </div>
      </div>
      <fieldset className="custom-tuning">
        <legend>Customize {activeInstrument.label} open strings</legend>
        <div className="custom-tuning-grid">
          {activeTuning.map((note, index) => (
            <label key={activeInstrument.stringLabels[index]}>
              {activeInstrument.stringLabels[index]}
              <select
                aria-label={`${activeInstrument.stringLabels[index]} tuning`}
                value={note}
                onChange={(event) => {
                  const midiNote = Number(event.target.value)
                  setInstrumentSettings((previous) => ({
                    ...previous,
                    tunings: {
                      ...previous.tunings,
                      [activeInstrument.id]: previous.tunings[activeInstrument.id]
                        .map((openNote, stringIndex) =>
                          stringIndex === index ? midiNote : openNote,
                        ),
                    },
                  }))
                }}
              >
                {customTuningNotes.map((midiNote) => (
                  <option key={midiNote} value={midiNote}>
                    {getTuningNoteName(midiNote)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {activeTuningPreset?.id !== activeInstrument.tuningPresets[0].id && (
          <button
            type="button"
            className="secondary-button fretboard-reset"
            onClick={() => setInstrumentSettings((previous) => ({
              ...previous,
              tunings: {
                ...previous.tunings,
                [activeInstrument.id]: [
                  ...activeInstrument.tuningPresets[0].midiNotes,
                ],
              },
            }))}
          >
            Reset to {activeInstrument.tuningPresets[0].label}
          </button>
        )}
      </fieldset>
      <div className="settings-list">
        <div className="settings-row practice-target-mode">
          <div>
            <strong>Practice-time targets</strong>
            <small>Set a shared daily target or choose a different target for each weekday. Use 0 minutes for a rest day.</small>
          </div>
          <label>
            Target schedule
            <select
              aria-label="Practice target mode"
              value={practiceTargets.mode}
              onChange={(event) => {
                const mode = event.target.value
                if (mode === 'daily' || mode === 'per-day') {
                  setPracticeTargets((previous) => ({ ...previous, mode }))
                }
              }}
            >
              <option value="daily">Same target every day</option>
              <option value="per-day">Different target each day</option>
            </select>
          </label>
        </div>
        {practiceTargets.mode === 'daily' ? (
          <label className="practice-target-input">
            Daily target (minutes)
            <input
              aria-label="Daily target minutes"
              type="number"
              min="0"
              max={MAX_DAILY_PRACTICE_TARGET_MINUTES}
              step="1"
              value={practiceTargets.dailyMinutes}
              onChange={(event) => updatePracticeTargetMinutes('daily', event.target.value)}
            />
          </label>
        ) : (
          <div className="practice-target-grid">
            {DAY_OF_WEEK_KEYS.map((day) => (
              <label className="practice-target-input" key={day}>
                {day[0].toUpperCase() + day.slice(1)} target (minutes)
                <input
                  aria-label={`${day[0].toUpperCase() + day.slice(1)} target minutes`}
                  type="number"
                  min="0"
                  max={MAX_DAILY_PRACTICE_TARGET_MINUTES}
                  step="1"
                  value={practiceTargets.dayMinutes[day]}
                  onChange={(event) => updatePracticeTargetMinutes(day, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}
      </div>
      {routines.length === 0 ? (
        <p className="empty-inline">Create a routine to configure its practice behavior.</p>
      ) : (
        <div className="settings-list">
          {routines.map((routine) => (
            <div className="settings-row" key={routine.id}>
              <div>
                <strong>{routine.name}</strong>
                <small>Pause the session timer after each exercise or song, then continue when ready.</small>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  aria-label={`Pause at item end for ${routine.name}`}
                  checked={Boolean(routine.pauseAtItemEnd)}
                  onChange={(event) =>
                    setRoutinePauseAtItemEnd(routine.id, event.target.checked)
                  }
                />
                Pause at item end
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  const renderAbout = () => (
    <section className="panel">
      <PageHero
        eyebrow="About"
        title="Guitar Practice Companion"
        description="A free, local-first practice companion for guitarists."
      />
      <div className="about-panel">
        <p>
          Version {__APP_VERSION__} (beta). Your exercises, routines, songs, and history stay on
          this device, and you can export a backup anytime from the Backup tab.
        </p>
        <p>
          Something not working, or have an idea? Open an issue on{' '}
          <a
            href="https://github.com/RobertJooste/guitar-practice/issues"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          . If the app behaves oddly after an update, try reloading first; your data is stored
          locally and a reload does not delete it.
        </p>
        <p>
          If the app helps your practice, you can{' '}
          <a href="https://ko-fi.com/robertjooste" target="_blank" rel="noreferrer">
            support it on Ko-fi
          </a>
          . It is entirely optional and unlocks nothing — the app is free and complete either way.
        </p>
      </div>
    </section>
  )

  const saveSong = (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateSongDraft(songForm)) {
      setSongMessage('Add a song title before saving.')
      return
    }

    if (editingSongId) {
      setSongs((previous) =>
        previous.map((song) => (song.id === editingSongId ? { ...createSongFromDraft(songForm), id: editingSongId } : song)),
      )
      setEditingSongId(null)
    } else {
      setSongs((previous) => [createSongFromDraft(songForm), ...previous])
    }

    setSongForm({ ...DEFAULT_SONG_DRAFT })
    setSongMessage('Song saved.')
  }

  const editSong = (song: Song) => {
    setEditingSongId(song.id)
    setSongForm({
      title: song.title,
      artist: song.artist,
      tuning: song.tuning,
      difficulty: song.difficulty,
      notes: song.notes,
      tab: song.tab,
    })
    setSongMessage('')
  }

  const duplicateSong = (song: Song) => {
    setSongs((previous) => [createSongDuplicate(song), ...previous])
  }

  const deleteSong = (songId: string) => {
    const song = songs.find((item) => item.id === songId)
    const routinesUsingSongCount = routines.filter((routine) =>
      routine.items.some((routineItem) => routineItem.songId === songId),
    ).length

    if (song && routinesUsingSongCount > 0) {
      const shouldDelete = window.confirm(
        `Delete "${song.title}"? It's used in ${routinesUsingSongCount} routine(s). Deleting it will remove it from those routines. Historical records will not be affected. Are you sure?`,
      )

      if (!shouldDelete) {
        return
      }
    }

    setSongs((previous) => previous.filter((song) => song.id !== songId))
    if (expandedSongId === songId) {
      setExpandedSongId(null)
    }

    setRoutines((previous) =>
      previous.map((routine) => ({
        ...routine,
        items: routine.items.filter((item) => item.songId !== songId),
      })),
    )

    if (editingSongId === songId) {
      setEditingSongId(null)
      setSongForm({ ...DEFAULT_SONG_DRAFT })
    }
  }

  const renderSongs = () => (
    <section className="panel">
      <PageHero
        eyebrow="Keep your music close"
        title="Song library"
        description="Save songs, practice notes, and tab or notation so they’re ready for your next session."
      />

      <div className="search-row">
        <input
          value={songFilter}
          onChange={(event) => setSongFilter(event.target.value)}
          placeholder="Search song library"
        />
      </div>

      <form className="stack-form" onSubmit={saveSong}>
        <div className="song-form-grid">
          <label>
            Song title
            <input
              value={songForm.title}
              onChange={(event) => setSongForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Black Hole Sun"
            />
          </label>
          <label>
            Artist
            <input
              value={songForm.artist}
              onChange={(event) => setSongForm((current) => ({ ...current, artist: event.target.value }))}
              placeholder="Soundgarden"
            />
          </label>
          <label>
            Tuning
            <input
              value={songForm.tuning}
              onChange={(event) => setSongForm((current) => ({ ...current, tuning: event.target.value }))}
              placeholder="E A D G B E"
            />
          </label>
          <label>
            Difficulty
            <select
              value={songForm.difficulty}
              onChange={(event) => setSongForm((current) => ({ ...current, difficulty: event.target.value }))}
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </label>
        </div>

        <label>
          Practice notes
          <textarea
            value={songForm.notes}
            onChange={(event) => setSongForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Focus on the rhythm, phrasing, and clean muting between sections."
          />
        </label>

        <label>
          Tabs / notation (optional)
          <textarea
            value={songForm.tab}
            onChange={(event) => setSongForm((current) => ({ ...current, tab: event.target.value }))}
            placeholder="e|-------------------|\nB|-------------------|\nG|-------------------|"
            className="tab-editor"
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingSongId ? 'Update song' : 'Add song'}
          </button>
          {editingSongId && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setEditingSongId(null)
                setSongForm({ ...DEFAULT_SONG_DRAFT })
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {songMessage && <p className="status-message">{songMessage}</p>}
      </form>

      <div className="song-list">
        {visibleSongs.length === 0 ? (
          <p className="empty-inline">
            {songs.length === 0
              ? 'Save a song with optional tabs and practice notes when you want to revisit a piece.'
              : 'No songs match that search yet.'}
          </p>
        ) : (
          visibleSongs.map((song) => {
            const isExpanded = expandedSongId === song.id

            return (
              <article
                key={song.id}
                className={`card song-card ${isExpanded ? 'expanded' : 'collapsed'}`}
                data-song-id={song.id}
              >
                <button
                  type="button"
                  className="song-card-header"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} song ${song.title}`}
                  onClick={() =>
                    setExpandedSongId((previous) => previous === song.id ? null : song.id)
                  }
                >
                  <div className="song-card-header-left">
                    <p className="eyebrow">{song.difficulty}</p>
                    <h3>{song.title}</h3>
                  </div>
                  <span className="duration-badge">{song.artist || 'Unknown artist'}</span>
                </button>

                {isExpanded && (
                  <>
                    <div className="song-meta-row">
                      <span>Tuning: {song.tuning || 'E A D G B E'}</span>
                    </div>

                    {song.notes && <p>{song.notes}</p>}

                    <pre className="tab-block">{song.tab}</pre>

                    <div className="card-actions">
                      <button className="secondary-button" onClick={() => editSong(song)}>
                        Edit
                      </button>
                      <button className="secondary-button" onClick={() => duplicateSong(song)}>
                        Duplicate
                      </button>
                      <button className="danger-button" onClick={() => deleteSong(song.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )

  const renderBackup = () => (
    <section className="panel">
      <PageHero
        eyebrow="Your practice, protected"
        title="Backup and restore"
        description="Keep a local copy of your practice data and restore it whenever you need."
      />

      <div className="backup-box">
        <p>
          Save a local backup of your exercises, routines, history, and active-session data. Import it later to restore the app state.
        </p>

        <div className="backup-actions">
          <button className="primary-button" onClick={handleExportBackup}>Export backup</button>
          <label className="secondary-button file-button">
            Import backup
            <input type="file" accept="application/json" onChange={handleImportBackup} />
          </label>
        </div>

        {backupMessage && <p className="status-message">{backupMessage}</p>}
      </div>

      <div className="backup-box routine-import-box">
        <div>
          <h3>Import a shared routine</h3>
          <p>
            Preview a routine file before adding it. Shared routines do not include practice history or active-session data.
          </p>
        </div>
        <label className="secondary-button file-button">
          Choose routine file
          <input
            type="file"
            accept=".gproutine,application/json"
            aria-label="Choose shared routine file"
            onChange={handleImportRoutineFile}
          />
        </label>

        {routineImportPackage && (
          <article className="shared-routine-preview">
            <h4>{routineImportPackage.routine.name}</h4>
            {routineImportPackage.routine.description && (
              <p>{routineImportPackage.routine.description}</p>
            )}
            <p>
              {routineImportPackage.items.length} routine items; {routineImportPackage.exercises.length} exercises and {routineImportPackage.songs.length} songs will be added as new library entries.
            </p>
            <p>
              {routineImportPackage.songs.some((song) => song.tab !== undefined)
                ? 'Tab/notation text is included in this file.'
                : 'Tab/notation text is not included in this file.'}
            </p>
            <ul>
              {routineImportPackage.items.map((item, index) => {
                const exercise =
                  item.kind === 'exercise'
                    ? routineImportPackage.exercises.find(
                        (candidate) => candidate.id === item.sourceId,
                      )
                    : undefined
                const song =
                  item.kind === 'song'
                    ? routineImportPackage.songs.find(
                        (candidate) => candidate.id === item.sourceId,
                      )
                    : undefined
                return (
                  <li key={`${item.kind}-${item.sourceId}-${index}`}>
                    <strong>{index + 1}. {exercise?.name ?? song?.title ?? 'Practice item'}</strong>
                    {' '}({item.duration} min)
                    {exercise && (
                      <p>
                        {exercise.category} · Default {exercise.defaultDuration} min
                        {exercise.targetTempo ? ` · Target tempo ${exercise.targetTempo} BPM` : ''}
                        <br />
                        {exercise.description}
                        {exercise.notes ? ` Notes: ${exercise.notes}` : ''}
                      </p>
                    )}
                    {song && (
                      <>
                        <p>
                          {song.artist || 'Unknown artist'} · {song.tuning} · {song.difficulty}
                        </p>
                        {song.tab !== undefined && (
                          <details>
                            <summary>View included tab/notation</summary>
                            <pre>{song.tab}</pre>
                          </details>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="routine-import-actions">
              <button className="primary-button" onClick={() => handleImportRoutine()}>
                Add as new routine
              </button>
              {routines.length > 0 && (
                <div className="routine-replacement">
                  <label>
                    Replace this routine
                    <select
                      aria-label="Routine to replace"
                      value={routineImportTargetId}
                      onChange={(event) => setRoutineImportTargetId(event.target.value)}
                    >
                      <option value="">Choose a routine...</option>
                      {routines.map((routine) => (
                        <option key={routine.id} value={routine.id}>{routine.name}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="danger-button"
                    disabled={!routineImportTargetId}
                    onClick={() => handleImportRoutine(routineImportTargetId)}
                  >
                    Replace selected routine
                  </button>
                </div>
              )}
            </div>
          </article>
        )}
        {routineShareMessage && (
          <p className="status-message" role="status">{routineShareMessage}</p>
        )}
      </div>
    </section>
  )

  const renderActiveSession = () => {
    if (!activeSession || !activeRoutine) {
      return null
    }

    const positionMs = activeRoutine.positionMs
    const remainingMs = Math.max(0, activeSession.totalMs - positionMs)
    const fraction = activeSession.totalMs > 0
      ? Math.min(100, (positionMs / activeSession.totalMs) * 100)
      : 100
    const currentExercise = activeRoutine.currentExercise
    const currentSong = activeRoutine.currentItem?.kind === 'song' && activeRoutine.currentItem.songId
      ? activeRoutine.currentItem.songSnapshot ?? getSongById(activeRoutine.currentItem.songId, songs)
      : undefined
    const currentSongTab = currentSong?.tab.trim() ? currentSong.tab : null
    const isFocusedTabVisible =
      currentSongTab !== null && hiddenTabSessionId !== activeSession.id
    const focusLabel =
      activeRoutine.currentItem?.kind === 'song' && activeRoutine.currentItem.songId
        ? activeRoutine.currentItem.songSnapshot?.title ??
          getSongById(activeRoutine.currentItem.songId, songs)?.title ??
          'Song practice'
        : currentExercise?.name ?? 'Session complete'
    const sessionTimerControl = activeSession.status === 'running' ? (
      <button
        type="button"
        className="secondary-button"
        aria-label="Pause practice session"
        onClick={pauseSession}
      >
        Pause
      </button>
    ) : (
      <button
        type="button"
        className="secondary-button"
        aria-label={
          activeSession.pauseReason === 'item-end'
            ? 'Continue practice session'
            : 'Resume practice session'
        }
        onClick={resumeSession}
      >
        {activeSession.pauseReason === 'item-end' ? 'Continue' : 'Resume'}
      </button>
    )

    return (
      <section className="panel session-panel">
        <div className="session-topline">
          <div>
            <p className="eyebrow">Active session</p>
            <h2>{activeSession.routineName}</h2>
          </div>
          <span className={`status-pill ${activeSession.status}`}>{activeSession.status}</span>
        </div>

        <div className="session-grid">
          <div className="session-main-card">
            <p className="eyebrow">Current item</p>
            <h3>{focusLabel}</h3>
            <p>
              {activeRoutine.currentItem?.kind === 'song'
                ? 'Work on the song passage with attention to rhythm and phrasing.'
                : currentExercise?.description ?? 'Your routine is complete. Great work.'}
            </p>
          </div>

          <div className="timer-card">
            <small>Routine remaining</small>
            <strong>{formatDurations(remainingMs)}</strong>
            <span>{Math.round(fraction)}% complete</span>
          </div>

          <div className="timer-card">
            <small>{activeRoutine.currentItem?.kind === 'song' ? 'Song remaining' : 'Exercise remaining'}</small>
            <strong>{formatDurations(activeRoutine.currentItemRemainingMs)}</strong>
            <span>{activeRoutine.currentItem ? `${activeRoutine.currentItem.duration} min item` : 'Complete'}</span>
          </div>
        </div>

        {currentSongTab && currentSong && (
          <section className="focused-tab-panel" aria-label="Focused song tab practice">
            <div className="focused-tab-header">
              <div>
                <p className="eyebrow">Practice tab</p>
                <h3>{currentSong.title}</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                aria-controls={`focused-tab-${activeSession.id}`}
                aria-expanded={isFocusedTabVisible}
                onClick={() => setHiddenTabSessionId(
                  isFocusedTabVisible ? activeSession.id : null,
                )}
              >
                {isFocusedTabVisible ? 'Hide tab' : 'Show tab'}
              </button>
            </div>

            <pre
              id={`focused-tab-${activeSession.id}`}
              className="tab-block focused-tab-display"
              tabIndex={0}
              aria-label={`${currentSong.title} tab notation`}
              hidden={!isFocusedTabVisible}
            >
              {currentSongTab}
            </pre>
            {isFocusedTabVisible && (
              <div className="focused-tab-session-controls">
                {sessionTimerControl}
                <div className="focused-tab-elapsed">
                  <small>Session elapsed</small>
                  <strong>{formatDurations(deriveElapsedMs(activeSession))}</strong>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="progress-bar">
          <span style={{ width: `${fraction}%` }} />
        </div>

        <div className="session-meta">
          <span>{activeRoutine.displayIndex + 1} of {activeRoutine.routine.items.length} items</span>
          <span>{activeRoutine.totalMinutes} min routine</span>
          <span>{activeRoutine.currentItem ? `${activeRoutine.currentItem.duration} min current item` : 'Complete'}</span>
        </div>

        <div className="session-controls">
          {!isFocusedTabVisible && sessionTimerControl}
          <button className="secondary-button" onClick={skipCurrentExercise}>Skip</button>
          <button className="secondary-button" onClick={previousExercise}>Previous</button>
          <button className="primary-button" onClick={finishSession}>Finish</button>
        </div>

        <MetronomeControls {...metronome} />
      </section>
    )
  }

  const renderSessionIndicator = () => {
    if (
      !activeSession ||
      activeSession.status === 'completed' ||
      !activeRoutine
    ) {
      return null
    }

    const positionMs = activeRoutine.positionMs
    const remainingMs = Math.max(0, activeSession.totalMs - positionMs)
    const progress = activeSession.totalMs > 0
      ? Math.min(100, (positionMs / activeSession.totalMs) * 100)
      : 100
    const item = activeRoutine.currentItem
    const currentItemName = item?.kind === 'song'
      ? item.songSnapshot?.title ?? 'Song practice'
      : activeRoutine.currentExercise?.name ?? 'Session complete'

    return (
      <section
        className={`session-indicator ${activeSession.status}`}
        aria-label={`${activeSession.status} practice session`}
      >
        <div className="session-indicator-details">
          <span className={`status-pill ${activeSession.status}`}>{activeSession.status}</span>
          <div className="session-indicator-copy">
            <strong>{activeSession.routineName}</strong>
            <span>
              {currentItemName} · {activeRoutine.displayIndex + 1} of {activeRoutine.routine.items.length}
            </span>
          </div>
          <span className="session-indicator-time">{formatDurations(remainingMs)} left</span>
        </div>
        <div
          className="session-indicator-progress"
          role="progressbar"
          aria-label="Practice session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="session-indicator-actions">
          {activeSession.status === 'running' ? (
            <button
              className="secondary-button session-toggle-button"
              aria-label="Pause practice session"
              onClick={pauseSession}
            >
              Pause
            </button>
          ) : (
            <button
              className="secondary-button session-toggle-button"
              aria-label="Resume practice session"
              onClick={resumeSession}
            >
              {activeSession.pauseReason === 'item-end' ? 'Continue' : 'Resume'}
            </button>
          )}
          <button
            className="secondary-button session-return-button"
            onClick={() => setTab('dashboard')}
          >
            Return to practice
          </button>
        </div>
      </section>
    )
  }

  const navigationGroups: { label: string; tabs: AppTab[] }[] = [
    { label: 'Practice', tabs: ['dashboard', 'metronome', 'routines', 'history'] },
    { label: 'Library', tabs: ['library', 'songs'] },
    { label: 'Explore', tabs: ['fretboard', 'scales'] },
    { label: 'Manage', tabs: ['backup', 'settings', 'about'] },
  ]

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true">GP</div>
          <div className="brand-copy">
            <p className="eyebrow">Guitar practice</p>
            <h1>Practice companion</h1>
          </div>
        </header>

        <nav className="nav-tabs" aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              <div className="nav-group-items">
                {group.tabs.map((item) => (
                  <button
                    key={item}
                    className={item === tab ? 'nav-tab active' : 'nav-tab'}
                    aria-current={item === tab ? 'page' : undefined}
                    onClick={() => {
                      setTab(item)
                      if (item !== 'dashboard') {
                        setDashboardCustomizationOpen(false)
                      }
                    }}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <p className="sidebar-note">Your practice stays on this device.</p>
      </aside>

      <div className="app-main">
        {tab === 'dashboard' ? renderActiveSession() : renderSessionIndicator()}

        <main className="content-shell">
          {storageRecoveryItems.length > 0 && (
            <section className="storage-warning" role="alert">
              <div>
                <strong>Some saved data could not be loaded</strong>
                <p>The app is using safe defaults for: {storageRecoveryItems.map((item) => item.label).join(', ')}. Download a recovery copy before replacing this data.</p>
              </div>
              <button className="secondary-button" onClick={handleDownloadStorageRecovery}>
                Download recovery data
              </button>
            </section>
          )}
          {storageError && (
            <section className="storage-warning" role="alert">
              <div>
                <strong>Practice data could not be saved</strong>
                <p>Your browser storage may be full or restricted. Export a backup to avoid losing data.</p>
              </div>
              <button className="secondary-button" onClick={() => setTab('backup')}>
                Go to backup
              </button>
            </section>
          )}
          {tab === 'dashboard' && renderDashboard()}
          {tab === 'metronome' && <MetronomeControls {...metronome} />}
          {tab === 'library' && renderLibrary()}
          {tab === 'routines' && renderRoutines()}
          {tab === 'history' && renderHistory()}
          {tab === 'songs' && renderSongs()}
          <FretboardExplorer
            hidden={tab !== 'fretboard'}
            instrument={activeInstrument}
            tuning={activeTuning}
          />
          <ScalePractice
            hidden={tab !== 'scales'}
            instrument={activeInstrument}
            tuning={activeTuning}
          />
          {tab === 'backup' && renderBackup()}
          {tab === 'settings' && renderSettings()}
          {tab === 'about' && renderAbout()}
        </main>
      </div>
    </div>
  )
}

export default App
