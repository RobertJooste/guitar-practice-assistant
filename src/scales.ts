export type PentatonicScaleType = 'major' | 'minor'

type ScaleDefinition = {
  label: string
  kind: 'pentatonic' | 'diatonic'
  intervals: readonly number[]
  letterSteps: readonly number[]
}

export const SCALE_DEFINITIONS = {
  'major-pentatonic': {
    label: 'major pentatonic',
    kind: 'pentatonic',
    intervals: [0, 2, 4, 7, 9],
    letterSteps: [0, 1, 2, 4, 5],
  },
  'minor-pentatonic': {
    label: 'minor pentatonic',
    kind: 'pentatonic',
    intervals: [0, 3, 5, 7, 10],
    letterSteps: [0, 2, 3, 4, 6],
  },
  major: {
    label: 'major (Ionian)',
    kind: 'diatonic',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
  dorian: {
    label: 'Dorian',
    kind: 'diatonic',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
  phrygian: {
    label: 'Phrygian',
    kind: 'diatonic',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
  lydian: {
    label: 'Lydian',
    kind: 'diatonic',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
  mixolydian: {
    label: 'Mixolydian',
    kind: 'diatonic',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
  'natural-minor': {
    label: 'natural minor (Aeolian)',
    kind: 'diatonic',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
  locrian: {
    label: 'Locrian',
    kind: 'diatonic',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    letterSteps: [0, 1, 2, 3, 4, 5, 6],
  },
} as const satisfies Record<string, ScaleDefinition>

export type ScaleId = keyof typeof SCALE_DEFINITIONS

export const isScaleId = (value: string): value is ScaleId =>
  Object.hasOwn(SCALE_DEFINITIONS, value)

export type ScaleNote = {
  fret: number
  name: string
  isRoot: boolean
}

export type ScaleStringPosition = {
  openStringMidiNote: number
  notes: ScaleNote[]
}

export type PentatonicPosition = {
  position: number
  startFret: number
  endFret: number
  strings: ScaleStringPosition[]
}

export const PENTATONIC_INTERVALS: Record<PentatonicScaleType, readonly number[]> = {
  major: SCALE_DEFINITIONS['major-pentatonic'].intervals,
  minor: SCALE_DEFINITIONS['minor-pentatonic'].intervals,
}

const STANDARD_TUNING_MIDI_NOTES = [40, 45, 50, 55, 59, 64]
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL_NOTE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]
const POSITION_START_OFFSETS: Record<PentatonicScaleType, readonly number[]> = {
  major: [-3, -1, 1, 4, 6],
  minor: [0, 2, 4, 7, 9],
}
const POSITION_WIDTHS = [4, 4, 5, 4, 4]

const normalizePitchClass = (pitchClass: number) => ((pitchClass % 12) + 12) % 12

const validateTuning = (openStringMidiNotes: readonly number[]) => {
  if (
    openStringMidiNotes.length === 0 ||
    openStringMidiNotes.some((note) => !Number.isInteger(note))
  ) {
    throw new RangeError('Tuning must contain one or more whole-number string pitches.')
  }
}

export const isPentatonicScale = (scaleId: ScaleId) =>
  SCALE_DEFINITIONS[scaleId].kind === 'pentatonic'

export const getScaleNoteNames = (
  keyPitchClass: number,
  scaleId: ScaleId,
): Record<number, string> => {
  if (!Number.isInteger(keyPitchClass) || keyPitchClass < 0 || keyPitchClass > 11) {
    throw new RangeError('Key must be a pitch class from 0 through 11.')
  }
  if (!isScaleId(scaleId)) {
    throw new RangeError('Scale must be a supported scale.')
  }

  const tonicName = KEY_NAMES[keyPitchClass]
  const tonicLetterIndex = NOTE_LETTERS.indexOf(tonicName[0])
  const definition = SCALE_DEFINITIONS[scaleId]
  const noteNames: Record<number, string> = {}

  definition.intervals.forEach((interval, index) => {
    const notePitchClass = normalizePitchClass(keyPitchClass + interval)
    const noteLetterIndex = (tonicLetterIndex + definition.letterSteps[index]) % NOTE_LETTERS.length
    const naturalPitchClass = NATURAL_NOTE_PITCH_CLASSES[noteLetterIndex]
    let accidental = notePitchClass - naturalPitchClass
    if (accidental > 6) {
      accidental -= 12
    } else if (accidental < -6) {
      accidental += 12
    }

    noteNames[notePitchClass] = `${NOTE_LETTERS[noteLetterIndex]}${accidental > 0
      ? '#'.repeat(accidental)
      : 'b'.repeat(-accidental)}`
  })

  return noteNames
}

export const getPentatonicPosition = (
  keyPitchClass: number,
  scaleType: PentatonicScaleType,
  position: number,
  openStringMidiNotes: readonly number[] = STANDARD_TUNING_MIDI_NOTES,
): PentatonicPosition => {
  if (!Number.isInteger(keyPitchClass) || keyPitchClass < 0 || keyPitchClass > 11) {
    throw new RangeError('Key must be a pitch class from 0 through 11.')
  }
  if (scaleType !== 'major' && scaleType !== 'minor') {
    throw new RangeError('Scale type must be major or minor.')
  }
  if (!Number.isInteger(position) || position < 1 || position > 5) {
    throw new RangeError('Pentatonic position must be from 1 through 5.')
  }
  validateTuning(openStringMidiNotes)

  const normalizedKey = normalizePitchClass(keyPitchClass)
  let lowStringKeyFret = normalizePitchClass(
    normalizedKey - normalizePitchClass(openStringMidiNotes[0]),
  )
  const positionIndex = position - 1
  const startOffset = POSITION_START_OFFSETS[scaleType][positionIndex]
  if (lowStringKeyFret + startOffset < 0) {
    lowStringKeyFret += 12
  }

  const startFret = lowStringKeyFret + startOffset
  const endFret = startFret + POSITION_WIDTHS[positionIndex] - 1

  return {
    position,
    startFret,
    endFret,
    strings: getScaleNotesInRange(
      normalizedKey,
      scaleType === 'major' ? 'major-pentatonic' : 'minor-pentatonic',
      startFret,
      endFret,
      openStringMidiNotes,
    ),
  }
}

export const getPentatonicNotesInRange = (
  keyPitchClass: number,
  scaleType: PentatonicScaleType,
  startFret: number,
  endFret: number,
  openStringMidiNotes: readonly number[] = STANDARD_TUNING_MIDI_NOTES,
): ScaleStringPosition[] => {
  if (scaleType !== 'major' && scaleType !== 'minor') {
    throw new RangeError('Scale type must be major or minor.')
  }
  return getScaleNotesInRange(
    keyPitchClass,
    scaleType === 'major' ? 'major-pentatonic' : 'minor-pentatonic',
    startFret,
    endFret,
    openStringMidiNotes,
  )
}

export const getScaleNotesInRange = (
  keyPitchClass: number,
  scaleId: ScaleId,
  startFret: number,
  endFret: number,
  openStringMidiNotes: readonly number[] = STANDARD_TUNING_MIDI_NOTES,
): ScaleStringPosition[] => {
  if (!Number.isInteger(keyPitchClass) || keyPitchClass < 0 || keyPitchClass > 11) {
    throw new RangeError('Key must be a pitch class from 0 through 11.')
  }
  if (!isScaleId(scaleId)) {
    throw new RangeError('Scale must be a supported scale.')
  }
  if (
    !Number.isInteger(startFret) ||
    !Number.isInteger(endFret) ||
    startFret < 0 ||
    endFret < 0 ||
    startFret > endFret
  ) {
    throw new RangeError('Fret range must use whole numbers, start at zero or higher, and end after it starts.')
  }
  validateTuning(openStringMidiNotes)

  const normalizedKey = normalizePitchClass(keyPitchClass)
  const scaleNoteNames = getScaleNoteNames(normalizedKey, scaleId)
  const scalePitchClasses = new Set(
    SCALE_DEFINITIONS[scaleId].intervals.map((interval) =>
      normalizePitchClass(normalizedKey + interval),
    ),
  )

  return openStringMidiNotes.map((openStringMidiNote) => ({
    openStringMidiNote,
    notes: Array.from(
      { length: endFret - startFret + 1 },
      (_, index) => startFret + index,
    ).flatMap((fret) => {
      const notePitchClass = normalizePitchClass(openStringMidiNote + fret)
      if (!scalePitchClasses.has(notePitchClass)) {
        return []
      }

      return [{
        fret,
        name: scaleNoteNames[notePitchClass],
        isRoot: notePitchClass === normalizedKey,
      }]
    }),
  }))
}
