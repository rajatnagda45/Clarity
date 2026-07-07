'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  FileText,
  AlignLeft,
  Tag,
  Layers,
  Zap,
  Hash,
  ShieldCheck,
  MessageSquare,
  ScrollText,
  RefreshCw,
  Globe,
  Cpu,
  Timer,
  Coins,
  DollarSign,
  GitBranch,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { useDocumentInspect } from '@/hooks/useDocumentInspect';
import type {
  PipelineInspectEvent,
  DocumentChunk,
  DocumentEmbedding,
  DocumentVectorIndex,
  Clause,
  PipelineInspectReport,
} from '@/types/clarity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: string | null | undefined): string {
  return v ?? '—';
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtCost(usd: number): string {
  if (usd === 0) return '$0.000000';
  return `$${usd.toFixed(6)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-sm text-slate-200 break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/8 bg-white/3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    indexed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    failed: 'bg-red-500/15 text-red-300 border-red-500/25',
    embedding: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
    indexing: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    current: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    stale: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  };
  const cls = map[status] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/25';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section: Upload
// ---------------------------------------------------------------------------

function UploadSection({ report }: { report: PipelineInspectReport }) {
  const d = report.document;
  return (
    <div className="space-y-4">
      <SectionCard title="Document">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KV label="Filename" value={d.filename} />
          <KV label="Status" value={d.status} />
          <KV label="Source Type" value={d.sourceType} />
          <KV label="Page Count" value={d.pageCount?.toString() ?? '—'} />
          <KV label="Created" value={fmtTs(d.createdAt)} />
          {d.error && <KV label="Error" value={d.error} />}
        </div>
      </SectionCard>
      <SectionCard title="Ingestion Run">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KV label="Run ID" value={fmt(d.ingestionRunId)} mono />
          <KV label="Started" value={fmtTs(d.ingestionStartedAt)} />
          <KV label="Completed" value={fmtTs(d.ingestionCompletedAt)} />
          {d.ingestionStartedAt && d.ingestionCompletedAt && (
            <KV
              label="Duration"
              value={fmtMs(
                new Date(d.ingestionCompletedAt).getTime() -
                  new Date(d.ingestionStartedAt).getTime(),
              )}
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Extraction
// ---------------------------------------------------------------------------

function ExtractionSection({ report }: { report: PipelineInspectReport }) {
  const a = report.artifacts;
  if (!a) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
        <AlertCircle size={16} />
        No extraction artifacts found. The pipeline_events table may not have this data yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SectionCard title="Artifact Info">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KV label="Source SHA-256" value={fmt(a.sourceSha256)} mono />
          <KV label="Extracted Blocks" value={a.extractionBlockCount.toString()} />
          <KV label="Normalized Blocks" value={a.normalizedBlockCount.toString()} />
          <KV label="Preprocessing Segments" value={a.preprocessingSegmentCount.toString()} />
        </div>
      </SectionCard>
      {a.extractionTextPreview && (
        <SectionCard title="Extracted Text (first 4 000 chars)">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-5 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {a.extractionTextPreview}
          </pre>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Normalized Text
// ---------------------------------------------------------------------------

function NormalizedTextSection({ report }: { report: PipelineInspectReport }) {
  const a = report.artifacts;
  if (!a?.normalizedTextPreview) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
        <AlertCircle size={16} />
        No normalized text artifacts found.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SectionCard title="Normalized Text (first 4 000 chars)">
        <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-5 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {a.normalizedTextPreview}
        </pre>
      </SectionCard>
      {a.metadata && (
        <SectionCard title="Document Metadata">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono leading-5 max-h-64 overflow-y-auto">
            {JSON.stringify(a.metadata, null, 2)}
          </pre>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Clause Extraction
// ---------------------------------------------------------------------------

function ClauseExtractionSection({ report }: { report: PipelineInspectReport }) {
  const clauses = report.clauses;
  if (clauses.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
        <AlertCircle size={16} />
        No clauses extracted yet. Ingestion must complete first.
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    flagged: 'text-red-400 bg-red-500/10 border-red-500/20',
    non_standard: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    normal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(['flagged', 'non_standard', 'normal'] as const).map((flag) => {
          const count = clauses.filter((c) => c.riskFlag === flag).length;
          return (
            <div key={flag} className={`rounded-lg border p-3 ${riskColors[flag]}`}>
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs opacity-80 capitalize">{flag.replace('_', ' ')}</div>
            </div>
          );
        })}
      </div>
      <SectionCard title={`Clauses (${clauses.length})`}>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {clauses.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300 capitalize">
                  {c.clauseType}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${riskColors[c.riskFlag]}`}>
                    {c.riskFlag.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500">p. {c.page}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{c.text}</p>
              {c.rationale && (
                <p className="text-[11px] text-slate-500 italic">{c.rationale}</p>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Chunks
// ---------------------------------------------------------------------------

function ChunksSection({ report }: { report: PipelineInspectReport }) {
  const chunks = report.chunks;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (chunks.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
        <AlertCircle size={16} />
        No chunks yet. Ingestion must complete first.
      </div>
    );
  }

  const totalTokens = chunks.reduce((s, c) => s + c.tokenCount, 0);
  const avgTokens = chunks.length ? Math.round(totalTokens / chunks.length) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{chunks.length}</div>
          <div className="text-xs text-slate-500">Total chunks</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{totalTokens.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Total tokens</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{avgTokens}</div>
          <div className="text-xs text-slate-500">Avg tokens/chunk</div>
        </div>
      </div>
      <SectionCard title={`Chunks (${chunks.length})`}>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {chunks.map((c) => (
            <div key={c.chunkId} className="rounded-lg border border-white/8 bg-white/3 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.chunkId ? null : c.chunkId)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-right">{c.chunkIndex}</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {c.sectionTitle || c.clauseNumber || `Chunk ${c.chunkIndex}`}
                  </span>
                  <StatusPill status={c.chunkKind} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>pp. {c.pageStart}–{c.pageEnd}</span>
                  <span>{c.tokenCount} tok</span>
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${expanded === c.chunkId ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {expanded === c.chunkId && (
                <div className="px-3 pb-3 space-y-2 border-t border-white/8">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <KV label="Chunk ID" value={c.chunkId} mono />
                    <KV label="Checksum" value={c.checksum} mono />
                    <KV label="Parser Version" value={c.parserVersion} mono />
                    <KV label="Chunk Version" value={c.chunkVersion} mono />
                    <KV label="Fragment" value={`${c.fragmentIndex + 1} / ${c.fragmentCount}`} />
                    {c.crossReferences.length > 0 && (
                      <KV label="Cross-refs" value={c.crossReferences.join(', ')} />
                    )}
                  </div>
                  <div className="rounded bg-black/30 p-2 text-xs text-slate-300 font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                    {c.text}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Embeddings
// ---------------------------------------------------------------------------

function EmbeddingsSection({ report }: { report: PipelineInspectReport }) {
  const embeddings = report.embeddings;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (embeddings.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
        <AlertCircle size={16} />
        No embeddings yet. Embedding pipeline must run first.
      </div>
    );
  }

  const totalCost = embeddings.reduce((s, e) => s + e.estimatedCostUsd, 0);
  const avgLatency =
    embeddings.filter((e) => e.latencyMs != null).reduce((s, e) => s + (e.latencyMs ?? 0), 0) /
    (embeddings.filter((e) => e.latencyMs != null).length || 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{embeddings.length}</div>
          <div className="text-xs text-slate-500">Embedding records</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{report.staleEmbeddingCount}</div>
          <div className="text-xs text-slate-500">Stale</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{fmtMs(Math.round(avgLatency))}</div>
          <div className="text-xs text-slate-500">Avg embed latency</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{fmtCost(totalCost)}</div>
          <div className="text-xs text-slate-500">Total cost</div>
        </div>
      </div>
      <SectionCard title="Current Embedding Target">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KV label="Provider" value={fmt(report.currentEmbeddingProvider)} />
          <KV label="Model" value={fmt(report.currentEmbeddingModel)} />
          <KV label="Dimension" value={report.currentEmbeddingDimension?.toString() ?? '—'} />
          <KV label="Embedding Version" value={fmt(report.currentEmbeddingVersion)} mono />
          <KV label="Parser Version" value={fmt(report.currentEmbeddingParserVersion)} mono />
          <KV label="Chunk Version" value={fmt(report.currentEmbeddingChunkVersion)} mono />
        </div>
      </SectionCard>
      <SectionCard title={`Embedding Records (${embeddings.length})`}>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {embeddings.map((e) => (
            <div key={e.chunkId} className="rounded-lg border border-white/8 bg-white/3 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === e.chunkId ? null : e.chunkId)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-right">{e.chunkIndex}</span>
                  <StatusPill status={e.status} />
                  <span className="text-xs text-slate-400 font-mono">{e.chunkId.slice(0, 8)}…</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>{e.tokenCount} tok</span>
                  <span>{fmtMs(e.latencyMs)}</span>
                  <span>{fmtCost(e.estimatedCostUsd)}</span>
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${expanded === e.chunkId ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {expanded === e.chunkId && (
                <div className="px-3 pb-3 space-y-2 border-t border-white/8">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <KV label="Chunk ID" value={e.chunkId} mono />
                    <KV label="Checksum" value={e.checksum} mono />
                    <KV label="Provider" value={e.embeddingProvider} />
                    <KV label="Model" value={e.embeddingModel} />
                    <KV label="Dimension" value={e.embeddingDimension.toString()} />
                    <KV label="Retry Count" value={e.retryCount.toString()} />
                    <KV label="Created" value={fmtTs(e.createdAt)} />
                  </div>
                  {e.vectorPreview.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-1">Vector Preview (first {e.vectorPreview.length} dims)</p>
                      <div className="rounded bg-black/30 p-2 text-[10px] font-mono text-slate-400 break-all leading-5">
                        [{e.vectorPreview.map((v) => v.toFixed(4)).join(', ')}]
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Vector IDs
// ---------------------------------------------------------------------------

function VectorIDsSection({ report }: { report: PipelineInspectReport }) {
  const vectors = report.vectors;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (vectors.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
        <AlertCircle size={16} />
        No vector index records yet. Indexing pipeline must run first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{vectors.length}</div>
          <div className="text-xs text-slate-500">Total vectors</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{report.staleVectorCount}</div>
          <div className="text-xs text-slate-500">Stale</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">
            {fmt(report.currentIndexProvider)}
          </div>
          <div className="text-xs text-slate-500">Provider</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100 truncate">
            {fmt(report.currentIndexNamespace)}
          </div>
          <div className="text-xs text-slate-500">Namespace</div>
        </div>
      </div>
      <SectionCard title="Index Target">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KV label="Provider" value={fmt(report.currentIndexProvider)} />
          <KV label="Index Name" value={fmt(report.currentIndexName)} />
          <KV label="Namespace" value={fmt(report.currentIndexNamespace)} mono />
        </div>
      </SectionCard>
      <SectionCard title={`Vector Records (${vectors.length})`}>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {vectors.map((v) => (
            <div key={v.vectorId} className="rounded-lg border border-white/8 bg-white/3 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === v.vectorId ? null : v.vectorId)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500 w-6 text-right">{v.chunkIndex}</span>
                  <StatusPill status={v.status} />
                  <span className="text-xs font-mono text-slate-400">{v.vectorId.slice(0, 16)}…</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>pp. {v.pageStart}–{v.pageEnd}</span>
                  <span>{fmtMs(v.latencyMs)}</span>
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${expanded === v.vectorId ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {expanded === v.vectorId && (
                <div className="px-3 pb-3 space-y-2 border-t border-white/8">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase">Vector ID</span>
                      <span className="text-xs font-mono text-slate-300 break-all flex-1">{v.vectorId}</span>
                      <CopyButton text={v.vectorId} />
                    </div>
                    <KV label="Chunk ID" value={v.chunkId} mono />
                    <KV label="Checksum" value={v.checksum} mono />
                    <KV label="Embedding Provider" value={v.embeddingProvider} />
                    <KV label="Embedding Model" value={v.embeddingModel} />
                    <KV label="Retry Count" value={v.retryCount.toString()} />
                    <KV label="Indexed At" value={fmtTs(v.indexedAt)} />
                  </div>
                  {v.chunkText && (
                    <div className="rounded bg-black/30 p-2 text-[10px] font-mono text-slate-400 max-h-28 overflow-y-auto whitespace-pre-wrap">
                      {v.chunkText.slice(0, 500)}{v.chunkText.length > 500 ? '…' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Verification
// ---------------------------------------------------------------------------

function VerificationSection({ report }: { report: PipelineInspectReport }) {
  const chunkCount = report.chunkCount;
  const embCount = report.embeddings.filter((e) => e.status === 'current').length;
  const vecCount = report.vectors.filter((v) => v.status === 'current').length;
  const fullyIndexed = report.document.status === 'indexed';
  const staleEmbeddings = report.staleEmbeddingCount;
  const staleVectors = report.staleVectorCount;

  const checks = [
    {
      label: 'Ingestion complete',
      pass: ['chunked', 'awaiting_embeddings', 'embedding', 'embedded', 'awaiting_index', 'indexing', 'indexed'].includes(report.document.status),
      detail: `Status: ${report.document.status}`,
    },
    {
      label: 'All chunks have current embeddings',
      pass: chunkCount > 0 && embCount === chunkCount && staleEmbeddings === 0,
      detail: `${embCount} / ${chunkCount} current, ${staleEmbeddings} stale`,
    },
    {
      label: 'All chunks indexed in vector store',
      pass: chunkCount > 0 && vecCount === chunkCount && staleVectors === 0,
      detail: `${vecCount} / ${chunkCount} current, ${staleVectors} stale`,
    },
    {
      label: 'Document status = indexed',
      pass: fullyIndexed,
      detail: `Status: ${report.document.status}`,
    },
    {
      label: 'No error on document',
      pass: !report.document.error,
      detail: report.document.error ?? 'None',
    },
  ];

  const passed = checks.filter((c) => c.pass).length;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${
        passed === checks.length
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}>
        {passed === checks.length
          ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
          : <AlertCircle size={24} className="text-amber-400 shrink-0" />}
        <div>
          <div className={`font-semibold text-sm ${passed === checks.length ? 'text-emerald-300' : 'text-amber-300'}`}>
            {passed === checks.length ? 'All checks passed — document is fully indexed' : `${passed} / ${checks.length} checks passed`}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Verification confirms all pipeline stages completed successfully with no stale data.
          </div>
        </div>
      </div>
      <SectionCard title="Verification Checklist">
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              {c.pass
                ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                : <AlertCircle size={14} className="text-amber-400 shrink-0" />}
              <div className="flex-1">
                <span className="text-sm text-slate-200">{c.label}</span>
              </div>
              <span className="text-xs text-slate-500">{c.detail}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Answer History
// ---------------------------------------------------------------------------

function AnswerHistorySection({ report }: { report: PipelineInspectReport }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <MessageSquare size={18} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-medium text-blue-300 mb-1">Answer history is tracked workspace-wide</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Answer runs are linked to retrieval events, not directly to individual documents.
              To see which answers cited chunks from this document ({report.documentId.slice(0, 8)}…),
              use the Answers Explorer in the Developer Console where you can filter by document.
            </p>
          </div>
        </div>
      </div>
      <SectionCard title="Document Stats">
        <div className="grid grid-cols-2 gap-4">
          <KV label="Document ID" value={report.documentId} mono />
          <KV label="Chunk Count" value={report.chunkCount.toString()} />
          <KV label="Status" value={report.document.status} />
          <KV label="Total Tokens Indexed" value={report.totalTokens.toLocaleString()} />
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Logs
// ---------------------------------------------------------------------------

function LogsSection({ report }: { report: PipelineInspectReport }) {
  const events = report.events;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-slate-500 text-sm py-8">
        <AlertCircle size={16} />
        <p>No pipeline events found.</p>
        <p className="text-xs text-slate-600">
          Run <code className="font-mono">backend/migrations/001_pipeline_events.sql</code> to enable persistent event logging.
        </p>
      </div>
    );
  }

  return (
    <SectionCard title={`Pipeline Logs (${events.length} events)`}>
      <div className="space-y-1 max-h-[600px] overflow-y-auto font-mono text-xs">
        {events.map((ev) => (
          <div
            key={ev.eventId}
            className={`flex items-start gap-3 py-1.5 px-2 rounded ${
              ev.error ? 'bg-red-500/8' : 'hover:bg-white/3'
            }`}
          >
            <span className="text-slate-600 shrink-0 w-24 truncate">{new Date(ev.createdAt).toLocaleTimeString()}</span>
            <span className={`shrink-0 w-20 truncate ${
              ev.stage === 'failed' ? 'text-red-400' :
              ev.stage === 'completed' ? 'text-emerald-400' :
              'text-violet-400'
            }`}>{ev.stage}</span>
            <span className="text-slate-400 shrink-0 w-28 truncate">{ev.status}</span>
            <span className="text-slate-500 shrink-0 w-10 text-right">{ev.progress}%</span>
            <span className="text-slate-600 shrink-0 w-20 text-right">{fmtMs(ev.elapsedMs)}</span>
            {ev.error && (
              <span className="text-red-400 flex-1 truncate">{ev.error}</span>
            )}
            {ev.worker && !ev.error && (
              <span className="text-slate-600 flex-1 truncate">{ev.worker}</span>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: Retries
// ---------------------------------------------------------------------------

function RetriesSection({ report }: { report: PipelineInspectReport }) {
  const d = report.document;
  const embeddingRetries = report.embeddings.reduce((s, e) => s + e.retryCount, 0);
  const vectorRetries = report.vectors.reduce((s, v) => s + v.retryCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className={`text-xl font-bold ${report.totalRetries > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {report.totalRetries}
          </div>
          <div className="text-xs text-slate-500">Total retries</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{d.embeddingRetryCount}</div>
          <div className="text-xs text-slate-500">Embedding run retries</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{d.indexRetryCount}</div>
          <div className="text-xs text-slate-500">Index run retries</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{embeddingRetries + vectorRetries}</div>
          <div className="text-xs text-slate-500">Per-chunk retries</div>
        </div>
      </div>
      <SectionCard title="Retry Breakdown by Run">
        <div className="space-y-3">
          {[
            { label: 'Embedding run', value: d.embeddingRetryCount, detail: `Run ID: ${d.embeddingRunId ?? 'none'}` },
            { label: 'Index run', value: d.indexRetryCount, detail: `Run ID: ${d.indexRunId ?? 'none'}` },
            { label: 'Per-chunk embedding retries (sum)', value: embeddingRetries, detail: `across ${report.embeddingCount} embedding records` },
            { label: 'Per-vector index retries (sum)', value: vectorRetries, detail: `across ${report.vectorCount} vector records` },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <div className="text-sm text-slate-300">{row.label}</div>
                <div className="text-xs text-slate-600">{row.detail}</div>
              </div>
              <span className={`text-lg font-bold ${row.value > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: API Calls
// ---------------------------------------------------------------------------

function APICallsSection({ report }: { report: PipelineInspectReport }) {
  const events = report.events;
  const stageGroups: Record<string, number> = {};
  for (const ev of events) {
    stageGroups[ev.stage] = (stageGroups[ev.stage] ?? 0) + 1;
  }

  const providers = new Set<string>();
  if (report.currentEmbeddingProvider) providers.add(report.currentEmbeddingProvider);
  if (report.currentIndexProvider) providers.add(report.currentIndexProvider);
  const uniqueWorkers = new Set(events.map((e) => e.worker).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{events.length}</div>
          <div className="text-xs text-slate-500">Pipeline events</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{report.embeddingCount}</div>
          <div className="text-xs text-slate-500">Embedding API calls</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{providers.size}</div>
          <div className="text-xs text-slate-500">External providers</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{uniqueWorkers.size}</div>
          <div className="text-xs text-slate-500">Workers</div>
        </div>
      </div>
      <SectionCard title="Events by Stage">
        <div className="space-y-2">
          {Object.entries(stageGroups).map(([stage, count]) => (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-28 truncate">{stage}</span>
              <div className="flex-1 bg-white/5 rounded-full h-2">
                <div
                  className="bg-violet-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (count / events.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-400 w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </SectionCard>
      {report.currentEmbeddingProvider && (
        <SectionCard title="Embedding Provider">
          <div className="grid grid-cols-2 gap-4">
            <KV label="Provider" value={fmt(report.currentEmbeddingProvider)} />
            <KV label="Model" value={fmt(report.currentEmbeddingModel)} />
            <KV label="Dimension" value={report.currentEmbeddingDimension?.toString() ?? '—'} />
            <KV label="Embedding Version" value={fmt(report.currentEmbeddingVersion)} mono />
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Worker
// ---------------------------------------------------------------------------

function WorkerSection({ report }: { report: PipelineInspectReport }) {
  const wi = report.latestWorkerInfo;
  const events = report.events;
  const workersMap: Record<string, { count: number; lastSeen: string }> = {};
  for (const ev of events) {
    if (!ev.worker) continue;
    if (!workersMap[ev.worker]) workersMap[ev.worker] = { count: 0, lastSeen: ev.createdAt };
    workersMap[ev.worker].count++;
    workersMap[ev.worker].lastSeen = ev.createdAt;
  }

  return (
    <div className="space-y-4">
      {wi ? (
        <SectionCard title="Latest Worker Snapshot">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KV label="PID" value={wi.pid.toString()} mono />
            <KV label="Hostname" value={wi.hostname} mono />
            <KV label="Memory" value={`${wi.memory_mb} MB`} />
            <KV label="CPU" value={`${wi.cpu_percent}%`} />
            <KV label="Worker Version" value={wi.worker_version} mono />
            <KV label="Build SHA" value={wi.build} mono />
          </div>
        </SectionCard>
      ) : (
        <div className="text-sm text-slate-500 text-center py-4">
          No worker metadata available. Requires pipeline_events table.
        </div>
      )}
      {Object.keys(workersMap).length > 0 && (
        <SectionCard title="Worker Activity">
          <div className="space-y-2">
            {Object.entries(workersMap).map(([worker, info]) => (
              <div key={worker} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-xs font-mono text-slate-300">{worker}</span>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{info.count} events</span>
                  <span>Last: {fmtTs(info.lastSeen)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Latency
// ---------------------------------------------------------------------------

function LatencySection({ report }: { report: PipelineInspectReport }) {
  const st = report.latestStageTimings;
  const d = report.document;

  const ingestionMs = d.ingestionStartedAt && d.ingestionCompletedAt
    ? new Date(d.ingestionCompletedAt).getTime() - new Date(d.ingestionStartedAt).getTime()
    : null;
  const embeddingMs = d.embeddingStartedAt && d.embeddingCompletedAt
    ? new Date(d.embeddingCompletedAt).getTime() - new Date(d.embeddingStartedAt).getTime()
    : null;
  const indexingMs = d.indexStartedAt && d.indexCompletedAt
    ? new Date(d.indexCompletedAt).getTime() - new Date(d.indexStartedAt).getTime()
    : null;
  const totalMs = ingestionMs && embeddingMs && indexingMs
    ? ingestionMs + embeddingMs + indexingMs
    : null;

  const stageRows = st ? [
    { label: 'R2 Fetch', key: 'fetch_ms' },
    { label: 'Text Extraction', key: 'extract_ms' },
    { label: 'Normalization', key: 'normalize_ms' },
    { label: 'Preprocessing', key: 'preprocess_ms' },
    { label: 'Chunking', key: 'chunk_ms' },
    { label: 'Persist Chunks', key: 'persist_ms' },
    { label: 'Build Pending', key: 'build_pending_ms' },
    { label: 'OpenAI Embed', key: 'embed_ms' },
    { label: 'Load Records', key: 'load_records_ms' },
    { label: 'Pinecone Upsert', key: 'upsert_ms' },
    { label: 'Cleanup', key: 'cleanup_ms' },
  ].filter((r) => st[r.key] != null) : [];

  const maxMs = stageRows.length > 0 ? Math.max(...stageRows.map((r) => st![r.key])) : 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ingestion', ms: ingestionMs },
          { label: 'Embedding', ms: embeddingMs },
          { label: 'Indexing', ms: indexingMs },
          { label: 'End-to-end', ms: totalMs },
        ].map((row) => (
          <div key={row.label} className="rounded-lg border border-white/8 bg-white/3 p-3">
            <div className="text-xl font-bold text-slate-100">{fmtMs(row.ms)}</div>
            <div className="text-xs text-slate-500">{row.label}</div>
          </div>
        ))}
      </div>
      {stageRows.length > 0 && (
        <SectionCard title="Per-Stage Timing">
          <div className="space-y-2">
            {stageRows.map((row) => {
              const ms = st![row.key];
              return (
                <div key={row.key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-36 truncate">{row.label}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2">
                    <div
                      className="bg-violet-500 h-2 rounded-full"
                      style={{ width: `${Math.max(2, (ms / maxMs) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-20 text-right">{fmtMs(ms)}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
      {stageRows.length === 0 && (
        <div className="text-sm text-slate-500 text-center py-4">
          No per-stage timing data. Requires pipeline_events table with stage_timings.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Token Usage
// ---------------------------------------------------------------------------

function TokenUsageSection({ report }: { report: PipelineInspectReport }) {
  const chunks = report.chunks;
  const kindTotals: Record<string, number> = {};
  for (const c of chunks) {
    kindTotals[c.chunkKind] = (kindTotals[c.chunkKind] ?? 0) + c.tokenCount;
  }

  const d = report.document;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{report.totalTokens.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Total tokens (chunks)</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{report.chunkCount}</div>
          <div className="text-xs text-slate-500">Chunks</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">
            {report.chunkCount > 0 ? Math.round(report.totalTokens / report.chunkCount) : 0}
          </div>
          <div className="text-xs text-slate-500">Avg tokens/chunk</div>
        </div>
      </div>
      {Object.keys(kindTotals).length > 0 && (
        <SectionCard title="Tokens by Chunk Kind">
          <div className="space-y-2">
            {Object.entries(kindTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([kind, tokens]) => (
                <div key={kind} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 truncate capitalize">{kind}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2">
                    <div
                      className="bg-violet-500 h-2 rounded-full"
                      style={{ width: `${Math.max(2, (tokens / report.totalTokens) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-20 text-right">{tokens.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </SectionCard>
      )}
      <SectionCard title="Embedding Model Context">
        <div className="grid grid-cols-2 gap-4">
          <KV label="Provider" value={fmt(d.currentEmbeddingProvider)} />
          <KV label="Model" value={fmt(d.currentEmbeddingModel)} />
          <KV label="Dimension" value={d.currentEmbeddingDimension?.toString() ?? '—'} />
          <KV label="Embedded Chunks" value={report.embeddingCount.toString()} />
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Cost
// ---------------------------------------------------------------------------

function CostSection({ report }: { report: PipelineInspectReport }) {
  const embeddings = report.embeddings;
  const totalCost = report.totalCostUsd;

  const costByModel: Record<string, number> = {};
  for (const e of embeddings) {
    const key = `${e.embeddingProvider}/${e.embeddingModel}`;
    costByModel[key] = (costByModel[key] ?? 0) + e.estimatedCostUsd;
  }

  const avgCostPerChunk = embeddings.length > 0 ? totalCost / embeddings.length : 0;
  const avgCostPerToken = report.totalTokens > 0 ? totalCost / report.totalTokens : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{fmtCost(totalCost)}</div>
          <div className="text-xs text-slate-500">Total embedding cost</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{fmtCost(avgCostPerChunk)}</div>
          <div className="text-xs text-slate-500">Per chunk</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">${(avgCostPerToken * 1000).toFixed(8)}</div>
          <div className="text-xs text-slate-500">Per 1k tokens</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-xl font-bold text-slate-100">{report.totalTokens.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Tokens processed</div>
        </div>
      </div>
      {Object.keys(costByModel).length > 0 && (
        <SectionCard title="Cost by Model">
          <div className="space-y-2">
            {Object.entries(costByModel).map(([model, cost]) => (
              <div key={model} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-xs font-mono text-slate-300">{model}</span>
                <span className="text-xs font-mono text-slate-200">{fmtCost(cost)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Timeline
// ---------------------------------------------------------------------------

function TimelineSection({ report }: { report: PipelineInspectReport }) {
  const events = report.events;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-slate-500 text-sm py-8">
        <AlertCircle size={16} />
        <p>No events to display.</p>
        <p className="text-xs text-slate-600">Requires pipeline_events table (001_pipeline_events.sql).</p>
      </div>
    );
  }

  const stageColors: Record<string, string> = {
    queued: 'bg-slate-500',
    extracting: 'bg-blue-500',
    normalizing: 'bg-cyan-500',
    clause_extraction: 'bg-teal-500',
    chunking: 'bg-indigo-500',
    embedding: 'bg-violet-500',
    indexing: 'bg-purple-500',
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
  };

  return (
    <SectionCard title={`Event Timeline (${events.length} events)`}>
      <div className="relative space-y-0 max-h-[600px] overflow-y-auto pr-2">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-white/8" />
        {events.map((ev, i) => {
          const dotColor = stageColors[ev.stage] ?? 'bg-slate-400';
          const isLast = i === events.length - 1;
          return (
            <div key={ev.eventId} className="relative flex items-start gap-4 pb-4">
              <div className={`relative z-10 mt-1 h-2.5 w-2.5 rounded-full shrink-0 ml-[14px] ${dotColor} ring-2 ring-[#0D0F1A]`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${
                    ev.stage === 'failed' ? 'text-red-300' :
                    ev.stage === 'completed' ? 'text-emerald-300' :
                    'text-slate-200'
                  }`}>{ev.stage}</span>
                  <span className="text-[10px] text-slate-500">{ev.status}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    ev.progress === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/8 text-slate-400'
                  }`}>{ev.progress}%</span>
                  <span className="text-[10px] text-slate-600">{fmtMs(ev.elapsedMs)}</span>
                </div>
                {ev.error && (
                  <p className="text-[11px] text-red-400 mt-0.5">{ev.error}</p>
                )}
                {ev.stageTimings && Object.keys(ev.stageTimings).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {Object.entries(ev.stageTimings).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-mono text-slate-600">
                        {k}: {fmtMs(v)}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-slate-600">{fmtTs(ev.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Sidebar nav
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'upload', label: 'Upload', icon: Upload, desc: 'Document + ingestion run' },
  { id: 'extraction', label: 'Extraction', icon: FileText, desc: 'Extracted text' },
  { id: 'normalized', label: 'Normalized Text', icon: AlignLeft, desc: 'Normalized + metadata' },
  { id: 'clauses', label: 'Clause Extraction', icon: Tag, desc: 'Risk-classified clauses' },
  { id: 'chunks', label: 'Chunks', icon: Layers, desc: 'Chunked text segments' },
  { id: 'embeddings', label: 'Embeddings', icon: Zap, desc: 'Vector embeddings' },
  { id: 'vectors', label: 'Vector IDs', icon: Hash, desc: 'Pinecone vector records' },
  { id: 'verification', label: 'Verification', icon: ShieldCheck, desc: 'Pipeline health checks' },
  { id: 'answers', label: 'Answer History', icon: MessageSquare, desc: 'Document usage in answers' },
  { id: 'logs', label: 'Logs', icon: ScrollText, desc: 'Pipeline event log' },
  { id: 'retries', label: 'Retries', icon: RefreshCw, desc: 'Retry counts per stage' },
  { id: 'api-calls', label: 'API Calls', icon: Globe, desc: 'External provider calls' },
  { id: 'worker', label: 'Worker', icon: Cpu, desc: 'Worker process metadata' },
  { id: 'latency', label: 'Latency', icon: Timer, desc: 'Per-stage timing' },
  { id: 'tokens', label: 'Token Usage', icon: Coins, desc: 'Token counts by chunk' },
  { id: 'cost', label: 'Cost', icon: DollarSign, desc: 'Embedding cost breakdown' },
  { id: 'timeline', label: 'Timeline', icon: GitBranch, desc: 'Chronological event view' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PipelineInspectorPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') ?? '';
  const [activeSection, setActiveSection] = useState<SectionId>('upload');

  const { data: report, isLoading, error } = useDocumentInspect(params.documentId);

  const headerStatusColor = useMemo(() => {
    if (!report) return 'text-slate-400';
    const s = report.document.status;
    if (s === 'indexed') return 'text-emerald-400';
    if (s === 'failed') return 'text-red-400';
    return 'text-violet-400';
  }, [report]);

  function renderSection() {
    if (!report) return null;
    switch (activeSection) {
      case 'upload': return <UploadSection report={report} />;
      case 'extraction': return <ExtractionSection report={report} />;
      case 'normalized': return <NormalizedTextSection report={report} />;
      case 'clauses': return <ClauseExtractionSection report={report} />;
      case 'chunks': return <ChunksSection report={report} />;
      case 'embeddings': return <EmbeddingsSection report={report} />;
      case 'vectors': return <VectorIDsSection report={report} />;
      case 'verification': return <VerificationSection report={report} />;
      case 'answers': return <AnswerHistorySection report={report} />;
      case 'logs': return <LogsSection report={report} />;
      case 'retries': return <RetriesSection report={report} />;
      case 'api-calls': return <APICallsSection report={report} />;
      case 'worker': return <WorkerSection report={report} />;
      case 'latency': return <LatencySection report={report} />;
      case 'tokens': return <TokenUsageSection report={report} />;
      case 'cost': return <CostSection report={report} />;
      case 'timeline': return <TimelineSection report={report} />;
    }
  }

  const sectionBadges: Partial<Record<SectionId, number | string>> = report
    ? {
        chunks: report.chunkCount,
        clauses: report.clauseCount,
        embeddings: report.embeddingCount,
        vectors: report.vectorCount,
        logs: report.events.length,
        retries: report.totalRetries || undefined,
        tokens: report.totalTokens > 0 ? `${(report.totalTokens / 1000).toFixed(1)}k` : undefined,
        cost: report.totalCostUsd > 0 ? fmtCost(report.totalCostUsd) : undefined,
      }
    : {};

  return (
    <div className="min-h-screen bg-[#0D0F1A] text-slate-100">
      {/* Header */}
      <div className="border-b border-white/8 bg-white/3 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/developer/dashboard${workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : ''}`}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-500">Pipeline Inspector</span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-100 truncate">
              {report?.document.filename ?? 'Loading…'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-semibold uppercase tracking-wider ${headerStatusColor}`}>
                {report?.document.status ?? '—'}
              </span>
              {report && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500">{report.document.sourceType.toUpperCase()}</span>
                  {report.document.pageCount && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-500">{report.document.pageCount} pages</span>
                    </>
                  )}
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500">{report.chunkCount} chunks</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500">{report.totalTokens.toLocaleString()} tokens</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500">{fmtCost(report.totalCostUsd)}</span>
                </>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-600 hidden md:block">
            {params.documentId}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading pipeline data…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm text-red-300">Failed to load pipeline inspector</p>
          <p className="text-xs text-slate-500">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {report && !isLoading && (
        <div className="flex h-[calc(100vh-120px)]">
          {/* Sidebar */}
          <div className="w-56 shrink-0 border-r border-white/8 overflow-y-auto py-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const badge = sectionBadges[s.id];
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors group ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon
                    size={13}
                    className={isActive ? 'text-violet-400' : 'text-slate-600 group-hover:text-slate-400'}
                  />
                  <span className="text-xs font-medium flex-1 truncate">{s.label}</span>
                  {badge != null && badge !== 0 && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-violet-500/30 text-violet-300' : 'bg-white/8 text-slate-500'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {renderSection()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
