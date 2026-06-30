import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  return <AppShell>{children}</AppShell>;
}
