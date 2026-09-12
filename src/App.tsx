import { useState } from 'react';
import { SENSORS } from './utils/dataGenerator';
import { useTelemetryStream } from './hooks/useTelemetryStream';
import Chart from './components/Chart';
import Controls from './components/Controls';
import DataTable from './components/DataTable';
import MetricsPanel from './components/MetricsPanel';

export default function App() {
  const [streaming, setStreaming] = useState(true);
  const [intervalMs, setIntervalMs] = useState(250);
  const [pointsPerTick, setPointsPerTick] = useState(1);
  const [live, setLive] = useState(true);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(SENSORS.map((s) => s.id))
  );

  const { buffers, totalPoints, tick } = useTelemetryStream({
    intervalMs,
    pointsPerTick,
    running: streaming,
  });

  const toggleSensor = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least one series visible
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const pointsPerSecond = streaming
    ? Math.round((pointsPerTick * SENSORS.length * 1000) / intervalMs)
    : 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <h1>PulseBoard</h1>
            <p>Live telemetry from Line 4, Plant Floor B</p>
          </div>
        </div>
      </header>

      <MetricsPanel
        totalPoints={totalPoints}
        activeSensors={visibleIds.size}
        totalSensors={SENSORS.length}
        streaming={streaming}
        pointsPerSecond={pointsPerSecond}
        bufferCapacity={200_000 * SENSORS.length}
      />

      <div className="app-body">
        <Controls
          sensors={SENSORS}
          visibleIds={visibleIds}
          onToggleSensor={toggleSensor}
          streaming={streaming}
          onToggleStreaming={() => setStreaming((s) => !s)}
          intervalMs={intervalMs}
          onIntervalChange={setIntervalMs}
          pointsPerTick={pointsPerTick}
          onPointsPerTickChange={setPointsPerTick}
        />

        <main className="app-main">
          <Chart
            buffers={buffers}
            sensors={SENSORS}
            visibleIds={visibleIds}
            tick={tick}
            live={live}
            onLiveChange={setLive}
          />
          <DataTable buffers={buffers} sensors={SENSORS} visibleIds={visibleIds} tick={tick} />
        </main>
      </div>
    </div>
  );
}
