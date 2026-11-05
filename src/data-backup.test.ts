import { describe, expect, it } from 'vitest'
import { exportAppData, importAppData } from './data-backup'
import { DEFAULT_DASHBOARD_LAYOUT } from './dashboard-layout'
import { createDefaultPracticeTargets } from './practice-targets'
import { createDefaultInstrumentSettings } from './instruments'
import { DEFAULT_APP_THEME } from './app-themes'

const validBackup = {
  version: 1,
  exportedAt: '2024-01-01T00:00:00.000Z',
  exercises: [{
    id: 'a',
    name: 'Warm-up',
    category: 'Technique',
    description: 'Warm up carefully.',
    defaultDuration: 5,
  }],
  routines: [{
    id: 'r1',
    name: 'Today',
    description: 'Daily practice',
    items: [{ id: 'item1', exerciseId: 'a', duration: 5 }],
  }],
  songs: [{
    id: 's1',
    title: 'Demo song',
    artist: 'Artist',
    tuning: 'E A D G B E',
    difficulty: 'Beginner',
    notes: '',
    tab: 'e|---|',
  }],
  history: [{
    id: 'h1',
    routineName: 'Today',
    actualMinutes: 5,
    plannedMinutes: 5,
    completedAt: '2024-01-01T00:00:00.000Z',
  }],
  selectedRoutineId: 'r1',
  activeSession: null,
}

