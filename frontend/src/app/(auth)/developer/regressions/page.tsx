'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Minus, Filter, RefreshCw } from 'lucide-react';
import { PremiumBackground } from '@/components/landing/PremiumBackground';
import { useRegressions } from '@/hooks/useRegressions';

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-[#4A5168] text-xs">—</span>;
  const isPositive = delta > 0;
  const isNeutral = Math.abs(delta) < 0.01;
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${isNeutral ? 'text-[#4A5168]' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isNeutral ? <Minus size={11} /> : isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {isPositive ? '+' : ''}{delta.toFixed(3)}
    </span>
  );
}

export default function RegressionsPage() {
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const { data, isLoading, isError, refetch } = useRegressions(onlyFlagged);

  const reports = data?.reports ?? [];
  const flaggedCount = reports.filter(r => r.hasRegression).length;

  return (
    <div className="relative min-h-screen bg-[#05070B] selection:bg-purple-500/30 selection:text-white pb-32">
      <PremiumBackground glowOpacity={0.07} />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 pt-10 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#F1F3F9] tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <TrendingDown size={20} className="text-red-400" />
              </div>
              Regression Reports
            </h1>
            <p className="text-sm text-[#8892AA] mt-1.5">Quality delta detection — rolling baseline vs. current eval score comparison.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setOnlyFlagged(f => !f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                onlyFlagged
                  ? 'bg-red-500/20 border-red-500/30 text-red-400'
                  : 'border-white/[0.08] text-[#8892AA] hover:text-[#F1F3F9] hover:bg-white/[0.04]'
              }`}
            >
              <Filter size={14} />
              {onlyFlagged ? 'Regressions only' : 'All reports'}
            </button>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-white/[0.08] text-[#4A5168] hover:text-[#F1F3F9] hover:bg-white/[0.04] transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Summary */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Reports', value: String(data?.total ?? 0), color: 'text-[#F1F3F9]', icon: CheckCircle2, bg: 'bg-white/[0.04]' },
              { label: 'Regressions Detected', value: String(flaggedCount), color: 'text-red-400', icon: AlertTriangle, bg: 'bg-red-500/10' },
              { label: 'Clean Reports', value: String((data?.total ?? 0) - flaggedCount), color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4`}>
                <stat.icon size={20} className={stat.color} />
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-[#4A5168]">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white/[0.03] border border-white/[0.04] rounded-2xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
            <AlertTriangle size={28} className="text-red-400 mb-3" />
            <p className="text-sm text-[#F1F3F9]">Failed to load regression reports</p>
          </div>
        ) : !reports.length ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0F1117] border border-white/[0.06] rounded-2xl text-center">
            <CheckCircle2 size={36} className="text-emerald-400 mb-4" />
            <p className="text-base font-semibold text-[#F1F3F9]">
              {onlyFlagged ? 'No regressions detected' : 'No regression reports yet'}
            </p>
            <p className="text-sm text-[#4A5168] mt-1 max-w-sm">
              {onlyFlagged
                ? 'All recent evaluations are within the regression threshold.'
                : 'Regression reports are auto-generated after each LLM-as-Judge evaluation run.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <div
                key={report.id}
                className={`bg-[#0F1117] border rounded-2xl p-5 transition-colors ${
                  report.hasRegression
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {report.hasRegression
                        ? <AlertTriangle size={16} className="text-red-400 shrink-0" />
                        : <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                      <p className="text-sm font-semibold text-[#F1F3F9]">
                        {report.hasRegression ? 'Regression Detected' : 'No Regression'}
                      </p>
                      {report.hasRegression && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20">
                          FLAGGED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4A5168]">{new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <DeltaBadge delta={report.judgeOverallDelta} />
                </div>

                <div className="grid grid-cols-4 gap-4 text-xs mb-4">
                  <div>
                    <p className="text-[#4A5168] mb-0.5">Current Score</p>
                    <p className={`font-semibold ${report.currentJudgeOverall != null && report.currentJudgeOverall >= 7 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {report.currentJudgeOverall?.toFixed(2) ?? '—'}/10
                    </p>
                  </div>
                  <div>
                    <p className="text-[#4A5168] mb-0.5">Baseline Avg</p>
                    <p className="text-[#F1F3F9] font-semibold">{report.baselineAvgJudgeOverall?.toFixed(2) ?? '—'}/10</p>
                  </div>
                  <div>
                    <p className="text-[#4A5168] mb-0.5">Window Size</p>
                    <p className="text-[#F1F3F9] font-semibold">{report.windowSize} evals</p>
                  </div>
                  <div>
                    <p className="text-[#4A5168] mb-0.5">Delta</p>
                    <DeltaBadge delta={report.judgeOverallDelta} />
                  </div>
                </div>

                {report.regressionFlags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {report.regressionFlags.map(flag => (
                      <span key={flag} className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[10px] font-mono text-[#4A5168] mt-3 truncate">eval: {report.currentEvalId}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
