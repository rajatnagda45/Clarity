import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { BackgroundEffects } from '@/components/landing/BackgroundEffects';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Footer } from '@/components/landing/Footer';
import { PricingFAQ } from '@/components/landing/pricing/PricingFAQ';

export const metadata = {
  title: 'FAQ - Clarity AI Docs',
  description: 'Frequently Asked Questions about Clarity AI.',
};

export default async function FAQPage() {
  const { userId } = await auth();
  
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="relative min-h-screen text-white overflow-hidden selection:bg-orange-500/30 selection:text-white bg-[#05070B]">
      <BackgroundEffects />
      <LandingNavbar />
      
      <div className="relative z-10 flex flex-col pt-32">
        <PricingFAQ />
        <Footer />
      </div>
    </main>
  );
}
