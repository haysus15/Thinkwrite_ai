'use client';

import { useEffect } from 'react';
import ParticleHero from '@/components/landing/ParticleHero';
import LandingNav from '@/components/landing/LandingNav';
import FeaturesSection from '@/components/landing/FeaturesSection';

export default function LandingPage() {
  // Add landing-page class to body for specific styling
  useEffect(() => {
    document.body.classList.add('landing-page');
    return () => {
      document.body.classList.remove('landing-page');
    };
  }, []);

  return (
    <main className="relative min-h-screen">
      <LandingNav />
      <ParticleHero />
      
      {/* Features section blends into Milky Way background */}
      <FeaturesSection />
    </main>
  );
}