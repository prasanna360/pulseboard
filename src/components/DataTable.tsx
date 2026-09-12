import { useMemo, useState } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import type { RingBuffer } from '../utils/ringBuffer';
import type { SensorConfig } from '../types';

interface DataTableProps {
  buffers: Map<string, RingBuffer>;
  sensors: SensorConfig[];
  visibleIds: Set<string>;
  tick: number;
}

interface TableRow {
  t: number;
  v: number;
  sensor: SensorConfig;
}

const ROWS_PER_SENSOR = 3000; // recent window merged into the table
const ROW_HEIGHT = 28;

export default function DataTable({ buffers, sensors, visibleIds, tick }: DataTableProps) {
  const [search, setSearch] = useState('');

  // Recomputed only when `tick` (new data) or the sensor selection changes —
  // the table only ever needs the most recent slice, not the full buffer,
  // and react-window ensures only ~20 rows are ever mounted in the DOM
  // regardless of how many thousands are in `rows`.
  const rows: TableRow[] = useMemo(() => {
    const merged: TableRow[] = [];
    for (const sensor of sensors) {
      if (!visibleIds.has(sensor.id)) continue;
      const buf = buffers.get(sensor.id);
      if (!buf) continue;
      const all = buf.toOrderedPoints();
      const recent = all.slice(Math.max(0, all.length - ROWS_PER_SENSOR));
      for (const p of recent) merged.push({ t: p.t, v: p.v, sensor });
    }
    merged.sort((a, b) => b.t - a.t);
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, visibleIds, sensors, buffers]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.sensor.label.toLowerCase().includes(q));
  }, [rows, search]);

  const Row = ({ index, style }: ListChildComponentProps) => {
    const row = filteredRows[index];
    const isWarn = row.v >= row.sensor.warnThreshold;
    return (
      <div className={`table-row ${index % 2 === 0 ? 'row-even' : ''}`} style={style}>
        <span className="cell cell-time">{new Date(row.t).toLocaleTimeString([], { hour12: false })}
          <span className="cell-ms">.{String(row.t % 1000).padStart(3, '0')}</span>
        </span>
        <span className="cell cell-sensor">
          <span className="swatch swatch-sm" style={{ backgroundColor: row.sensor.color }} />
          {row.sensor.label}
        </span>
        <span className={`cell cell-value ${isWarn ? 'value-warn' : ''}`}>
          {row.v.toFixed(3)} {row.sensor.unit}
        </span>
      </div>
    );
  };

  return (
    <section className="panel table-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <h2>Raw Readings</h2>
          <span className="hint">newest first, virtualized so only visible rows touch the DOM</span>
        </div>
        <div className="panel-header-right">
          <input
            className="search-input"
            placeholder="Filter by sensor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="metric-inline">
            <span className="metric-label">rows</span>
            <span className="metric-value">{filteredRows.length.toLocaleString()}</span>
          </span>
        </div>
      </header>
      <div className="table-head-row">
        <span className="cell">Time</span>
        <span className="cell">Sensor</span>
        <span className="cell">Value</span>
      </div>
      <FixedSizeList
        height={320}
        itemCount={filteredRows.length}
        itemSize={ROW_HEIGHT}
        width="100%"
      >
        {Row}
      </FixedSizeList>
    </section>
  );
}