describe('data backup helpers', () => {
  it('serializes app state to a JSON payload', () => {
    const payload = exportAppData({
      exercises: [{ id: 'a', name: 'Warm-up' }],
      routines: [{ id: 'r1', name: 'Today', items: [] }],
      songs: [{ id: 's1', title: 'Demo song', artist: 'Artist', tuning: 'E A D G B E', difficulty: 'Beginner', notes: '', tab: 'e|---|' }],
      history: [{ id: 'h1', routineName: 'Today', actualMinutes: 20, plannedMinutes: 20, completedAt: '2024-01-01T00:00:00.000Z' }],
      selectedRoutineId: 'r1',
      activeSession: null,
    })

    expect(JSON.parse(payload).version).toBe(1)
    expect(JSON.parse(payload).dashboardLayout).toEqual(DEFAULT_DASHBOARD_LAYOUT)
    expect(payload).toContain('"exercises"')
    expect(payload).toContain('"routines"')
    expect(JSON.parse(payload).practiceTargets.dayMinutes.monday).toBe(30)
    expect(JSON.parse(payload).instrumentSettings)
      .toEqual(createDefaultInstrumentSettings())
    expect(JSON.parse(payload).appTheme).toBe(DEFAULT_APP_THEME)
  })

  it('restores the expected app state from the backup payload', () => {
    const restored = importAppData(JSON.stringify(validBackup)) as {
      exercises: Array<{ id: string; name: string }>
      routines: Array<{ id: string; name: string; items: unknown[] }>
      songs: Array<{ id: string; title: string }>
      history: Array<{ id: string }>
      selectedRoutineId: string
    }

    expect(restored.exercises).toHaveLength(1)
    expect(restored.routines[0].name).toBe('Today')
    expect(restored.songs[0].title).toBe('Demo song')
    expect(restored.selectedRoutineId).toBe('r1')
  })

  it('restores songs with non-standard difficulty strings', () => {
    const backup = {
      ...validBackup,
      songs: [{ ...validBackup.songs[0], difficulty: 'Custom level' }],
    }

    const restored = importAppData(JSON.stringify(backup)) as {
      songs: Array<{ difficulty: string }>
    }

    expect(restored.songs[0].difficulty).toBe('Custom level')
  })

  it('treats a missing version as a legacy version-1 backup', () => {
    const { version: _version, songs: _songs, ...legacyBackup } = validBackup
    const restored = importAppData(JSON.stringify(legacyBackup))

    expect(restored.songs).toEqual([])
    expect(restored.routines).toHaveLength(1)
    expect(restored.practiceTargets).toEqual(createDefaultPracticeTargets())
  })

  it('round-trips custom practice-time targets', () => {
    const practiceTargets = {
      mode: 'per-day' as const,
      dailyMinutes: 20,
      dayMinutes: {
        monday: 45,
        tuesday: 30,
        wednesday: 20,
        thursday: 15,
        friday: 10,
        saturday: 0,
        sunday: 0,
      },
    }
    const exported = exportAppData({
      ...validBackup,
      practiceTargets,
    })

    expect(importAppData(exported).practiceTargets).toEqual(practiceTargets)
  })

  it('round-trips dashboard layout preferences', () => {
    const dashboardLayout = {
      ...DEFAULT_DASHBOARD_LAYOUT,
      order: [
        'weekly-chart',
        'activity-stats',
        'weekly-summary',
        'weekly-goal',
        'routine-preview',
      ] as typeof DEFAULT_DASHBOARD_LAYOUT.order,
      hidden: ['weekly-goal'] as typeof DEFAULT_DASHBOARD_LAYOUT.hidden,
      sizes: { ...DEFAULT_DASHBOARD_LAYOUT.sizes, 'weekly-chart': 'half' as const },
    }

    const exported = exportAppData({ ...validBackup, dashboardLayout })

    expect(importAppData(exported).dashboardLayout).toEqual(dashboardLayout)
  })

  it('round-trips instrument selection and per-instrument tunings', () => {
    const instrumentSettings = createDefaultInstrumentSettings()
    instrumentSettings.activeInstrumentId = 'bass-4'
    instrumentSettings.tunings['bass-4'] = [26, 33, 38, 43]
    instrumentSettings.tunings['guitar-6'] = [38, 45, 50, 55, 59, 64]

    const restored = importAppData(exportAppData({ ...validBackup, instrumentSettings }))

    expect(restored.instrumentSettings).toEqual(instrumentSettings)
  })

  it('defaults instrument settings for backups created before instrument profiles', () => {
    expect(importAppData(JSON.stringify(validBackup)).instrumentSettings)
      .toEqual(createDefaultInstrumentSettings())
  })

  it('round-trips a selected app theme and defaults older backups', () => {
    const exported = exportAppData({ ...validBackup, appTheme: 'midnight' })

    expect(importAppData(exported).appTheme).toBe('midnight')
    expect(importAppData(JSON.stringify(validBackup)).appTheme).toBe(DEFAULT_APP_THEME)
  })

  it('rejects an unknown app theme in a backup', () => {
    expect(() => importAppData(JSON.stringify({ ...validBackup, appTheme: 'unknown' })))
      .toThrow('Backup file contains an invalid app theme.')
  })

  it('rejects invalid instrument tuning data in a backup', () => {
    const instrumentSettings = createDefaultInstrumentSettings()
    instrumentSettings.tunings['bass-4'] = [26, 33, 38]

    expect(() => importAppData(JSON.stringify({ ...validBackup, instrumentSettings })))
      .toThrow('Backup file contains invalid instrument settings.')
  })

  it('defaults dashboard layout for older backups', () => {
    expect(importAppData(JSON.stringify(validBackup)).dashboardLayout)
      .toEqual(DEFAULT_DASHBOARD_LAYOUT)
  })

  it('rejects invalid dashboard layout data', () => {
    const backup = {
      ...validBackup,
      dashboardLayout: { ...DEFAULT_DASHBOARD_LAYOUT, order: ['unknown'] },
    }

    expect(() => importAppData(JSON.stringify(backup)))
      .toThrow('Backup file contains an invalid dashboard layout.')
  })

  it('round-trips optional enjoyment ratings and current difficulty', () => {
    const backup = {
      ...validBackup,
      exercises: [{
        ...validBackup.exercises[0],
        enjoymentRating: 4,
        difficulty: 'Hard',
      }],
      routines: [{
        ...validBackup.routines[0],
        enjoymentRating: 2,
        difficulty: 'Moderate',
      }],
    }
    const restored = importAppData(exportAppData(backup))

    expect(restored.exercises[0]).toMatchObject({ enjoymentRating: 4, difficulty: 'Hard' })
    expect(restored.routines[0]).toMatchObject({ enjoymentRating: 2, difficulty: 'Moderate' })
  })

  it('keeps legacy exercises and routines valid when optional ratings are absent', () => {
    expect(importAppData(JSON.stringify(validBackup)).exercises[0])
      .not.toHaveProperty('enjoymentRating')
    expect(importAppData(JSON.stringify(validBackup)).routines[0])
      .not.toHaveProperty('difficulty')
  })

  it('rejects invalid exercise and routine ratings or difficulty values', () => {
    const invalidExercise = {
      ...validBackup,
      exercises: [{ ...validBackup.exercises[0], enjoymentRating: 6 }],
    }
    const invalidRoutine = {
      ...validBackup,
      routines: [{ ...validBackup.routines[0], difficulty: 'Expert' }],
    }

    expect(() => importAppData(JSON.stringify(invalidExercise)))
      .toThrow('Backup file contains missing or invalid app data.')
    expect(() => importAppData(JSON.stringify(invalidRoutine)))
      .toThrow('Backup file contains missing or invalid app data.')
  })

  it('rejects invalid practice-time targets in a backup', () => {
    const backup = {
      ...validBackup,
      practiceTargets: {
        mode: 'per-day',
        dailyMinutes: 20,
        dayMinutes: { monday: -5 },
      },
    }

    expect(() => importAppData(JSON.stringify(backup)))
      .toThrow('Backup file contains invalid practice-time targets.')
  })

  it('rejects unsupported backup versions', () => {
    expect(() => importAppData(JSON.stringify({ ...validBackup, version: 2 })))
      .toThrow('Unsupported backup version: 2')
    expect(() => importAppData(JSON.stringify({ ...validBackup, version: null })))
      .toThrow('Unsupported backup version: null')
  })

  it('rejects malformed nested records', () => {
    const malformed = {
      ...validBackup,
      routines: [{ ...validBackup.routines[0], items: [{ id: 'bad', duration: 'five' }] }],
    }

    expect(() => importAppData(JSON.stringify(malformed)))
      .toThrow('Backup file contains missing or invalid app data.')
  })

  it('falls back to an existing routine when the selected id is stale', () => {
    const restored = importAppData(JSON.stringify({ ...validBackup, selectedRoutineId: 'missing' }))

    expect(restored.selectedRoutineId).toBe('r1')
  })
})
