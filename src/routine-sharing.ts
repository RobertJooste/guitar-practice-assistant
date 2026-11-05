import {
  isStoredExercise,
  isStoredSong,
  type StoredExercise,
  type StoredRoutine,
} from './data-validation'
import type { Song } from './song-library'

const ROUTINE_SHARE_FORMAT = 'guitar-practice-routine'
const ROUTINE_SHARE_VERSION = 1

type ShareableExercise = Pick<
  StoredExercise,
  'id' | 'name' | 'category' | 'description' | 'defaultDuration' | 'targetTempo' | 'notes'
>

type ShareableSong = Pick<Song, 'id' | 'title' | 'artist' | 'tuning' | 'difficulty'> & {
  tab?: string
}

export type RoutineShareItem = {
  kind: 'exercise' | 'song'
  sourceId: string
  duration: number
}

export type RoutineSharePackage = {
  format: typeof ROUTINE_SHARE_FORMAT
  version: typeof ROUTINE_SHARE_VERSION
  routine: {
    name: string
    description: string
    pauseAtItemEnd: boolean
  }
  items: RoutineShareItem[]
  exercises: ShareableExercise[]
  songs: ShareableSong[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isShareItem = (value: unknown): value is RoutineShareItem =>
  isRecord(value) &&
  (value.kind === 'exercise' || value.kind === 'song') &&
  isString(value.sourceId) &&
  value.sourceId.length > 0 &&
  typeof value.duration === 'number' &&
  Number.isFinite(value.duration) &&
  value.duration > 0

const getShareableExercise = (exercise: StoredExercise): ShareableExercise => ({
  id: exercise.id,
  name: exercise.name,
  category: exercise.category,
  description: exercise.description,
  defaultDuration: exercise.defaultDuration,
  ...(exercise.targetTempo === undefined ? {} : { targetTempo: exercise.targetTempo }),
  ...(exercise.notes === undefined ? {} : { notes: exercise.notes }),
})

const getShareableSong = (song: Song, includeTab: boolean): ShareableSong => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  tuning: song.tuning,
  difficulty: song.difficulty,
  ...(includeTab ? { tab: song.tab } : {}),
})

export const createRoutineSharePackage = (
  routine: StoredRoutine,
  exercises: readonly StoredExercise[],
  songs: readonly Song[],
  includeTabs: boolean,
): RoutineSharePackage => {
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const songById = new Map(songs.map((song) => [song.id, song]))
  const sharedExercises = new Map<string, ShareableExercise>()
  const sharedSongs = new Map<string, ShareableSong>()
  const items = routine.items.map((item): RoutineShareItem => {
    const hasExercise = Boolean(item.exerciseId)
    const hasSong = Boolean(item.songId)
    if (
      hasExercise === hasSong ||
      (item.kind === 'exercise' && (!hasExercise || hasSong)) ||
      (item.kind === 'song' && (!hasSong || hasExercise))
    ) {
      throw new Error('This routine contains an item that cannot be shared.')
    }
    const isSongItem = item.kind === 'song' || (item.kind === undefined && hasSong)
    if (isSongItem && item.songId) {
      const song = songById.get(item.songId)
      if (!song) {
        throw new Error('This routine refers to a song that is no longer in your library.')
      }
      sharedSongs.set(song.id, getShareableSong(song, includeTabs))
      return { kind: 'song', sourceId: song.id, duration: item.duration }
    }

    if (item.exerciseId) {
      const exercise = exerciseById.get(item.exerciseId)
      if (!exercise) {
        throw new Error('This routine refers to an exercise that is no longer in your library.')
      }
      sharedExercises.set(exercise.id, getShareableExercise(exercise))
      return { kind: 'exercise', sourceId: exercise.id, duration: item.duration }
    }

    throw new Error('This routine contains an item that cannot be shared.')
  })

  return {
    format: ROUTINE_SHARE_FORMAT,
    version: ROUTINE_SHARE_VERSION,
    routine: {
      name: routine.name,
      description: routine.description,
      pauseAtItemEnd: Boolean(routine.pauseAtItemEnd),
    },
    items,
    exercises: [...sharedExercises.values()],
    songs: [...sharedSongs.values()],
  }
}

