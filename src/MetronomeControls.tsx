import {
  MAX_METRONOME_BPM,
  MIN_METRONOME_BPM,
  type MetronomeState,
} from './metronome'

type MetronomeControlsProps = MetronomeState

const MetronomeControls = ({
  bpm,
  setBpm,
  isPlaying,
  beat,
  error,
  start,
  stop,
  tapTempo,
}: MetronomeControlsProps) => (
  <section className="metronome-panel" aria-label="Practice metronome">
    <div className="metronome-heading">
      <div>
        <p className="eyebrow">Practice tool</p>
        <h2>Metronome</h2>
      </div>
      <span className="metronome-beat" data-active={beat > 0} aria-hidden="true" />
    </div>
    <p className="metronome-description">
      Set a steady pulse while you practise. Tempo stays available while the app is open.
    </p>
    <div className="metronome-tempo">
      <label htmlFor="metronome-tempo">Tempo</label>
      <output htmlFor="metronome-tempo">{bpm} BPM</output>
      <input
        id="metronome-tempo"
        aria-label="Tempo BPM"
        type="range"
        min={MIN_METRONOME_BPM}
        max={MAX_METRONOME_BPM}
        step="1"
        value={bpm}
        onChange={(event) => setBpm(Number(event.target.value))}
      />
    </div>
    <div className="metronome-controls">
      <button
        type="button"
        className="primary-button"
        aria-label={isPlaying ? 'Stop metronome' : 'Start metronome'}
        onClick={() => {
          if (isPlaying) {
            stop()
          } else {
            void start()
          }
        }}
      >
        {isPlaying ? 'Stop' : 'Start'}
      </button>
      <button type="button" className="secondary-button" onClick={tapTempo}>
        Tap tempo
      </button>
      <span className="metronome-status" role="status">
        {isPlaying ? `Playing at ${bpm} BPM` : 'Stopped'}
      </span>
    </div>
    {error && <p className="metronome-error" role="alert">{error}</p>}
  </section>
)

export default MetronomeControls
