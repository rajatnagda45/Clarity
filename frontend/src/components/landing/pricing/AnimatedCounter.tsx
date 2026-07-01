"use client";

import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function AnimatedCounter({ value, duration = 1000, prefix = "", suffix = "", decimals = 0 }: AnimatedCounterProps) {
  const [count, setCount] = useState(value);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const prevValue = useRef(value);

  useEffect(() => {
    if (!isInView) return;
    
    // If the value hasn't changed (or it's the first mount), just set it if we want to animate from 0.
    // Actually, we want to animate from 0 on first view, and from prevValue on change.
    const startValue = prevValue.current === value ? 0 : prevValue.current;
    const endValue = value;
    
    if (startValue === endValue) {
      setCount(endValue);
      return;
    }

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function (easeOutQuad)
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const currentVal = startValue + (endValue - startValue) * easeProgress;
      
      setCount(currentVal);
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        prevValue.current = endValue;
      }
    };
    
    window.requestAnimationFrame(step);
  }, [value, duration, isInView]);

  return (
    <span ref={ref}>
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  );
}
