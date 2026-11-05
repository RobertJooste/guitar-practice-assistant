import { describe, expect, it } from 'vitest'
import {
  deriveElapsedMs,
  deriveSessionPositionMs,
  getNextExercisePositionMs,
  getPreviousExerciseElapsedMs,
  getProgressForElapsed,
  getRoutineTotalMinutes,
  summariseWeeklyPractice,
} from './practice-utils'

describe('practice utilities', () => {
  it('adds routine item durations correctly', () => {
    expect(
      getRoutineTotalMinutes({
        items: [{ duration: 5 }, { duration: 8 }, { duration: 7 }],
      }),
    ).toBe(20)
  })

  it('calculates the current progress index for elapsed time', () => {
    const routine = {
      items: [{ duration: 5 }, { duration: 8 }, { duration: 7 }],
    }

    expect(getProgressForElapsed(routine, 6 * 60_000)).toMatchObject({
      currentIndex: 1,
    })
  })

  it('derives running elapsed time from timestamps', () => {
    const session = {
      status: 'running' as const,
      elapsedMs: 30_000,
      lastUpdatedAt: 1_000,
    }

    expect(deriveElapsedMs(session, 10_000)).toBe(39_000)
  })

  it('derives routine position separately from actual practice time', () => {
    const session = {
      status: 'running',
      elapsedMs: 120_000,
      lastUpdatedAt: 1_000,
      positionOffsetMs: 300_000,
    }

    expect(deriveSessionPositionMs(session, 31_000)).toBe(450_000)
    expect(deriveElapsedMs(session, 31_000)).toBe(150_000)
  })

  it('skips only the remainder of the current item', () => {
    const items = [{ duration: 5 }, { duration: 8 }, { duration: 7 }]

    expect(getNextExercisePositionMs(items, 7 * 60_000)).toBe(13 * 60_000)
  })

  it('summarises recent practice minutes by day', () => {
    const today = new Date(2026, 0, 1, 12)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const history = [
      { completedAt: today.toISOString(), actualMinutes: 20 },
      { completedAt: yesterday.toISOString(), actualMinutes: 30 },
    ]

    const summary = summariseWeeklyPractice(history, today)
    expect(summary.totalMinutes).toBe(50)
    expect(summary.daySummaries.length).toBe(7)
    expect(summary.streak).toBe(2)
  })

  it('keeps a streak active before completing practice today', () => {
    const today = new Date(2026, 9, 21, 12)
    const history = Array.from({ length: 6 }, (_, daysAgo) => {
      const date = new Date(today)
      date.setDate(date.getDate() - daysAgo - 1)
      return { completedAt: date.toISOString(), actualMinutes: 20 }
    })

    expect(summariseWeeklyPractice(history, today).streak).toBe(6)
  })

  it('counts consecutive practice days beyond the weekly summary window', () => {
    const today = new Date(2026, 9, 21, 12)
    const history = Array.from({ length: 10 }, (_, daysAgo) => {
      const date = new Date(today)
      date.setDate(date.getDate() - daysAgo)
      return { completedAt: date.toISOString(), actualMinutes: 20 }
    })

    expect(summariseWeeklyPractice(history, today).streak).toBe(10)
  })

  it('starts a streak from yesterday when there is no practice today', () => {
    const today = new Date(2026, 9, 21, 12)
    const history = [3, 4, 5].map((daysAgo) => {
      const date = new Date(today)
      date.setDate(date.getDate() - daysAgo)
      return { completedAt: date.toISOString(), actualMinutes: 20 }
    })

    expect(summariseWeeklyPractice(history, today).streak).toBe(0)
  })

  describe('getPreviousExerciseElapsedMs', () => {
    const items = [{ duration: 5 }, { duration: 8 }, { duration: 7 }] // 5m, 8m, 7m

    it('rewinds to the start of the current item if beyond the threshold', () => {
      const elapsedMs = 5 * 60_000 + 10_000 // 10s into the second item
      const expectedStartOfSecondItem = 5 * 60_000
      expect(getPreviousExerciseElapsedMs(items, elapsedMs)).toBe(expectedStartOfSecondItem)
    })

    it('steps back to the previous item if within the threshold', () => {
      const elapsedMs = 5 * 60_000 + 2_000 // 2s into the second item
      const expectedStartOfFirstItem = 0
      expect(getPreviousExerciseElapsedMs(items, elapsedMs)).toBe(expectedStartOfFirstItem)
    })

    it('steps back to the start of the second item from the third', () => {
      const elapsedMs = (5 + 8) * 60_000 + 1_000 // 1s into the third item
      const expectedStartOfSecondItem = 5 * 60_000
      expect(getPreviousExerciseElapsedMs(items, elapsedMs)).toBe(expectedStartOfSecondItem)
    })

    it('rewinds to the start of the first item if near the beginning', () => {
      const elapsedMs = 10_000 // 10s into the first item
      expect(getPreviousExerciseElapsedMs(items, elapsedMs)).toBe(0)
    })

    it('clamps at zero if already at the very beginning', () => {
      const elapsedMs = 2_000 // 2s into the first item
      expect(getPreviousExerciseElapsedMs(items, elapsedMs)).toBe(0)
    })

    it('goes back to the start of the last item when the session has completed', () => {
      const totalMs = (5 + 8 + 7) * 60_000
      const expectedStartOfLastItem = (5 + 8) * 60_000
      expect(getPreviousExerciseElapsedMs(items, totalMs)).toBe(expectedStartOfLastItem)
    })

    it('goes back to the start of the last item in a two-item session at completion', () => {
      const twoItems = [{ duration: 5 }, { duration: 8 }]
      const totalMs = (5 + 8) * 60_000
      expect(getPreviousExerciseElapsedMs(twoItems, totalMs)).toBe(5 * 60_000)
    })
  })
})
