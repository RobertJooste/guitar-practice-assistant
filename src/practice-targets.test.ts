import { describe, expect, it } from 'vitest'
import {
  createDefaultPracticeTargets,
  getDailyPracticeTarget,
  getWeeklyPracticeTarget,
  isStoredPracticeTargets,
} from './practice-targets'

describe('practice-time targets', () => {
  it('preserves the existing 150-minute weekly aim with the default weekday schedule', () => {
    const targets = createDefaultPracticeTargets()

    expect(targets.mode).toBe('per-day')
    expect(getWeeklyPracticeTarget(targets, new Date(2026, 0, 1))).toBe(150)
    expect(getDailyPracticeTarget(targets, new Date(2026, 0, 1))).toBe(30)
    expect(getDailyPracticeTarget(targets, new Date(2026, 0, 3))).toBe(0)
  })

  it('applies a shared daily target to all seven dates in the rolling week', () => {
    const targets = { ...createDefaultPracticeTargets(), mode: 'daily' as const, dailyMinutes: 25 }

    expect(getDailyPracticeTarget(targets, new Date(2026, 0, 3))).toBe(25)
    expect(getWeeklyPracticeTarget(targets, new Date(2026, 0, 1))).toBe(175)
  })

  it('calculates per-day targets across a week boundary', () => {
    const targets = createDefaultPracticeTargets()
    targets.dayMinutes.saturday = 10
    targets.dayMinutes.sunday = 20

    expect(getWeeklyPracticeTarget(targets, new Date(2026, 0, 4))).toBe(180)
  })

  it('validates the target mode and bounded integer minute values', () => {
    const targets = createDefaultPracticeTargets()

    expect(isStoredPracticeTargets(targets)).toBe(true)
    expect(isStoredPracticeTargets({ ...targets, mode: 'monthly' })).toBe(false)
    expect(isStoredPracticeTargets({
      ...targets,
      dayMinutes: { ...targets.dayMinutes, monday: -1 },
    })).toBe(false)
    expect(isStoredPracticeTargets({
      ...targets,
      dailyMinutes: 600.5,
    })).toBe(false)
  })
})
