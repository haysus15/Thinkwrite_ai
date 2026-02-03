'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, Fingerprint, GraduationCap, Sparkles } from 'lucide-react';

export default function FeaturesSection() {
  const studios = [
    {
      name: "Mirror Mode",
      assistant: "Ursie",
      description: "Always learning, always adapting. Mirror Mode captures your unique writing DNA across all contexts, building a complete fingerprint of your authentic voice.",
      icon: <Fingerprint className="w-10 h-10" />,
      logoImage: "/mirror-mode-full-silver.png", // Full logo with symbol + text (full silver)
      color: "#C0C8D0", // Cool silver
      borderColor: "rgba(192, 200, 208, 0.3)",
      glowColor: "rgba(192, 200, 208, 0.1)",
      highlight: "Runs in the background across all studios",
      route: "/mirror-mode",
      available: true
    },
    {
      name: "Career Studio",
      assistant: "Lex",
      description: "Your HR-savvy career partner. From resumes to cover letters to professional communications, Lex ensures your authentic voice shines in every career moment.",
      icon: <Briefcase className="w-10 h-10" />,
      logoImage: "/career-studio-clean-large.png", // Full logo with sigil + text (clean, no lines)
      color: "#FFD37A", // Warm gold
      borderColor: "rgba(255, 211, 122, 0.4)",
      glowColor: "rgba(255, 211, 122, 0.15)",
      highlight: "Powered by Lex, your career guide",
      route: "/career-studio",
      available: true
    },
    {
      name: "Academic Studio",
      assistant: "Victor",
      description: "Victor and Travis sharpen your thinking with structured workflows, clear requirements, and academic integrity checks.",
      icon: <GraduationCap className="w-10 h-10" />,
      color: "#9CC2E7",
      borderColor: "rgba(156, 194, 231, 0.35)",
      glowColor: "rgba(156, 194, 231, 0.12)",
      highlight: "Powered by Victor and Travis",
      route: "/academic-studio/landing",
      available: true
    },
    {
      name: "Creative Studio",
      assistant: "Tre",
      description: "Where imagination meets your voice. Tre guides you through creative writing, storytelling, and artistic expression—all in your unique style.",
      icon: <Sparkles className="w-10 h-10" />,
      color: "#F0D7AA", // Champagne
      borderColor: "rgba(240, 215, 170, 0.3)",
      glowColor: "rgba(240, 215, 170, 0.1)",
      highlight: "Powered by Tre, your creative companion",
      route: "#",
      available: false
    }
  ];

  return (
    <section id="features" className="relative min-h-screen py-20 px-6">
      {/* NO separate background - blends into ParticleHero Milky Way */}
      
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 
            className="font-['Orbitron'] text-5xl md:text-6xl font-bold mb-6"
            style={{
              background: 'linear-gradient(90deg, #BFC6CF 0%, #FFFFFF 25%, #F6E7B8 60%, #FFD37A 85%, #B8860B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px rgba(255,210,120,0.15)',
            }}
          >
            Four Studios. One Voice.
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Each studio powered by its own AI assistant, guiding you step-by-step while Mirror Mode learns your writing DNA in the background.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {studios.map((studio) => {
            const CardContent = (
              <>
                {studio.logoImage ? (
  <div className="mb-6">
    {/* Unified logo slot (keeps both logos visually equal) */}
    <div className="relative mx-auto h-[130px] w-full max-w-[360px] flex items-center justify-center">
      {/* Baseline alignment: nudge Career Studio upward */}
      <div
        className={`relative h-full w-full ${
          studio.name === "Career Studio" ? "-translate-y-3" : ""
        }`}
      >
        <Image
          src={studio.logoImage}
          alt={studio.name}
          fill
          className="object-contain"
          style={{
            mixBlendMode: "screen",
            filter: "brightness(1.1)",
          }}
          priority={studio.name === "Mirror Mode"}
        />
      </div>
    </div>
  </div>
) : (

                  // Icon & Name for studios without full logos
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-5xl">
                      {studio.icon}
                    </div>
                    <div>
                      <h3 
                        className="font-['Orbitron'] text-2xl font-bold"
                        style={{ color: studio.color }}
                      >
                        {studio.name}
                      </h3>
                      <p 
                        className="text-sm font-semibold"
                        style={{ color: studio.color, opacity: 0.8 }}
                      >
                        {studio.highlight}
                      </p>
                    </div>
                  </div>
                )}

                {/* Highlight text for studios with logos */}
                {studio.logoImage && (
                  <p 
                    className="text-sm font-semibold text-center mb-4"
                    style={{ color: studio.color, opacity: 0.8 }}
                  >
                    {studio.highlight}
                  </p>
                )}

                {/* Description */}
                <p className="text-gray-300 leading-relaxed mb-4">
                  {studio.description}
                </p>

                {/* Assistant Badge */}
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${studio.borderColor}`,
                  }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: studio.available ? studio.color : '#6B7280',
                      boxShadow: studio.available ? `0 0 8px ${studio.color}` : 'none',
                    }}
                  />
                  <span className="text-sm text-gray-300">
                    AI Assistant: <span className="font-semibold" style={{ color: studio.color }}>
                      {studio.assistant}
                    </span>
                  </span>
                </div>

                {/* Coming Soon Badge for unavailable studios */}
                {!studio.available && (
                  <div 
                    className="mt-4 inline-block px-3 py-1 rounded-full"
                    style={{
                      background: 'rgba(240, 215, 170, 0.1)',
                      border: '1px solid rgba(240, 215, 170, 0.3)',
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: '#F0D7AA' }}>
                      Coming Soon
                    </span>
                  </div>
                )}

                {/* Hover Glow Effect */}
                <div 
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at center, ${studio.glowColor}, transparent 70%)`,
                  }}
                />
              </>
            );

            return studio.available ? (
              <Link
                key={studio.name}
                href={studio.route}
                className="group relative backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02] cursor-pointer block"
                style={{
                  background: 'rgba(15, 15, 25, 0.6)',
                  border: `1px solid ${studio.borderColor}`,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}
              >
                {CardContent}
              </Link>
            ) : (
              <div
                key={studio.name}
                className="group relative backdrop-blur-sm rounded-2xl p-8 opacity-60 cursor-not-allowed"
                style={{
                  background: 'rgba(15, 15, 25, 0.6)',
                  border: `1px solid ${studio.borderColor}`,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}
              >
                {CardContent}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-400 mb-6">
            All studios work together, powered by Mirror Mode's continuous learning engine.
          </p>
          <Link href="/career-studio">
            <button 
              className="px-10 py-4 text-black font-['Orbitron'] font-bold text-lg rounded-xl transition-transform duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #FFFFFF 0%, #E7E9EE 25%, #FFD37A 60%, #B8860B 100%)',
                boxShadow: '0 0 18px rgba(255,210,120,0.22), 0 0 42px rgba(255,210,120,0.10), inset 0 0 18px rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              Start with Career Studio
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
