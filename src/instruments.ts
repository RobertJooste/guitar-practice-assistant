export const MIN_TUNING_MIDI_NOTE = 16
export const MAX_TUNING_MIDI_NOTE = 88

export type InstrumentId = 'guitar-6' | 'guitar-7' | 'bass-4' | 'bass-5'

export type InstrumentTuningPreset = {
  id: string
  label: string
  midiNotes: readonly number[]
}

export type InstrumentProfile = {
  id: InstrumentId
  label: string
  stringLabels: readonly string[]
  tuningPresets: readonly InstrumentTuningPreset[]
}

const makePreset = (
  id: string,
  label: string,
  midiNotes: readonly number[],
): InstrumentTuningPreset => ({ id, label, midiNotes })

export const INSTRUMENT_PROFILES: readonly InstrumentProfile[] = [
  {
    id: 'guitar-6',
    label: '6-string guitar',
    stringLabels: [
      '6th string (low)',
      '5th string',
      '4th string',
      '3rd string',
      '2nd string',
      '1st string (high)',
    ],
    tuningPresets: [
      makePreset('standard', 'Standard (E A D G B E)', [40, 45, 50, 55, 59, 64]),
      makePreset('drop-d', 'Drop D (D A D G B E)', [38, 45, 50, 55, 59, 64]),
      makePreset('d-standard', 'D Standard (D G C F A D)', [38, 43, 48, 53, 57, 62]),
      makePreset('open-g', 'Open G (D G D G B D)', [38, 43, 50, 55, 59, 62]),
      makePreset('open-d', 'Open D (D A D F# A D)', [38, 45, 50, 54, 57, 62]),
    ],
  },
  {
    id: 'guitar-7',
    label: '7-string guitar',
    stringLabels: [
      '7th string (low)',
      '6th string',
      '5th string',
      '4th string',
      '3rd string',
      '2nd string',
      '1st string (high)',
    ],
    tuningPresets: [
      makePreset('standard', 'Standard (B E A D G B E)', [35, 40, 45, 50, 55, 59, 64]),
      makePreset('drop-a', 'Drop A (A E A D G B E)', [33, 40, 45, 50, 55, 59, 64]),
      makePreset('a-standard', 'A Standard (A D G C F A D)', [33, 38, 43, 48, 53, 57, 62]),
    ],
  },
  {
    id: 'bass-4',
    label: '4-string bass',
    stringLabels: [
      '4th string (low)',
      '3rd string',
      '2nd string',
      '1st string (high)',
    ],
    tuningPresets: [
      makePreset('standard', 'Standard (E A D G)', [28, 33, 38, 43]),
      makePreset('drop-d', 'Drop D (D A D G)', [26, 33, 38, 43]),
      makePreset('d-standard', 'D Standard (D G C F)', [26, 31, 36, 41]),
    ],
  },
  {
    id: 'bass-5',
    label: '5-string bass',
    stringLabels: [
      '5th string (low)',
      '4th string',
      '3rd string',
      '2nd string',
      '1st string (high)',
    ],
    tuningPresets: [
      makePreset('standard', 'Standard (B E A D G)', [23, 28, 33, 38, 43]),
      makePreset('drop-a', 'Drop A (A E A D G)', [21, 28, 33, 38, 43]),
      makePreset('c-standard', 'C Standard (C F Bb Eb Ab)', [24, 29, 34, 39, 44]),
    ],
  },
]

export type InstrumentSettings = {
  activeInstrumentId: InstrumentId
  tunings: Record<InstrumentId, number[]>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getInstrumentProfile = (instrumentId: InstrumentId) =>
  INSTRUMENT_PROFILES.find((profile) => profile.id === instrumentId) ?? INSTRUMENT_PROFILES[0]

export const createDefaultInstrumentSettings = (): InstrumentSettings => ({
  activeInstrumentId: 'guitar-6',
  tunings: {
    'guitar-6': [...getInstrumentProfile('guitar-6').tuningPresets[0].midiNotes],
    'guitar-7': [...getInstrumentProfile('guitar-7').tuningPresets[0].midiNotes],
    'bass-4': [...getInstrumentProfile('bass-4').tuningPresets[0].midiNotes],
    'bass-5': [...getInstrumentProfile('bass-5').tuningPresets[0].midiNotes],
  },
})

export const findInstrumentTuningPreset = (
  profile: InstrumentProfile,
  midiNotes: readonly number[],
) => profile.tuningPresets.find((preset) =>
  preset.midiNotes.length === midiNotes.length &&
  preset.midiNotes.every((note, index) => note === midiNotes[index]),
)

export const isInstrumentSettings = (value: unknown): value is InstrumentSettings => {
  if (!isRecord(value)) {
    return false
  }
  const profile = INSTRUMENT_PROFILES.find(
    (item) => item.id === value.activeInstrumentId,
  )
  const tunings = value.tunings

  if (!profile || !isRecord(tunings)) {
    return false
  }

  return INSTRUMENT_PROFILES.every((instrument) => {
    const notes = tunings[instrument.id]
    return Array.isArray(notes) &&
      notes.length === instrument.stringLabels.length &&
      notes.every((note) =>
        typeof note === 'number' &&
        Number.isInteger(note) &&
        note >= MIN_TUNING_MIDI_NOTE &&
        note <= MAX_TUNING_MIDI_NOTE,
      )
  })
}
