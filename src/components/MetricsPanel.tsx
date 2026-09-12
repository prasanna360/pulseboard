interface MetricsPanelProps {
  totalPoints: number;
  activeSensors: number;
  totalSensors: number;
  streaming: boolean;
  pointsPerSecond: number;
  bufferCapacity: number;
}

export default function MetricsPanel({
  totalPoints,
  activeSensors,
  totalSensors,
  streaming,
  pointsPerSecond,
  bufferCapacity,
}: MetricsPanelProps) {
  const capacityUsed = Math.min(totalPoints / bufferCapacity, 1);

  return (
    <section className="panel metrics-strip">
      <div className="metrics-strip-item">
        <span className="metric-label">status</span>
        <span className={`metric-value ${streaming ? 'value-live' : ''}`}>
          {streaming ? 'streaming' : 'paused'}
        </span>
      </div>
      <div className="metrics-strip-divider" />
      <div className="metrics-strip-item">
        <span className="metric-label">buffered readings</span>
        <span className="metric-value">{totalPoints.toLocaleString()}</span>
      </div>
      <div className="metrics-strip-divider" />
      <div className="metrics-strip-item">
        <span className="metric-label">ingest rate</span>
        <span className="metric-value">{pointsPerSecond.toLocaleString()} pts/s</span>
      </div>
      <div className="metrics-strip-divider" />
      <div className="metrics-strip-item">
        <span className="metric-label">sensors online</span>
        <span className="metric-value">
          {activeSensors}/{totalSensors}
        </span>
      </div>
      <div className="metrics-strip-divider" />
      <div className="metrics-strip-item metrics-strip-capacity">
        <span className="metric-label">buffer capacity</span>
        <div className="capacity-bar">
          <div className="capacity-bar-fill" style={{ width: `${capacityUsed * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
