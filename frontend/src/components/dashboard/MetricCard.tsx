'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
  formatValue?: (v: number) => string;
}

function AnimatedNumber({
  value,
  formatValue,
}: {
  value: number;
  formatValue?: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const startTime = performance.now();
    const duration = 800;

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  const formatted = formatValue
    ? formatValue(display)
    : Math.round(display).toLocaleString();

  return <span>{formatted}</span>;
}

export function MetricCard({
  label,
  value,
  prefix,
  suffix,
  icon,
  iconBg,
  loading,
  formatValue,
}: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
      className="flex flex-col gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0F1117] p-5"
    >
      {/* Top row */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#F1F3F9]"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <span className="text-sm text-[#8892AA]">{label}</span>
      </div>

      {/* Value */}
      <div className="text-3xl font-bold text-[#F1F3F9]">
        {loading ? (
          <div className="h-9 w-24 rounded-lg bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
        ) : value == null ? (
          <span className="text-[#4A5168]">—</span>
        ) : (
          <>
            {prefix && <span className="text-xl text-[#8892AA]">{prefix}</span>}
            <AnimatedNumber value={value} formatValue={formatValue} />
            {suffix && <span className="text-xl text-[#8892AA]"> {suffix}</span>}
          </>
        )}
      </div>
    </motion.div>
  );
}
