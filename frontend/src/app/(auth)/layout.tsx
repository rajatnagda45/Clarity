import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';


export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
            Clarity
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/documents" className="hover:text-slate-900">
              Documents
            </Link>
            <Link href="/chat" className="hover:text-slate-900">
              Chat
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
