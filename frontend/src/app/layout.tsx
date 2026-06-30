import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { UIProvider } from '@/contexts/UIContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { ToastProvider } from '@/contexts/ToastContext';
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
              <ToastProvider>
                {children}
              </ToastProvider>
            </WorkspaceProvider>
          </UIProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
