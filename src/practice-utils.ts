export type RoutineLike = {
  items: Array<{ duration: number }>
  [key: string]: unknown
}

export type SessionHistoryLike = {
  completedAt: string
  actualMinutes: number
}

export const getRoutineTotalMinutes = (routine: RoutineLike): number =>
  routine.items.reduce((total, item) => total + item.duration, 0)

export const getProgressForElapsed = (
  routine: RoutineLike,
  elapsedMs: number,
): { currentIndex: number; remainingInCurrentItemMs: number; beforeCurrentMs: number } => {
  let beforeCurrentMs = 0

  for (let index = 0; index < routine.items.length; index += 1) {
    const item = routine.items[index]
    const itemDurationMs = item.duration * 60_000

    if (elapsedMs < beforeCurrentMs + itemDurationMs) {
      return {
        currentIndex: index,
        beforeCurrentMs,
        remainingInCurrentItemMs: Math.max(0, beforeCurrentMs + itemDurationMs - elapsedMs),
      }
    }

    beforeCurrentMs += itemDurationMs
  }

  return {
    currentIndex: Math.max(0, routine.items.length - 1),
    beforeCurrentMs,
    remainingInCurrentItemMs: 0,
  }
}

export const deriveElapsedMs = (
  session: { status: string; elapsedMs: number; lastUpdatedAt: number },
  now = Date.now(),
): number => {
  if (session.status !== 'running') {
    return session.elapsedMs
  }

  return session.elapsedMs + Math.max(0, now - session.lastUpdatedAt)
}

export const deriveSessionPositionMs = (
  session: {
    status: string
    elapsedMs: number
    lastUpdatedAt: number
    positionOffsetMs?: number
  },
  now = Date.now(),
): number => Math.max(0, deriveElapsedMs(session, now) + (session.positionOffsetMs ?? 0))

export const getNextExercisePositionMs = (
  items: Array<{ duration: number }>,
  positionMs: number,
): number => {
  if (items.length === 0) {
    return Math.max(0, positionMs)
  }

  const currentPositionMs = Math.max(0, positionMs)
  const progress = getProgressForElapsed({ items }, currentPositionMs)
  const currentItem = items[progress.currentIndex]

  if (!currentItem) {
    return currentPositionMs
  }

  const currentItemEndMs = progress.beforeCurrentMs + currentItem.duration * 60_000
  return Math.max(currentPositionMs, currentItemEndMs)
}

export const summariseWeeklyPractice = (
  history: SessionHistoryLike[],
  today = new Date(),
) => {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return date
  })

  const totalMinutesByDay = new Map<string, number>()
  const practiceDays = new Set<string>()

  for (const entry of history) {
    const entryDate = new Date(entry.completedAt)
    const date = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate())
    const key = date.toDateString()
    totalMinutesByDay.set(key, (totalMinutesByDay.get(key) ?? 0) + entry.actualMinutes)
    if (entry.actualMinutes > 0) {
      practiceDays.add(key)
    }
  }

  const daySummaries = dates.map((date) => {
    const key = date.toDateString()
    const minutes = totalMinutesByDay.get(key) ?? 0
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      minutes,
    }
  })

  const totalMinutes = daySummaries.reduce((sum, day) => sum + day.minutes, 0)
  const averageMinutes = daySummaries.length ? totalMinutes / daySummaries.length : 0
  const bestDay = daySummaries.reduce(
    (best, day) => (day.minutes > best.minutes ? day : best),
    { label: 'N/A', minutes: 0 },
  )

  const streakDate = new Date(today)
  streakDate.setHours(0, 0, 0, 0)
  if (!practiceDays.has(streakDate.toDateString())) {
    streakDate.setDate(streakDate.getDate() - 1)
  }

  let streak = 0
  while (practiceDays.has(streakDate.toDateString())) {
    streak += 1
    streakDate.setDate(streakDate.getDate() - 1)
  }

  return {
    totalMinutes,
    averageMinutes,
    bestDay,
    streak,
    daySummaries,
  }
}

export const getPreviousExerciseElapsedMs = (
  items: Array<{ duration: number }>,
  elapsedMs: number,
  rewindThresholdMs = 3000,
): number => {
  if (elapsedMs <= rewindThresholdMs) {
    return 0
  }

  const totalMs = items.reduce((sum, item) => sum + item.duration * 60_000, 0)
  // When elapsedMs === totalMs (session completed), getProgressForElapsed
  // returns beforeCurrentMs = totalMs rather than the start of the last item,
  // so timeIntoCurrentItem = 0 incorrectly fires the rewind-to-previous branch.
  // Clamping to totalMs - 1 keeps the position inside the last item.
  const position = totalMs > 0 ? Math.min(elapsedMs, totalMs - 1) : elapsedMs

  const { currentIndex, beforeCurrentMs } = getProgressForElapsed({ items }, position)
  const timeIntoCurrentItem = position - beforeCurrentMs

  if (timeIntoCurrentItem > rewindThresholdMs || currentIndex === 0) {
    return beforeCurrentMs
  }

  // Find start of previous item by summing durations of all items before it.
  let previousItemStartMs = 0
  for (let i = 0; i < currentIndex - 1; i += 1) {
    previousItemStartMs += items[i].duration * 60_000
  }

  return previousItemStartMs
}
