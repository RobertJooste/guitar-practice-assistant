export const APP_THEMES = [
  { id: 'classic', label: 'Classic Indigo' },
  { id: 'forest', label: 'Forest' },
  { id: 'ember', label: 'Ember' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'lavender', label: 'Lavender' },
] as const

export type AppTheme = (typeof APP_THEMES)[number]['id']

export const DEFAULT_APP_THEME: AppTheme = 'classic'

export const isAppTheme = (value: unknown): value is AppTheme =>
  typeof value === 'string' && APP_THEMES.some((theme) => theme.id === value)
