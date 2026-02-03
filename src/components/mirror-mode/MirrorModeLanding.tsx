"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Scroll, BookOpen, Sparkles, Eye, Calendar } from "lucide-react";
import * as THREE from 'three';

export default function MirrorModeLanding() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [logoPressed, setLogoPressed] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isSceneLoaded, setIsSceneLoaded] = useState(false);
  const initializingRef = useRef(false);
  const cleanupFnRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  // ============================================================
  // STARFIELD with reliable initialization
  // ============================================================
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Prevent double initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    const initScene = () => {
      if (!canvasRef.current) {
        initializingRef.current = false;
        return;
      }
      
      // Check window is available
      if (typeof window === 'undefined') {
        initializingRef.current = false;
        return;
      }

      // Ensure window dimensions are available
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      
      // Clear any existing canvas
      const existingCanvas = canvasRef.current?.querySelector('canvas');
      if (existingCanvas) {
        existingCanvas.remove();
      }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    canvasRef.current?.appendChild(renderer.domElement);

    // ============================================================
    // STARFIELD - Dense particle background
    // ============================================================
    const starParticleCount = 100000;
    const starPositions = new Float32Array(starParticleCount * 3);
    const starVelocities = new Float32Array(starParticleCount * 3);
    const starColors = new Float32Array(starParticleCount * 3);

    for (let i = 0; i < starParticleCount; i++) {
      const i3 = i * 3;
      
      const clusterTightness = Math.pow(Math.random(), 4);
      const clusterRadius = clusterTightness * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const x = clusterRadius * Math.sin(phi) * Math.cos(theta);
      const y = clusterRadius * Math.sin(phi) * Math.sin(theta) * 0.3;
      const z = clusterRadius * Math.cos(phi);
      
      starPositions[i3] = x;
      starPositions[i3 + 1] = y;
      starPositions[i3 + 2] = z - 10;
      
      starVelocities[i3] = x * 0.002;
      starVelocities[i3 + 1] = y * 0.002;
      starVelocities[i3 + 2] = 0.01;
      
      const colorMix = Math.random();
      if (colorMix < 0.4) {
        starColors[i3] = 0.85;
        starColors[i3 + 1] = 0.85;
        starColors[i3 + 2] = 0.90;
      } else if (colorMix < 0.7) {
        starColors[i3] = 0.95;
        starColors[i3 + 1] = 0.95;
        starColors[i3 + 2] = 1.0;
      } else {
        starColors[i3] = 1.0;
        starColors[i3 + 1] = 1.0;
        starColors[i3 + 2] = 1.0;
      }
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.012,
      transparent: true,
      opacity: 0.2,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Accent stars
    const accentStarCount = 5000;
    const accentPositions = new Float32Array(accentStarCount * 3);
    const accentVelocities = new Float32Array(accentStarCount * 3);
    const accentColors = new Float32Array(accentStarCount * 3);

    for (let i = 0; i < accentStarCount; i++) {
      const i3 = i * 3;
      
      const radius = Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      accentPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      accentPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      accentPositions[i3 + 2] = radius * Math.cos(phi) - 10;
      
      const x = accentPositions[i3];
      const y = accentPositions[i3 + 1];
      accentVelocities[i3] = x * 0.003;
      accentVelocities[i3 + 1] = y * 0.003;
      accentVelocities[i3 + 2] = 0.015;
      
      accentColors[i3] = 0.95;
      accentColors[i3 + 1] = 0.95;
      accentColors[i3 + 2] = 1.0;
    }

    const accentGeometry = new THREE.BufferGeometry();
    accentGeometry.setAttribute('position', new THREE.BufferAttribute(accentPositions, 3));
    accentGeometry.setAttribute('color', new THREE.BufferAttribute(accentColors, 3));

    const accentMaterial = new THREE.PointsMaterial({
      size: 0.01,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const accentStars = new THREE.Points(accentGeometry, accentMaterial);
    scene.add(accentStars);

    // Animation loop
    let animationFrameId: number;
    
    const animate = () => {
      const time = Date.now() * 0.0001;

      starField.rotation.y = time * 0.02;
      starField.rotation.z = Math.sin(time * 0.2) * 0.01;
      
      const pulse = Math.sin(time * 0.3) * 0.05 + 1;
      starField.scale.set(pulse, pulse, pulse);

      camera.position.z = 15 - Math.sin(time * 0.2) * 0.3;

      accentStars.rotation.y = time * 0.08;
      accentStars.rotation.x = Math.sin(time * 0.4) * 0.03;

      const starPosAttribute = starGeometry.getAttribute('position');
      for (let i = 0; i < starParticleCount; i++) {
        const i3 = i * 3;
        
        starPosAttribute.array[i3] += starVelocities[i3];
        starPosAttribute.array[i3 + 1] += starVelocities[i3 + 1];
        starPosAttribute.array[i3 + 2] += starVelocities[i3 + 2];
        
        if (starPosAttribute.array[i3 + 2] > 5) {
          const resetTightness = Math.pow(Math.random(), 4);
          const resetRadius = resetTightness * 6;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          const x = resetRadius * Math.sin(phi) * Math.cos(theta);
          const y = resetRadius * Math.sin(phi) * Math.sin(theta) * 0.3;
          const z = resetRadius * Math.cos(phi);
          
          starPosAttribute.array[i3] = x;
          starPosAttribute.array[i3 + 1] = y;
          starPosAttribute.array[i3 + 2] = z - 20;
        }
      }
      starPosAttribute.needsUpdate = true;

      const accentPosAttribute = accentGeometry.getAttribute('position');
      for (let i = 0; i < accentStarCount; i++) {
        const i3 = i * 3;
        
        accentPosAttribute.array[i3] += accentVelocities[i3];
        accentPosAttribute.array[i3 + 1] += accentVelocities[i3 + 1];
        accentPosAttribute.array[i3 + 2] += accentVelocities[i3 + 2];
        
        if (accentPosAttribute.array[i3 + 2] > 8) {
          const resetRadius = Math.random() * 20;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          accentPosAttribute.array[i3] = resetRadius * Math.sin(phi) * Math.cos(theta);
          accentPosAttribute.array[i3 + 1] = resetRadius * Math.sin(phi) * Math.sin(theta);
          accentPosAttribute.array[i3 + 2] = -25;
        }
      }
      accentPosAttribute.needsUpdate = true;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    };

    window.addEventListener('resize', handleResize);

    const cleanup = () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      starGeometry.dispose();
      starMaterial.dispose();
      accentGeometry.dispose();
      accentMaterial.dispose();
      renderer.dispose();
      scene.clear();
      if (canvasRef.current?.contains(renderer.domElement)) {
        canvasRef.current.removeChild(renderer.domElement);
      }
      initializingRef.current = false;
    };
    
    cleanupFnRef.current = cleanup;
    
    // Mark scene as loaded after first render
    requestAnimationFrame(() => {
      setIsSceneLoaded(true);
    });
    };

    // Dual initialization strategy
    const initTimeout = setTimeout(initScene, 100);
    requestAnimationFrame(initScene);

    return () => {
      clearTimeout(initTimeout);
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
    };
  }, []);

  const handleEnter = () => {
    setIsEntering(true);
    setTimeout(() => {
      router.push('/mirror-mode/dashboard');
    }, 800);
  };

  // Logo mouse tracking
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!logoRef.current) return;
      
      const x = (event.clientX / window.innerWidth - 0.5) * 15;
      const y = (event.clientY / window.innerHeight - 0.5) * 15;
      
      logoRef.current.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-black">
      {/* Loading indicator while scene initializes */}
      {!isSceneLoaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#C0C0C0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#C0C0C0] font-['Orbitron']">Loading Mirror Mode...</p>
          </div>
        </div>
      )}
      
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-[#C0C0C0]/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image 
              src="/thinkwrite-logo-transparent.png" 
              alt="THINKWRITE AI" 
              width={180}
              height={28}
              className="h-auto w-auto max-h-5"
              priority
            />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative h-screen bg-black overflow-hidden">
        {/* Starfield Background */}
        <div ref={canvasRef} className="absolute inset-0 z-0" style={{ filter: 'blur(0.3px)' }} />

        {/* Logo in FRONT */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-6">
          <div 
            ref={logoRef}
            onClick={() => {
              setLogoPressed(true);
              setTimeout(() => setLogoPressed(false), 600);
            }}
            className={`mb-8 transition-all duration-700 ease-in-out cursor-pointer ${
              logoPressed ? 'scale-110 rotate-12' : isEntering ? 'scale-y-75 scale-x-90' : 'scale-100 rotate-0'
            }`}
            style={{
              transformStyle: 'preserve-3d',
            }}
          >
            <Image 
              src="/mirror-mode-reflection.png" 
              alt="Mirror Mode Symbol" 
              width={600}
              height={600}
              className="w-auto h-auto max-w-[600px] max-h-[600px] pointer-events-auto"
              style={{
                filter: `
                  drop-shadow(0 0 40px rgba(192,192,192,0.8))
                  drop-shadow(0 0 80px rgba(169,169,169,0.5))
                  drop-shadow(0 6px 12px rgba(0,0,0,0.4))
                  brightness(1.2)
                  contrast(1.4)
                  saturate(0.3)
                  ${logoPressed ? 'hue-rotate(45deg) brightness(1.4)' : isEntering ? 'brightness(1.5) drop-shadow(0 0 120px rgba(192,192,192,0.9))' : ''}
                `,
                transition: 'filter 0.7s ease-in-out',
                mixBlendMode: 'screen',
              }}
              priority
            />
          </div>
          
          <p className="text-lg text-white/60 mb-3 text-center max-w-2xl">
            Where Ursie learns your authentic writing voice
          </p>

          <p className="text-sm text-[#C0C0C0]/70 mb-12 text-center max-w-xl">
            Continuous learning. Precision mirroring. Your voice, preserved.
          </p>

          <div className="flex flex-wrap gap-4 justify-center pointer-events-auto">
            <button
              onClick={handleEnter}
              disabled={isEntering}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#C0C0C0] text-black font-['Orbitron'] font-bold text-lg hover:bg-[#A0A0A0] transition-all hover:scale-105 shadow-lg shadow-[#C0C0C0]/50 disabled:opacity-50"
            >
              {isEntering ? 'Entering...' : 'Enter Mirror Mode'} <ArrowRight className="w-5 h-5" />
            </button>

            <Link
              href="/select-studio"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 transition-all"
            >
              Return to Studios
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="text-white/40 text-sm animate-bounce">↓ Learn How It Works</div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-20 bg-black py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Main Explanation */}
            <section className="lg:col-span-7 space-y-6">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-[#C0C0C0]/20 rounded-2xl p-8 shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#C0C0C0]/15 border border-[#C0C0C0]/25 flex items-center justify-center flex-shrink-0">
                    <Scroll className="w-6 h-6 text-[#C0C0C0]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-['Orbitron'] font-semibold text-white mb-4">
                      Your voice is the training data. Ursie learns it.
                    </h2>
                    <p className="text-base text-white/70 leading-relaxed">
                      Upload writing samples, write naturally across studios, and let Ursie
                      analyze what matters: clarity, rhythm, consistency, and authority.
                      When your readiness is high, Mirror Mode can generate and rewrite in your exact voice.
                    </p>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-black/60 border border-[#C0C0C0]/20 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Scroll className="w-4 h-4 text-[#C0C0C0]" />
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40 font-['Orbitron']">
                      System Status
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="text-xs text-emerald-300/70">ACTIVE</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatusCard 
                    title="Samples Uploaded" 
                    value="Awaiting Data" 
                    hint="Upload documents to begin training." 
                  />
                  <StatusCard 
                    title="Voice Profile" 
                    value="Not Yet Built" 
                    hint="Ursie needs more samples to map your style." 
                  />
                  <StatusCard 
                    title="Studio Feed" 
                    value="Passive" 
                    hint="Later: learn from all studios automatically." 
                  />
                  <StatusCard 
                    title="Privacy" 
                    value="Protected" 
                    hint="You control what counts as training data." 
                  />
                </div>
              </div>
            </section>

            {/* Right: What It Captures */}
            <aside className="lg:col-span-5 space-y-6">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-[#C0C0C0]/20 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-['Orbitron'] font-semibold text-white flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-[#C0C0C0]" />
                  What Mirror Mode Captures
                </h3>
                <ul className="space-y-3 text-sm text-white/70">
                  <li className="flex gap-3 items-start">
                    <span className="text-[#C0C0C0] text-lg">▸</span>
                    <span>Sentence rhythm, structure, transitions</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-[#C0C0C0] text-lg">▸</span>
                    <span>Confidence markers (hedging vs authority)</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-[#C0C0C0] text-lg">▸</span>
                    <span>Vocabulary habits and repeated phrasing</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-[#C0C0C0] text-lg">▸</span>
                    <span>Editing behavior (what you accept/reject)</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white/[0.02] border border-[#C0C0C0]/20 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-['Orbitron'] font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#C0C0C0]" />
                  Ursie's Rules (Preview)
                </h3>
                <p className="text-sm text-white/70 mb-6">
                  Ursie doesn't do fluff. She pushes for precision and consistency 
                  so the AI can mirror you cleanly.
                </p>

                <div className="space-y-4">
                  <Rule
                    icon={<Scroll className="w-4 h-4 text-[#C0C0C0]" />}
                    title="No vague verbs"
                    text='"Helped with" means nothing. Say what moved, what changed, and why it matters.'
                  />
                  <Rule
                    icon={<Sparkles className="w-4 h-4 text-[#C0C0C0]" />}
                    title="Your chat counts"
                    text="How you explain things in conversation is part of your voice signature."
                  />
                  <Rule
                    icon={<Calendar className="w-4 h-4 text-[#C0C0C0]" />}
                    title="Controlled access"
                    text="You decide which writing is training data. The system doesn't take without permission."
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-[#C0C0C0]/20 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-['Orbitron']">{title}</div>
        <div className="text-[10px] text-[#C0C0C0]/60">▸</div>
      </div>
      <div className="text-sm font-semibold text-white mb-1">{value}</div>
      <div className="text-xs text-white/50">{hint}</div>
    </div>
  );
}

function Rule({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#C0C0C0]/20 bg-black/40 p-4 hover:bg-black/60 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-[#C0C0C0]/10 border border-[#C0C0C0]/20 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white mb-1">{title}</div>
        <div className="text-xs text-white/60 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}