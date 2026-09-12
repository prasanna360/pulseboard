import { useEffect, useRef, useState, useCallback } from 'react';
import type { DownsampleRequest, DownsampleResponse } from '../types';

export function useDownsampleWorker() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdsRef = useRef<Map<string, number>>(new Map());
  const [results, setResults] = useState<Map<string, { t: number; v: number }[]>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/downsample.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<DownsampleResponse>) => {
      const { key, requestId, points } = e.data;
      // discard results from superseded requests (user panned/zoomed again
      // before the previous downsample finished)
      if (requestIdsRef.current.get(key) !== requestId) return;
      setResults((prev) => {
        const next = new Map(prev);
        next.set(key, points);
        return next;
      });
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const submit = useCallback(
    (key: string, points: { t: number; v: number }[], threshold: number) => {
      const nextId = (requestIdsRef.current.get(key) ?? 0) + 1;
      requestIdsRef.current.set(key, nextId);
      const req: DownsampleRequest = { key, requestId: nextId, points, threshold };
      workerRef.current?.postMessage(req);
    },
    []
  );

  return { results, submit };
}
