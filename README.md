# PulseBoard

A real-time industrial telemetry dashboard, built to stay smooth under heavy, continuous
data — hundreds of thousands of points streaming and rendering live, with no backend
required.

---

## What it does

PulseBoard watches four simulated sensors on a factory line — furnace temperature,
spindle vibration, line pressure, and coolant temperature — and streams live readings
into the browser. You can:

- Watch all four traces update live, each with its own color and warning threshold
- Drag to pan and scroll to zoom on the chart, at any point in the stream's history
- Pause and resume ingest, or change how fast data arrives
- Toggle sensors on or off
- Scroll through raw readings in a searchable table, filtered by sensor

The interesting part isn't the sensors — it's what it takes to keep a chart like this
responsive when the underlying dataset never stops growing.

## The performance problem, and how it's solved

Naive real-time charts fall over in three predictable places: the data structure holding
the stream, the work of turning raw points into pixels, and the DOM if you're also
rendering a table of readings. PulseBoard addresses each directly.

**Ingest doesn't allocate.** Each sensor writes into a fixed-capacity `Float64Array` ring
buffer (`src/utils/ringBuffer.ts`) instead of a growing/shrinking JS array. Writes are
O(1) and memory is allocated once up front, so a fast stream never triggers GC pauses
from constant array resizing.

**Downsampling runs off the main thread.** Rendering 100,000+ raw points every frame is
wasteful — most of them round to the same pixel anyway. PulseBoard implements
Largest-Triangle-Three-Buckets (`src/utils/lttb.ts`), an algorithm that picks the points
that most affect the visual shape of the line — peaks, spikes, slope changes — and drops
the redundant, near-collinear ones. It reduces any range down to ~1,400 points before
drawing. This runs inside a Web Worker (`src/workers/downsample.worker.ts`), so panning
and zooming never wait on computation happening on the same thread as your interaction.

**The chart draws itself, independently of React.** Instead of re-rendering on every
data tick, the canvas runs its own `requestAnimationFrame` loop
(`src/components/Chart.tsx`) that reads the latest downsampled points from a ref. React
state updates happen at a much lower frequency than the draw loop, so the two never
fight each other for the frame budget. FPS and per-frame render time are measured and
shown live in the chart header, so the performance claim isn't just asserted — you can
watch it.

**The table never mounts more than it shows.** The raw-readings table
(`src/components/DataTable.tsx`) uses `react-window` to virtualize rows — with
thousands of readings in memory, only the dozen or so actually visible in the viewport
exist in the DOM at once.

## Stack

React 18, TypeScript, Vite. No UI framework, no charting library — the chart is
hand-rolled Canvas 2D, which is what makes the render-loop and glow-trace behavior
possible to control precisely.

## Project structure

    src/
      components/     Chart, DataTable, Controls, MetricsPanel — all presentational
      hooks/          useTelemetryStream (ingest), useDownsampleWorker (worker wrapper)
      utils/          ringBuffer, lttb, dataGenerator — the actual engineering
      workers/        downsample.worker — LTTB off the main thread


## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview   # sanity-check the production build locally
```

Output is a static `dist/` folder — deployable anywhere that serves static files.

## Deploying

1. Push this project to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo. Vercel
   auto-detects the Vite preset (build command `npm run build`, output `dist`).
   Click **Deploy**.

Netlify works the same way: **New site from Git**, build command `npm run build`,
publish directory `dist`.

## Notes on the simulated data

Sensor readings are generated client-side (`src/utils/dataGenerator.ts`) from a slow
sine drift plus jitter and occasional spikes, so the chart has realistic texture at any
zoom level without needing a live data source. Swapping in a real feed means replacing
the interval in `useTelemetryStream` with a WebSocket or SSE subscription that calls
the same `buffer.push(t, v)` — everything downstream (downsampling, rendering,
virtualization) is agnostic to where the numbers come from.
