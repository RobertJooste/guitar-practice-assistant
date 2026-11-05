import { describe, expect, it } from 'vitest'
import type { StoredExercise, StoredRoutine } from './data-validation'
import type { Song } from './song-library'
import { createRoutineSharePackage, parseRoutineSharePackage } from './routine-sharing'

const exercise: StoredExercise = {
  id: 'exercise-1',
  name: 'Alternate picking',
  category: 'Technique',
  description: 'Keep the picking motion relaxed.',
  defaultDuration: 5,
  notes: 'Use a metronome.',
  enjoymentRating: 4,
}

const song: Song = {
  id: 'song-1',
  title: 'Practice song',
  artist: 'Practice artist',
  tuning: 'E A D G B E',
  difficulty: 'Beginner',
  notes: 'Private practice note',
  tab: 'E|--0--|',
}

const routine: StoredRoutine = {
  id: 'routine-1',
  name: 'Focused practice',
  description: 'A short session.',
  isDefault: true,
  items: [
    { id: 'item-1', kind: 'exercise', exerciseId: exercise.id, duration: 7 },
    { id: 'item-2', kind: 'song', songId: song.id, duration: 12 },
  ],
}

describe('routine sharing packages', () => {
  it('exports only referenced content and includes song tabs only when requested', () => {
    const withoutTabs = createRoutineSharePackage(routine, [exercise], [song], false)
    expect(withoutTabs).toMatchObject({
      format: 'guitar-practice-routine',
      version: 1,
      routine: {
        name: 'Focused practice',
        description: 'A short session.',
        pauseAtItemEnd: false,
      },
      items: [
        { kind: 'exercise', sourceId: 'exercise-1', duration: 7 },
        { kind: 'song', sourceId: 'song-1', duration: 12 },
      ],
    })
    expect(withoutTabs.songs[0]).not.toHaveProperty('tab')
    expect(withoutTabs.songs[0]).not.toHaveProperty('notes')
    expect(withoutTabs.exercises[0]).not.toHaveProperty('enjoymentRating')
    expect(JSON.stringify(withoutTabs)).not.toContain('history')

    const withTabs = createRoutineSharePackage(routine, [exercise], [song], true)
    expect(withTabs.songs[0].tab).toBe('E|--0--|')
    expect(withTabs.songs[0]).not.toHaveProperty('notes')
  })

  it('round-trips a routine package through validation', () => {
    const packageData = createRoutineSharePackage(routine, [exercise], [song], true)

    expect(parseRoutineSharePackage(JSON.stringify(packageData))).toEqual(packageData)
  })

  it('supports exporting and importing an empty routine', () => {
    const emptyRoutine = { ...routine, items: [] }
    const packageData = createRoutineSharePackage(emptyRoutine, [exercise], [song], false)

    expect(packageData.exercises).toEqual([])
    expect(packageData.songs).toEqual([])
    expect(parseRoutineSharePackage(JSON.stringify(packageData))).toEqual(packageData)
  })

  it('reports library references that cannot be resolved during export', () => {
    const routineWithMissingExercise = {
      ...routine,
      items: [{ id: 'item-missing', kind: 'exercise' as const, exerciseId: 'missing', duration: 5 }],
    }

    expect(() => createRoutineSharePackage(routineWithMissingExercise, [], [], false)).toThrow(
      'no longer in your library',
    )
  })

  it('rejects malformed, unsupported, and unresolved packages', () => {
    expect(() => parseRoutineSharePackage('{')).toThrow('not valid JSON')
    expect(() =>
      parseRoutineSharePackage(JSON.stringify({ format: 'guitar-practice-routine', version: 2 })),
    ).toThrow('Unsupported routine file version')

    const packageData = createRoutineSharePackage(routine, [exercise], [song], false)
    packageData.items[0].sourceId = 'missing-exercise'
    expect(() => parseRoutineSharePackage(JSON.stringify(packageData))).toThrow(
      'missing or duplicate item references',
    )
  })

  it('rejects duplicated or unreferenced library definitions', () => {
    const packageData = createRoutineSharePackage(routine, [exercise], [song], false)
    packageData.exercises.push({ ...packageData.exercises[0], id: 'unused-exercise' })

    expect(() => parseRoutineSharePackage(JSON.stringify(packageData))).toThrow(
      'missing or duplicate item references',
    )
  })
})
