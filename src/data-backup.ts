import {
  isArrayOf,
  isStoredActiveSession,
  isStoredExercise,
  isStoredRoutine,
  isStoredSessionRecord,
  isStoredSong,
  isStoredPracticeTargets,
} from './data-validation'
import { createDefaultPracticeTargets, type PracticeTargets } from './practice-targets'
import { DEFAULT_DASHBOARD_LAYOUT, isDashboardLayout, type DashboardLayout } from './dashboard-layout'
import {
  createDefaultInstrumentSettings,
  isInstrumentSettings,
  type InstrumentSettings,
} from './instruments'
import { DEFAULT_APP_THEME, isAppTheme, type AppTheme } from './app-themes'

export type AppDataSnapshot = {
  exercises: unknown[]
  routines: unknown[]
  songs?: unknown[]
  history: unknown[]
  selectedRoutineId: string
  activeSession: unknown | null
  practiceTargets?: PracticeTargets
  dashboardLayout?: DashboardLayout
  instrumentSettings?: InstrumentSettings
  appTheme?: AppTheme
}

export type BackupEnvelope = AppDataSnapshot & {
  version: number
  exportedAt: string
}

export const exportAppData = (snapshot: AppDataSnapshot): string =>
  JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      ...snapshot,
      practiceTargets: snapshot.practiceTargets ?? createDefaultPracticeTargets(),
      dashboardLayout: snapshot.dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT,
      instrumentSettings: snapshot.instrumentSettings ?? createDefaultInstrumentSettings(),
      appTheme: snapshot.appTheme ?? DEFAULT_APP_THEME,
    },
    null,
    2,
  )

export const importAppData = (payload: string): AppDataSnapshot => {
  const parsed = JSON.parse(payload) as Partial<BackupEnvelope>

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file.')
  }

  const version = parsed.version === undefined ? 1 : parsed.version
  if (version !== 1) {
    throw new Error(`Unsupported backup version: ${String(version)}. This app supports version 1.`)
  }

  if (
    !isArrayOf(isStoredExercise)(parsed.exercises) ||
    !isArrayOf(isStoredRoutine)(parsed.routines) ||
    !isArrayOf(isStoredSessionRecord)(parsed.history)
  ) {
    throw new Error('Backup file contains missing or invalid app data.')
  }

  if (parsed.songs !== undefined && !isArrayOf(isStoredSong)(parsed.songs)) {
    throw new Error('Backup file contains invalid song data.')
  }

  if (
    parsed.activeSession !== undefined &&
    parsed.activeSession !== null &&
    !isStoredActiveSession(parsed.activeSession)
  ) {
    throw new Error('Backup file contains invalid active-session data.')
  }

  if (
    parsed.practiceTargets !== undefined &&
    !isStoredPracticeTargets(parsed.practiceTargets)
  ) {
    throw new Error('Backup file contains invalid practice-time targets.')
  }

  if (
    parsed.dashboardLayout !== undefined &&
    !isDashboardLayout(parsed.dashboardLayout)
  ) {
    throw new Error('Backup file contains an invalid dashboard layout.')
  }

  if (
    parsed.instrumentSettings !== undefined &&
    !isInstrumentSettings(parsed.instrumentSettings)
  ) {
    throw new Error('Backup file contains invalid instrument settings.')
  }

  if (parsed.appTheme !== undefined && !isAppTheme(parsed.appTheme)) {
    throw new Error('Backup file contains an invalid app theme.')
  }

  if (parsed.selectedRoutineId !== undefined && typeof parsed.selectedRoutineId !== 'string') {
    throw new Error('Backup file contains an invalid selected routine id.')
  }

  return {
    exercises: parsed.exercises,
    routines: parsed.routines,
    songs: Array.isArray(parsed.songs) ? parsed.songs : [],
    history: parsed.history,
    selectedRoutineId:
      typeof parsed.selectedRoutineId === 'string' &&
      parsed.routines.some((routine) => routine.id === parsed.selectedRoutineId)
        ? parsed.selectedRoutineId
        : parsed.routines[0]?.id ?? '',
    activeSession: parsed.activeSession ?? null,
    practiceTargets: parsed.practiceTargets ?? createDefaultPracticeTargets(),
    dashboardLayout: parsed.dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT,
    instrumentSettings: parsed.instrumentSettings ?? createDefaultInstrumentSettings(),
    appTheme: parsed.appTheme ?? DEFAULT_APP_THEME,
  }
}
