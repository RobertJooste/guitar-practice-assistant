import { describe, expect, it } from 'vitest'
import {
  createSongFromDraft,
  duplicateSong,
  getDefaultSongDuration,
  validateSongDraft,
} from './song-library'

describe('song library helpers', () => {
  it('creates a song record from a valid draft', () => {
    const song = createSongFromDraft({
      title: 'Smoke on the Water',
      artist: 'Deep Purple',
      tuning: 'E A D G B E',
      difficulty: 'Intermediate',
      notes: 'Focus on the rhythm and string muting.',
      tab: 'e|----------------|\nB|----------------|\nG|----------------|',
    })

    expect(song.id).toBeTruthy()
    expect(song.title).toBe('Smoke on the Water')
    expect(song.tab).toContain('e|----------------|')
  })

  it('creates a duplicate with a new id and copy label', () => {
    const original = createSongFromDraft({
      title: 'Original Song',
      artist: 'Demo',
      tuning: 'E A D G B E',
      difficulty: 'Intermediate',
      notes: 'Keep the phrasing steady.',
      tab: 'e|---|',
    })

    const duplicate = duplicateSong(original)

    expect(duplicate.id).not.toBe(original.id)
    expect(duplicate.title).toBe('Original Song (Copy)')
    expect(duplicate.tab).toBe(original.tab)
  })

  it('requires a title but allows tab content to be blank', () => {
    expect(
      validateSongDraft({
        title: '',
        artist: 'Demo',
        tuning: 'E A D G B E',
        difficulty: 'Beginner',
        notes: '',
        tab: '',
      }),
    ).toBe(false)

    expect(
      validateSongDraft({
        title: 'Song without tab',
        artist: 'Demo',
        tuning: 'E A D G B E',
        difficulty: 'Beginner',
        notes: '',
        tab: '',
      }),
    ).toBe(true)

    expect(
      validateSongDraft({
        title: 'Song with tab',
        artist: 'Demo',
        tuning: 'E A D G B E',
        difficulty: 'Beginner',
        notes: '',
        tab: 'e|--0--|',
      }),
    ).toBe(true)
  })

  it('uses explicit default routine durations for song difficulty levels', () => {
    expect(getDefaultSongDuration('Beginner')).toBe(5)
    expect(getDefaultSongDuration('Intermediate')).toBe(8)
    expect(getDefaultSongDuration('Advanced')).toBe(10)
    expect(getDefaultSongDuration('Custom level')).toBe(5)
  })
})
