export type NoteSpelling = 'sharps' | 'flats'

export const MAX_FRET = 22

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export const getNoteNameForPitchClass = (
  pitchClass: number,
  spelling: NoteSpelling = 'sharps',
): string => {
  const normalizedPitchClass = ((pitchClass % 12) + 12) % 12
  return (spelling === 'flats' ? FLAT_NAMES : SHARP_NAMES)[normalizedPitchClass]
}

export const getTuningNoteName = (
  midiNote: number,
  spelling: NoteSpelling = 'sharps',
): string => {
  const noteName = getNoteNameForPitchClass(midiNote, spelling)
  const octave = Math.floor(midiNote / 12) - 1
  return `${noteName}${octave}`
}

export const getNoteAtFret = (
  openStringMidiNote: number,
  fret: number,
  spelling: NoteSpelling = 'sharps',
): string => {
  if (!Number.isInteger(openStringMidiNote) || !Number.isInteger(fret) || fret < 0) {
    throw new RangeError('String pitch and fret must be whole numbers, and fret cannot be negative.')
  }

  return getNoteNameForPitchClass(openStringMidiNote + fret, spelling)
}
