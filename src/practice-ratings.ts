export const MAX_ENJOYMENT_RATING = 5

export const CURRENT_DIFFICULTY_LEVELS = [
  'Very easy',
  'Easy',
  'Moderate',
  'Hard',
  'Very hard',
] as const

export type CurrentDifficulty = typeof CURRENT_DIFFICULTY_LEVELS[number]

export const isEnjoymentRating = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_ENJOYMENT_RATING

export const isCurrentDifficulty = (value: unknown): value is CurrentDifficulty =>
  typeof value === 'string' &&
  CURRENT_DIFFICULTY_LEVELS.some((difficulty) => difficulty === value)

