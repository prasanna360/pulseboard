// This file runs in a Worker context (self is a DedicatedWorkerGlobalScope,
// not Window). We intentionally skip type-checking it against the DOM lib
// used by the rest of the app rather than mixing DOM + WebWorker libs
// project-wide, which is a known TypeScript incompatibility.
// @ts-nocheck
import { lttb } from '../utils/lttb';
import type { DownsampleRequest, DownsampleResponse } from '../types';

// Runs off the main thread: the chart can request a downsample of a
// 100k+ point buffer every time the user pans or zooms, without ever
// dropping a frame on the UI thread. Requests are tagged with an id so
// the main thread can discard stale results if a newer request supersedes
// one still in flight.
self.onmessage = (e: MessageEvent<DownsampleRequest>) => {
  const { key, requestId, points, threshold } = e.data;
  const result = lttb(points, threshold);
  const response: DownsampleResponse = { key, requestId, points: result };
  (self as unknown as Worker).postMessage(response);
};
