import { useLayoutEffect, useRef, useState } from 'react'
import {
  getNoteAtFret,
  getTuningNoteName,
  MAX_FRET,
  type NoteSpelling,
} from './fretboard'
import {
  findInstrumentTuningPreset,
  type InstrumentProfile,
} from './instruments'

const FRETS = Array.from({ length: MAX_FRET + 1 }, (_, fret) => fret)
const VISIBLE_FRET_COUNT = 12
const FRET_CELL_WIDTH = 58
function FretboardExplorer({
  hidden,
  instrument,
  tuning,
}: {
  hidden: boolean
  instrument: InstrumentProfile
  tuning: readonly number[]
}) {
  const [spelling, setSpelling] = useState<NoteSpelling>('sharps')
  const [scrollFret, setScrollFret] = useState(0)
  const [visibleFretCount, setVisibleFretCount] = useState(VISIBLE_FRET_COUNT + 1)
  const fretboardScrollRef = useRef<HTMLDivElement>(null)
  const selectedPreset = findInstrumentTuningPreset(instrument, tuning)
  const tuningLabel = selectedPreset?.label ?? 'Custom tuning'
  const maxScrollFret = MAX_FRET + 1 - visibleFretCount

  useLayoutEffect(() => {
    const scrollContainer = fretboardScrollRef.current
    if (hidden || !scrollContainer) {
      return
    }

    const updateVisibleFretCount = () => {
      const stringLabelWidth = scrollContainer.querySelector('thead th')?.getBoundingClientRect().width ?? 0
      const fretCellWidth = scrollContainer.querySelector('tbody td')?.getBoundingClientRect().width ?? 0
      if (stringLabelWidth > 0 && fretCellWidth > 0) {
        const visibleCount = Math.max(
          1,
          Math.min(
            MAX_FRET + 1,
            Math.floor((scrollContainer.clientWidth - stringLabelWidth) / fretCellWidth),
          ),
        )
        setVisibleFretCount(visibleCount)
      }
    }

    updateVisibleFretCount()
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(updateVisibleFretCount)
    resizeObserver?.observe(scrollContainer)
    window.addEventListener('resize', updateVisibleFretCount)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateVisibleFretCount)
    }
  }, [hidden])

  const scrollToFret = (fret: number) => {
    const nextFret = Math.min(maxScrollFret, Math.max(0, fret))
    setScrollFret(nextFret)
    if (fretboardScrollRef.current) {
      const fretCellWidth = fretboardScrollRef.current
        .querySelector('tbody td')
        ?.getBoundingClientRect().width || FRET_CELL_WIDTH
      fretboardScrollRef.current.scrollLeft = nextFret * fretCellWidth
    }
  }

  const updateScrollFret = () => {
    const scrollContainer = fretboardScrollRef.current
    if (!scrollContainer) {
      return
    }
    const fretCellWidth = scrollContainer.querySelector('tbody td')
      ?.getBoundingClientRect().width || FRET_CELL_WIDTH
    setScrollFret(
      Math.min(
        maxScrollFret,
        Math.max(0, Math.round(scrollContainer.scrollLeft / fretCellWidth)),
      ),
    )
  }

  const visibleFretRange = scrollFret === 0
    ? `Open–${visibleFretCount - 1}`
    : `${scrollFret}–${scrollFret + visibleFretCount - 1}`

  return (
    <section className="panel fretboard-panel" hidden={hidden}>
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">Explore your instrument</p>
          <h2>Fretboard note explorer</h2>
          <p className="page-hero-description">
            {instrument.label} · {tuningLabel}. Strings follow standard tab order, with the highest string at the top and the lowest at the bottom. Use the slider or scroll the diagram horizontally to move along the neck.
          </p>
        </div>
      </header>

      <div className="fretboard-settings">
        <label>
          Note spelling
          <select
            aria-label="Note spelling"
            value={spelling}
            onChange={(event) => {
              if (event.target.value === 'sharps' || event.target.value === 'flats') {
                setSpelling(event.target.value)
              }
            }}
          >
            <option value="sharps">Sharps (C#)</option>
            <option value="flats">Flats (Db)</option>
          </select>
        </label>
      </div>

      <div
        ref={fretboardScrollRef}
        className="fretboard-scroll"
        role="region"
        aria-label={`${instrument.label} fretboard diagram, frets zero through ${MAX_FRET}`}
        tabIndex={0}
        onScroll={updateScrollFret}
      >
        <table className="fretboard-table">
          <caption>
            {instrument.label} notes in {tuningLabel}
          </caption>
          <thead>
            <tr>
              <th className="fretboard-string-heading" scope="col">String</th>
              {FRETS.map((fret) => (
                <th key={fret} scope="col" className={fret === 0 ? 'open-fret-heading' : ''}>
                  <span>{fret === 0 ? 'Open' : fret}</span>
                  {fret > 0 && (fret === 12 || fret === 3 || fret === 5 || fret === 7 || fret === 9) && (
                    <span className="fret-marker" aria-hidden="true">
                      {fret === 12 ? '••' : '•'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tuning
              .map((openNote, stringIndex) => ({ openNote, stringIndex }))
              .reverse()
              .map(({ openNote, stringIndex }) => (
                <tr key={instrument.stringLabels[stringIndex]}>
                  <th scope="row">
                    <span>{instrument.stringLabels[stringIndex]}</span>
                    <strong>{getTuningNoteName(openNote, spelling)}</strong>
                  </th>
                  {FRETS.map((fret) => (
                    <td key={fret} className={fret === 0 ? 'open-fret' : ''}>
                      <span className="fretboard-note">
                        {getNoteAtFret(openNote, fret, spelling)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="fretboard-position-control">
        <label htmlFor="fretboard-position">
          Scroll along the neck
          <span>Showing frets {visibleFretRange}</span>
        </label>
        <input
          id="fretboard-position"
          type="range"
          min="0"
          max={maxScrollFret}
          step="1"
          value={scrollFret}
          aria-label="Fretboard scroll"
          onChange={(event) => scrollToFret(Number(event.target.value))}
        />
        <div className="fretboard-range-labels" aria-hidden="true">
          <span>Open</span>
          <span>Fret {MAX_FRET}</span>
        </div>
      </div>
      <p className="fretboard-note-caption">
        The diagram shows frets 0–{MAX_FRET}. Note names repeat every 12 frets; scale and chord highlighting are not included.
      </p>
    </section>
  )
}

export default FretboardExplorer
