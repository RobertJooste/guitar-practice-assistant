import { describe, expect, it } from 'vitest'
import {
  getNoteAtFret,
  getNoteNameForPitchClass,
  getTuningNoteName,
} from './fretboard'
import { getInstrumentProfile } from './instruments'

describe('fretboard note calculations', () => {
  it('names the open strings in standard tuning', () => {
    const standardTuning = getInstrumentProfile('guitar-6')
      .tuningPresets.find((preset) => preset.id === 'standard')

    expect(standardTuning?.midiNotes.map((note) => getTuningNoteName(note))).toEqual([
      'E2',
      'A2',
      'D3',
      'G3',
      'B3',
      'E4',
    ])
  })

  it('repeats the pitch class after twelve frets', () => {
    expect(getNoteAtFret(40, 0)).toBe('E')
    expect(getNoteAtFret(40, 12)).toBe('E')
    expect(getNoteAtFret(40, 24)).toBe('E')
  })

  it('calculates notes from alternate and custom tunings', () => {
    const dropD = getInstrumentProfile('guitar-6')
      .tuningPresets.find((preset) => preset.id === 'drop-d')

    expect(dropD && getTuningNoteName(dropD.midiNotes[0])).toBe('D2')
    expect(dropD && getNoteAtFret(dropD.midiNotes[0], 2)).toBe('E')
    expect(getTuningNoteName(43)).toBe('G2')
  })

  it('supports flat spelling for enharmonic notes', () => {
    expect(getNoteNameForPitchClass(1, 'sharps')).toBe('C#')
    expect(getNoteNameForPitchClass(1, 'flats')).toBe('Db')
    expect(getNoteAtFret(40, 8, 'flats')).toBe('C')
    expect(getTuningNoteName(54, 'flats')).toBe('Gb3')
  })

  it('rejects invalid fret positions', () => {
    expect(() => getNoteAtFret(40, -1)).toThrow(RangeError)
    expect(() => getNoteAtFret(40, 1.5)).toThrow(RangeError)
  })
})
