/**
 * Fixed-capacity ring buffer backed by typed arrays.
 *
 * Streaming telemetry at high frequency into a plain JS array (push/shift)
 * causes constant reallocation and GC churn as the array grows and shrinks.
 * A ring buffer over Float64Array avoids that entirely: writes are O(1),
 * memory is allocated once, and reading out "the last N points in order"
 * is a simple wrap-aware slice.
 */
export class RingBuffer {
  private t: Float64Array;
  private v: Float64Array;
  private capacity: number;
  private writeIndex = 0;
  private filled = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.t = new Float64Array(capacity);
    this.v = new Float64Array(capacity);
  }

  push(t: number, v: number) {
    this.t[this.writeIndex] = t;
    this.v[this.writeIndex] = v;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.filled = Math.min(this.filled + 1, this.capacity);
  }

  get length() {
    return this.filled;
  }

  /** Returns points in chronological order as plain {t,v} objects. */
  toOrderedPoints(): { t: number; v: number }[] {
    const out: { t: number; v: number }[] = new Array(this.filled);
    const start =
      this.filled < this.capacity
        ? 0
        : this.writeIndex; // oldest element position once buffer has wrapped
    for (let i = 0; i < this.filled; i++) {
      const idx = (start + i) % this.capacity;
      out[i] = { t: this.t[idx], v: this.v[idx] };
    }
    return out;
  }

  /** Returns only points within [fromT, toT], still chronological. */
  toOrderedPointsInRange(fromT: number, toT: number): { t: number; v: number }[] {
    const all = this.toOrderedPoints();
    // binary search for range start (data is chronological & monotonic)
    let lo = 0;
    let hi = all.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (all[mid].t < fromT) lo = mid + 1;
      else hi = mid;
    }
    const startIdx = lo;
    const out: { t: number; v: number }[] = [];
    for (let i = startIdx; i < all.length; i++) {
      if (all[i].t > toT) break;
      out.push(all[i]);
    }
    return out;
  }

  latest(): { t: number; v: number } | null {
    if (this.filled === 0) return null;
    const idx = (this.writeIndex - 1 + this.capacity) % this.capacity;
    return { t: this.t[idx], v: this.v[idx] };
  }
}