const normalizeShareableExercise = (value: unknown): ShareableExercise | null => {
  if (
    !isStoredExercise(value) ||
    value.id.trim().length === 0 ||
    value.name.trim().length === 0
  ) {
    return null
  }
  return getShareableExercise(value)
}

const normalizeShareableSong = (value: unknown): ShareableSong | null => {
  if (!isRecord(value)) {
    return null
  }
  const song = {
    id: value.id,
    title: value.title,
    artist: value.artist,
    tuning: value.tuning,
    difficulty: value.difficulty,
    notes: '',
    tab: value.tab ?? '',
  }
  if (
    !isStoredSong(song) ||
    song.id.trim().length === 0 ||
    song.title.trim().length === 0 ||
    (value.tab !== undefined && !isString(value.tab))
  ) {
    return null
  }
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    tuning: song.tuning,
    difficulty: song.difficulty,
    ...(value.tab === undefined ? {} : { tab: value.tab }),
  }
}

export const parseRoutineSharePackage = (payload: string): RoutineSharePackage => {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  if (!isRecord(parsed) || parsed.format !== ROUTINE_SHARE_FORMAT) {
    throw new Error('This is not a shared practice routine file.')
  }
  if (parsed.version !== ROUTINE_SHARE_VERSION) {
    throw new Error(`Unsupported routine file version: ${String(parsed.version)}.`)
  }
  if (
    !isRecord(parsed.routine) ||
    !isString(parsed.routine.name) ||
    parsed.routine.name.trim().length === 0 ||
    !isString(parsed.routine.description) ||
    typeof parsed.routine.pauseAtItemEnd !== 'boolean' ||
    !Array.isArray(parsed.items) ||
    !parsed.items.every(isShareItem) ||
    !Array.isArray(parsed.exercises) ||
    !Array.isArray(parsed.songs)
  ) {
    throw new Error('The shared routine file is missing required routine data.')
  }

  const exercises = parsed.exercises.map(normalizeShareableExercise)
  const songs = parsed.songs.map(normalizeShareableSong)
  if (exercises.some((exercise) => exercise === null) || songs.some((song) => song === null)) {
    throw new Error('The shared routine file contains invalid exercise or song data.')
  }

  const validExercises = exercises.filter(
    (exercise): exercise is ShareableExercise => exercise !== null,
  )
  const validSongs = songs.filter((song): song is ShareableSong => song !== null)
  const exerciseIds = new Set(validExercises.map((exercise) => exercise.id))
  const songIds = new Set(validSongs.map((song) => song.id))
  const referencedExerciseIds = new Set(
    parsed.items.filter((item) => item.kind === 'exercise').map((item) => item.sourceId),
  )
  const referencedSongIds = new Set(
    parsed.items.filter((item) => item.kind === 'song').map((item) => item.sourceId),
  )
  if (
    exerciseIds.size !== exercises.length ||
    songIds.size !== songs.length ||
    [...exerciseIds].some((id) => !referencedExerciseIds.has(id)) ||
    [...songIds].some((id) => !referencedSongIds.has(id)) ||
    parsed.items.some((item) =>
      item.kind === 'exercise'
        ? !exerciseIds.has(item.sourceId)
        : !songIds.has(item.sourceId),
    )
  ) {
    throw new Error('The shared routine file has missing or duplicate item references.')
  }

  return {
    format: ROUTINE_SHARE_FORMAT,
    version: ROUTINE_SHARE_VERSION,
    routine: {
      name: parsed.routine.name,
      description: parsed.routine.description,
      pauseAtItemEnd: parsed.routine.pauseAtItemEnd,
    },
    items: parsed.items,
    exercises: validExercises,
    songs: validSongs,
  }
}
