import { describe, expect, it } from 'vitest'
import {
  CURRENT_DIFFICULTY_LEVELS,
  isCurrentDifficulty,
  isEnjoymentRating,
} from './practice-ratings'

describe('practice ratings', () => {
  it('accepts whole-number enjoyment ratings from one to five', () => {
    expect([1, 2, 3, 4, 5].every(isEnjoymentRating)).toBe(true)
    expect([0, 6, 2.5, Number.NaN, '5'].every((rating) => !isEnjoymentRating(rating))).toBe(true)
  })

  it('accepts the supported player-assessed difficulty levels only', () => {
    expect(CURRENT_DIFFICULTY_LEVELS.every(isCurrentDifficulty)).toBe(true)
    expect(isCurrentDifficulty('Expert')).toBe(false)
    expect(isCurrentDifficulty(undefined)).toBe(false)
  })
})
