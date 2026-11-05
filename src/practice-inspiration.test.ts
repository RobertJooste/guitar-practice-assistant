import { describe, expect, it } from 'vitest'
import { createPracticeSuggestion } from './practice-inspiration'
import type { StoredExercise } from './data-validation'
import type { Song } from './song-library'

const exercises: StoredExercise[] = [
  { id: 'warmup', name: 'Warm-up', category: 'Warm-up', description: '', defaultDuration: 5 },
  { id: 'picking', name: 'Picking drill', category: 'Technique', description: '', defaultDuration: 5 },
  { id: 'scale', name: 'Scale work', category: 'Scales', description: '', defaultDuration: 5 },
  { id: 'ear', name: 'Intervals', category: 'Ear training', description: '', defaultDuration: 5 },
]

const songs: Song[] = [{
  id: 'song',
  title: 'Practice song',
  artist: '',
  tuning: 'E A D G B E',
  difficulty: 'Beginner',
  notes: '',
  tab: '',
}]

describe('createPracticeSuggestion', () => {
  it('creates a short plan whose item durations match the requested session length', () => {
    const suggestion = createPracticeSuggestion({
      durationMinutes: 10,
      focus: 'balanced',
      exercises,
      songs,
    })

    expect(suggestion?.items).toHaveLength(2)
    expect(suggestion?.items.reduce((total, item) => total + item.duration, 0)).toBe(10)
    expect(suggestion?.items.every((item) => item.duration > 0)).toBe(true)
  })

  it('includes work from the selected exercise focus', () => {
    const suggestion = createPracticeSuggestion({
      durationMinutes: 20,
      focus: 'theory-ear',
      exercises,
      songs,
    })

    expect(suggestion?.items.some((item) => item.exerciseId === 'ear' || item.exerciseId === 'scale')).toBe(true)
    expect(suggestion?.reason).toContain('theory and ear training')
  })

  it('supports song-focused suggestions and larger session lengths', () => {
    const suggestion = createPracticeSuggestion({
      durationMinutes: 60,
      focus: 'songs',
      exercises,
      songs,
    })

    expect(suggestion?.items).toHaveLength(6)
    expect(suggestion?.items.some((item) => item.songId === 'song')).toBe(true)
    expect(suggestion?.items.reduce((total, item) => total + item.duration, 0)).toBe(60)
  })

  it('returns no suggestion when the user has no exercises or songs', () => {
    expect(createPracticeSuggestion({
      durationMinutes: 10,
      focus: 'balanced',
      exercises: [],
      songs: [],
    })).toBeNull()
  })

  it('keeps every item duration positive for very short plans', () => {
    const suggestion = createPracticeSuggestion({
      durationMinutes: 1,
      focus: 'balanced',
      exercises,
      songs,
    })

    expect(suggestion?.items).toHaveLength(1)
    expect(suggestion?.items[0].duration).toBe(1)
  })

  it('explains when the selected focus is not represented in the library', () => {
    const suggestion = createPracticeSuggestion({
      durationMinutes: 10,
      focus: 'Jazz harmony',
      exercises,
      songs,
    })

    expect(suggestion?.reason).toContain('does not have Jazz harmony items yet')
    expect(suggestion?.items.length).toBeGreaterThan(0)
  })
})