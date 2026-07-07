'use client';

import { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ModelComparison } from '@/types/clarity';

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 },
};

export function ModelCharts({
  comparisons,
  modelColors,
}: {
  comparisons: ModelComparison[];
  modelColors: string[];
}) {
  const radarData = useMemo(() => {
    if (!comparisons.length) return [];
    return [
      { metric: 'Judge Score', ...Object.fromEntries(comparisons.map(c => [c.modelVersion, (c.avgJudgeOverall ?? 0)])) },
      { metric: 'Trust (×10)', ...Object.fromEntries(comparisons.map(c => [c.modelVersion, (c.avgTrustConfidence ?? 0) * 10])) },
    ];
  }, [comparisons]);

  const barData = useMemo(() => comparisons.map((c, i) => ({
    name: c.modelVersion.length > 20 ? c.modelVersion.slice(0, 20) + '…' : c.modelVersion,
    judge: +(c.avgJudgeOverall ?? 0).toFixed(2),
    trust: +((c.avgTrustConfidence ?? 0) * 10).toFixed(2),
    latency: c.avgLatencyMs ? +(c.avgLatencyMs / 100).toFixed(2) : 0,
    color: modelColors[i % modelColors.length],
  })), [comparisons, modelColors]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-sm font-semibold text-[#F1F3F9] mb-6">Multi-Metric Radar</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#8892AA', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#4A5168', fontSize: 10 }} />
            {comparisons.slice(0, 4).map((c, i) => (
              <Radar
                key={c.modelVersion}
                name={c.modelVersion}
                dataKey={c.modelVersion}
                stroke={modelColors[i % modelColors.length]}
                fill={modelColors[i % modelColors.length]}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ color: '#8892AA', fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#0F1117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-sm font-semibold text-[#F1F3F9] mb-1">Judge · Trust · Latency</p>
        <p className="text-xs text-[#4A5168] mb-4">Judge & Trust out of 10 · Latency ÷ 100</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#4A5168', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#8892AA', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#8892AA', fontSize: 11 }} />
            <Bar dataKey="judge" fill="#8B5CF6" radius={[0, 3, 3, 0]} name="Judge Score" />
            <Bar dataKey="trust" fill="#10B981" radius={[0, 3, 3, 0]} name="Trust (×10)" />
            <Bar dataKey="latency" fill="#F59E0B" radius={[0, 3, 3, 0]} name="Latency (÷100)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
