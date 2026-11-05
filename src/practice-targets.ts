export const DAY_OF_WEEK_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type DayOfWeekKey = typeof DAY_OF_WEEK_KEYS[number]
export type PracticeTargetMode = 'daily' | 'per-day'

export type PracticeTargets = {
  mode: PracticeTargetMode
  dailyMinutes: number
  dayMinutes: Record<DayOfWeekKey, number>
}

export const MAX_DAILY_PRACTICE_TARGET_MINUTES = 600

export const createDefaultPracticeTargets = (): PracticeTargets => ({
  mode: 'per-day',
  dailyMinutes: 30,
  dayMinutes: {
    monday: 30,
    tuesday: 30,
    wednesday: 30,
    thursday: 30,
    friday: 30,
    saturday: 0,
    sunday: 0,
  },
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isValidTargetMinutes = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_DAILY_PRACTICE_TARGET_MINUTES

export const isStoredPracticeTargets = (value: unknown): value is PracticeTargets => {
  if (
    !isRecord(value) ||
    (value.mode !== 'daily' && value.mode !== 'per-day') ||
    !isValidTargetMinutes(value.dailyMinutes) ||
    !isRecord(value.dayMinutes)
  ) {
    return false
  }

  const dayMinutes = value.dayMinutes
  return DAY_OF_WEEK_KEYS.every((day) => isValidTargetMinutes(dayMinutes[day]))
}

const getDayOfWeekKey = (date: Date): DayOfWeekKey =>
  DAY_OF_WEEK_KEYS[(date.getDay() + 6) % 7]

export const getDailyPracticeTarget = (targets: PracticeTargets, date: Date): number =>
  targets.mode === 'daily' ? targets.dailyMinutes : targets.dayMinutes[getDayOfWeekKey(date)]

export const getWeeklyPracticeTarget = (targets: PracticeTargets, today = new Date()): number => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let total = 0

  for (let daysAgo = 0; daysAgo < 7; daysAgo += 1) {
    total += getDailyPracticeTarget(targets, date)
    date.setDate(date.getDate() - 1)
  }

  return total
}
