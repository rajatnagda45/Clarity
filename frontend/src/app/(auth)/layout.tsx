import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DarkAppLayout } from '@/components/layout/DarkAppLayout';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  return <DarkAppLayout>{children}</DarkAppLayout>;
}
