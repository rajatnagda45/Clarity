import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-5xl font-bold text-gray-900">Clarity</h1>
        <p className="text-xl text-gray-600">
          Self-auditing contract intelligence. Every claim verified against the source. Every
          answer carries a measured trust score.
        </p>
        <p className="text-sm text-gray-400 italic">
          Not legal advice — Clarity flags and explains; it does not advise.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Get started
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to dashboard
          </a>
        </SignedIn>
      </div>
    </main>
  );
}
