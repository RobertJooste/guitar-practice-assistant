// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDefaultInstrumentSettings } from './instruments'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const sharedRoutineFixture = {
  format: 'guitar-practice-routine',
  version: 1,
  routine: {
    name: 'Shared focus',
    description: 'A routine from a friend.',
    pauseAtItemEnd: true,
  },
  items: [
    { kind: 'exercise', sourceId: 'shared-exercise-id', duration: 9 },
    { kind: 'song', sourceId: 'shared-song-id', duration: 6 },
  ],
  exercises: [{
    id: 'shared-exercise-id',
    name: 'Shared picking exercise',
    category: 'Technique',
    description: 'Alternate pick evenly.',
    defaultDuration: 5,
  }],
  songs: [{
    id: 'shared-song-id',
    title: 'Shared song',
    artist: 'Shared artist',
    tuning: 'E A D G B E',
    difficulty: 'Intermediate',
    tab: 'E|--0--|',
  }],
}

describe('practice session workflows', () => {
  let container: HTMLDivElement
  let root: Root
  let storage: Map<string, string>
  let originalElementFromPoint: PropertyDescriptor | undefined

  beforeEach(() => {
    originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))
    storage = new Map()
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<App />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint)
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint')
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const clickButton = (label: string) => {
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim().toLowerCase() === label.toLowerCase(),
    )

    if (!button) {
      throw new Error(`Could not find button: ${label}`)
    }

    act(() => button.click())
  }

  const selectValue = (label: string, value: string) => {
    const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)
    if (!select) {
      throw new Error(`Could not find select: ${label}`)
    }

    act(() => {
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  const expandRoutineCard = (nameFragment: string) => {
    const header = Array.from(container.querySelectorAll<HTMLButtonElement>('.routine-card-header')).find(
      (btn) => btn.getAttribute('aria-expanded') === 'false' && btn.textContent?.includes(nameFragment),
    )
    if (!header) {
      throw new Error(`Could not find collapsed routine card header for: ${nameFragment}`)
    }
    act(() => header.click())
  }

  const importSharedRoutineFile = async (packageData: unknown = sharedRoutineFixture) => {
    clickButton('backup')
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Choose shared routine file"]',
    )
    if (!input) {
      throw new Error('Could not find the shared routine file input')
    }

    const file = new File([JSON.stringify(packageData)], 'shared.gproutine', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', {
      value: async () => JSON.stringify(packageData),
    })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it('does not count skipped routine time as actual practice time', async () => {
    clickButton('Start practice')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })
    clickButton('Skip')
    expect(container.querySelector('.timer-card strong')?.textContent).toBe('15:00')
    clickButton('Finish')
    clickButton('history')

    expect(container.querySelector('.history-row')?.textContent).toContain('2 min')
    expect(container.querySelector('.history-row')?.textContent).toContain('Planned 20 min')
  })

  it('keeps the metronome accessible during an active practice session', async () => {
    clickButton('Start practice')
    expect(container.querySelector('.session-panel .metronome-panel')).not.toBeNull()

    const tempoSlider = container.querySelector<HTMLInputElement>(
      '.metronome-panel input[aria-label="Tempo BPM"]',
    )
    if (!tempoSlider) {
      throw new Error('Could not find the metronome tempo slider')
    }
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(tempoSlider, '120')
      tempoSlider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('.session-panel .metronome-panel output')?.textContent)
      .toBe('120 BPM')

    clickButton('Metronome')
    expect(container.querySelector('.session-indicator')).not.toBeNull()
    expect(container.querySelector('.metronome-panel')).not.toBeNull()
    clickButton('dashboard')
    expect(container.querySelector('.session-panel .metronome-panel')).not.toBeNull()
    expect(container.querySelector('.session-panel .metronome-panel output')?.textContent)
      .toBe('120 BPM')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(container.querySelector('.timer-card strong')?.textContent).toBe('19:00')
  })

  it('shows version, support, and Ko-fi links on the about page', () => {
    clickButton('about')

    const aboutPanel = container.querySelector('.about-panel')
    expect(aboutPanel?.textContent).toContain('Version 0.1.0 (beta)')
    expect(aboutPanel?.closest('.panel')?.textContent).toContain('local-first')

    const githubLink = aboutPanel?.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/RobertJooste/guitar-practice/issues"]',
    )
    expect(githubLink?.target).toBe('_blank')
    expect(githubLink?.rel).toContain('noreferrer')

    const kofiLink = aboutPanel?.querySelector<HTMLAnchorElement>(
      'a[href="https://ko-fi.com/robertjooste"]',
    )
    expect(kofiLink?.target).toBe('_blank')
    expect(kofiLink?.rel).toContain('noreferrer')
  })

  it('estimates tempo from repeated taps', async () => {
    clickButton('Metronome')
    clickButton('Tap tempo')
    for (let tap = 0; tap < 4; tap += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      clickButton('Tap tempo')
    }

    expect(container.querySelector('.metronome-panel output')?.textContent).toBe('120 BPM')
  })

  it('shares instrument tuning between tools and remembers tuning per instrument', () => {
    clickButton('settings')
    selectValue('Instrument', 'bass-4')
    selectValue('Instrument tuning preset', 'drop-d')
    selectValue('Instrument', 'bass-5')
    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Instrument tuning preset"]',
    )?.value).toBe('standard')
    selectValue('Instrument', 'bass-4')
    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Instrument tuning preset"]',
    )?.value).toBe('drop-d')

    clickButton('fretboard')
    expect(container.querySelector('[aria-label="4-string bass fretboard diagram, frets zero through 22"]'))
      .not.toBeNull()
    expect(container.querySelector('.fretboard-table caption')?.textContent)
      .toContain('Drop D (D A D G)')
    expect(container.querySelectorAll('.fretboard-panel tbody tr')).toHaveLength(4)

    clickButton('scales')
    expect(container.querySelector('.pentatonic-table caption')?.textContent)
      .toContain('4-string bass, Drop D')
    expect(container.querySelectorAll('.pentatonic-table tbody tr')).toHaveLength(4)
    expect(JSON.parse(storage.get('guitar-practice-instrument-settings') ?? '{}'))
      .toMatchObject({
        activeInstrumentId: 'bass-4',
        tunings: { 'bass-4': [26, 33, 38, 43] },
      })
  })

  it('customizes dashboard widget visibility, order, and desktop size and persists the layout', () => {
    expect(Array.from(container.querySelectorAll<HTMLElement>('.dashboard-widget'))
      .map((widget) => widget.dataset.dashboardWidget)).toEqual([
      'activity-stats',
      'weekly-summary',
      'weekly-goal',
      'weekly-chart',
      'routine-preview',
    ])
    expect(container.querySelector('.dashboard-widget-controls')).toBeNull()

    clickButton('Customize dashboard')
    const moveSummaryUp = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move Weekly summary up"]',
    )
    if (!moveSummaryUp) {
      throw new Error('Could not find the weekly summary reorder control')
    }
    act(() => moveSummaryUp.click())

    const hideWeeklyGoal = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show Weekly goal"]',
    )
    if (!hideWeeklyGoal) {
      throw new Error('Could not find the weekly goal visibility control')
    }
    act(() => {
      hideWeeklyGoal.click()
      hideWeeklyGoal.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('[data-dashboard-widget="weekly-goal"]')).toBeNull()

    const restoreWeeklyGoal = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show Weekly goal"]',
    )
    if (!restoreWeeklyGoal) {
      throw new Error('Could not find the weekly goal restore control')
    }
    act(() => {
      restoreWeeklyGoal.click()
      restoreWeeklyGoal.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('[data-dashboard-widget="weekly-goal"]')).not.toBeNull()

    const chartSize = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Size for Seven-day practice chart"]',
    )
    if (!chartSize) {
      throw new Error('Could not find the chart size selector')
    }
    act(() => {
      chartSize.value = 'half'
      chartSize.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const layout = JSON.parse(storage.get('guitar-practice-dashboard-layout') ?? '{}')
    expect(layout.order[0]).toBe('weekly-summary')
    expect(layout.hidden).toEqual([])
    expect(layout.sizes['weekly-chart']).toBe('half')

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))
    expect(container.querySelector('[data-dashboard-widget="weekly-chart"]')?.classList)
      .toContain('dashboard-widget-half')
    expect(Array.from(container.querySelectorAll<HTMLElement>('.dashboard-widget'))
      .map((widget) => widget.dataset.dashboardWidget)[0]).toBe('weekly-summary')
  })

  it('updates an untouched saved dashboard layout to the new responsive defaults', () => {
    storage.set('guitar-practice-dashboard-layout', JSON.stringify({
      order: ['activity-stats', 'weekly-summary', 'weekly-goal', 'weekly-chart', 'routine-preview'],
      hidden: [],
      sizes: {
        'activity-stats': 'full',
        'weekly-summary': 'full',
        'weekly-goal': 'full',
        'weekly-chart': 'full',
        'routine-preview': 'full',
      },
    }))

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(container.querySelector('[data-dashboard-widget="activity-stats"]')?.classList)
      .toContain('dashboard-widget-full')
    for (const widget of ['weekly-summary', 'weekly-goal', 'weekly-chart', 'routine-preview']) {
      expect(container.querySelector(`[data-dashboard-widget="${widget}"]`)?.classList)
        .toContain('dashboard-widget-half')
    }
  })

  it('resets a customized dashboard only after confirmation', () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    clickButton('Customize dashboard')
    clickButton('Reset dashboard layout')
    expect(confirm).not.toHaveBeenCalled()

    const moveSummaryUp = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Move Weekly summary up"]',
    )
    if (!moveSummaryUp) {
      throw new Error('Could not find the weekly summary reorder control')
    }
    act(() => moveSummaryUp.click())
    clickButton('Reset dashboard layout')
    expect(confirm).toHaveBeenCalledOnce()
    expect(JSON.parse(storage.get('guitar-practice-dashboard-layout') ?? '{}').order[0])
      .toBe('weekly-summary')

    confirm.mockReturnValue(true)
    clickButton('Reset dashboard layout')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(JSON.parse(storage.get('guitar-practice-dashboard-layout') ?? '{}'))
      .toMatchObject({ hidden: [], sizes: { 'weekly-chart': 'half' } })
  })

  it('reorders dashboard blocks by pointer drag in customize mode', () => {
    clickButton('Customize dashboard')
    const firstWidget = container.querySelector<HTMLElement>(
      '[data-dashboard-widget="activity-stats"]',
    )
    const targetWidget = container.querySelector<HTMLElement>(
      '[data-dashboard-widget="weekly-chart"]',
    )
    const dragHandle = firstWidget?.querySelector<HTMLButtonElement>(
      'button[aria-label="Drag to reorder Activity stats"]',
    )
    if (!firstWidget || !targetWidget || !dragHandle) {
      throw new Error('Could not find dashboard drag targets')
    }

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => targetWidget,
    })
    const dispatchPointer = (target: EventTarget, type: string) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        pointerId: { value: 23 },
        clientX: { value: 10 },
        clientY: { value: 10 },
        button: { value: 0 },
        isPrimary: { value: true },
      })
      act(() => target.dispatchEvent(event))
    }

    dispatchPointer(dragHandle, 'pointerdown')
    dispatchPointer(window, 'pointermove')
    dispatchPointer(window, 'pointerup')

    expect(Array.from(container.querySelectorAll<HTMLElement>('.dashboard-widget'))
      .map((widget) => widget.dataset.dashboardWidget)).toEqual([
      'weekly-summary',
      'weekly-goal',
      'weekly-chart',
      'activity-stats',
      'routine-preview',
    ])
  })

  it('restores a dashboard layout from a full backup', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    clickButton('backup')
    const importInput = container.querySelector<HTMLInputElement>(
      '.backup-actions input[type="file"]',
    )
    if (!importInput) {
      throw new Error('Could not find the backup import input')
    }

    const backup = {
      version: 1,
      exportedAt: '2026-01-01T12:00:00.000Z',
      exercises: [],
      routines: [],
      songs: [],
      history: [],
      selectedRoutineId: '',
      activeSession: null,
      dashboardLayout: {
        order: [
          'weekly-chart',
          'activity-stats',
          'weekly-summary',
          'weekly-goal',
          'routine-preview',
        ],
        hidden: ['weekly-summary'],
        sizes: {
          'activity-stats': 'full',
          'weekly-summary': 'full',
          'weekly-goal': 'full',
          'weekly-chart': 'half',
          'routine-preview': 'full',
        },
      },
    }
    const file = new File([JSON.stringify(backup)], 'backup.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) })
    Object.defineProperty(importInput, 'files', { configurable: true, value: [file] })
    await act(async () => {
      importInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.backup-box .status-message')?.textContent)
      .toContain('Backup restored successfully')
    expect(JSON.parse(storage.get('guitar-practice-dashboard-layout') ?? '{}').hidden)
      .toEqual(['weekly-summary'])
    clickButton('dashboard')
    expect(container.querySelector('[data-dashboard-widget="weekly-summary"]')).toBeNull()
    expect(container.querySelector('[data-dashboard-widget="weekly-chart"]')?.classList)
      .toContain('dashboard-widget-half')
  })

  it('restores instrument and tuning preferences from a full backup', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    clickButton('backup')
    const importInput = container.querySelector<HTMLInputElement>(
      '.backup-actions input[type="file"]',
    )
    if (!importInput) {
      throw new Error('Could not find the backup import input')
    }
    const instrumentSettings = createDefaultInstrumentSettings()
    instrumentSettings.activeInstrumentId = 'bass-5'
    instrumentSettings.tunings['bass-5'] = [21, 28, 33, 38, 43]
    const backup = {
      version: 1,
      exportedAt: '2026-01-01T12:00:00.000Z',
      exercises: [],
      routines: [],
      songs: [],
      history: [],
      selectedRoutineId: '',
      activeSession: null,
      instrumentSettings,
      appTheme: 'forest',
    }
    const file = new File([JSON.stringify(backup)], 'backup.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) })
    Object.defineProperty(importInput, 'files', { configurable: true, value: [file] })
    await act(async () => {
      importInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    clickButton('settings')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="App theme"]')?.value)
      .toBe('forest')
    expect(document.documentElement.dataset.appTheme).toBe('forest')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Instrument"]')?.value)
      .toBe('bass-5')
    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Instrument tuning preset"]',
    )?.value).toBe('drop-a')
    clickButton('fretboard')
    expect(container.querySelectorAll('.fretboard-panel tbody tr')).toHaveLength(5)
    expect(container.querySelector('.fretboard-panel tbody tr:last-child th strong')?.textContent)
      .toBe('A0')
  })

  it('applies and persists a selected app-wide theme', () => {
    clickButton('Settings')
    selectValue('App theme', 'midnight')

    expect(document.documentElement.dataset.appTheme).toBe('midnight')
    expect(JSON.parse(storage.get('guitar-practice-app-theme') ?? 'null')).toBe('midnight')

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))
    clickButton('Settings')

    expect(document.documentElement.dataset.appTheme).toBe('midnight')
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="App theme"]')?.value)
      .toBe('midnight')
  })

  it('preserves an invalid saved dashboard layout in recovery data', () => {
    act(() => root.unmount())
    const malformedLayout = JSON.stringify({ order: ['unknown'] })
    storage.set('guitar-practice-dashboard-layout', malformedLayout)
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Dashboard layout')
    expect(JSON.parse(storage.get('guitar-practice-recovery-data') ?? '[]')).toContainEqual({
      key: 'guitar-practice-dashboard-layout',
      label: 'Dashboard layout',
      raw: malformedLayout,
    })
    expect(container.querySelectorAll('.dashboard-widget')).toHaveLength(5)
  })

  it('preserves an invalid saved theme in recovery data and uses the default theme', () => {
    act(() => root.unmount())
    const malformedTheme = JSON.stringify('neon')
    storage.set('guitar-practice-app-theme', malformedTheme)
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('App theme')
    expect(JSON.parse(storage.get('guitar-practice-recovery-data') ?? '[]')).toContainEqual({
      key: 'guitar-practice-app-theme',
      label: 'App theme',
      raw: malformedTheme,
    })
    expect(document.documentElement.dataset.appTheme).toBe('classic')
  })

  it('does not count paused time as actual practice time', async () => {
    clickButton('Start practice')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })
    clickButton('Pause')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })
    clickButton('Resume')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    clickButton('Finish')
    clickButton('history')

    expect(container.querySelector('.history-row')?.textContent).toContain('3 min')
    expect(container.querySelector('.history-row')?.textContent).toContain('Planned 20 min')
  })

  it('shows a compact running-session indicator on other tabs and returns to the full session', async () => {
    clickButton('Start practice')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    clickButton('library')

    const indicator = container.querySelector('.session-indicator')
    expect(indicator?.textContent).toContain('running')
    expect(indicator?.textContent).toContain('20-minute practice')
    expect(indicator?.textContent).toContain('Finger warm-up')
    expect(indicator?.textContent).toContain('19:00 left')
    expect(container.querySelector('.session-panel')).toBeNull()

    clickButton('Pause')
    expect(container.querySelector('.session-indicator')?.classList.contains('paused')).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(container.querySelector('.session-indicator')?.textContent).toContain('19:00 left')

    clickButton('Resume')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(container.querySelector('.session-indicator')?.textContent).toContain('18:00 left')

    clickButton('Return to practice')
    expect(container.querySelector('.session-indicator')).toBeNull()
    expect(container.querySelector('.session-panel h2')?.textContent).toBe('20-minute practice')
    expect(container.querySelector('.session-panel .status-pill')?.textContent).toBe('running')
  })

  it('shows a resume control for paused sessions in the compact indicator', () => {
    clickButton('Start practice')
    clickButton('Pause')
    clickButton('songs')

    const indicator = container.querySelector('.session-indicator')
    expect(indicator?.classList.contains('paused')).toBe(true)
    expect(indicator?.textContent).toContain('paused')
    expect(indicator?.querySelectorAll('button')).toHaveLength(2)
    expect(indicator?.querySelector('[aria-label="Resume practice session"]')).not.toBeNull()
    expect(Array.from(indicator?.querySelectorAll('button') ?? []).map(
      (button) => button.textContent?.trim(),
    )).toContain('Resume')

    clickButton('Resume')
    expect(container.querySelector('.session-indicator')?.classList.contains('running')).toBe(true)

    clickButton('Return to practice')
    expect(container.querySelector('.session-panel .status-pill')?.textContent).toBe('running')
  })

  it('starts the C major pentatonic example routine with its focused tab visible', () => {
    clickButton('routines')
    expandRoutineCard('C major pentatonic tab practice')
    clickButton('Select routine')
    clickButton('Start selected routine')

    expect(container.querySelector('.session-main-card h3')?.textContent)
      .toBe('C major pentatonic scale')
    expect(container.querySelector('.focused-tab-display')?.textContent)
      .toContain('A|----------3-5')
    expect(container.querySelector<HTMLPreElement>('.focused-tab-display')?.hidden).toBe(false)
    expect(container.querySelector('.focused-tab-panel button')?.textContent).toBe('Hide tab')
  })

  it('starts a technique exercise routine with its original tab in the focused view', () => {
    clickButton('routines')
    expandRoutineCard('Hammer-on control practice')
    clickButton('Select routine')
    clickButton('Start selected routine')

    expect(container.querySelector('.session-main-card h3')?.textContent)
      .toBe('Hammer-on control')
    expect(container.querySelector('.focused-tab-display')?.textContent).toContain('5h7')
    expect(container.querySelector('.focused-tab-panel button')?.textContent).toBe('Hide tab')
  })

  it('provides ten scale tabs and ten technique exercise tabs on first launch', () => {
    const starterSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]') as Array<{
      id: string
      tab: string
    }>
    const starterRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
      items: Array<{ songId?: string }>
    }>

    const scaleSongIds = [
      'song-c-major-pentatonic',
      'song-a-minor-pentatonic',
      'song-e-minor-pentatonic',
      'song-g-major-pentatonic',
      'song-c-major',
      'song-a-natural-minor',
      'song-a-minor-blues',
      'song-d-dorian',
      'song-g-mixolydian',
      'song-a-harmonic-minor',
    ]
    const techniqueSongIds = [
      'song-chromatic-fingering',
      'song-spider-walk',
      'song-alternate-picking',
      'song-string-crossing',
      'song-hammer-ons',
      'song-pull-offs',
      'song-slides',
      'song-bend-release',
      'song-vibrato',
      'song-palm-muted-rhythm',
    ]
    expect(starterSongs.filter(({ id }) => scaleSongIds.includes(id))).toHaveLength(10)
    expect(starterSongs.filter(({ id }) => techniqueSongIds.includes(id))).toHaveLength(10)
    const techniqueTabs = starterSongs.filter(({ id }) => techniqueSongIds.includes(id))
    expect(techniqueTabs.every(({ tab }) => {
      const rows = tab.split('\n')
      return rows.length === 6 && new Set(rows.map((row) => row.length)).size === 1
    })).toBe(true)
    expect(starterSongs.filter(({ id }) =>
      [...scaleSongIds, ...techniqueSongIds].includes(id),
    ).every(({ tab }) => tab.trim().length > 0)).toBe(true)
    expect(starterRoutines.filter(({ items }) =>
      items.some(({ songId }) =>
        songId && [...scaleSongIds, ...techniqueSongIds].includes(songId),
      ),
    )).toHaveLength(20)
  })

  it('adds missing tab examples to existing saved data without changing the selected routine', () => {
    const scaleSongIds = [
      'song-c-major-pentatonic',
      'song-a-minor-pentatonic',
      'song-e-minor-pentatonic',
      'song-g-major-pentatonic',
      'song-c-major',
      'song-a-natural-minor',
      'song-a-minor-blues',
      'song-d-dorian',
      'song-g-mixolydian',
      'song-a-harmonic-minor',
      'song-chromatic-fingering',
      'song-spider-walk',
      'song-alternate-picking',
      'song-string-crossing',
      'song-hammer-ons',
      'song-pull-offs',
      'song-slides',
      'song-bend-release',
      'song-vibrato',
      'song-palm-muted-rhythm',
    ]
    const scaleRoutineIds = scaleSongIds.map((id) => `starter-${id.slice('song-'.length)}`)
    const savedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
    }>
    const savedSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]') as Array<{
      id: string
    }>
    storage.set(
      'guitar-practice-routines',
      JSON.stringify(savedRoutines.filter(({ id }) => !scaleRoutineIds.includes(id))),
    )
    storage.set(
      'guitar-practice-songs',
      JSON.stringify(savedSongs.filter(({ id }) => !scaleSongIds.includes(id))),
    )
    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))
    clickButton('routines')
    clickButton('Add starter tab examples')

    const migratedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
    }>
    const migratedSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]') as Array<{
      id: string
    }>
    expect(migratedRoutines.map(({ id }) => id))
      .toEqual(expect.arrayContaining(scaleRoutineIds))
    expect(migratedSongs.map(({ id }) => id))
      .toEqual(expect.arrayContaining(scaleSongIds))
    expect(storage.get('guitar-practice-selected-routine')).toBe('"starter-20"')
  })

  it('shows saved song tabs during practice and reuses the session timer controls', async () => {
    await importSharedRoutineFile()
    clickButton('Add as new routine')
    clickButton('routines')
    clickButton('Start selected routine')

    expect(container.querySelector('.focused-tab-panel')).toBeNull()
    expect(container.querySelectorAll('.session-panel [aria-label="Pause practice session"]'))
      .toHaveLength(1)

    clickButton('Skip')

    const focusedTabPanel = container.querySelector('.focused-tab-panel')
    const tabDisplay = focusedTabPanel?.querySelector<HTMLPreElement>('.focused-tab-display')
    expect(tabDisplay?.textContent).toBe('E|--0--|')
    expect(tabDisplay?.hidden).toBe(false)
    expect(focusedTabPanel?.querySelector('h3')?.textContent).toBe('Shared song')
    expect(container.querySelectorAll('.session-panel [aria-label="Pause practice session"]'))
      .toHaveLength(1)
    expect(focusedTabPanel?.querySelector('[aria-label="Resume practice session"]')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(focusedTabPanel?.querySelector('.focused-tab-elapsed strong')?.textContent).toBe('0:02')

    clickButton('Pause')
    expect(focusedTabPanel?.querySelector('[aria-label="Resume practice session"]')).not.toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(focusedTabPanel?.querySelector('.focused-tab-elapsed strong')?.textContent).toBe('0:02')

    clickButton('Resume')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(58_000)
    })
    expect(focusedTabPanel?.querySelector('.focused-tab-elapsed strong')?.textContent).toBe('1:00')

    clickButton('Hide tab')
    expect(tabDisplay?.hidden).toBe(true)
    expect(focusedTabPanel?.querySelector('.focused-tab-session-controls')).toBeNull()
    expect(container.querySelectorAll('.session-panel [aria-label="Pause practice session"]'))
      .toHaveLength(1)

    const savedSession = JSON.parse(storage.get('guitar-practice-active-session') ?? '{}')
    expect(savedSession).not.toHaveProperty('focusedTabVisible')

    clickButton('Finish')
    clickButton('history')
    expect(container.querySelector('.history-row')?.textContent).toContain('1 min')
  })

  it('resets the transient tab visibility to visible after reloading an active session', async () => {
    await importSharedRoutineFile()
    clickButton('Add as new routine')
    clickButton('routines')
    clickButton('Start selected routine')
    clickButton('Skip')
    clickButton('Hide tab')

    expect(container.querySelector<HTMLPreElement>('.focused-tab-display')?.hidden).toBe(true)

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(container.querySelector('.session-panel h2')?.textContent).toBe('Shared focus')
    expect(container.querySelector<HTMLPreElement>('.focused-tab-display')?.hidden).toBe(false)
    expect(container.querySelector('.focused-tab-display')?.textContent).toBe('E|--0--|')
  })

  it('keeps tab visibility consistent while moving between tabbed and non-tabbed routine items', async () => {
    await importSharedRoutineFile({
      ...sharedRoutineFixture,
      routine: {
        name: 'Tab visibility transitions',
        description: '',
        pauseAtItemEnd: false,
      },
      items: [
        { kind: 'song', sourceId: 'shared-song-id', duration: 1 },
        { kind: 'song', sourceId: 'song-without-tab-id', duration: 1 },
        { kind: 'song', sourceId: 'shared-song-id', duration: 1 },
        { kind: 'exercise', sourceId: 'shared-exercise-id', duration: 1 },
      ],
      songs: [
        ...sharedRoutineFixture.songs,
        {
          id: 'song-without-tab-id',
          title: 'Song without tab',
          artist: '',
          tuning: 'E A D G B E',
          difficulty: 'Beginner',
          notes: '',
          tab: '',
        },
      ],
    })
    clickButton('Add as new routine')
    clickButton('routines')
    clickButton('Start selected routine')

    expect(container.querySelector<HTMLPreElement>('.focused-tab-display')?.hidden).toBe(false)
    clickButton('Hide tab')
    clickButton('Skip')

    expect(container.querySelector('.focused-tab-panel')).toBeNull()
    expect(container.querySelectorAll('.session-panel [aria-label="Pause practice session"]'))
      .toHaveLength(1)

    clickButton('Skip')
    expect(container.querySelector<HTMLPreElement>('.focused-tab-display')?.hidden).toBe(true)
    expect(container.querySelector('.focused-tab-panel button')?.textContent).toBe('Show tab')

    clickButton('Skip')
    expect(container.querySelector('.focused-tab-panel')).toBeNull()
    expect(container.querySelector('.session-main-card h3')?.textContent)
      .toBe('Shared picking exercise')
    expect(container.querySelectorAll('.session-panel [aria-label="Pause practice session"]'))
      .toHaveLength(1)
  })

  it('does not show a compact indicator for completed sessions', async () => {
    clickButton('Start practice')
    clickButton('Finish')
    clickButton('history')

    expect(container.querySelector('.session-indicator')).toBeNull()
    expect(container.querySelector('.session-panel')).toBeNull()
    expect(container.querySelector('.history-row')).not.toBeNull()
  })

  it('explores notes in preset and custom tunings and keeps the selection across tabs', () => {
    clickButton('Settings')
    selectValue('Instrument tuning preset', 'drop-d')
    clickButton('Fretboard')
    const diagram = container.querySelector<HTMLTableElement>('.fretboard-table')
    expect(diagram?.querySelectorAll('tbody tr')).toHaveLength(6)
    expect(diagram?.querySelector('tbody tr:first-child th span')?.textContent)
      .toContain('1st string (high)')
    expect(diagram?.querySelector('tbody tr:first-child th strong')?.textContent).toBe('E4')
    expect(diagram?.querySelector('tbody tr:last-child th span')?.textContent)
      .toContain('6th string (low)')
    expect(diagram?.querySelector('tbody tr:last-child th strong')?.textContent).toBe('D2')
    expect(diagram?.querySelectorAll('thead th')).toHaveLength(24)
    expect(diagram?.querySelector('thead th:last-child')?.textContent).toBe('22')
    expect(container.querySelector('.fretboard-scroll')?.getAttribute('aria-label'))
      .toContain('zero through 22')
    const fretSlider = container.querySelector<HTMLInputElement>(
      'input[aria-label="Fretboard scroll"]',
    )
    if (!fretSlider) {
      throw new Error('Could not find the fretboard scroll slider')
    }
    expect(fretSlider.max).toBe('10')
    expect(container.querySelector('.fretboard-position-control')?.textContent)
      .toContain('Showing frets Open–12')
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(fretSlider, '2')
      fretSlider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('.fretboard-position-control')?.textContent)
      .toContain('Showing frets 2–14')
    expect(container.querySelector('.fretboard-scroll')?.scrollLeft).toBe(116)

    const lowStringRow = container.querySelector('.fretboard-table tbody tr:last-child')
    expect(lowStringRow?.querySelector('th strong')?.textContent).toBe('D2')
    expect(lowStringRow?.querySelectorAll('td .fretboard-note')[2]?.textContent).toBe('E')

    clickButton('library')
    clickButton('Fretboard')
    expect(container.querySelector('.fretboard-table tbody tr:last-child th strong')?.textContent).toBe('D2')

    clickButton('Settings')
    const customStringTuning = container.querySelector<HTMLSelectElement>(
      'select[aria-label="6th string (low) tuning"]',
    )
    if (!customStringTuning) {
      throw new Error('Could not find the low string tuning selector')
    }
    act(() => {
      customStringTuning.value = '41'
      customStringTuning.dispatchEvent(new Event('change', { bubbles: true }))
    })
    clickButton('Fretboard')
    expect(container.querySelector('.fretboard-table tbody tr:last-child th strong')?.textContent).toBe('F2')
    clickButton('Settings')
    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Instrument tuning preset"]',
    )?.value).toBe('custom')
  })

  it('switches fretboard note labels between sharp and flat spellings', () => {
    clickButton('Fretboard')
    const spelling = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Note spelling"]',
    )
    const highEStringRow = container.querySelector('.fretboard-table tbody tr:first-child')

    if (!spelling || !highEStringRow) {
      throw new Error('Could not find the fretboard note spelling controls')
    }

    expect(highEStringRow.querySelectorAll('.fretboard-note')[1]?.textContent).toBe('F')
    act(() => {
      spelling.value = 'flats'
      spelling.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(highEStringRow.querySelectorAll('.fretboard-note')[2]?.textContent).toBe('Gb')
  })

  it('shows pentatonic patterns and major-scale modes on the fretboard', () => {
    clickButton('Scales')
    expect(container.querySelector('.pentatonic-summary')?.textContent).toContain(
      'C minor pentatonic · Position 1',
    )
    expect(container.querySelectorAll('.pentatonic-table tbody tr')).toHaveLength(6)
    expect(container.querySelector('.pentatonic-table tbody tr:first-child th span')?.textContent)
      .toContain('1st string (high)')
    expect(container.querySelector('.pentatonic-table tbody tr:last-child th span')?.textContent)
      .toContain('6th string (low)')
    expect(container.querySelectorAll('.pentatonic-table .pentatonic-root').length).toBeGreaterThan(0)

    const viewSelector = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Pentatonic fretboard view"]',
    )
    const scaleSelector = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Scale"]',
    )
    if (!viewSelector || !scaleSelector) {
      throw new Error('Could not find the scale selectors')
    }
    expect(Array.from(scaleSelector.options).map(({ value }) => value)).toEqual([
      'major-pentatonic',
      'minor-pentatonic',
      'major',
      'dorian',
      'phrygian',
      'lydian',
      'mixolydian',
      'natural-minor',
      'locrian',
    ])
    expect(container.querySelectorAll('.pentatonic-table thead th')).toHaveLength(5)
    act(() => {
      viewSelector.value = 'zoomed-out'
      viewSelector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelectorAll('.pentatonic-table thead th')).toHaveLength(13)
    expect(container.querySelector('.pentatonic-summary')?.textContent)
      .toContain('Showing frets 4–15')
    expect(container.querySelector('.pentatonic-board')?.classList.contains('zoomed-out')).toBe(true)

    const keySelector = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Scale key"]',
    )
    const positionSelector = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Pentatonic box position"]',
    )
    if (!keySelector || !positionSelector) {
      throw new Error('Could not find pentatonic scale selectors')
    }

    act(() => {
      keySelector.value = '9'
      keySelector.dispatchEvent(new Event('change', { bubbles: true }))
      scaleSelector.value = 'major-pentatonic'
      scaleSelector.dispatchEvent(new Event('change', { bubbles: true }))
      positionSelector.value = '5'
      positionSelector.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(container.querySelector('.pentatonic-summary')?.textContent).toContain(
      'A major pentatonic · Position 5',
    )
    expect(container.querySelector('.pentatonic-board')?.getAttribute('aria-label')).toContain(
      'A major pentatonic position 5',
    )
    expect(container.querySelectorAll('.pentatonic-table thead th')).toHaveLength(13)
    expect(container.querySelector('.pentatonic-summary')?.textContent)
      .toContain('Showing frets 7–18')
    act(() => {
      keySelector.value = '3'
      keySelector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('.pentatonic-summary')?.textContent)
      .toContain('Showing frets 11–22')

    clickButton('library')
    clickButton('Scales')
    expect(container.querySelector('.pentatonic-summary')?.textContent).toContain(
      'Eb major pentatonic · Position 5',
    )
    expect(container.querySelector('select[aria-label="Pentatonic note spelling"]')).toBeNull()

    act(() => {
      keySelector.value = '5'
      keySelector.dispatchEvent(new Event('change', { bubbles: true }))
      scaleSelector.value = 'major'
      scaleSelector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('.pentatonic-summary')?.textContent).toContain(
      'F major (Ionian)',
    )
    expect(Array.from(container.querySelectorAll('.pentatonic-table .fretboard-note'))
      .some((note) => note.textContent === 'Bb')).toBe(true)

    act(() => {
      keySelector.value = '0'
      keySelector.dispatchEvent(new Event('change', { bubbles: true }))
      scaleSelector.value = 'dorian'
      scaleSelector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('.pentatonic-summary')?.textContent).toContain('C Dorian')
    expect(container.querySelectorAll('.pentatonic-table thead th')).toHaveLength(24)
    expect(container.querySelector('.pentatonic-table thead th:nth-child(2)')?.textContent)
      .toBe('Open')
    expect(container.querySelector('.pentatonic-table thead th:last-child')?.textContent)
      .toBe('22')
    expect(container.querySelector('.pentatonic-summary')?.textContent)
      .toContain('Showing frets Open–12')
    expect(container.querySelector('.pentatonic-board')?.getAttribute('aria-label'))
      .toContain('frets 0 through 22')
    expect(container.querySelector('.pentatonic-table tbody tr:last-child')?.querySelectorAll(
      'td .fretboard-note',
    )).toHaveLength(13)
    expect(container.querySelector('.pentatonic-table tbody tr:last-child')?.textContent)
      .toContain('Bb')
    expect(container.querySelector('select[aria-label="Pentatonic box position"]')).toBeNull()

    const scaleSlider = container.querySelector<HTMLInputElement>(
      'input[aria-label="Scale fretboard scroll"]',
    )
    if (!scaleSlider) {
      throw new Error('Could not find the scale fretboard scroll slider')
    }
    expect(scaleSlider.max).toBe('10')
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(scaleSlider, '2')
      scaleSlider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('.pentatonic-summary')?.textContent)
      .toContain('Showing frets 2–14')
    expect(container.querySelector('.pentatonic-board')?.scrollLeft).toBe(116)

    act(() => {
      keySelector.value = '7'
      keySelector.dispatchEvent(new Event('change', { bubbles: true }))
      scaleSelector.value = 'major'
      scaleSelector.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const gMajorRows = Array.from(
      container.querySelectorAll<HTMLTableRowElement>('.pentatonic-table tbody tr'),
    )
    expect(gMajorRows.map((row) => [
      row.querySelector('th span')?.textContent,
      row.querySelector('th strong')?.textContent,
      Array.from(row.querySelectorAll('td'), (cell) =>
        cell.querySelector('.fretboard-note')?.textContent ?? null,
      ),
    ])).toEqual([
      ['1st string (high)', 'E', [
        'E', null, 'F#', 'G', null, 'A', null, 'B', 'C', null, 'D', null, 'E',
        null, 'F#', 'G', null, 'A', null, 'B', 'C', null, 'D',
      ]],
      ['2nd string', 'B', [
        'B', 'C', null, 'D', null, 'E', null, 'F#', 'G', null, 'A', null, 'B',
        'C', null, 'D', null, 'E', null, 'F#', 'G', null, 'A',
      ]],
      ['3rd string', 'G', [
        'G', null, 'A', null, 'B', 'C', null, 'D', null, 'E', null, 'F#', 'G',
        null, 'A', null, 'B', 'C', null, 'D', null, 'E', null,
      ]],
      ['4th string', 'D', [
        'D', null, 'E', null, 'F#', 'G', null, 'A', null, 'B', 'C', null, 'D',
        null, 'E', null, 'F#', 'G', null, 'A', null, 'B', 'C',
      ]],
      ['5th string', 'A', [
        'A', null, 'B', 'C', null, 'D', null, 'E', null, 'F#', 'G', null, 'A',
        null, 'B', 'C', null, 'D', null, 'E', null, 'F#', 'G',
      ]],
      ['6th string (low)', 'E', [
        'E', null, 'F#', 'G', null, 'A', null, 'B', 'C', null, 'D', null, 'E',
        null, 'F#', 'G', null, 'A', null, 'B', 'C', null, 'D',
      ]],
    ])
  })

  it('shows today and weekly practice against their separate targets', async () => {
    clickButton('Start practice')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })
    clickButton('Finish')

    act(() => vi.setSystemTime(new Date('2026-01-02T12:00:00.000Z')))
    clickButton('Start practice')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })
    clickButton('Finish')

    const todayCard = container.querySelector('.stats-grid .stat-card:nth-child(2)')
    expect(todayCard?.querySelector('strong')?.textContent).toBe('2 min')
    expect(todayCard?.querySelector('small')?.textContent).toBe('28 min to daily target')
    const sessionCountCard = Array.from(container.querySelectorAll('.stats-grid .stat-card')).find(
      (card) => card.querySelector('span')?.textContent === 'Total sessions',
    )
    expect(sessionCountCard?.querySelector('strong')?.textContent).toBe('2')
    expect(container.querySelector('.goal-header')?.textContent).toContain('12/150 min')
  })

  it('sets, clears, and persists optional exercise and routine ratings', () => {
    clickButton('library')
    const exerciseCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Finger warm-up'),
    )
    const exerciseRating = exerciseCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rate Finger warm-up enjoyment 4 out of 5 stars"]',
    )
    const exerciseDifficulty = exerciseCard?.querySelector<HTMLSelectElement>(
      'select[aria-label="Current difficulty for Finger warm-up"]',
    )
    if (!exerciseRating || !exerciseDifficulty) {
      throw new Error('Could not find exercise rating controls')
    }

    act(() => {
      exerciseRating.click()
      exerciseDifficulty.value = 'Hard'
      exerciseDifficulty.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const savedExercises = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
      difficulty?: string
    }>
    expect(savedExercises.find((exercise) => exercise.id === 'warmup-1')).toMatchObject({
      enjoymentRating: 4,
      difficulty: 'Hard',
    })

    clickButton('Edit')
    clickButton('Update exercise')
    const editedExercise = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
      difficulty?: string
    }>
    expect(editedExercise.find((exercise) => exercise.id === 'warmup-1')).toMatchObject({
      enjoymentRating: 4,
      difficulty: 'Hard',
    })

    const updatedExerciseRating = exerciseCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rate Finger warm-up enjoyment 2 out of 5 stars"]',
    )
    if (!updatedExerciseRating) {
      throw new Error('Could not find the exercise rating control')
    }
    act(() => updatedExerciseRating.click())
    const changedExercises = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
    }>
    expect(changedExercises.find((exercise) => exercise.id === 'warmup-1')?.enjoymentRating).toBe(2)

    const clearRating = exerciseCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear Finger warm-up enjoyment rating"]',
    )
    const clearDifficulty = exerciseCard?.querySelector<HTMLSelectElement>(
      'select[aria-label="Current difficulty for Finger warm-up"]',
    )
    if (!clearRating || !clearDifficulty) {
      throw new Error('Could not find the clear exercise rating controls')
    }
    act(() => {
      clearRating.click()
      clearDifficulty.value = ''
      clearDifficulty.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const clearedExercises = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
      difficulty?: string
    }>
    expect(clearedExercises.find((exercise) => exercise.id === 'warmup-1')).not.toHaveProperty(
      'enjoymentRating',
    )
    expect(clearedExercises.find((exercise) => exercise.id === 'warmup-1')).not.toHaveProperty(
      'difficulty',
    )

    clickButton('routines')
    expandRoutineCard('20-minute practice')
    const routineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('20-minute practice'),
    )
    const routineRating = routineCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rate 20-minute practice enjoyment 5 out of 5 stars"]',
    )
    const routineDifficulty = routineCard?.querySelector<HTMLSelectElement>(
      'select[aria-label="Current difficulty for 20-minute practice"]',
    )
    if (!routineRating || !routineDifficulty) {
      throw new Error('Could not find routine rating controls')
    }

    act(() => {
      routineRating.click()
      routineDifficulty.value = 'Very hard'
      routineDifficulty.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const savedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
      difficulty?: string
    }>
    expect(savedRoutines.find((routine) => routine.id === 'starter-20')).toMatchObject({
      enjoymentRating: 5,
      difficulty: 'Very hard',
    })

    const changedRoutineRating = routineCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rate 20-minute practice enjoyment 3 out of 5 stars"]',
    )
    if (!changedRoutineRating) {
      throw new Error('Could not find the routine rating control')
    }
    act(() => {
      changedRoutineRating.click()
      routineDifficulty.value = 'Moderate'
      routineDifficulty.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const changedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
      difficulty?: string
    }>
    expect(changedRoutines.find((routine) => routine.id === 'starter-20')).toMatchObject({
      enjoymentRating: 3,
      difficulty: 'Moderate',
    })

    const clearRoutineRating = routineCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear 20-minute practice enjoyment rating"]',
    )
    if (!clearRoutineRating) {
      throw new Error('Could not find the clear routine rating control')
    }
    act(() => {
      clearRoutineRating.click()
      routineDifficulty.value = ''
      routineDifficulty.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const clearedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
      enjoymentRating?: number
      difficulty?: string
    }>
    expect(clearedRoutines.find((routine) => routine.id === 'starter-20')).not.toHaveProperty(
      'enjoymentRating',
    )
    expect(clearedRoutines.find((routine) => routine.id === 'starter-20')).not.toHaveProperty(
      'difficulty',
    )
  })

  it('edits shared and per-day targets and uses them for dashboard progress', () => {
    clickButton('Settings')
    const modeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Practice target mode"]',
    )

    if (!modeSelect) {
      throw new Error('Could not find the practice target mode selector')
    }

    act(() => {
      modeSelect.value = 'daily'
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const dailyInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Daily target minutes"]',
    )
    if (!dailyInput) {
      throw new Error('Could not find the shared daily target input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(dailyInput, '20')
      dailyInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(JSON.parse(storage.get('guitar-practice-targets') ?? '{}')).toMatchObject({
      mode: 'daily',
      dailyMinutes: 20,
    })

    clickButton('dashboard')
    const todayCard = container.querySelector('.stats-grid .stat-card:nth-child(2)')
    expect(todayCard?.querySelector('small')?.textContent).toBe('20 min to daily target')
    expect(container.querySelector('.goal-header')?.textContent).toContain('0/140 min')

    clickButton('Settings')
    const perDayModeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Practice target mode"]',
    )

    if (!perDayModeSelect) {
      throw new Error('Could not find the practice target mode selector')
    }

    act(() => {
      perDayModeSelect.value = 'per-day'
      perDayModeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const thursdayInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Thursday target minutes"]',
    )
    if (!thursdayInput) {
      throw new Error('Could not find Thursday target input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(thursdayInput, '40')
      thursdayInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    clickButton('dashboard')
    expect(container.querySelector('.stats-grid .stat-card:nth-child(2)')?.textContent)
      .toContain('40 min to daily target')
    expect(container.querySelector('.goal-header')?.textContent).toContain('0/160 min')

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))
    clickButton('Settings')

    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Practice target mode"]',
    )?.value).toBe('per-day')
    expect(container.querySelector<HTMLInputElement>(
      'input[aria-label="Thursday target minutes"]',
    )?.value).toBe('40')
  })

  it('reorders mixed routine items by pointer drag and keeps the saved session order', () => {
    clickButton('routines')
    expandRoutineCard('20-minute practice')

    const routineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('20-minute practice'),
    )
    const songSelect = Array.from(routineCard?.querySelectorAll('select') ?? []).find(
      (select) => Array.from(select.options).some(
        (option) => option.textContent?.trim() === 'Sample rhythm riff',
      ),
    )
    const songOption = Array.from(songSelect?.options ?? []).find(
      (option) => option.textContent?.trim() === 'Sample rhythm riff',
    )

    if (!routineCard || !songSelect || !songOption) {
      throw new Error('Could not find the starter routine song selector')
    }

    act(() => {
      songSelect.value = songOption.value
      songSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const getRows = () => Array.from(
      routineCard.querySelectorAll<HTMLElement>('.routine-item-row'),
    )
    const labelsBefore = getRows().map((row) => ({
      label: row.querySelector('span')?.textContent,
      duration: row.querySelector<HTMLInputElement>('input[type="number"]')?.value,
    }))
    const itemIdsBefore = getRows().map((row) => row.dataset.routineItemId)

    const dispatchPointer = (
      target: EventTarget,
      type: string,
      pointerId: number,
      clientY: number,
    ) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        pointerId: { value: pointerId },
        clientX: { value: 10 },
        clientY: { value: clientY },
        button: { value: 0 },
      })
      act(() => target.dispatchEvent(event))
    }

    const dragItemToIndex = (fromIndex: number, toIndex: number) => {
      const rows = getRows()
      const dragHandle = rows[fromIndex]?.querySelector<HTMLButtonElement>(
        '.routine-item-drag-handle',
      )
      const targetRow = rows[toIndex]

      if (!dragHandle || !targetRow) {
        throw new Error('Could not find routine item drag targets')
      }

      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: () => targetRow,
      })
      dispatchPointer(dragHandle, 'pointerdown', 7, fromIndex)
      dispatchPointer(window, 'pointermove', 7, toIndex)
      expect(targetRow.classList.contains('drop-target')).toBe(true)
      dispatchPointer(window, 'pointerup', 7, toIndex)
    }

    dragItemToIndex(0, 3)
    expect(getRows().map((row) => row.querySelector('span')?.textContent)).toEqual([
      '1. String skipping',
      '2. Major scale box',
      '3. Metronome rhythm',
      '4. Finger warm-up',
      '5. Sample rhythm riff',
    ])

    dragItemToIndex(4, 1)
    expect(getRows().map((row) => row.querySelector('span')?.textContent)).toEqual([
      '1. String skipping',
      '2. Sample rhythm riff',
      '3. Major scale box',
      '4. Metronome rhythm',
      '5. Finger warm-up',
    ])
    expect(getRows().map((row) => ({
      label: row.querySelector('span')?.textContent,
      duration: row.querySelector<HTMLInputElement>('input[type="number"]')?.value,
    }))).toEqual([
      labelsBefore[1],
      labelsBefore[4],
      labelsBefore[2],
      labelsBefore[3],
      labelsBefore[0],
    ].map((item, index) => ({ ...item, label: `${index + 1}. ${item.label?.slice(3)}` })))

    const savedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]')
    const savedRoutine = savedRoutines.find((routine: { name: string }) =>
      routine.name === '20-minute practice',
    )
    expect(savedRoutine.items.map((item: { id: string }) => item.id)).toEqual([
      itemIdsBefore[1],
      itemIdsBefore[4],
      itemIdsBefore[2],
      itemIdsBefore[3],
      itemIdsBefore[0],
    ])

    clickButton('dashboard')
    clickButton('Start practice')
    expect(container.querySelector('.session-main-card h3')?.textContent).toBe('String skipping')
    expect(container.querySelector('.session-meta')?.textContent).toContain('5 items')
  })

  it('expands long exercise descriptions and omits the control when text fits', () => {
    clickButton('library')

    expect(container.querySelectorAll('.exercise-description-toggle')).toHaveLength(0)

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Alternate picking drills"]',
    )
    const descriptionInput = container.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Describe the exercise and the key focus points."]',
    )

    if (!nameInput || !descriptionInput) {
      throw new Error('Could not find the exercise form fields')
    }

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setInputValue?.call(nameInput, 'Long description exercise')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))

      const setTextAreaValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setTextAreaValue?.call(
        descriptionInput,
        'Practice slowly and evenly. '.repeat(12),
      )
      descriptionInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add exercise')

    const exerciseCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Long description exercise'),
    )
    const description = exerciseCard?.querySelector<HTMLElement>('.exercise-description')

    if (!description) {
      throw new Error('Could not find the new exercise description')
    }

    Object.defineProperty(description, 'scrollHeight', { configurable: true, value: 120 })
    Object.defineProperty(description, 'clientHeight', { configurable: true, value: 60 })
    act(() => window.dispatchEvent(new Event('resize')))

    const moreButton = exerciseCard?.querySelector<HTMLButtonElement>(
      '.exercise-description-toggle',
    )
    expect(moreButton?.textContent).toBe('More')
    expect(moreButton?.getAttribute('aria-expanded')).toBe('false')
    expect(moreButton?.getAttribute('aria-controls')).toBe(description.id)

    act(() => moreButton?.click())
    expect(exerciseCard?.querySelector('.exercise-description')?.classList.contains('expanded')).toBe(true)
    expect(exerciseCard?.querySelector('.exercise-description-toggle')?.textContent).toBe('Less')
    expect(exerciseCard?.querySelector('.exercise-description-toggle')?.getAttribute('aria-expanded')).toBe('true')

    act(() => exerciseCard?.querySelector<HTMLButtonElement>('.exercise-description-toggle')?.click())
    expect(exerciseCard?.querySelector('.exercise-description')?.classList.contains('expanded')).toBe(false)
    expect(exerciseCard?.querySelector('.exercise-description-toggle')?.textContent).toBe('More')
  })

  it('creates, edits, and duplicates an exercise from the library form', () => {
    clickButton('library')

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Alternate picking drills"]',
    )
    if (!nameInput) {
      throw new Error('Could not find the exercise name field')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Tremolo study')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add exercise')

    const createdCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Tremolo study'),
    )
    expect(createdCard).toBeDefined()
    expect(JSON.parse(storage.get('guitar-practice-exercises') ?? '[]')
      .some((exercise: { name: string }) => exercise.name === 'Tremolo study')).toBe(true)

    const editButton = Array.from(createdCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Edit',
    )
    act(() => editButton?.click())
    expect(nameInput.value).toBe('Tremolo study')

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Tremolo study (revised)')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Update exercise')
    expect(container.querySelector('.library-grid')?.textContent)
      .toContain('Tremolo study (revised)')
    expect(container.querySelector('.library-grid')?.textContent)
      .not.toContain('Tremolo study"')

    const updatedCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Tremolo study (revised)'),
    )
    const duplicateButton = Array.from(updatedCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Duplicate',
    )
    act(() => duplicateButton?.click())
    expect(container.querySelector('.library-grid')?.textContent)
      .toContain('Tremolo study (revised) (Copy)')
  })

  it('ignores a blank exercise name without adding a card', () => {
    clickButton('library')
    const cardCount = container.querySelectorAll('.library-grid .card').length

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Alternate picking drills"]',
    )
    if (!nameInput) {
      throw new Error('Could not find the exercise name field')
    }
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, '   ')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add exercise')

    expect(container.querySelectorAll('.library-grid .card')).toHaveLength(cardCount)
  })

  it('creates a routine, adds an exercise to it, and starts it', () => {
    clickButton('routines')

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Evening technique reset"]',
    )
    if (!nameInput) {
      throw new Error('Could not find the routine name field')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Evening drills')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add routine')

    const routineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('Evening drills'),
    )
    expect(routineCard).toBeDefined()

    const addExerciseSelect = routineCard?.querySelector<HTMLSelectElement>(
      'select[aria-label="Add exercise to Evening drills"]',
    )
    if (!addExerciseSelect) {
      throw new Error('Could not find the routine exercise selector')
    }
    const exerciseOption = Array.from(addExerciseSelect.options).find(
      (option) => option.textContent?.trim() === 'Finger warm-up',
    )
    if (!exerciseOption) {
      throw new Error('Could not find the exercise option')
    }
    act(() => {
      addExerciseSelect.value = exerciseOption.value
      addExerciseSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(routineCard?.textContent).toContain('Finger warm-up')

    const selectButton = Array.from(routineCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Select routine',
    )
    act(() => selectButton?.click())
    clickButton('Start selected routine')
    expect(container.querySelector('.session-panel')?.textContent).toContain('Evening drills')
  })

  it('requires confirmation before a backup import replaces current data', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    clickButton('library')
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Alternate picking drills"]',
    )
    if (!nameInput) {
      throw new Error('Could not find the exercise name field')
    }
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Keep me exercise')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add exercise')

    clickButton('backup')
    const importInput = container.querySelector<HTMLInputElement>(
      '.backup-actions input[type="file"]',
    )
    if (!importInput) {
      throw new Error('Could not find the backup import input')
    }

    const backup = {
      version: 1,
      exportedAt: '2026-01-01T12:00:00.000Z',
      exercises: [],
      routines: [],
      songs: [],
      history: [],
      selectedRoutineId: '',
      activeSession: null,
    }
    const file = new File([JSON.stringify(backup)], 'backup.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) })
    Object.defineProperty(importInput, 'files', { configurable: true, value: [file] })
    await act(async () => {
      importInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('replaces all current'))
    expect(container.querySelector('.backup-box .status-message')).toBeNull()
    expect(JSON.parse(storage.get('guitar-practice-exercises') ?? '[]')
      .some((exercise: { name: string }) => exercise.name === 'Keep me exercise')).toBe(true)

    confirmSpy.mockReturnValue(true)
    Object.defineProperty(importInput, 'files', { configurable: true, value: [file] })
    await act(async () => {
      importInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.backup-box .status-message')?.textContent)
      .toContain('Backup restored successfully')
    expect(JSON.parse(storage.get('guitar-practice-exercises') ?? '[]')
      .some((exercise: { name: string }) => exercise.name === 'Keep me exercise')).toBe(false)
  })

  it('rejects an invalid backup file without changing saved data', async () => {
    clickButton('backup')
    const importInput = container.querySelector<HTMLInputElement>(
      '.backup-actions input[type="file"]',
    )
    if (!importInput) {
      throw new Error('Could not find the backup import input')
    }

    const file = new File(['{"version":99,"exercises":"not-an-array"}'], 'bad.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', {
      value: async () => '{"version":99,"exercises":"not-an-array"}',
    })
    Object.defineProperty(importInput, 'files', { configurable: true, value: [file] })
    await act(async () => {
      importInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.backup-box .status-message')?.textContent)
      .toContain('not a valid practice backup')
    expect(JSON.parse(storage.get('guitar-practice-exercises') ?? '[]').length)
      .toBeGreaterThan(0)
  })

  it('counts down the routine and current exercise separately', async () => {
    clickButton('Start practice')
    const timerCards = Array.from(container.querySelectorAll('.timer-card'))

    expect(timerCards[0]?.querySelector('small')?.textContent).toBe('Routine remaining')
    expect(timerCards[1]?.querySelector('small')?.textContent).toBe('Exercise remaining')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })

    expect(timerCards[0]?.querySelector('strong')?.textContent).toBe('18:00')
    expect(timerCards[1]?.querySelector('strong')?.textContent).toBe('3:00')
  })

  it('applies an enabled routine pause setting to the active session', async () => {
    clickButton('Start practice')
    clickButton('Settings')

    const pauseSetting = container.querySelector<HTMLInputElement>(
      'input[aria-label="Pause at item end for 20-minute practice"]',
    )

    if (!pauseSetting) {
      throw new Error('Could not find the routine pause setting')
    }

    act(() => pauseSetting.click())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })

    expect(container.querySelector('.session-indicator .status-pill')?.textContent).toBe('paused')
    clickButton('Return to practice')
    expect(container.querySelector('.session-panel .status-pill')?.textContent).toBe('paused')
    expect(container.querySelector('.session-main-card h3')?.textContent).toBe('Finger warm-up')
    expect(container.querySelectorAll('.timer-card strong')[0]?.textContent).toBe('15:00')
    expect(container.querySelectorAll('.timer-card strong')[1]?.textContent).toBe('0:00')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000)
    })
    expect(container.querySelectorAll('.timer-card strong')[0]?.textContent).toBe('15:00')

    clickButton('Continue')
    expect(container.querySelector('.status-pill')?.textContent).toBe('running')
    expect(container.querySelector('.session-main-card h3')?.textContent).toBe('String skipping')
  })

  it('completes the final routine item automatically when item-end pausing is enabled', async () => {
    clickButton('Settings')
    const pauseSetting = container.querySelector<HTMLInputElement>(
      'input[aria-label="Pause at item end for 20-minute practice"]',
    )

    if (!pauseSetting) {
      throw new Error('Could not find the routine pause setting')
    }

    act(() => pauseSetting.click())
    clickButton('dashboard')
    clickButton('Start practice')

    for (let itemIndex = 0; itemIndex < 4; itemIndex += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000)
      })

      if (itemIndex < 3) {
        expect(container.querySelector('.status-pill')?.textContent).toBe('paused')
        clickButton('Continue')
      }
    }

    expect(container.querySelector('.status-pill')?.textContent).toBe('completed')
    clickButton('history')
    expect(container.querySelector('.history-row')?.textContent).toContain('20 min')
  })

  it('starts the selected routine from the routines tab only after an explicit action', () => {
    clickButton('routines')
    expect(container.querySelector('.session-panel')).toBeNull()

    clickButton('Start selected routine')

    expect(container.querySelector('.session-panel h2')?.textContent).toBe('20-minute practice')
  })

  it('downloads an individual routine from its sharing controls', () => {
    const createObjectURL = vi.fn(() => 'blob:shared-routine')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        expect(this.download).toBe('20-minute-practice.gproutine')
      },
    )

    clickButton('routines')
    expandRoutineCard('20-minute practice')
    clickButton('Share routine')
    const includeTabs = container.querySelector<HTMLInputElement>(
      'input[aria-label="Include song tab/notation text"]',
    )
    expect(includeTabs?.checked).toBe(false)
    clickButton('Download routine file')

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(downloadClick).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:shared-routine')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('was exported')
  })

  it('previews a shared routine and imports it with fresh library identifiers', async () => {
    const previousExercises = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]')
    const previousSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]')
    const previousRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]')

    await importSharedRoutineFile()
    expect(container.querySelector('.shared-routine-preview')?.textContent).toContain('Shared focus')
    expect(container.querySelector('.shared-routine-preview')?.textContent).toContain(
      'Tab/notation text is included',
    )
    expect(JSON.parse(storage.get('guitar-practice-routines') ?? '[]')).toHaveLength(
      previousRoutines.length,
    )

    clickButton('Add as new routine')

    const importedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]')
    const importedRoutine = importedRoutines.find(
      (routine: { name: string }) => routine.name === 'Shared focus',
    )
    const importedExercises = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]')
    const importedSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]')
    expect(importedRoutines).toHaveLength(previousRoutines.length + 1)
    expect(importedExercises).toHaveLength(previousExercises.length + 1)
    expect(importedSongs).toHaveLength(previousSongs.length + 1)
    expect(importedExercises[0].id).not.toBe('shared-exercise-id')
    expect(importedSongs[0].id).not.toBe('shared-song-id')
    expect(importedRoutine.items[0].exerciseId).toBe(importedExercises[0].id)
    expect(importedRoutine.items[1].songId).toBe(importedSongs[0].id)
    expect(importedSongs[0].tab).toBe('E|--0--|')
    expect(importedRoutine.pauseAtItemEnd).toBe(true)
  })

  it('rejects an invalid shared routine without changing saved app data', async () => {
    const previousExercises = storage.get('guitar-practice-exercises')
    const previousSongs = storage.get('guitar-practice-songs')
    const previousRoutines = storage.get('guitar-practice-routines')

    await importSharedRoutineFile({ format: 'unknown', version: 1 })

    expect(container.querySelector('.shared-routine-preview')).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'not a shared practice routine file',
    )
    expect(storage.get('guitar-practice-exercises')).toBe(previousExercises)
    expect(storage.get('guitar-practice-songs')).toBe(previousSongs)
    expect(storage.get('guitar-practice-routines')).toBe(previousRoutines)
  })

  it('requires an explicit target when replacing a routine and preserves its identity', async () => {
    const existingRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]')
    const existingRoutine = existingRoutines[0]

    await importSharedRoutineFile()
    const replaceButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Replace selected routine',
    )
    expect(replaceButton?.disabled).toBe(true)

    const target = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Routine to replace"]',
    )
    if (!target) {
      throw new Error('Could not find the routine replacement selector')
    }
    act(() => {
      target.value = existingRoutine.id
      target.dispatchEvent(new Event('change', { bubbles: true }))
    })
    clickButton('Replace selected routine')

    const updatedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]')
    const updatedRoutine = updatedRoutines.find(
      (routine: { id: string }) => routine.id === existingRoutine.id,
    )
    expect(updatedRoutines).toHaveLength(existingRoutines.length)
    expect(updatedRoutine.name).toBe('Shared focus')
    expect(updatedRoutine.id).toBe(existingRoutine.id)
    expect(updatedRoutine.isDefault).toBe(existingRoutine.isDefault)
    expect(updatedRoutine.enjoymentRating).toBe(existingRoutine.enjoymentRating)
    expect(updatedRoutine.items[0].exerciseId).not.toBe('shared-exercise-id')
    expect(JSON.parse(storage.get('guitar-practice-history') ?? '[]')).toEqual([])
  })

  it('recovers from structurally invalid saved routines and offers a recovery download', () => {
    act(() => root.unmount())
    storage.set('guitar-practice-routines', JSON.stringify([{ id: 'broken' }]))
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Some saved data could not be loaded',
    )
    clickButton('Routines')
    expect(container.querySelector('.routine-card h3')?.textContent).toBe('20-minute practice')
    expect(Array.from(container.querySelectorAll('button')).some(
      (button) => button.textContent?.trim() === 'Download recovery data',
    )).toBe(true)

    const recoveryData = JSON.parse(storage.get('guitar-practice-recovery-data') ?? '[]')
    expect(recoveryData).toContainEqual({
      key: 'guitar-practice-routines',
      label: 'Routines',
      raw: JSON.stringify([{ id: 'broken' }]),
    })
  })

  it('preserves malformed recovery storage as downloadable recovery data', () => {
    act(() => root.unmount())
    const malformedRecovery = JSON.stringify({ legacyEntries: ['keep this data'] })
    storage.set('guitar-practice-recovery-data', malformedRecovery)
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Some saved data could not be loaded',
    )
    expect(JSON.parse(storage.get('guitar-practice-recovery-data') ?? '[]')).toContainEqual({
      key: 'guitar-practice-recovery-data',
      label: 'Recovery data',
      raw: malformedRecovery,
    })
  })

  it('normalizes a stale selected-routine id to the first available routine', () => {
    act(() => root.unmount())
    storage.set('guitar-practice-selected-routine', JSON.stringify('missing-routine'))
    root = createRoot(container)
    act(() => root.render(<App />))

    expect(storage.get('guitar-practice-selected-routine')).toBe(JSON.stringify('starter-20'))
  })

  it('selects and starts a routine from the routine list or dashboard', () => {
    clickButton('routines')
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Evening technique reset"]',
    )

    if (!nameInput) {
      throw new Error('Could not find the new routine name input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Focused practice')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add routine')

    const newRoutineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('Focused practice'),
    )
    const makeDefaultButton = Array.from(newRoutineCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Make default',
    )

    if (!makeDefaultButton) {
      throw new Error('Could not find the make-default button')
    }

    act(() => makeDefaultButton.click())
    expect(makeDefaultButton.textContent?.trim()).toBe('Current default')
    expect(makeDefaultButton.disabled).toBe(true)

    const exerciseSelect = newRoutineCard?.querySelector<HTMLSelectElement>(
      'select[aria-label="Add exercise to Focused practice"]',
    )

    if (!exerciseSelect) {
      throw new Error('Could not find the new routine exercise selector')
    }

    act(() => {
      exerciseSelect.value = 'warmup-1'
      exerciseSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expandRoutineCard('20-minute practice')
    const starterRoutineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('20-minute practice'),
    )
    const selectStarterButton = Array.from(starterRoutineCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Select routine',
    )

    if (!selectStarterButton) {
      throw new Error('Could not find the starter routine selection button')
    }

    act(() => selectStarterButton.click())
    expect(selectStarterButton.textContent?.trim()).toBe('Selected')
    expect(container.querySelector('.session-panel')).toBeNull()

    clickButton('dashboard')
    const routinePicker = container.querySelector<HTMLSelectElement>('select[aria-label="Practice routine"]')

    if (!routinePicker) {
      throw new Error('Could not find the dashboard routine selector')
    }

    const focusedRoutineOption = Array.from(routinePicker.options).find(
      (option) => option.textContent?.trim() === 'Focused practice',
    )

    if (!focusedRoutineOption) {
      throw new Error('Could not find the new routine in the dashboard selector')
    }

    act(() => {
      routinePicker.value = focusedRoutineOption.value
      routinePicker.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(container.querySelector('.routine-preview h3')?.textContent).toBe('Focused practice')
    clickButton('Practice selected routine')

    expect(container.querySelector('.session-panel h2')?.textContent).toBe('Focused practice')
    expect(container.querySelector('.session-main-card h3')?.textContent).toBe('Finger warm-up')
  })

  it('rewinds the routine cursor without erasing elapsed practice time', async () => {
    clickButton('Start practice')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60_000)
    })
    clickButton('Previous')

    expect(container.querySelector('.timer-card strong')?.textContent).toBe('15:00')
    clickButton('Finish')
    clickButton('history')

    expect(container.querySelector('.history-row')?.textContent).toContain('6 min')
    expect(container.querySelector('.history-row')?.textContent).toContain('Planned 20 min')
  })

  it('keeps the started session plan when its routine is edited', () => {
    clickButton('Start practice')
    clickButton('routines')
    expandRoutineCard('20-minute practice')

    const routineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('20-minute practice'),
    )
    const durationInput = routineCard?.querySelector('input[type="number"]')

    if (!(durationInput instanceof HTMLInputElement)) {
      throw new Error('Could not find the starter routine duration input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      setValue?.call(durationInput, '12')
      durationInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    clickButton('Return to practice')
    expect(container.querySelector('.session-meta')?.textContent).toContain('20 min routine')
    expect(container.querySelector('.session-meta')?.textContent).toContain('5 min current item')
  })

  it('renames a routine without changing an active session snapshot', () => {
    clickButton('Start practice')
    clickButton('Routines')
    expandRoutineCard('20-minute practice')

    const routineCard = container.querySelector<HTMLElement>(
      '.routine-card[data-routine-id="starter-20"]',
    )
    const renameButton = routineCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rename routine 20-minute practice"]',
    )
    if (!routineCard || !renameButton) {
      throw new Error('Could not find the routine rename control')
    }

    act(() => renameButton.click())
    const nameInput = routineCard.querySelector<HTMLInputElement>(
      'input[aria-label="Routine name for 20-minute practice"]',
    )
    if (!nameInput) {
      throw new Error('Could not find the routine name input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, '  Focused practice  ')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => routineCard.querySelector<HTMLButtonElement>(
      'button[aria-label="Save routine name for 20-minute practice"]',
    )?.click())

    expect(routineCard.querySelector('h3')?.textContent).toBe('Focused practice')
    const savedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
      name: string
    }>
    expect(savedRoutines.find((routine) => routine.id === 'starter-20')?.name)
      .toBe('Focused practice')
    expect(container.querySelector('.session-indicator')?.textContent)
      .toContain('20-minute practice')

    const renamedCard = container.querySelector<HTMLElement>(
      '.routine-card[data-routine-id="starter-20"]',
    )
    act(() => renamedCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rename routine Focused practice"]',
    )?.click())
    const renamedInput = renamedCard?.querySelector<HTMLInputElement>(
      'input[aria-label="Routine name for Focused practice"]',
    )
    if (!renamedInput) {
      throw new Error('Could not find the renamed routine name input')
    }
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(renamedInput, '   ')
      renamedInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(renamedCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Save routine name for Focused practice"]',
    )?.disabled).toBe(true)
    const cancelRename = Array.from(renamedCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel rename',
    )
    act(() => cancelRename?.click())
    expect(renamedCard?.querySelector('h3')?.textContent).toBe('Focused practice')
  })

  it('duplicates a routine with fresh item IDs and without making it default', () => {
    clickButton('Routines')
    expandRoutineCard('20-minute practice')
    const sourceCard = container.querySelector<HTMLElement>(
      '.routine-card[data-routine-id="starter-20"]',
    )
    const sourceRating = sourceCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Rate 20-minute practice enjoyment 4 out of 5 stars"]',
    )
    const sourceDifficulty = sourceCard?.querySelector<HTMLSelectElement>(
      'select[aria-label="Current difficulty for 20-minute practice"]',
    )
    const pauseSetting = sourceCard?.querySelector<HTMLInputElement>(
      'input[aria-label="Pause at item end for 20-minute practice"]',
    )
    if (!sourceCard || !sourceRating || !sourceDifficulty || !pauseSetting) {
      throw new Error('Could not find source routine controls')
    }
    act(() => {
      sourceRating.click()
      sourceDifficulty.value = 'Hard'
      sourceDifficulty.dispatchEvent(new Event('change', { bubbles: true }))
      pauseSetting.click()
    })

    const source = JSON.parse(storage.get('guitar-practice-routines') ?? '[]')
      .find((routine: { id: string }) => routine.id === 'starter-20') as {
        items: Array<{ id: string; exerciseId?: string; duration: number }>
        enjoymentRating?: number
        difficulty?: string
        pauseAtItemEnd?: boolean
      }
    act(() => sourceCard.querySelector<HTMLButtonElement>(
      'button[aria-label="Duplicate routine 20-minute practice"]',
    )?.click())

    const savedRoutines = JSON.parse(storage.get('guitar-practice-routines') ?? '[]') as Array<{
      id: string
      name: string
      description: string
      isDefault?: boolean
      pauseAtItemEnd?: boolean
      enjoymentRating?: number
      difficulty?: string
      items: Array<{ id: string; exerciseId?: string; duration: number }>
    }>
    const duplicate = savedRoutines.find((routine) => routine.name === '20-minute practice (Copy)')

    expect(duplicate).toMatchObject({
      description: 'Quick, balanced routine for a focused daily session.',
      isDefault: false,
      pauseAtItemEnd: true,
      enjoymentRating: 4,
      difficulty: 'Hard',
    })
    expect(duplicate?.id).not.toBe('starter-20')
    expect(duplicate?.items.every(
      ({ id }) => !source.items.some((sourceItem) => sourceItem.id === id),
    )).toBe(true)
    expect(duplicate?.items.map(({ exerciseId, duration }) => ({ exerciseId, duration })))
      .toEqual(source.items.map(({ exerciseId, duration }) => ({ exerciseId, duration })))
    expect(savedRoutines.find((routine) => routine.id === 'starter-20')?.isDefault).toBe(true)
    expect(storage.get('guitar-practice-selected-routine')).toBe('"starter-20"')
  })

  it('keeps a running session available after its source routine is deleted', () => {
    clickButton('Start practice')
    clickButton('routines')
    expandRoutineCard('20-minute practice')

    const routineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('20-minute practice'),
    )
    const deleteButton = Array.from(routineCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Delete',
    )

    if (!deleteButton) {
      throw new Error('Could not find the starter routine delete button')
    }

    act(() => deleteButton.click())

    clickButton('Return to practice')
    expect(container.querySelector('.session-panel h2')?.textContent).toBe('20-minute practice')
    expect(container.querySelector('.session-meta')?.textContent).toContain('20 min routine')
    expect(container.querySelector('.session-main-card h3')?.textContent).toBe('Finger warm-up')
  })

  it('keeps the current exercise details when its library entry is edited', () => {
    clickButton('Start practice')
    clickButton('library')

    const exerciseCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Finger warm-up'),
    )
    const editButton = Array.from(exerciseCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Edit',
    )

    if (!editButton) {
      throw new Error('Could not find the warm-up exercise edit button')
    }

    act(() => editButton.click())
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Alternate picking drills"]',
    )

    if (!nameInput) {
      throw new Error('Could not find the exercise name input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Changed warm-up')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Update exercise')

    clickButton('Return to practice')
    expect(container.querySelector('.session-main-card h3')?.textContent).toBe('Finger warm-up')
  })

  it('records automatic completion once when a timer tick catches up', async () => {
    clickButton('Start practice')
    act(() => vi.setSystemTime(new Date('2026-01-01T12:20:00.000Z')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    clickButton('history')

    expect(container.querySelector('.history-row')?.textContent).toContain('20 min')
    clickButton('dashboard')
    clickButton('Finish')
    clickButton('history')
    expect(container.querySelectorAll('.history-row')).toHaveLength(1)
  })

  it('starts a short inspiration suggestion without requiring a saved routine', () => {
    clickButton('Inspire me')

    expect(container.querySelector('.suggestion-preview')?.textContent).toContain('10 min')
    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Suggested sessions per week"]',
    )?.value).toBe('3')

    clickButton('Start suggested session')

    expect(container.querySelector('.session-panel h2')?.textContent).toBe('10-minute balanced practice')
    expect(container.querySelector('.session-meta')?.textContent).toContain('10 min routine')
  })

  it('opens inspiration from the routines view without hiding the routine list', () => {
    clickButton('Routines')
    clickButton('Get inspired')

    expect(container.querySelector('.inspiration-panel')).not.toBeNull()
    expect(container.querySelector('.routine-list')).not.toBeNull()
    expect(container.querySelector<HTMLSelectElement>(
      'select[aria-label="Suggestion session length"]',
    )?.value).toBe('10')
  })

  it('includes song difficulty when searching the song library', () => {
    clickButton('Songs')
    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search song library"]',
    )
    if (!searchInput) {
      throw new Error('Could not find the song search input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(searchInput, 'Beginner')
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const visibleTitles = Array.from(container.querySelectorAll('.song-card h3'))
      .map((heading) => heading.textContent)
    expect(visibleTitles).toEqual([
      'Sample rhythm riff',
      'C major pentatonic scale',
      'A minor pentatonic scale',
      'E minor pentatonic scale',
      'G major pentatonic scale',
      'C major scale',
      'A natural minor scale',
      'A minor blues scale',
      'Chromatic 1-2-3-4 warm-up',
      'Spider walk finger independence',
      'Alternate-picking string run',
      'String-crossing accuracy',
      'Hammer-on control',
      'Pull-off control',
      'Slide accuracy',
      'Vibrato steadiness',
      'Palm-muted rhythm control',
    ])
  })

  it('creates and edits a song when tab/notation is blank', () => {
    clickButton('songs')

    const titleInput = container.querySelector<HTMLInputElement>('input[placeholder="Black Hole Sun"]')
    if (!titleInput) {
      throw new Error('Could not find the song title field')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(titleInput, 'Song without tab')
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    clickButton('Add song')

    const storedSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]')
    expect(storedSongs[0].title).toBe('Song without tab')
    expect(storedSongs[0].tab).toBe('')

    const songCard = container.querySelector<HTMLElement>(
      `.song-card[data-song-id="${storedSongs[0].id}"]`,
    )
    const songHeader = songCard?.querySelector<HTMLButtonElement>('.song-card-header')
    if (!songHeader) {
      throw new Error('Could not find the new song card')
    }
    act(() => songHeader.click())
    clickButton('Edit')
    clickButton('Update song')

    const updatedSongs = JSON.parse(storage.get('guitar-practice-songs') ?? '[]')
    expect(updatedSongs[0].title).toBe('Song without tab')
    expect(updatedSongs[0].tab).toBe('')
    expect(container.textContent).toContain('Song saved.')
  })

  it('removes a song from routines when deleting it', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    clickButton('songs')

    const titleInput = container.querySelector<HTMLInputElement>('input[placeholder="Black Hole Sun"]')
    if (!titleInput) {
      throw new Error('Could not find the song title field')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(titleInput, 'Routine song')
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const tabInput = container.querySelector<HTMLTextAreaElement>('.tab-editor')
    if (!tabInput) {
      throw new Error('Could not find the song tab field')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setValue?.call(tabInput, 'e|---0-2-0-2---|')
      tabInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    clickButton('Add song')
    clickButton('routines')
    expandRoutineCard('20-minute practice')

    const routineCard = Array.from(container.querySelectorAll('.routine-card')).find(
      (card) => card.textContent?.includes('20-minute practice'),
    )
    const addSongSelect = Array.from(routineCard?.querySelectorAll('select') ?? []).find(
      (select) => Array.from(select.options).some((option) => option.textContent?.trim() === 'Routine song'),
    )

    if (!addSongSelect) {
      throw new Error('Could not find the routine song selector')
    }

    const songOption = Array.from(addSongSelect.options).find(
      (option) => option.textContent?.trim() === 'Routine song',
    )

    if (!songOption) {
      throw new Error('Could not find the new song option')
    }

    act(() => {
      addSongSelect.value = songOption.value
      addSongSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(routineCard?.textContent).toContain('Routine song')
    expect(
      routineCard?.querySelector<HTMLInputElement>('.routine-item-row input[type="number"]:last-of-type')
        ?.value,
    ).toBe('5')

    clickButton('songs')
    const songCard = Array.from(container.querySelectorAll('.card')).find(
      (card) => card.textContent?.includes('Routine song'),
    )
    const songHeader = songCard?.querySelector<HTMLButtonElement>('.song-card-header')
    if (!songHeader) {
      throw new Error('Could not find the song card header')
    }
    act(() => songHeader.click())

    const deleteButton = Array.from(songCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Delete',
    )

    if (!deleteButton) {
      throw new Error('Could not find the song delete button')
    }

    act(() => deleteButton.click())

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('used in 1 routine'))

    clickButton('routines')
    expect(container.querySelector('.routine-card')?.textContent).not.toContain('Routine song')
  })

  it('collapses and expands song cards one at a time', () => {
    clickButton('songs')

    const firstSongCard = container.querySelector<HTMLElement>('.song-card[data-song-id="song-1"]')
    const secondSongCard = container.querySelector<HTMLElement>('.song-card[data-song-id="song-2"]')
    const firstHeader = firstSongCard?.querySelector<HTMLButtonElement>('.song-card-header')
    const secondHeader = secondSongCard?.querySelector<HTMLButtonElement>('.song-card-header')

    if (!firstSongCard || !secondSongCard || !firstHeader || !secondHeader) {
      throw new Error('Could not find the starter song cards')
    }

    expect(firstHeader.getAttribute('aria-expanded')).toBe('false')
    expect(firstSongCard.querySelector('.tab-block')).toBeNull()
    expect(firstSongCard.textContent).toContain('Sample rhythm riff')
    expect(firstSongCard.textContent).toContain('Practice set')

    act(() => firstHeader.click())
    expect(firstHeader.getAttribute('aria-expanded')).toBe('true')
    expect(firstSongCard.querySelector('.tab-block')).not.toBeNull()

    act(() => secondHeader.click())
    expect(firstHeader.getAttribute('aria-expanded')).toBe('false')
    expect(firstSongCard.querySelector('.tab-block')).toBeNull()
    expect(secondHeader.getAttribute('aria-expanded')).toBe('true')
    expect(secondSongCard.querySelector('.tab-block')).not.toBeNull()

    act(() => secondHeader.click())
    expect(secondHeader.getAttribute('aria-expanded')).toBe('false')
    expect(secondSongCard.querySelector('.tab-block')).toBeNull()
  })

  it('lets the user change focus and length, then save the suggestion as a routine', () => {
    clickButton('Inspire me')
    const lengthSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Suggestion session length"]',
    )
    const focusSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Suggestion focus"]',
    )

    if (!lengthSelect || !focusSelect) {
      throw new Error('Could not find the inspiration controls')
    }

    act(() => {
      lengthSelect.value = '20'
      lengthSelect.dispatchEvent(new Event('change', { bubbles: true }))
      focusSelect.value = 'theory-ear'
      focusSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    clickButton('Generate another')

    expect(container.querySelector('.suggestion-preview')?.textContent).toContain('20 min')
    expect(container.querySelector('.suggestion-cadence')?.textContent).toContain('3 times this week')
    clickButton('Save as routine')

    const itemDuration = container.querySelector<HTMLInputElement>('input[aria-label="Minutes for Finger warm-up"]')
    if (!itemDuration) {
      throw new Error('Could not find the suggested item duration input')
    }

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(itemDuration, '8')
      itemDuration.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Save as routine')
    clickButton('routines')

    expect(container.querySelectorAll('.routine-card')).toHaveLength(24)
    expect(Array.from(container.querySelectorAll('.routine-card')).some(
      (card) => card.textContent?.includes('20-minute theory and ear practice'),
    )).toBe(true)
  })

  // A1 — Storage write error handling
  it('shows a storage write error when localStorage.setItem throws', () => {
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: () => { throw new DOMException('QuotaExceededError') },
    })

    // Trigger a state change that calls setItem — create an exercise
    clickButton('library')
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Alternate picking drills"]',
    )
    if (!nameInput) {
      throw new Error('Could not find the exercise name field')
    }
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(nameInput, 'Quota test exercise')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton('Add exercise')

    expect(container.textContent).toContain('could not be saved')
  })

  // A2 — Timer refresh-recovery tests
  it('recovers a running session and continues from elapsed time after a reload', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const routine = {
      id: 'r-reload',
      name: 'Reload test',
      description: '',
      items: [{ id: 'i1', exerciseId: 'warmup-1', duration: 10 }],
    }
    const session = {
      id: 's-reload',
      routineId: 'r-reload',
      routineName: 'Reload test',
      totalMs: 10 * 60 * 1000,
      status: 'running',
      elapsedMs: 0,
      positionOffsetMs: 0,
      lastUpdatedAt: fiveMinutesAgo,
      items: [{ id: 'i1', exerciseId: 'warmup-1', duration: 10 }],
    }
    storage.set('guitar-practice-routines', JSON.stringify([routine]))
    storage.set('guitar-practice-active-session', JSON.stringify(session))

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))

    // 5 of 10 minutes elapsed → ~5 minutes remaining
    expect(container.textContent).toMatch(/5:\d\d/)
  })

  it('completes a session that was nearly finished at reload time', () => {
    const tenSecondsAgo = Date.now() - 10 * 1000
    const routine = {
      id: 'r-almost',
      name: 'Almost done',
      description: '',
      items: [{ id: 'i1', exerciseId: 'warmup-1', duration: 10 }],
    }
    const session = {
      id: 's-almost',
      routineId: 'r-almost',
      routineName: 'Almost done',
      totalMs: 10 * 60 * 1000,
      status: 'running',
      elapsedMs: 9 * 60 * 1000 + 50 * 1000, // 9m50s elapsed; 10s more crosses the line
      positionOffsetMs: 0,
      lastUpdatedAt: tenSecondsAgo,
      items: [{ id: 'i1', exerciseId: 'warmup-1', duration: 10 }],
    }
    storage.set('guitar-practice-routines', JSON.stringify([routine]))
    storage.set('guitar-practice-active-session', JSON.stringify(session))

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))
    act(() => vi.advanceTimersByTime(2000))

    const history = JSON.parse(storage.get('guitar-practice-history') ?? '[]') as unknown[]
    expect(history).toHaveLength(1)
    // Session stays in storage as 'completed' until the user dismisses it
    const savedSession = JSON.parse(storage.get('guitar-practice-active-session') ?? 'null') as { status: string } | null
    expect(savedSession?.status).toBe('completed')
  })

  // A3 — Empty-routine guard
  it('Practice selected routine button is disabled when the selected routine has no items', () => {
    const emptyRoutine = {
      id: 'r-empty',
      name: 'Empty routine',
      description: '',
      items: [],
      isDefault: true,
    }
    storage.set('guitar-practice-routines', JSON.stringify([emptyRoutine]))
    storage.set('guitar-practice-selected-routine', JSON.stringify('r-empty'))

    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<App />))

    const practiceButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim().toLowerCase() === 'practice selected routine',
    )
    expect(practiceButton?.disabled).toBe(true)
    expect(storage.get('guitar-practice-active-session')).toBeUndefined()
  })

  // A4 — Library delete safety
  it('preserves history records after deleting the exercise used in that session', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // The default "20-minute practice" routine uses warmup-1; start and complete it
    clickButton('Start practice')
    act(() => vi.advanceTimersByTime(21 * 60 * 1000))

    // Session should be complete — verify history written
    const historyBefore = JSON.parse(storage.get('guitar-practice-history') ?? '[]') as Array<{ routineName: string }>
    expect(historyBefore.length).toBeGreaterThan(0)

    // Now delete Finger warm-up from library
    clickButton('library')
    const exerciseCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Finger warm-up'),
    )
    const editButton = Array.from(exerciseCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Edit',
    )
    act(() => editButton?.click())
    const deleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Delete',
    )
    act(() => deleteButton?.click())

    const historyAfter = JSON.parse(storage.get('guitar-practice-history') ?? '[]') as Array<{ routineName: string }>
    expect(historyAfter.length).toBe(historyBefore.length)
    expect(historyAfter[0].routineName).toBe('20-minute practice')
  })

  it('shows a confirmation dialog when deleting an exercise used in a routine', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    clickButton('library')
    const exerciseCard = Array.from(container.querySelectorAll('.library-grid .card')).find(
      (card) => card.textContent?.includes('Finger warm-up'),
    )
    const editButton = Array.from(exerciseCard?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Edit',
    )
    act(() => editButton?.click())
    const deleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Delete',
    )
    act(() => deleteButton?.click())

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/routine/i))
    // Confirm was false — exercise should still exist
    const exercises = JSON.parse(storage.get('guitar-practice-exercises') ?? '[]') as Array<{ id: string }>
    expect(exercises.some((e) => e.id === 'warmup-1')).toBe(true)
  })

  // A5 — End-to-end backup round-trip
  it('exports a backup that round-trips all app data', async () => {
    // Seed representative data via storage before the import
    const exercises = [{ id: 'e1', name: 'Warm-up', category: 'Warm-up', description: '', defaultDuration: 5 }]
    const routines = [{ id: 'r1', name: 'Daily', description: '', items: [{ id: 'i1', exerciseId: 'e1', duration: 5 }] }]
    const history = [{ id: 'h1', routineName: 'Daily', actualMinutes: 5, plannedMinutes: 5, completedAt: new Date().toISOString() }]

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    clickButton('backup')

    // Import using the seeded data as a backup file
    const importInput = container.querySelector<HTMLInputElement>('.backup-actions input[type="file"]')
    if (!importInput) {
      throw new Error('Could not find the backup import input')
    }
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises,
      routines,
      songs: [],
      history,
      selectedRoutineId: 'r1',
      activeSession: null,
    }
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) })
    Object.defineProperty(importInput, 'files', { configurable: true, value: [file] })
    await act(async () => {
      importInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.backup-box .status-message')?.textContent)
      .toContain('Backup restored successfully')

    // Capture the JSON string when Blob is constructed during export
    const OriginalBlob = globalThis.Blob
    let capturedJSON = ''
    vi.stubGlobal('Blob', class extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options)
        if (Array.isArray(parts) && typeof parts[0] === 'string') {
          capturedJSON = parts[0] as string
        }
      }
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    clickButton('Export backup')

    expect(capturedJSON).toBeTruthy()
    const { importAppData } = await import('./data-backup')
    const restored = importAppData(capturedJSON)
    const restoredExercises = restored.exercises as Array<{ name: string }>
    const restoredRoutines = restored.routines as Array<{ name: string }>
    const restoredHistory = restored.history as Array<{ routineName: string }>
    expect(restoredExercises).toHaveLength(1)
    expect(restoredExercises[0].name).toBe('Warm-up')
    expect(restoredRoutines[0].name).toBe('Daily')
    expect(restoredHistory).toHaveLength(1)
    expect(restoredHistory[0].routineName).toBe('Daily')
  })
})
