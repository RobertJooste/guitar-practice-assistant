import { useLayoutEffect, useRef, useState } from 'react'
import { getNoteNameForPitchClass, MAX_FRET } from './fretboard'
import {
  getScaleNoteNames,
  getScaleNotesInRange,
  getPentatonicPosition,
  isPentatonicScale,
  isScaleId,
  SCALE_DEFINITIONS,
  type ScaleId,
} from './scales'
import {
  findInstrumentTuningPreset,
  type InstrumentProfile,
} from './instruments'

const KEYS = Array.from({ length: 12 }, (_, pitchClass) => pitchClass)
const VISIBLE_FRET_COUNT = 12
const FRET_CELL_WIDTH = 58
type ScaleView = 'box' | 'zoomed-out'

function ScalePractice({
  hidden,
  instrument,
  tuning,
}: {
  hidden: boolean
  instrument: InstrumentProfile
  tuning: readonly number[]
}) {
  const [keyPitchClass, setKeyPitchClass] = useState(0)
  const [scaleId, setScaleId] = useState<ScaleId>('minor-pentatonic')
  const [position, setPosition] = useState(1)
  const [scaleView, setScaleView] = useState<ScaleView>('box')
  const [scrollFret, setScrollFret] = useState(0)
  const [visibleFretCount, setVisibleFretCount] = useState(VISIBLE_FRET_COUNT + 1)
  const scaleScrollRef = useRef<HTMLDivElement>(null)
  const scaleNoteNames = getScaleNoteNames(keyPitchClass, scaleId)
  const keyName = scaleNoteNames[keyPitchClass]
  const pentatonic = isPentatonicScale(scaleId)
  const selectedPosition = pentatonic
    ? getPentatonicPosition(
      keyPitchClass,
      scaleId === 'major-pentatonic' ? 'major' : 'minor',
      position,
      tuning,
    )
    : undefined
  const visibleStartFret = selectedPosition && scaleView === 'box'
    ? selectedPosition.startFret
    : selectedPosition
      ? Math.max(0, Math.min(selectedPosition.startFret - 4, MAX_FRET - 11))
      : 0
  const visibleEndFret = selectedPosition && scaleView === 'box'
    ? selectedPosition.endFret
    : selectedPosition
      ? Math.min(visibleStartFret + 11, MAX_FRET)
      : MAX_FRET
  const visibleStrings = selectedPosition && scaleView === 'box'
    ? selectedPosition.strings
    : getScaleNotesInRange(
      keyPitchClass,
      scaleId,
      visibleStartFret,
      visibleEndFret,
      tuning,
    )
  const scaleLabel = SCALE_DEFINITIONS[scaleId].label
  const tuningLabel = findInstrumentTuningPreset(instrument, tuning)?.label ?? 'Custom tuning'
  const visibleFrets = Array.from(
    { length: visibleEndFret - visibleStartFret + 1 },
    (_, index) => visibleStartFret + index,
  )
  const maxScrollFret = MAX_FRET + 1 - visibleFretCount
  const visibleFretRange = scrollFret === 0
    ? `Open–${Math.min(visibleFretCount - 1, MAX_FRET)}`
    : `${scrollFret}–${Math.min(scrollFret + visibleFretCount - 1, MAX_FRET)}`

  useLayoutEffect(() => {
    const scrollContainer = scaleScrollRef.current
    if (hidden || selectedPosition || !scrollContainer) {
      return
    }

    const updateVisibleFretCount = () => {
      const stringLabelWidth = scrollContainer
        .querySelector('thead th')
        ?.getBoundingClientRect().width ?? 0
      const fretCellWidth = scrollContainer
        .querySelector('tbody td')
        ?.getBoundingClientRect().width ?? 0
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
  }, [hidden, selectedPosition])

  const scrollToFret = (fret: number) => {
    const nextFret = Math.min(maxScrollFret, Math.max(0, fret))
    setScrollFret(nextFret)
    if (scaleScrollRef.current) {
      const fretCellWidth = scaleScrollRef.current
        .querySelector('tbody td')
        ?.getBoundingClientRect().width || FRET_CELL_WIDTH
      scaleScrollRef.current.scrollLeft = nextFret * fretCellWidth
    }
  }

  const updateScrollFret = () => {
    const scrollContainer = scaleScrollRef.current
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

  return (
    <section className="panel pentatonic-panel" hidden={hidden}>
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">Find your sound</p>
          <h2>Scale practice</h2>
          <p className="page-hero-description">
            Choose a key and scale to see its notes on the {instrument.label} in {tuningLabel}.
            Strings follow standard tab order, with the highest string at the top and the lowest at the bottom.
            Pentatonic scales show box positions; seven-note scales show the full neck from open to fret {MAX_FRET}, which you can scroll.
          </p>
        </div>
      </header>

      <div className="pentatonic-settings">
        <label>
          Key
          <select
            aria-label="Scale key"
            value={keyPitchClass}
            onChange={(event) => setKeyPitchClass(Number(event.target.value))}
          >
            {KEYS.map((pitchClass) => (
              <option key={pitchClass} value={pitchClass}>
                {getScaleNoteNames(pitchClass, scaleId)[pitchClass]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Scale
          <select
            aria-label="Scale"
            value={scaleId}
            onChange={(event) => {
              if (isScaleId(event.target.value)) {
                setScaleId(event.target.value)
              }
            }}
          >
            <optgroup label="Pentatonic">
              <option value="major-pentatonic">Major pentatonic</option>
              <option value="minor-pentatonic">Minor pentatonic</option>
            </optgroup>
            <optgroup label="Major-scale modes">
              <option value="major">Major (Ionian)</option>
              <option value="dorian">Dorian</option>
              <option value="phrygian">Phrygian</option>
              <option value="lydian">Lydian</option>
              <option value="mixolydian">Mixolydian</option>
              <option value="natural-minor">Natural minor (Aeolian)</option>
              <option value="locrian">Locrian</option>
            </optgroup>
          </select>
        </label>

        {pentatonic && (
          <label>
            Box position
            <select
              aria-label="Pentatonic box position"
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5].map((item) => (
                <option key={item} value={item}>Position {item}</option>
              ))}
            </select>
          </label>
        )}

        {pentatonic && (
          <label>
            Fretboard view
            <select
              aria-label="Pentatonic fretboard view"
              value={scaleView}
              onChange={(event) => {
                if (event.target.value === 'box' || event.target.value === 'zoomed-out') {
                  setScaleView(event.target.value)
                }
              }}
            >
              <option value="box">Box (4–5 frets)</option>
              <option value="zoomed-out">Zoom out (up to 12 frets)</option>
            </select>
          </label>
        )}

      </div>

      <div className="pentatonic-summary">
        <strong>
          {keyName} {scaleLabel}
          {selectedPosition && ` · Position ${position}`}
        </strong>
        <span>
          {selectedPosition
            ? `Position frets ${selectedPosition.startFret}–${selectedPosition.endFret}`
            : `Showing frets ${visibleFretRange}`}
          {selectedPosition && scaleView === 'zoomed-out' &&
            ` · Showing frets ${visibleStartFret}–${visibleEndFret}`}
        </span>
      </div>

      <div
        ref={selectedPosition ? undefined : scaleScrollRef}
        className={`fretboard-scroll pentatonic-board${selectedPosition && scaleView === 'zoomed-out' ? ' zoomed-out' : ''}${selectedPosition ? '' : ' full-range'}`}
        role="region"
        aria-label={`${keyName} ${scaleLabel}${selectedPosition ? ` position ${position}` : ''} fretboard, frets ${selectedPosition ? visibleStartFret : 0} through ${visibleEndFret}`}
        tabIndex={0}
        onScroll={selectedPosition ? undefined : updateScrollFret}
      >
        <table className="fretboard-table pentatonic-table">
          <caption>
            {keyName} {scaleLabel}{selectedPosition ? `, position ${position}` : ''}; {instrument.label}, {tuningLabel}
          </caption>
          <thead>
            <tr>
              <th className="fretboard-string-heading" scope="col">String</th>
              {visibleFrets.map((fret) => (
                <th key={fret} scope="col">{fret === 0 ? 'Open' : fret}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStrings
              .map((string, stringIndex) => ({ string, stringIndex }))
              .reverse()
              .map(({ string, stringIndex }) => {
                const stringLabel = instrument.stringLabels[stringIndex]
                return (
                  <tr key={stringLabel}>
                    <th scope="row">
                      <span>{stringLabel}</span>
                      <strong>{getNoteNameForPitchClass(string.openStringMidiNote)}</strong>
                    </th>
                    {visibleFrets.map((fret) => {
                      const note = string.notes.find((item) => item.fret === fret)
                      const noteLabel = note
                        ? `${note.name}${note.isRoot ? ', root' : ''}`
                        : 'not in scale'
                      return (
                        <td key={fret} aria-label={`${stringLabel}, fret ${fret}: ${noteLabel}`}>
                          {note && (
                            <span className={`fretboard-note${note.isRoot ? ' pentatonic-root' : ''}`}>
                              {note.name}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {!selectedPosition && (
        <div className="fretboard-position-control scale-position-control">
          <label htmlFor="scale-fretboard-position">
            Scroll along the neck
            <span>Showing frets {visibleFretRange}</span>
          </label>
          <input
            id="scale-fretboard-position"
            type="range"
            min="0"
            max={maxScrollFret}
            step="1"
            value={scrollFret}
            aria-label="Scale fretboard scroll"
            onChange={(event) => scrollToFret(Number(event.target.value))}
          />
          <div className="fretboard-range-labels" aria-hidden="true">
            <span>Open</span>
            <span>Fret {MAX_FRET}</span>
          </div>
        </div>
      )}

      <div className="pentatonic-legend" aria-label="Diagram legend">
        <span className="fretboard-note pentatonic-root" aria-hidden="true">{keyName}</span>
        <span>Root note</span>
        <span className="fretboard-note" aria-hidden="true">N</span>
        <span>Other scale note</span>
      </div>
      <p className="fretboard-note-caption">
        Scale positions are calculated from the selected instrument and tuning. This standalone practice reference is not attached to routines or session timers.
      </p>
    </section>
  )
}

export default ScalePractice
