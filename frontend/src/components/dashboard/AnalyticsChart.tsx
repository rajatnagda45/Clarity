'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart2 } from 'lucide-react';

export interface AnalyticsPoint {
  date: string;
  conversations: number;
  documentsUploaded: number;
  queries: number;
}

interface AnalyticsChartProps {
  data: AnalyticsPoint[];
  loading?: boolean;
}

const DATE_RANGES = ['7D', '30D', '90D', '1Y'] as const;
type DateRange = (typeof DATE_RANGES)[number];

interface TooltipEntry {
  name?: string | number;
  color?: string;
  value?: string | number | readonly (string | number)[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#151923] px-3 py-2 shadow-xl">
      <p className="mb-1.5 text-xs text-[#4A5168]">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-[#8892AA] capitalize">{entry.name}:</span>
          <span className="font-medium text-[#F1F3F9]">
            {Array.isArray(entry.value) ? entry.value.join(', ') : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsChart({ data, loading }: AnalyticsChartProps) {
  const [activeRange, setActiveRange] = useState<DateRange>('30D');

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0F1117] p-6 shadow-xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[rgba(91,110,240,0.1)] p-2 text-[#5B6EF0]">
            <BarChart2 size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[#F1F3F9] tracking-tight text-lg">Activity Overview</h3>
            <p className="text-xs text-[#8892AA]">Document processing and queries over time</p>
          </div>
        </div>
        <div className="flex gap-1">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setActiveRange(range)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                activeRange === range
                  ? 'border border-[rgba(91,110,240,0.3)] bg-[rgba(91,110,240,0.2)] text-[#5B6EF0]'
                  : 'text-[#4A5168] hover:text-[#8892AA]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[200px] w-full rounded-xl bg-[rgba(255,255,255,0.03)] skeleton-shimmer" />
      ) : data.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2">
          <BarChart2 size={32} className="text-[#4A5168]" />
          <p className="text-sm text-[#8892AA]">No analytics data yet</p>
          <p className="text-xs text-[#4A5168]">Data will appear once you start using the workspace</p>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradConversations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5B6EF0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#5B6EF0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDocuments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradQueries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <Tooltip content={CustomTooltip} />
              <Area
                type="monotone"
                dataKey="conversations"
                stroke="#5B6EF0"
                strokeWidth={2}
                fill="url(#gradConversations)"
              />
              <Area
                type="monotone"
                dataKey="documentsUploaded"
                stroke="#22C55E"
                strokeWidth={2}
                fill="url(#gradDocuments)"
              />
              <Area
                type="monotone"
                dataKey="queries"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#gradQueries)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4">
        {[
          { key: 'conversations', color: '#5B6EF0', label: 'Conversations' },
          { key: 'documentsUploaded', color: '#22C55E', label: 'Documents Uploaded' },
          { key: 'queries', color: '#F59E0B', label: 'Queries' },
        ].map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-xs text-[#8892AA]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
