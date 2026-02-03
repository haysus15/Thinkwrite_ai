// src/app/select-studio/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import {
  Briefcase,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Fingerprint,
} from "lucide-react";
import * as THREE from "three";

export default function SelectStudioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const canvasRef = useRef<HTMLDivElement>(null);

  // ✅ Keep references so we can reliably re-init on client nav
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initializingRef = useRef(false);
  const [isSceneLoaded, setIsSceneLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // ============================================================
  // BIG SKY: layered starfield + subtle dotted journey tribute
  // ============================================================
  useEffect(() => {
    if (loading || !user) return;

    const host = canvasRef.current;
    if (!host) return;
    
    // Prevent double initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    const teardown = () => {
      try {
        cleanupRef.current?.();
      } catch {}
      cleanupRef.current = null;

      try {
        rendererRef.current?.dispose();
      } catch {}
      rendererRef.current = null;

      try {
        host.querySelectorAll("canvas").forEach((c) => c.remove());
      } catch {}
      
      initializingRef.current = false;
    };

    const init = () => {
      const hostNow = canvasRef.current;
      if (!hostNow) {
        initializingRef.current = false;
        return;
      }
      
      // Check window is available
      if (typeof window === 'undefined') {
        initializingRef.current = false;
        return;
      }

      if (rendererRef.current && hostNow.querySelector("canvas")) {
        window.dispatchEvent(new Event("resize"));
        return;
      }

      // Clear any existing canvases
      hostNow.querySelectorAll("canvas").forEach((c) => c.remove());

      hostNow.style.position = "fixed";
      hostNow.style.inset = "0";
      hostNow.style.width = "100%";
      hostNow.style.height = "100%";
      hostNow.style.pointerEvents = "none";
      hostNow.style.zIndex = "0";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
      camera.position.set(0, 0, 34);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      rendererRef.current = renderer;

      renderer.setClearColor(0x000000, 1);

      const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(DPR);

      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      hostNow.appendChild(renderer.domElement);

      const setSize = () => {
        const w = Math.max(1, window.innerWidth || 1);
        const h = Math.max(1, window.innerHeight || 1);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      setSize();
      requestAnimationFrame(() => setSize());

      window.addEventListener("resize", setSize);

      scene.add(new THREE.AmbientLight(0xffffff, 0.20));

      const rand = (min: number, max: number) =>
        min + Math.random() * (max - min);

      type StarLayer = {
        points: THREE.Points;
        geo: THREE.BufferGeometry;
        mat: THREE.PointsMaterial;
        vel: Float32Array;
        count: number;
        zReset: number;
        spread: number;
      };

      const makeStarLayer = (opts: {
        count: number;
        spread: number;
        zMin: number;
        zMax: number;
        size: number;
        opacity: number;
        zSpeed: number;
        warmChance: number;
        drift: number;
      }): StarLayer => {
        const {
          count,
          spread,
          zMin,
          zMax,
          size,
          opacity,
          zSpeed,
          warmChance,
          drift,
        } = opts;

        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
          const i3 = i * 3;

          pos[i3] = rand(-spread, spread);
          pos[i3 + 1] = rand(-spread, spread);
          pos[i3 + 2] = rand(zMin, zMax);

          vel[i3] = (Math.random() - 0.5) * drift;
          vel[i3 + 1] = (Math.random() - 0.5) * drift;
          vel[i3 + 2] = zSpeed + Math.random() * zSpeed * 0.6;

          const t = Math.random();
          if (t < warmChance) {
            col[i3] = 1.0;
            col[i3 + 1] = rand(0.80, 0.94);
            col[i3 + 2] = rand(0.30, 0.52);
          } else if (t < 0.65) {
            col[i3] = rand(0.45, 0.75);
            col[i3 + 1] = rand(0.75, 0.95);
            col[i3 + 2] = 1.0;
          } else {
            col[i3] = rand(0.86, 1.0);
            col[i3 + 1] = rand(0.62, 0.88);
            col[i3 + 2] = 1.0;
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
          size,
          transparent: true,
          opacity,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, mat);
        scene.add(points);

        return { points, geo, mat, vel, count, zReset: zMin, spread };
      };

      const farStars = makeStarLayer({
        count: 6200,
        spread: 180,
        zMin: -1200,
        zMax: -160,
        size: 0.14,
        opacity: 0.90,
        zSpeed: 0.052,
        warmChance: 0.05,
        drift: 0.010,
      });

      const midStars = makeStarLayer({
        count: 4200,
        spread: 145,
        zMin: -900,
        zMax: -130,
        size: 0.17,
        opacity: 0.98,
        zSpeed: 0.082,
        warmChance: 0.09,
        drift: 0.012,
      });

      const nearStars = makeStarLayer({
        count: 2200,
        spread: 115,
        zMin: -600,
        zMax: -110,
        size: 0.21,
        opacity: 1.0,
        zSpeed: 0.125,
        warmChance: 0.12,
        drift: 0.014,
      });

      const stepStars = (layer: StarLayer) => {
        const p = layer.geo.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < layer.count; i++) {
          const i3 = i * 3;
          p.array[i3] += layer.vel[i3];
          p.array[i3 + 1] += layer.vel[i3 + 1];
          p.array[i3 + 2] += layer.vel[i3 + 2];

          if (p.array[i3 + 2] > 18) {
            p.array[i3] = (Math.random() - 0.5) * 2 * layer.spread;
            p.array[i3 + 1] = (Math.random() - 0.5) * 2 * layer.spread;
            p.array[i3 + 2] = layer.zReset;
          }
        }
        p.needsUpdate = true;
      };

      // Tribute: dotted journey route
      const tributeCount = 1800;
      const tributePos = new Float32Array(tributeCount * 3);
      const tributeCol = new Float32Array(tributeCount * 3);

      const routePoints: Array<{ x: number; y: number }> = [];
      const arcSteps = 280;
      for (let i = 0; i < arcSteps; i++) {
        const t = i / (arcSteps - 1);
        const x = -170 + t * 340;
        const y =
          70 +
          Math.sin(t * Math.PI * 1.15) * 10 +
          Math.sin(t * 8.0) * 1.5;
        routePoints.push({ x, y });
      }

      const nodes = [
        { t: 0.08, strength: 1.0 },
        { t: 0.22, strength: 0.9 },
        { t: 0.41, strength: 1.1 },
        { t: 0.58, strength: 0.95 },
        { t: 0.76, strength: 1.15 },
        { t: 0.9, strength: 1.0 },
      ].map((n) => {
        const idx = Math.floor(n.t * (routePoints.length - 1));
        return {
          x: routePoints[idx].x,
          y: routePoints[idx].y,
          strength: n.strength,
        };
      });

      const pickRoute = () =>
        routePoints[Math.floor(Math.random() * routePoints.length)];

      for (let k = 0; k < tributeCount; k++) {
        const i3 = k * 3;
        const useNode = Math.random() < 0.34;

        let x = 0;
        let y = 0;
        if (useNode) {
          const n = nodes[Math.floor(Math.random() * nodes.length)];
          x = n.x + (Math.random() - 0.5) * 12 * n.strength;
          y = n.y + (Math.random() - 0.5) * 8 * n.strength;
        } else {
          const p = pickRoute();
          x = p.x + (Math.random() - 0.5) * 6;
          y = p.y + (Math.random() - 0.5) * 4;
        }

        const z = -220 + (Math.random() - 0.5) * 16;

        tributePos[i3] = x;
        tributePos[i3 + 1] = y;
        tributePos[i3 + 2] = z;

        const tt = Math.random();
        if (tt < 0.10) {
          tributeCol[i3] = 1.0;
          tributeCol[i3 + 1] = rand(0.82, 0.95);
          tributeCol[i3 + 2] = rand(0.30, 0.55);
        } else if (tt < 0.55) {
          tributeCol[i3] = rand(0.65, 0.92);
          tributeCol[i3 + 1] = rand(0.85, 1.0);
          tributeCol[i3 + 2] = 1.0;
        } else {
          tributeCol[i3] = rand(0.86, 1.0);
          tributeCol[i3 + 1] = rand(0.70, 0.90);
          tributeCol[i3 + 2] = 1.0;
        }
      }

      const tributeGeo = new THREE.BufferGeometry();
      tributeGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(tributePos, 3)
      );
      tributeGeo.setAttribute("color", new THREE.BufferAttribute(tributeCol, 3));

      const tributeMat = new THREE.PointsMaterial({
        size: 0.28,
        transparent: true,
        opacity: 0.98,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const tributePoints = new THREE.Points(tributeGeo, tributeMat);
      scene.add(tributePoints);

      let raf = 0;

      const animate = () => {
        const t = performance.now() * 0.00012;

        scene.rotation.y = Math.sin(t * 0.9) * 0.02;
        scene.rotation.x = Math.cos(t * 0.7) * 0.018;

        stepStars(farStars);
        stepStars(midStars);
        stepStars(nearStars);

        tributePoints.rotation.z = Math.sin(t * 0.5) * 0.01;
        tributePoints.rotation.y = Math.cos(t * 0.35) * 0.01;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };

      animate();

      cleanupRef.current = () => {
        window.removeEventListener("resize", setSize);
        cancelAnimationFrame(raf);

        const layers = [farStars, midStars, nearStars];
        for (const L of layers) {
          scene.remove(L.points);
          L.geo.dispose();
          L.mat.dispose();
        }

        scene.remove(tributePoints);
        tributeGeo.dispose();
        tributeMat.dispose();

        renderer.dispose();
        scene.clear();

        try {
          if (hostNow.contains(renderer.domElement))
            hostNow.removeChild(renderer.domElement);
        } catch {}
      };
      
      // Mark scene as loaded after first render
      requestAnimationFrame(() => {
        setIsSceneLoaded(true);
      });
    };

    // Dual initialization strategy: try immediate + delayed
    const initTimeout = setTimeout(init, 100);
    requestAnimationFrame(init);

    return () => {
      clearTimeout(initTimeout);
      teardown();
    };
  }, [loading, user]);

  const handleStudioClick = (href: string) => router.push(href);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }
  if (!user) return null;

  interface Studio {
    name: string;
    description: string;
    icon: React.ReactNode | string;
    logoImage?: string;
    color: string;
    gradient: string;
    href: string;
    comingSoon?: boolean;
    featured?: boolean;
  }

  const studios: Studio[] = [
    {
      name: "Mirror Mode",
      description:
        "Train Ursie to learn your authentic writing voice. Works in the background across all studios.",
      icon: "/mirror-mode-sigil.png",
      logoImage: "/mirror-mode-full-silver.png", // New combined logo with symbol + text (full silver)
      color: "#EAAA00",
      gradient: "from-[#EAAA00] via-amber-500 to-yellow-600",
      href: "/mirror-mode",
      featured: true,
    },
    {
      name: "Career Studio",
      description:
        "Master resumes, cover letters, and career documents with Lex's HR expertise",
      icon: "/career-sigil.png",
      logoImage: "/career-studio-clean-large.png", // Larger version to match Mirror Mode size
      color: "#EAAA00",
      gradient: "from-[#EAAA00] to-amber-600",
      href: "/career-studio",
    },
    {
      name: "Academic Studio",
      description:
        "Victor and Travis push you toward rigorous thinking and clear execution.",
      icon: <GraduationCap className="w-8 h-8" />,
      color: "#3b82f6",
      gradient: "from-blue-500 to-blue-700",
      href: "/academic-studio/landing",
    },
    {
      name: "Creative Studio",
      description:
        "Coming Soon - Get brutally honest feedback from Tre's creative eye",
      icon: <Sparkles className="w-8 h-8" />,
      color: "#a855f7",
      gradient: "from-purple-500 to-purple-700",
      href: "#",
      comingSoon: true,
    },
  ];

  return (
    <div className="relative min-h-screen bg-black">
      {/* Loading indicator while scene initializes */}
      {!isSceneLoaded && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#EAAA00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#EAAA00] font-['Orbitron']">Loading...</p>
          </div>
        </div>
      )}
      
      {/* Canvas */}
      <div ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* Soft big-sky lift */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a1a]/20 via-black/10 to-black/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,210,255,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(182,140,255,0.08),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_85%,rgba(234,170,0,0.06),transparent_55%)]" />
      </div>

      {/* Film grain */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
        }}
      />

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="cursor-pointer">
            <Image
              src="/thinkwrite-logo-transparent.png"
              alt="THINKWRITE AI"
              width={180}
              height={28}
              className="h-auto w-auto max-h-5 transition-opacity hover:opacity-80"
              priority
            />
          </Link>
          <div className="hidden sm:block text-[11px] text-white/45 tracking-[0.22em] uppercase">
            beneath the eternal sky
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 pt-[22vh] md:pt-[26vh] pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-['Orbitron'] font-bold mb-4 text-white">
              Select a Studio
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Begin where you write best. Your tools stay consistent — only the lens changes.
            </p>
          </div>

          <div className="mt-16 md:mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {studios.map((studio) => (
              <button
                key={studio.name}
                onClick={() => !studio.comingSoon && handleStudioClick(studio.href)}
                disabled={studio.comingSoon}
                className={`
                  relative group p-8 rounded-2xl border transition-all duration-500
                  ${
                    studio.comingSoon
                      ? "border-white/10 bg-black/40 cursor-not-allowed opacity-60"
                      : "border-white/20 bg-black/50 hover:bg-black/70 hover:border-white/40 hover:scale-[1.02] hover:shadow-[0_0_70px_rgba(120,210,255,0.18)]"
                  }
                `}
                style={{ backdropFilter: "blur(10px)" }}
              >
                {studio.comingSoon && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/10 rounded-full text-xs text-white/60">
                    Coming Soon
                  </div>
                )}

                {studio.featured && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-gradient-to-r from-[#EAAA00]/90 to-amber-500/90 rounded text-[10px] text-black font-medium tracking-wide">
                    RECOMMENDED
                  </div>
                )}

                {studio.logoImage ? (
                  // Full logo (includes symbol + text) - no icon box needed
                  <div className={`mb-6 ${studio.name === "Mirror Mode" ? "mt-6" : ""}`}>
                    <Image
                      src={studio.logoImage}
                      alt={studio.name}
                      width={studio.name === "Career Studio" ? 360 : 240}
                      height={studio.name === "Career Studio" ? 180 : 120}
                      className="h-auto w-auto max-w-full mx-auto"
                      style={{
                        mixBlendMode: 'screen', // Makes black transparent
                        filter: 'brightness(1.1)' // Slightly brighter for visibility
                      }}
                    />
                  </div>
                ) : (
                  // Icon box only for studios without full logos
                  <>
                    <div
                      className={`
                        w-16 h-16 rounded-xl mb-6 flex items-center justify-center
                        bg-gradient-to-br ${studio.gradient}
                        ${!studio.comingSoon && "group-hover:scale-110"}
                        transition-transform duration-300
                      `}
                      style={{ boxShadow: `0 0 40px ${studio.color}40` }}
                    >
                      {typeof studio.icon === 'string' ? (
                        <Image
                          src={studio.icon}
                          alt={`${studio.name} icon`}
                          width={32}
                          height={32}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        studio.icon
                      )}
                    </div>

                    <h3 className="text-2xl font-['Orbitron'] font-bold mb-3 text-white">
                      {studio.name}
                    </h3>
                  </>
                )}

                <p className="text-sm text-white/70 leading-relaxed mb-6">
                  {studio.description}
                </p>

                {!studio.comingSoon && (
                  <div className="flex items-center gap-2 text-white/60 group-hover:text-[#79d7ff] transition-colors">
                    <span className="text-sm font-medium">Enter Studio</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-14 text-center">
            <p className="text-sm text-white/50">
              Start with Mirror Mode to train Ursie, or jump directly into any studio
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
