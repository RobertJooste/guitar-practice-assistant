import { describe, expect, it } from 'vitest'
import {
  createDefaultInstrumentSettings,
  findInstrumentTuningPreset,
  getInstrumentProfile,
  isInstrumentSettings,
} from './instruments'

describe('instrument profiles', () => {
  it('provides correctly sized standard tunings for each supported instrument', () => {
    const settings = createDefaultInstrumentSettings()

    expect(settings.activeInstrumentId).toBe('guitar-6')
    expect(Object.entries(settings.tunings).map(([id, notes]) => [id, notes.length]))
      .toEqual([
        ['guitar-6', 6],
        ['guitar-7', 7],
        ['bass-4', 4],
        ['bass-5', 5],
      ])
    expect(settings.tunings['bass-5']).toEqual([23, 28, 33, 38, 43])
    expect(isInstrumentSettings(settings)).toBe(true)
  })

  it('finds a preset only when its full tuning matches', () => {
    const bass = getInstrumentProfile('bass-4')

    expect(findInstrumentTuningPreset(bass, [28, 33, 38, 43])?.id).toBe('standard')
    expect(findInstrumentTuningPreset(bass, [26, 33, 38, 43])?.id).toBe('drop-d')
    expect(findInstrumentTuningPreset(bass, [27, 33, 38, 43])).toBeUndefined()
  })

  it('rejects malformed, incomplete, and out-of-range stored settings', () => {
    const settings = createDefaultInstrumentSettings()

    expect(isInstrumentSettings({ ...settings, activeInstrumentId: 'mandolin' })).toBe(false)
    expect(isInstrumentSettings({
      ...settings,
      tunings: { ...settings.tunings, 'bass-4': [26, 33, 38] },
    })).toBe(false)
    expect(isInstrumentSettings({
      ...settings,
      tunings: { ...settings.tunings, 'bass-4': [12, 33, 38, 43] },
    })).toBe(false)
  })
})
