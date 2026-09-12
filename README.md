# PulseBoard

A performance-critical, real-time telemetry dashboard. Built for the Flam Frontend R&D
assignment.

Simulates four live industrial sensors (furnace temperature, spindle vibration, line
pressure, coolant temperature) streaming into the browser, and renders them in a canvas
chart that stays smooth even as the underlying buffer grows into the hundreds of
thousands of points.

## What it demonstrates

- **Typed-array ring buffers** (`src/utils/ringBuffer.ts`) — each sensor writes into a
  fixed-capacity `Float64Array` buffer instead of a growing/shrinking JS array, so
  ingest is O(1) with zero GC churn from array reallocation.
- **LTTB downsampling in a Web Worker** (`src/utils/lttb.ts`,
  `src/workers/downsample.worker.ts`) — Largest-Triangle-Three-Buckets reduces
  hundreds of thousands of raw points down to ~1,400 points for rendering while
  preserving the visual shape (spikes and slope changes survive). It runs off the
  main thread so panning/zooming never stalls on computation.
- **Independent canvas render loop** (`src/components/Chart.tsx`) — drawing runs on
  its own `requestAnimationFrame` loop reading from a ref, decoupled from React's
  render cycle and from when worker results arrive. FPS and per-frame render time are
  measured and shown live.
- **Virtualized data table** (`src/components/DataTable.tsx`) — uses `react-window`
  so only the ~15 visible rows are ever mounted in the DOM, no matter how many
  thousand rows are in the underlying dataset.
- **Pan & zoom** — drag to pan, scroll to zoom (zooms toward the cursor position),
  double-click to jump back to the live edge.

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

Output is a static `dist/` folder — no backend required.

## Deploying (for assignment submission)

The app is 100% static, so any static host works. Vercel is the fastest path:

1. Push this project to a new GitHub repo (see below).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output directory `dist`
   (Vercel usually auto-detects both). Click **Deploy**.
4. Copy the deployed URL — that's your submission link.

Netlify works the same way (`New site from Git`, build command `npm run build`,
publish directory `dist`).

## Pushing to GitHub

From inside this project folder:

```bash
git init
git add .
git commit -m "PulseBoard: real-time telemetry dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then submit both the GitHub repo URL and the deployed URL as requested in the
assignment brief.
