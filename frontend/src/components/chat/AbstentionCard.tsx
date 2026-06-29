"use client";

interface AbstentionCardProps {
  reason: string;
  trustScore: number;
  threshold: number;
  missingEvidenceQuery?: string;
}

export function AbstentionCard({
  reason,
  trustScore,
  threshold,
  missingEvidenceQuery,
}: AbstentionCardProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="h-5 w-5 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-800">
            I can&rsquo;t verify this with confidence
          </h4>
          <p className="mt-1 text-sm text-amber-700">{reason}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-amber-600">
            <span>
              Trust score:{" "}
              <span className="font-medium">{Math.round(trustScore * 100)}%</span>
            </span>
            <span aria-hidden>·</span>
            <span>
              Threshold:{" "}
              <span className="font-medium">{Math.round(threshold * 100)}%</span>
            </span>
          </div>
          {missingEvidenceQuery && (
            <div className="mt-2 rounded border border-amber-200 bg-white/60 px-2.5 py-1.5">
              <p className="text-xs text-amber-700">
                <span className="font-medium">Suggested search: </span>
                {missingEvidenceQuery}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
