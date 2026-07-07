'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

interface PerfStats {
  fps: number;
  routeMs: number | null;
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
  memoryMb: number | null;
  renderCount: number;
}

function useFPS() {
  const [fps, setFps] = useState(60);
  const frameRef = useRef<number>(0);
  const lastRef = useRef<number>(performance.now());
  const countRef = useRef(0);

  useEffect(() => {
    let running = true;
    function tick() {
      if (!running) return;
      countRef.current++;
      const now = performance.now();
      if (now - lastRef.current >= 500) {
        setFps(Math.round(countRef.current * 1000 / (now - lastRef.current)));
        countRef.current = 0;
        lastRef.current = now;
      }
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, []);

  return fps;
}

export function PerformanceOverlay() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const fps = useFPS();
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<PerfStats>({
    fps: 60, routeMs: null, queryCount: 0,
    cacheHits: 0, cacheMisses: 0, memoryMb: null, renderCount: 0,
  });
  const renderCountRef = useRef(0);
  const navStartRef = useRef<number | null>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      if (navStartRef.current !== null) {
        const ms = performance.now() - navStartRef.current;
        setStats(s => ({ ...s, routeMs: Math.round(ms) }));
      }
      prevPathRef.current = pathname;
      navStartRef.current = null;
    }
  }, [pathname]);

  const startNav = useCallback(() => {
    navStartRef.current = performance.now();
  }, []);

  useEffect(() => {
    window.addEventListener('click', startNav, true);
    return () => window.removeEventListener('click', startNav, true);
  }, [startNav]);

  useEffect(() => {
    renderCountRef.current++;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const cache = qc.getQueryCache().getAll();
      const hits = cache.filter(q => q.state.status === 'success').length;
      const misses = cache.filter(q => q.state.status === 'pending').length;
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      setStats(s => ({
        ...s,
        fps,
        queryCount: cache.length,
        cacheHits: hits,
        cacheMisses: misses,
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null,
        renderCount: renderCountRef.current,
      }));
    }, 500);
    return () => clearInterval(id);
  }, [qc, fps]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && e.shiftKey && e.code === 'KeyP') setVisible(v => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] h-7 w-7 rounded-full bg-[#1A1F2E] border border-white/10 text-[10px] font-bold text-[#8892AA] hover:text-white hover:border-[#5B6EF0] flex items-center justify-center shadow-2xl transition-all"
        title="Alt+Shift+P — Performance Overlay"
      >
        P
      </button>
    );
  }

  const fpsColor = stats.fps >= 55 ? '#22C55E' : stats.fps >= 30 ? '#F59E0B' : '#EF4444';
  const routeColor = (stats.routeMs ?? 0) < 100 ? '#22C55E' : (stats.routeMs ?? 0) < 300 ? '#F59E0B' : '#EF4444';

  return (
    <div className="fixed bottom-4 right-4 z-[9999] min-w-[220px] rounded-2xl border border-white/10 bg-[#090B11]/95 p-4 text-[11px] font-mono shadow-2xl backdrop-blur-xl select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B6EF0]">Perf Monitor</span>
        <button onClick={() => setVisible(false)} className="text-[#4A5168] hover:text-white transition-colors text-xs">✕</button>
      </div>

      <div className="space-y-1.5">
        <Row label="FPS" value={`${stats.fps}`} color={fpsColor} />
        <Row label="Route" value={stats.routeMs != null ? `${stats.routeMs}ms` : '—'} color={routeColor} />
        <Row label="Queries" value={`${stats.queryCount}`} />
        <Row label="Cache ✓" value={`${stats.cacheHits}`} color="#22C55E" />
        <Row label="Cache ⟳" value={`${stats.cacheMisses}`} color={stats.cacheMisses > 0 ? '#F59E0B' : '#4A5168'} />
        {stats.memoryMb !== null && <Row label="JS Heap" value={`${stats.memoryMb} MB`} />}
        <Row label="Renders" value={`${stats.renderCount}`} />
      </div>

      <p className="mt-3 text-[9px] text-[#4A5168]">Alt+Shift+P to toggle</p>
    </div>
  );
}

function Row({ label, value, color = '#F1F3F9' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#8892AA]">{label}</span>
      <span style={{ color }} className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
