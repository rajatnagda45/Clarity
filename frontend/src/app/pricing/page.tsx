import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { BackgroundEffects } from '@/components/landing/BackgroundEffects';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Footer } from '@/components/landing/Footer';
import { PricingHero } from '@/components/landing/pricing/PricingHero';
import { PricingFAQ } from '@/components/landing/pricing/PricingFAQ';
import { ComparisonTable } from '@/components/landing/pricing/ComparisonTable';
import { EnterprisePanel } from '@/components/landing/pricing/EnterprisePanel';
import { PipelineCostAnimation } from '@/components/landing/pricing/PipelineCostAnimation';

export const metadata = {
  title: 'Pricing - Clarity AI Docs',
  description: 'Simple pricing. Scale as your AI grows.',
};

export default async function PricingPage() {
  const { userId } = await auth();
  
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="relative min-h-screen text-white overflow-hidden selection:bg-orange-500/30 selection:text-white bg-[#05070B]">
      <BackgroundEffects />
      <LandingNavbar />
      
      <div className="relative z-10 flex flex-col pt-32">
        <PricingHero />
        <PipelineCostAnimation />
        <ComparisonTable />
        <EnterprisePanel />
        <PricingFAQ />
        <Footer />
      </div>
    </main>
  );
}
