import type { StoredExercise, StoredRoutineItem } from './data-validation'
import type { Song } from './song-library'

export type InspirationFocus = 'balanced' | 'technique' | 'songs' | 'theory-ear' | string

export type SuggestedRoutineItem = Pick<StoredRoutineItem, 'kind' | 'exerciseId' | 'songId' | 'duration'>

export type PracticeSuggestion = {
  focus: InspirationFocus
  durationMinutes: number
  reason: string
  items: SuggestedRoutineItem[]
}

type SuggestionOptions = {
  durationMinutes: number
  focus: InspirationFocus
  exercises: StoredExercise[]
  songs: Song[]
  variation?: number
}

type SuggestionCandidate =
  | { kind: 'exercise'; exerciseId: string; category: string }
  | { kind: 'song'; songId: string; category: string }

const getFocusLabel = (focus: InspirationFocus): string => {
  if (focus === 'balanced') return 'a balanced mix'
  if (focus === 'technique') return 'technique'
  if (focus === 'songs') return 'song practice'
  if (focus === 'theory-ear') return 'theory and ear training'
  return focus
}

const matchesFocus = (category: string, focus: InspirationFocus): boolean => {
  const normalized = category.toLowerCase()

  if (focus === 'balanced') return true
  if (focus === 'technique') {
    return /technique|picking|legato|bend|vibrato|chord/.test(normalized)
  }
  if (focus === 'theory-ear') {
    return /scale|arpeggio|ear|theory|improvisation/.test(normalized)
  }

  return normalized === focus.toLowerCase() || normalized.includes(focus.toLowerCase())
}

const getSlotCount = (durationMinutes: number): number => {
  if (durationMinutes <= 10) return 2
  if (durationMinutes <= 20) return 3
  if (durationMinutes <= 30) return 4
  if (durationMinutes <= 45) return 5
  return 6
}

const getSlotType = (index: number, count: number): 'warmup' | 'focus' | 'theory' | 'song' => {
  if (index === 0 && count > 2) return 'warmup'
  if (index === count - 1) return 'song'
  if (count >= 4 && index === count - 2) return 'theory'
  return 'focus'
}

const toCandidate = (exercise: StoredExercise): SuggestionCandidate => ({
  kind: 'exercise',
  exerciseId: exercise.id,
  category: exercise.category,
})

export const createPracticeSuggestion = ({
  durationMinutes,
  focus,
  exercises,
  songs,
  variation = 0,
}: SuggestionOptions): PracticeSuggestion | null => {
  const duration = Math.max(1, Math.round(durationMinutes))
  const exerciseCandidates = exercises.map(toCandidate)
  const songCandidates: SuggestionCandidate[] = songs.map((song) => ({
    kind: 'song',
    songId: song.id,
    category: 'song',
  }))
  const allCandidates = [...exerciseCandidates, ...songCandidates]

  if (allCandidates.length === 0) {
    return null
  }

  const matchingExercises = exerciseCandidates.filter((candidate) => matchesFocus(candidate.category, focus))
  const theoryExercises = exerciseCandidates.filter((candidate) => matchesFocus(candidate.category, 'theory-ear'))
  const warmupExercises = exerciseCandidates.filter((candidate) => /warm.?up/.test(candidate.category.toLowerCase()))
  const focusCandidates = focus === 'songs'
    ? songCandidates
    : matchingExercises.length > 0
      ? matchingExercises
      : exerciseCandidates
  const used = new Set<string>()
  const count = Math.min(getSlotCount(duration), duration)
  const items: SuggestedRoutineItem[] = []

  for (let index = 0; index < count; index += 1) {
    const slot = getSlotType(index, count)
    const preferredCandidates = slot === 'warmup'
      ? warmupExercises
      : slot === 'theory'
        ? theoryExercises
        : slot === 'song'
          ? songCandidates
          : focusCandidates
    const candidates = preferredCandidates.length > 0
      ? preferredCandidates
      : focusCandidates.length > 0
        ? focusCandidates
        : allCandidates
    const startIndex = Math.abs(variation + index) % candidates.length
    const candidate = Array.from({ length: candidates.length }, (_, offset) =>
      candidates[(startIndex + offset) % candidates.length],
    ).find((item) => !used.has(`${item.kind}:${item.kind === 'song' ? item.songId : item.exerciseId}`)) ?? candidates[startIndex]
    const candidateKey = `${candidate.kind}:${candidate.kind === 'song' ? candidate.songId : candidate.exerciseId}`
    used.add(candidateKey)

    const baseDuration = Math.floor(duration / count)
    const itemDuration = baseDuration + (index < duration % count ? 1 : 0)
    items.push({
      kind: candidate.kind,
      ...(candidate.kind === 'song' ? { songId: candidate.songId } : { exerciseId: candidate.exerciseId }),
      duration: itemDuration,
    })
  }

  const focusLabel = getFocusLabel(focus)
  const hasFocusMaterial = focus === 'balanced' || (focus === 'songs' ? songs.length > 0 : matchingExercises.length > 0)
  const reason = focus === 'balanced'
    ? 'A short, editable mix of practice activities from your library.'
    : !hasFocusMaterial
      ? `Your library does not have ${focusLabel} items yet, so this uses available activities instead.`
      : `Built around ${focusLabel}, with a warm-up or song activity where your library allows.`

  return { focus, durationMinutes: duration, reason, items }
}