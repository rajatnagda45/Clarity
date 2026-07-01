import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { BackgroundEffects } from '@/components/landing/BackgroundEffects';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { PipelineVisualizer } from '@/components/landing/PipelineVisualizer';
import { FeaturesBentoGrid } from '@/components/landing/FeaturesBentoGrid';
import { HowClarityWorks } from '@/components/landing/HowClarityWorks';
import { TrustAndVerification } from '@/components/landing/TrustAndVerification';
import { EnterpriseWorkspace } from '@/components/landing/EnterpriseWorkspace';

import { ReasoningTimeline } from '@/components/landing/ReasoningTimeline';
import { ObservabilityDashboard } from '@/components/landing/ObservabilityDashboard';
import { EnterpriseSecurity } from '@/components/landing/EnterpriseSecurity';
import { CustomerStories } from '@/components/landing/CustomerStories';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: 'Clarity AI Docs - Verified Enterprise Intelligence',
  description: 'Enterprise AI document analysis with verifiable citations.',
};

export default async function LandingPage() {
  const { userId } = await auth();
  
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="relative min-h-screen text-white overflow-clip selection:bg-orange-500/30 selection:text-white bg-[#05070B]">
      <BackgroundEffects />
      <LandingNavbar />

      <div className="relative z-10 flex flex-col">
        <HeroSection />
        <PipelineVisualizer />
        <FeaturesBentoGrid />
        <HowClarityWorks />
        <TrustAndVerification />
        <EnterpriseWorkspace />

        <ReasoningTimeline />
        <ObservabilityDashboard />
        <EnterpriseSecurity />
        <CustomerStories />
        <CTASection />
        <Footer />
      </div>
    </main>
  );
}
