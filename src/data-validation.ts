import type { Song } from './song-library'
import {
  isCurrentDifficulty,
  isEnjoymentRating,
  type CurrentDifficulty,
} from './practice-ratings'

export { isStoredPracticeTargets } from './practice-targets'
export { isInstrumentSettings } from './instruments'

export type StoredExercise = {
  id: string
  name: string
  category: string
  description: string
  defaultDuration: number
  targetTempo?: number
  notes?: string
  enjoymentRating?: number
  difficulty?: CurrentDifficulty
}

export type StoredRoutineItem = {
  id: string
  exerciseId?: string
  songId?: string
  kind?: 'exercise' | 'song'
  duration: number
}

export type StoredRoutine = {
  id: string
  name: string
  description: string
  items: StoredRoutineItem[]
  isDefault?: boolean
  pauseAtItemEnd?: boolean
  enjoymentRating?: number
  difficulty?: CurrentDifficulty
}

export type StoredSessionRoutineItem = StoredRoutineItem & {
  exerciseSnapshot?: StoredExercise
  songSnapshot?: Song
}

export type StoredActiveSession = {
  id: string
  routineId: string
  routineName: string
  totalMs: number
  status: 'running' | 'paused' | 'completed'
  elapsedMs: number
  positionOffsetMs?: number
  lastUpdatedAt: number
  items: StoredSessionRoutineItem[]
  pauseAtItemEnd?: boolean
  pauseReason?: 'manual' | 'item-end'
}

export type StoredSessionRecord = {
  id: string
  routineName: string
  actualMinutes: number
  plannedMinutes: number
  completedAt: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isOptionalString = (value: unknown): boolean => value === undefined || isString(value)
const isOptionalBoolean = (value: unknown): boolean => value === undefined || typeof value === 'boolean'

export const isStoredExercise = (value: unknown): value is StoredExercise =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.category) &&
  isString(value.description) &&
  isFiniteNumber(value.defaultDuration) &&
  value.defaultDuration > 0 &&
  (value.targetTempo === undefined || (isFiniteNumber(value.targetTempo) && value.targetTempo > 0)) &&
  isOptionalString(value.notes) &&
  (value.enjoymentRating === undefined || isEnjoymentRating(value.enjoymentRating)) &&
  (value.difficulty === undefined || isCurrentDifficulty(value.difficulty))

export const isStoredSong = (value: unknown): value is Song =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  isString(value.artist) &&
  isString(value.tuning) &&
  isString(value.difficulty) &&
  value.difficulty.length > 0 &&
  isString(value.notes) &&
  isString(value.tab)

export const isStoredRoutineItem = (value: unknown): value is StoredRoutineItem => {
  if (!isRecord(value)) {
    return false
  }

  const hasExercise = isString(value.exerciseId)
  const hasSong = isString(value.songId)
  const kindIsValid = value.kind === undefined || value.kind === 'exercise' || value.kind === 'song'

  return (
    isString(value.id) &&
    isFiniteNumber(value.duration) &&
    value.duration > 0 &&
    (hasExercise || hasSong) &&
    kindIsValid &&
    (value.kind !== 'exercise' || hasExercise) &&
    (value.kind !== 'song' || hasSong)
  )
}

export const isStoredRoutine = (value: unknown): value is StoredRoutine =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.description) &&
  Array.isArray(value.items) &&
  value.items.every(isStoredRoutineItem) &&
  isOptionalBoolean(value.isDefault) &&
  isOptionalBoolean(value.pauseAtItemEnd) &&
  (value.enjoymentRating === undefined || isEnjoymentRating(value.enjoymentRating)) &&
  (value.difficulty === undefined || isCurrentDifficulty(value.difficulty))

const isStoredSessionRoutineItem = (value: unknown): value is StoredSessionRoutineItem => {
  if (!isRecord(value)) {
    return false
  }

  if (!isStoredRoutineItem(value)) {
    return false
  }

  const itemRecord = value as Record<string, unknown>
  return (
    (itemRecord.exerciseSnapshot === undefined || isStoredExercise(itemRecord.exerciseSnapshot)) &&
    (itemRecord.songSnapshot === undefined || isStoredSong(itemRecord.songSnapshot))
  )
}

export const isStoredActiveSession = (value: unknown): value is StoredActiveSession =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.routineId) &&
  isString(value.routineName) &&
  isFiniteNumber(value.totalMs) &&
  value.totalMs >= 0 &&
  (value.status === 'running' || value.status === 'paused' || value.status === 'completed') &&
  isFiniteNumber(value.elapsedMs) &&
  value.elapsedMs >= 0 &&
  (value.positionOffsetMs === undefined || isFiniteNumber(value.positionOffsetMs)) &&
  isFiniteNumber(value.lastUpdatedAt) &&
  Array.isArray(value.items) &&
  value.items.every(isStoredSessionRoutineItem) &&
  isOptionalBoolean(value.pauseAtItemEnd) &&
  (value.pauseReason === undefined || value.pauseReason === 'manual' || value.pauseReason === 'item-end')

export const isStoredSessionRecord = (value: unknown): value is StoredSessionRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.routineName) &&
  isFiniteNumber(value.actualMinutes) &&
  value.actualMinutes >= 0 &&
  isFiniteNumber(value.plannedMinutes) &&
  value.plannedMinutes >= 0 &&
  isString(value.completedAt) &&
  !Number.isNaN(Date.parse(value.completedAt))

export const isArrayOf = <T>(isItem: (value: unknown) => value is T) =>
  (value: unknown): value is T[] => Array.isArray(value) && value.every(isItem)

export const isStoredSelectedRoutineId = (value: unknown): value is string => isString(value)
