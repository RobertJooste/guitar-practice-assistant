export type SongDraft = {
  title: string
  artist: string
  tuning: string
  difficulty: string
  notes: string
  tab: string
}

export type Song = SongDraft & {
  id: string
}

export const DEFAULT_SONG_DRAFT: SongDraft = {
  title: '',
  artist: '',
  tuning: 'E A D G B E',
  difficulty: 'Beginner',
  notes: '',
  tab: '',
}

export const validateSongDraft = (draft: SongDraft): boolean => {
  const trimmedTitle = draft.title.trim()

  return trimmedTitle.length > 0
}

export const getDefaultSongDuration = (difficulty: string): number => {
  switch (difficulty) {
    case 'Intermediate':
      return 8
    case 'Advanced':
      return 10
    case 'Beginner':
    default:
      return 5
  }
}

export const createSongFromDraft = (draft: SongDraft): Song => ({
  id: crypto.randomUUID(),
  title: draft.title.trim(),
  artist: draft.artist.trim(),
  tuning: draft.tuning.trim() || 'E A D G B E',
  difficulty: draft.difficulty.trim() || 'Beginner',
  notes: draft.notes.trim(),
  tab: draft.tab.trim(),
})

export const duplicateSong = (song: Song): Song => ({
  ...song,
  id: crypto.randomUUID(),
  title: `${song.title.trim()} (Copy)`,
})
