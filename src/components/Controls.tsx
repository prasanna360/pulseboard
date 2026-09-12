import type { SensorConfig } from '../types';

interface ControlsProps {
  sensors: SensorConfig[];
  visibleIds: Set<string>;
  onToggleSensor: (id: string) => void;
  streaming: boolean;
  onToggleStreaming: () => void;
  intervalMs: number;
  onIntervalChange: (v: number) => void;
  pointsPerTick: number;
  onPointsPerTickChange: (v: number) => void;
}

const INTERVAL_OPTIONS = [
  { label: '100 ms', value: 100 },
  { label: '250 ms', value: 250 },
  { label: '1 s', value: 1000 },
];

const RATE_OPTIONS = [
  { label: 'x1', value: 1 },
  { label: 'x10', value: 10 },
  { label: 'x50', value: 50 },
];

export default function Controls({
  sensors,
  visibleIds,
  onToggleSensor,
  streaming,
  onToggleStreaming,
  intervalMs,
  onIntervalChange,
  pointsPerTick,
  onPointsPerTickChange,
}: ControlsProps) {
  return (
    <aside className="panel sidebar">
      <div className="sidebar-section">
        <h2>Stream</h2>
        <button className={`stream-toggle ${streaming ? 'is-on' : ''}`} onClick={onToggleStreaming}>
          {streaming ? 'Pause ingest' : 'Resume ingest'}
        </button>

        <label className="control-label" htmlFor="interval-select">
          Tick interval
        </label>
        <div className="segmented">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={intervalMs === opt.value ? 'is-active' : ''}
              onClick={() => onIntervalChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="control-label">Points per tick, per sensor</label>
        <div className="segmented">
          {RATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={pointsPerTick === opt.value ? 'is-active' : ''}
              onClick={() => onPointsPerTickChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <h2>Sensors</h2>
        <ul className="sensor-list">
          {sensors.map((sensor) => (
            <li key={sensor.id}>
              <label className="sensor-toggle">
                <input
                  type="checkbox"
                  checked={visibleIds.has(sensor.id)}
                  onChange={() => onToggleSensor(sensor.id)}
                />
                <span className="swatch" style={{ backgroundColor: sensor.color }} />
                <span className="sensor-name">{sensor.label}</span>
                <span className="sensor-unit">{sensor.unit}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section sidebar-footnote">
        <h2>How this stays smooth</h2>
        <p>
          Each sensor writes into a fixed-size typed-array ring buffer, so ingest never
          reallocates. Downsampling (LTTB) runs in a Web Worker off the main thread, and the
          canvas redraws on its own animation-frame loop — panning and zooming never wait on the
          data pipeline.
        </p>
      </div>
    </aside>
  );
}
