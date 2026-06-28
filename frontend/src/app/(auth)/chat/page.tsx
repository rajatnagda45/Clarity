import Link from 'next/link';


export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Phase A1</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Chat module</h1>
        <p className="mt-2 text-sm text-slate-600">
          The authenticated app shell is ready. Retrieval and streaming cited answers arrive in
          Milestones A5 and A6.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Active workspace:{' '}
          <span className="font-mono text-slate-800">{workspace ?? 'not selected'}</span>
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Workspace-aware routing is in place now so later milestones can plug chat into the same
          tenant boundary.
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
