import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { UIProvider } from '@/contexts/UIContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { DocumentEventsProvider } from '@/components/providers/DocumentEventsProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Clarity — Contract Intelligence',
  description:
    'Self-auditing contract intelligence. Every claim verified, every answer trusted.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased`}>
          <UIProvider>
            <WorkspaceProvider>
              <QueryProvider>
                {/* DocumentEventsProvider must be inside QueryProvider (needs useQueryClient)
                    and inside WorkspaceProvider (needs activeWorkspace). It subscribes once
                    per workspace and pushes pipeline events directly into the query cache. */}
                <DocumentEventsProvider>
                  <ToastProvider>
                    {children}
                  </ToastProvider>
                </DocumentEventsProvider>
              </QueryProvider>
            </WorkspaceProvider>
          </UIProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
