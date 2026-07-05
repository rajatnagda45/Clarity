"use client";

import React from 'react';

interface TrustBadgeProps {
  calibrated: number; // 0.0 – 1.0
  raw?: number;
  components?: Record<string, number>;
}

export function TrustBadge({ calibrated, raw, components }: TrustBadgeProps) {
  const pct = Math.round(calibrated * 100);

  const color =
    pct >= 80
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : pct >= 60
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";

  const label = pct >= 80 ? "High trust" : pct >= 60 ? "Medium trust" : "Low trust";

  return (
    <div className="group relative inline-flex">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}
        title={`Trust: ${pct}%`}
        aria-label={`${label} — ${pct}%`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
        {label} {pct}%
      </span>

      {/* Tooltip with component breakdown */}
      {components && (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-52 rounded-md border border-white/10 bg-[#151923] p-2.5 shadow-xl group-hover:block">
          <p className="mb-1.5 text-[11px] font-semibold text-[#4A5168] uppercase tracking-wide">
            Score breakdown
          </p>
          {Object.entries(components).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between py-0.5">
              <span className="text-[11px] text-[#8892AA] capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-[11px] font-medium text-[#F1F3F9]">
                {Math.round(val * 100)}%
              </span>
            </div>
          ))}
          {raw !== undefined && (
            <div className="mt-1.5 border-t border-white/10 pt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-[#4A5168]">Raw (uncalibrated)</span>
              <span className="text-[11px] text-[#8892AA]">{Math.round(raw * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
