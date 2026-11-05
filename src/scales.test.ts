import { describe, expect, it } from 'vitest'
import {
  getScaleNotesInRange,
  getPentatonicNotesInRange,
  getPentatonicPosition,
  getScaleNoteNames,
  PENTATONIC_INTERVALS,
  SCALE_DEFINITIONS,
} from './scales'

describe('scale patterns', () => {
  it('uses the expected major and minor pentatonic intervals', () => {
    expect(PENTATONIC_INTERVALS.major).toEqual([0, 2, 4, 7, 9])
    expect(PENTATONIC_INTERVALS.minor).toEqual([0, 3, 5, 7, 10])
  })

  it('defines the seven diatonic major-scale modes with their expected intervals', () => {
    expect(Object.fromEntries(
      Object.entries(SCALE_DEFINITIONS)
        .filter(([, scale]) => scale.kind === 'diatonic')
        .map(([id, scale]) => [id, scale.intervals]),
    )).toEqual({
      major: [0, 2, 4, 5, 7, 9, 11],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      phrygian: [0, 1, 3, 5, 7, 8, 10],
      lydian: [0, 2, 4, 6, 7, 9, 11],
      mixolydian: [0, 2, 4, 5, 7, 9, 10],
      'natural-minor': [0, 2, 3, 5, 7, 8, 10],
      locrian: [0, 1, 3, 5, 6, 8, 10],
    })
  })

  it('places all five A minor box positions in ascending fretboard regions', () => {
    const positions = [1, 2, 3, 4, 5].map((position) =>
      getPentatonicPosition(9, 'minor', position),
    )

    expect(positions.map(({ startFret, endFret }) => [startFret, endFret])).toEqual([
      [5, 8],
      [7, 10],
      [9, 13],
      [12, 15],
      [14, 17],
    ])
  })

  it('shows A major pentatonic notes and marks every tonic', () => {
    const position = getPentatonicPosition(9, 'major', 1)
    const lowE = position.strings[0]

    expect(lowE.notes.map(({ fret, name }) => [fret, name])).toEqual([
      [2, 'F#'],
      [5, 'A'],
    ])
    expect(lowE.notes.filter((note) => note.isRoot).map((note) => note.fret)).toEqual([5])
    expect(position.strings.flatMap((string) => string.notes).some((note) => note.isRoot)).toBe(true)
  })

  it('calculates notes in a different key with automatic scale spelling', () => {
    const cMajor = getPentatonicPosition(0, 'major', 1)
    const lowE = cMajor.strings[0]

    expect([cMajor.startFret, cMajor.endFret]).toEqual([5, 8])
    expect(lowE.notes.map(({ fret, name }) => [fret, name])).toEqual([
      [5, 'A'],
      [8, 'C'],
    ])
  })

  it('calculates scale notes and roots across an expanded fret range', () => {
    const strings = getPentatonicNotesInRange(0, 'minor', 0, 11)
    const lowE = strings[0]

    expect(lowE.notes.some(({ fret, name, isRoot }) =>
      fret === 8 && name === 'C' && isRoot,
    )).toBe(true)
    expect(lowE.notes.every(({ fret }) => fret >= 0 && fret <= 11)).toBe(true)
    expect(strings.flatMap((string) => string.notes).filter(({ isRoot }) => isRoot))
      .not.toHaveLength(0)
  })

  it('calculates full-neck notes for alternate tuning and different string counts', () => {
    const dropD = getScaleNotesInRange(0, 'major', 0, 3, [38, 45, 50, 55, 59, 64])
    const sevenString = getScaleNotesInRange(
      9,
      'natural-minor',
      0,
      1,
      [35, 40, 45, 50, 55, 59, 64],
    )

    expect(dropD[0].notes.map(({ fret, name }) => [fret, name])).toEqual([
      [0, 'D'],
      [2, 'E'],
      [3, 'F'],
    ])
    expect(sevenString).toHaveLength(7)
    expect(sevenString[0].notes[0]).toMatchObject({ fret: 0, name: 'B' })
  })

  it('recalculates pentatonic box frets from alternate tuning pitches', () => {
    const dropDPosition = getPentatonicPosition(
      9,
      'minor',
      1,
      [38, 45, 50, 55, 59, 64],
    )

    expect([dropDPosition.startFret, dropDPosition.endFret]).toEqual([7, 10])
    expect(dropDPosition.strings[0].notes.map(({ fret, name }) => [fret, name]))
      .toEqual([[7, 'A'], [10, 'C']])
  })

  it('calculates a major-scale mode across all strings and highlights its tonic', () => {
    const strings = getScaleNotesInRange(0, 'major', 0, 11)
    const lowE = strings[0]

    expect(lowE.notes.map(({ fret, name }) => [fret, name])).toEqual([
      [0, 'E'],
      [1, 'F'],
      [3, 'G'],
      [5, 'A'],
      [7, 'B'],
      [8, 'C'],
      [10, 'D'],
    ])
    expect(lowE.notes.find(({ isRoot }) => isRoot)?.fret).toBe(8)
    expect(strings).toHaveLength(6)
  })

  it('includes tonic notes for every diatonic mode in every key', () => {
    const modeIds = [
      'major',
      'dorian',
      'phrygian',
      'lydian',
      'mixolydian',
      'natural-minor',
      'locrian',
    ] as const

    for (let key = 0; key < 12; key += 1) {
      for (const modeId of modeIds) {
        const strings = getScaleNotesInRange(key, modeId, 0, 22)
        expect(strings.flatMap((string) => string.notes).some(({ isRoot }) => isRoot))
          .toBe(true)
      }
    }
  })

  it('spells scale degrees with distinct note letters, including A and Bb in F major', () => {
    const fMajorNames = getScaleNoteNames(5, 'major')

    expect([5, 7, 9, 10, 0, 2, 4].map((pitchClass) => fMajorNames[pitchClass]))
      .toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E'])

    for (let key = 0; key < 12; key += 1) {
      for (const scaleId of Object.keys(SCALE_DEFINITIONS) as Array<keyof typeof SCALE_DEFINITIONS>) {
        const noteLetters = Object.values(getScaleNoteNames(key, scaleId))
          .map((name) => name[0])
        expect(new Set(noteLetters).size).toBe(noteLetters.length)
      }
    }
  })

  it('rejects invalid expanded fret ranges', () => {
    expect(() => getPentatonicNotesInRange(0, 'minor', -1, 11)).toThrow(RangeError)
    expect(() => getPentatonicNotesInRange(0, 'minor', 8, 7)).toThrow(RangeError)
  })

  it('moves position shapes above the nut rather than returning negative frets', () => {
    const eMajorFirstPosition = getPentatonicPosition(4, 'major', 1)

    expect(eMajorFirstPosition.startFret).toBeGreaterThanOrEqual(0)
    expect(eMajorFirstPosition.strings.flatMap((string) => string.notes).every(
      ({ fret }) => fret >= 0,
    )).toBe(true)
  })

  it('includes root notes across every key, scale type, and position', () => {
    for (let key = 0; key < 12; key += 1) {
      for (const scaleType of ['major', 'minor'] as const) {
        for (let position = 1; position <= 5; position += 1) {
          const pattern = getPentatonicPosition(key, scaleType, position)
          expect(pattern.strings.flatMap((string) => string.notes).some(
            (note) => note.isRoot,
          )).toBe(true)
        }
      }
    }
  })

  it('rejects invalid keys and positions', () => {
    expect(() => getPentatonicPosition(12, 'minor', 1)).toThrow(RangeError)
    expect(() => getPentatonicPosition(0, 'major', 0)).toThrow(RangeError)
    expect(() => getPentatonicPosition(0, 'major', 6)).toThrow(RangeError)
  })
})
