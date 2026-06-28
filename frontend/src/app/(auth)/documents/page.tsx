import Link from 'next/link';


export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Phase A1</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Documents module</h1>
        <p className="mt-2 text-sm text-slate-600">
          Protected routing and workspace selection are ready. Upload, storage, and ingestion arrive
          in Milestone A2 and A3.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Active workspace:{' '}
          <span className="font-mono text-slate-800">{workspace ?? 'not selected'}</span>
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Return to the dashboard to create or pick a workspace before continuing with document
          ingestion milestones.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
