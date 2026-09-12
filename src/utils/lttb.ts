export interface Point {
  t: number;
  v: number;
}

/**
 * Largest-Triangle-Three-Buckets downsampling.
 *
 * Reduces an ordered series of N points down to `threshold` points while
 * preserving the visual shape of the series (peaks, spikes, and slope
 * changes survive; redundant near-collinear points are dropped). This is
 * what lets the canvas chart stay smooth at 60fps even when the underlying
 * buffer holds hundreds of thousands of raw readings — we only ever hand
 * the renderer a couple thousand points, chosen to matter.
 *
 * Runs in O(N) time. Safe to call on the main thread for small buffers,
 * but for large buffers this is dispatched to a Web Worker so it never
 * blocks user interaction (panning/zooming) on the main thread.
 */
export function lttb(data: Point[], threshold: number): Point[] {
  const n = data.length;
  if (threshold >= n || threshold <= 2) return data.slice();

  const sampled: Point[] = [data[0]];
  const bucketSize = (n - 2) / (threshold - 2);

  let a = 0; // index of last selected point

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    // average point of the NEXT bucket, used as a triangle anchor
    const nextRangeStart = rangeEnd;
    const nextRangeEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, n);
    let avgT = 0;
    let avgV = 0;
    const avgRangeLength = Math.max(nextRangeEnd - nextRangeStart, 1);
    for (let j = nextRangeStart; j < nextRangeEnd; j++) {
      avgT += data[j] ? data[j].t : data[n - 1].t;
      avgV += data[j] ? data[j].v : data[n - 1].v;
    }
    avgT /= avgRangeLength;
    avgV /= avgRangeLength;

    const pointA = data[a];
    let maxArea = -1;
    let maxIndex = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (pointA.t - avgT) * (data[j].v - pointA.v) -
          (pointA.t - data[j].t) * (avgV - pointA.v)
      );
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    sampled.push(data[maxIndex]);
    a = maxIndex;
  }

  sampled.push(data[n - 1]);
  return sampled;
}
