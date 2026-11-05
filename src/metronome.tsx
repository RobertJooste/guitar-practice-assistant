import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_METRONOME_BPM = 40
export const MAX_METRONOME_BPM = 240
export const DEFAULT_METRONOME_BPM = 100

const CLICK_LOOKAHEAD_SECONDS = 0.1
const SCHEDULER_INTERVAL_MS = 25
const TAP_TIMEOUT_MS = 2000
const TAP_INTERVAL_COUNT = 4

export type MetronomeState = {
  bpm: number
  setBpm: (bpm: number) => void
  isPlaying: boolean
  beat: number
  error: string
  start: () => Promise<void>
  stop: () => void
  tapTempo: () => void
}

export const useMetronome = (): MetronomeState => {
  const [bpm, setBpmState] = useState(DEFAULT_METRONOME_BPM)
  const [isPlaying, setIsPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [error, setError] = useState('')
  const bpmRef = useRef(bpm)
  const tapTimesRef = useRef<number[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<number | null>(null)
  const nextBeatTimeRef = useRef(0)
  const beatStartTimeoutRef = useRef<number | null>(null)
  const beatEndTimeoutRef = useRef<number | null>(null)

  const setBpm = useCallback((nextBpm: number) => {
    if (!Number.isInteger(nextBpm) || nextBpm < MIN_METRONOME_BPM || nextBpm > MAX_METRONOME_BPM) {
      return
    }

    bpmRef.current = nextBpm
    setBpmState(nextBpm)
    tapTimesRef.current = []
    setError('')
  }, [])

  const stop = useCallback(() => {
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current)
      schedulerRef.current = null
    }
    if (beatStartTimeoutRef.current !== null) {
      window.clearTimeout(beatStartTimeoutRef.current)
      beatStartTimeoutRef.current = null
    }
    if (beatEndTimeoutRef.current !== null) {
      window.clearTimeout(beatEndTimeoutRef.current)
      beatEndTimeoutRef.current = null
    }

    const audioContext = audioContextRef.current
    audioContextRef.current = null
    setIsPlaying(false)

    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => {
        setError('The metronome audio could not be closed cleanly. Try stopping it again.')
      })
    }
  }, [])

  const start = useCallback(async () => {
    if (schedulerRef.current !== null) {
      return
    }

    setError('')
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) {
      setError('Audio playback is not available in this browser.')
      return
    }

    let audioContext: AudioContext | null = null
    try {
      const context = new AudioContextConstructor()
      audioContext = context
      audioContextRef.current = context
      await context.resume()
      if (context.state !== 'running') {
        throw new Error('Audio playback did not start.')
      }

      nextBeatTimeRef.current = context.currentTime + 0.05
      setBeat(0)
      setIsPlaying(true)
      schedulerRef.current = window.setInterval(() => {
        while (
          nextBeatTimeRef.current <
          context.currentTime + CLICK_LOOKAHEAD_SECONDS
        ) {
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          const clickTime = nextBeatTimeRef.current

          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(1000, clickTime)
          gain.gain.setValueAtTime(0.0001, clickTime)
          gain.gain.exponentialRampToValueAtTime(0.35, clickTime + 0.001)
          gain.gain.exponentialRampToValueAtTime(0.0001, clickTime + 0.03)
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.start(clickTime)
          oscillator.stop(clickTime + 0.04)

          const pulseDelayMs = Math.max(
            0,
            (clickTime - context.currentTime) * 1000,
          )
          beatStartTimeoutRef.current = window.setTimeout(() => {
            beatStartTimeoutRef.current = null
            setBeat((previousBeat) => previousBeat + 1)
            if (beatEndTimeoutRef.current !== null) {
              window.clearTimeout(beatEndTimeoutRef.current)
              beatEndTimeoutRef.current = null
            }
            beatEndTimeoutRef.current = window.setTimeout(() => {
              beatEndTimeoutRef.current = null
              setBeat(0)
            }, 120)
          }, pulseDelayMs)
          nextBeatTimeRef.current += 60 / bpmRef.current
        }
      }, SCHEDULER_INTERVAL_MS)
    } catch (startError) {
      if (schedulerRef.current !== null) {
        window.clearInterval(schedulerRef.current)
        schedulerRef.current = null
      }
      audioContextRef.current = null
      setIsPlaying(false)
      setError('The metronome could not start. Check that audio is enabled and try again.')
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close().catch(() => {
          console.error('Could not close the audio context after metronome startup failed.', startError)
        })
      }
    }
  }, [])

  const tapTempo = useCallback(() => {
    const now = Date.now()
    const previousTap = tapTimesRef.current.at(-1)
    const interval = previousTap === undefined ? 0 : now - previousTap
    const taps = interval > TAP_TIMEOUT_MS ? [] : tapTimesRef.current
    taps.push(now)
    tapTimesRef.current = taps.slice(-(TAP_INTERVAL_COUNT + 1))

    if (
      interval >= 250 &&
      interval <= TAP_TIMEOUT_MS &&
      taps.length >= 2
    ) {
      const intervals = taps.slice(1).map((tap, index) => tap - taps[index])
      const averageInterval = intervals.reduce((total, value) => total + value, 0) /
        intervals.length
      const tappedBpm = Math.min(
        MAX_METRONOME_BPM,
        Math.max(MIN_METRONOME_BPM, Math.round(60_000 / averageInterval)),
      )
      bpmRef.current = tappedBpm
      setBpmState(tappedBpm)
      setError('')
    }
  }, [])

  useEffect(() => () => {
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current)
    }
    if (beatStartTimeoutRef.current !== null) {
      window.clearTimeout(beatStartTimeoutRef.current)
    }
    if (beatEndTimeoutRef.current !== null) {
      window.clearTimeout(beatEndTimeoutRef.current)
    }
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((closeError: unknown) => {
        console.error('Could not close the audio context after leaving the metronome.', closeError)
      })
    }
  }, [])

  return { bpm, setBpm, isPlaying, beat, error, start, stop, tapTempo }
}
