'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: number | string | null | undefined;
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  loading?: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
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

  return <>{Math.round(display).toLocaleString()}</>;
}

export function MetricCard({
  label,
  value,
  icon,
  iconBg,
  iconColor = '#fff',
  loading = false,
}: MetricCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className="group relative flex flex-col rounded-2xl bg-[#0F1117] p-6 overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] transition-colors"
    >
      {/* Premium Hover Glow Effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              350px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.06),
              transparent 80%
            )
          `,
        }}
      />
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              250px circle at ${mouseX}px ${mouseY}px,
              ${iconColor}15,
              transparent 80%
            )
          `,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-inner transition-transform group-hover:scale-110 duration-300"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            {icon}
          </div>
          {/* Decorative subtle dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-white/30 transition-colors" />
        </div>

        <div>
          <p className="text-sm font-medium text-[#8892AA] mb-1">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-[rgba(255,255,255,0.05)]" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-[#F1F3F9] flex items-baseline gap-1">
              {typeof value === 'number' ? (
                <AnimatedNumber value={value} />
              ) : value != null ? (
                <span>{value}</span>
              ) : (
                '0'
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
