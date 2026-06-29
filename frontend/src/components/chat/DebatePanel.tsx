"use client";

import { useState } from "react";

export interface DebateTurn {
  turn: number;
  claim: string;
  verdict: "supported" | "unsupported" | "uncertain";
  reasoning: string;
}

interface DebatePanelProps {
  turns: DebateTurn[];
}

const verdictColor: Record<string, string> = {
  supported: "border-green-400 bg-green-50",
  unsupported: "border-red-400 bg-red-50",
  uncertain: "border-amber-400 bg-amber-50",
};

const verdictDot: Record<string, string> = {
  supported: "bg-green-500",
  unsupported: "bg-red-500",
  uncertain: "bg-amber-400",
};

export function DebatePanel({ turns }: DebatePanelProps) {
  const [open, setOpen] = useState(false);

  if (!turns.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Critic review · {turns.length} turn{turns.length !== 1 ? "s" : ""}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`border-l-2 px-3 py-2.5 ${verdictColor[turn.verdict] ?? "border-gray-300 bg-gray-50"}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${verdictDot[turn.verdict] ?? "bg-gray-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 leading-snug">
                    Turn {turn.turn} · {turn.verdict}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-600 italic leading-snug line-clamp-2">
                    &ldquo;{turn.claim}&rdquo;
                  </p>
                  {turn.reasoning && (
                    <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">
                      {turn.reasoning}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
