// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MetronomeControls from './MetronomeControls'
import { useMetronome } from './metronome'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

type MockOscillator = {
  type: string
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> }
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

class MockAudioContext {
  static instances: MockAudioContext[] = []

  state = 'running'
  destination = {}
  private readonly origin = Date.now()
  readonly oscillators: MockOscillator[] = []
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {
    this.state = 'closed'
  })

  get currentTime() {
    return (Date.now() - this.origin) / 1000
  }

  constructor() {
    MockAudioContext.instances.push(this)
  }

  createOscillator(): MockOscillator {
    const oscillator = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
  }
}

const MetronomeHarness = () => <MetronomeControls {...useMetronome()} />

describe('practice metronome', () => {
  let container: HTMLDivElement
  let root: Root
  let originalAudioContext: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))
    MockAudioContext.instances = []
    originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<MetronomeHarness />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    if (originalAudioContext) {
      Object.defineProperty(window, 'AudioContext', originalAudioContext)
    } else {
      Reflect.deleteProperty(window, 'AudioContext')
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('schedules short audible clicks with Web Audio and closes it when stopped', async () => {
    const startButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Start metronome"]',
    )
    if (!startButton) {
      throw new Error('Could not find the start metronome button')
    }
    await act(async () => {
      startButton.click()
      await Promise.resolve()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60)
    })
    const audioContext = MockAudioContext.instances[0]
    expect(audioContext.resume).toHaveBeenCalledOnce()
    expect(container.querySelector('.metronome-beat')?.getAttribute('data-active'))
      .toBe('true')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120)
    })
    expect(container.querySelector('.metronome-beat')?.getAttribute('data-active'))
      .toBe('false')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(470)
    })
    expect(audioContext.oscillators.length).toBeGreaterThanOrEqual(2)
    expect(audioContext.oscillators[0].start).toHaveBeenCalledWith(
      expect.any(Number),
    )
    expect(container.querySelector('[role="status"]')?.textContent)
      .toBe('Playing at 100 BPM')

    const stopButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Stop metronome"]',
    )
    if (!stopButton) {
      throw new Error('Could not find the stop metronome button')
    }
    await act(async () => {
      stopButton.click()
      await Promise.resolve()
    })
    expect(audioContext.close).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Stopped')
  })
})
