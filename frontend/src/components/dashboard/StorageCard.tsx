'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface StorageCardProps {
  indexedDocs: number;
  totalDocs: number;
  totalChunks: number;
  loading?: boolean;
}

export function StorageCard({
  indexedDocs,
  totalDocs,
  totalChunks,
  loading,
}: StorageCardProps) {
  const notIndexed = Math.max(0, totalDocs - indexedDocs);
  const isEmpty = totalDocs === 0 && indexedDocs === 0;

  const pieData = [
    { name: 'indexed', value: indexedDocs },
    { name: 'pending', value: notIndexed },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0F1117] p-5">
      <span className="font-semibold text-[#F1F3F9]">Document Index</span>

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-[160px] w-[160px] rounded-full bg-[rgba(255,255,255,0.04)] skeleton-shimmer" />
        </div>
      ) : isEmpty ? (
        <div className="flex h-[160px] flex-col items-center justify-center gap-2">
          <p className="text-sm text-[#8892AA]">No documents yet</p>
          <p className="text-xs text-[#4A5168]">Upload documents to see stats</p>
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#5B6EF0" />
                  <Cell fill="#1A1F2E" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Center text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-[#F1F3F9]">{indexedDocs}</span>
            <span className="text-xs text-[#8892AA]">indexed</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-col gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#8892AA]">Documents</span>
          {loading ? (
            <div className="h-4 w-10 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
          ) : (
            <span className="font-medium text-[#F1F3F9]">{totalDocs}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#8892AA]">Chunks</span>
          {loading ? (
            <div className="h-4 w-16 rounded bg-[rgba(255,255,255,0.06)] skeleton-shimmer" />
          ) : (
            <span className="font-medium text-[#F1F3F9]">{totalChunks.toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
