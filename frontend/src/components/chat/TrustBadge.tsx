"use client";

interface TrustBadgeProps {
  calibrated: number; // 0.0 – 1.0
  raw?: number;
  components?: Record<string, number>;
}

export function TrustBadge({ calibrated, raw, components }: TrustBadgeProps) {
  const pct = Math.round(calibrated * 100);

  const color =
    pct >= 80
      ? "bg-green-100 text-green-800 border-green-200"
      : pct >= 60
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200";

  const label = pct >= 80 ? "High trust" : pct >= 60 ? "Medium trust" : "Low trust";

  return (
    <div className="group relative inline-flex">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}
        title={`Trust: ${pct}%`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {label} {pct}%
      </span>

      {/* Tooltip with component breakdown */}
      {components && (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-52 rounded-md border border-gray-200 bg-white p-2.5 shadow-md group-hover:block">
          <p className="mb-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Score breakdown
          </p>
          {Object.entries(components).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between py-0.5">
              <span className="text-[11px] text-gray-600 capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-[11px] font-medium text-gray-800">
                {Math.round(val * 100)}%
              </span>
            </div>
          ))}
          {raw !== undefined && (
            <div className="mt-1.5 border-t pt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Raw (uncalibrated)</span>
              <span className="text-[11px] text-gray-700">{Math.round(raw * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
