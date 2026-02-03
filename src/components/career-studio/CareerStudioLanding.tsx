// src/app/career-studio/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Target, Briefcase, FileText, TrendingUp, Users, Calendar } from "lucide-react";
import * as THREE from "three";

export default function CareerStudioLandingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const threeInitRef = useRef(false);

  const [isEntering, setIsEntering] = useState(false);
  const [isSceneLoaded, setIsSceneLoaded] = useState(false);

  // ============================================================
  // THREE: Stars across whole sky + Layered flowing nebula on right
  // KEEPING YOUR EXISTING BACKGROUND - NO CHANGES
  // ============================================================
  useEffect(() => {
    if (!canvasRef.current) return;
    if (threeInitRef.current) return;
    threeInitRef.current = true;

    const host = canvasRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);
    host.appendChild(renderer.domElement);

    let w = 1;
    let h = 1;

    const setSizeFromHost = () => {
      const rect = host.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    setSizeFromHost();

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const makeStarTexture = () => {
      const size = 128;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);

      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0.0, "rgba(255,255,255,1.0)");
      g.addColorStop(0.06, "rgba(255,255,255,0.98)");
      g.addColorStop(0.14, "rgba(255,255,255,0.60)");
      g.addColorStop(0.30, "rgba(255,255,255,0.18)");
      g.addColorStop(1.0, "rgba(255,255,255,0.0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size / 2, size * 0.20);
      ctx.lineTo(size / 2, size * 0.80);
      ctx.moveTo(size * 0.20, size / 2);
      ctx.lineTo(size * 0.80, size / 2);
      ctx.stroke();

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    const starTex = makeStarTexture();

    const starVert = `
      attribute vec3 color;
      attribute float aSeed;
      attribute float aSize;

      varying vec3 vColor;
      varying float vSeed;

      uniform float uTime;
      uniform float uBaseSize;

      void main() {
        vColor = color;
        vSeed = aSeed;

        vec3 p = position;
        p.x += sin(uTime * 0.025 + aSeed) * 0.08;
        p.y += cos(uTime * 0.020 + aSeed) * 0.06;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

        float tw = 0.72 + sin(uTime * 1.15 + aSeed) * 0.28;
        float s = uBaseSize * aSize * (0.70 + tw * 0.65);

        gl_PointSize = s * (340.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const starFrag = `
      precision highp float;

      varying vec3 vColor;
      varying float vSeed;

      uniform sampler2D uSprite;
      uniform float uTime;

      void main() {
        vec4 tex = texture2D(uSprite, gl_PointCoord);

        float tw = 0.75 + sin(uTime * 1.3 + vSeed) * 0.25;
        float a = tex.a * (0.55 + tw * 0.80);

        vec3 col = vColor * (0.92 + tw * 0.45);

        gl_FragColor = vec4(col, a);
      }
    `;

    const buildStars = (count: number, zMin: number, zMax: number, baseSize: number) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const seed = new Float32Array(count);
      const size = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        pos[i3] = rand(-22, 22);
        pos[i3 + 1] = rand(-14, 14);
        pos[i3 + 2] = rand(zMin, zMax);

        seed[i] = Math.random() * 1000;

        const r = Math.random();
        const bright = r > 0.988 ? 1.0 : r > 0.95 ? 0.62 : 0.26;

        const t = Math.random();
        let cr = 1.0, cg = 1.0, cb = 1.0;

        if (t < 0.60) {
          cr = 1.0; cg = 1.0; cb = 1.0;
        } else if (t < 0.80) {
          cr = 0.74; cg = 0.86; cb = 1.0;
        } else if (t < 0.93) {
          cr = 1.0; cg = 0.88; cb = 0.55;
        } else {
          cr = 0.82; cg = 1.0; cb = 0.88;
        }

        col[i3] = cr * bright;
        col[i3 + 1] = cg * bright;
        col[i3 + 2] = cb * bright;

        const s = Math.random();
        size[i] = s > 0.992 ? 1.45 : s > 0.95 ? 1.05 : 0.70;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSprite: { value: starTex },
          uBaseSize: { value: baseSize },
        },
        vertexShader: starVert,
        fragmentShader: starFrag,
      });

      const pts = new THREE.Points(geo, mat);
      scene.add(pts);

      return { geo, mat, pts };
    };

    const starsFar = buildStars(8200, -220, -50, 0.85);
    const starsNear = buildStars(3400, -70, -18, 1.05);

    const nebulaVert = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `;

    const nebulaFrag = `
      precision highp float;

      varying vec2 vUv;

      uniform float uTime;
      uniform vec2  uRes;

      uniform vec3  uColorA;
      uniform vec3  uColorB;
      uniform vec3  uColorC;

      uniform float uIntensity;
      uniform float uSoftness;
      uniform float uOpacity;

      uniform float uMaskStart;
      uniform float uMaskFeather;

      float hash(vec2 p){
        p = fract(p*vec2(123.34,456.21));
        p += dot(p,p+45.32);
        return fract(p.x*p.y);
      }

      float noise(vec2 p){
        vec2 i=floor(p);
        vec2 f=fract(p);
        float a=hash(i);
        float b=hash(i+vec2(1.0,0.0));
        float c=hash(i+vec2(0.0,1.0));
        float d=hash(i+vec2(1.0,1.0));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      float fbm(vec2 p){
        float v=0.0;
        float a=0.55;
        for(int i=0;i<6;i++){
          v += a*noise(p);
          p *= 2.02;
          a *= 0.52;
        }
        return v;
      }

      void main(){
        vec2 uv = vUv;

        float startX = uMaskStart;
        float feather = uMaskFeather;
        float rightMask = smoothstep(startX, startX + feather, uv.x);

        float textSafe = 1.0 - smoothstep(0.10, 0.35, uv.x) * 0.35;

        vec2 p = uv - 0.5;
        p.x *= uRes.x / uRes.y;

        float t = uTime * 0.06;
        vec2 driftA = vec2(t*0.65, -t*0.35);
        vec2 driftB = vec2(-t*0.32, t*0.28);

        float n1 = fbm(p*3.2 + driftA);
        float n2 = fbm(p*6.1 + driftA*1.3 + 2.3);
        float n3 = fbm(p*1.8 + driftB + 5.1);

        float n = (n1*0.55 + n2*0.30 + n3*0.35);

        vec2 c = (uv - vec2(0.60, 0.55));
        c.x *= uRes.x / uRes.y;
        float core = exp(-dot(c,c)*3.2);

        float wisps = pow(n, 1.6) * (0.55 + core*0.95);

        vec3 col = mix(uColorA, uColorB, clamp(n1,0.0,1.0));
        col = mix(col, uColorC, clamp(n2*0.9,0.0,1.0));

        col *= (0.35 + n*0.55);
        col = pow(col, vec3(1.0/uSoftness));
        
        col += vec3(1.0) * core * 0.08;

        float alpha = smoothstep(0.10, 1.0, wisps) * uIntensity;
        alpha *= rightMask;
        alpha *= textSafe;

        vec2 v = uv - 0.5;
        v.x *= uRes.x / uRes.y;
        float vig = smoothstep(0.98, 0.45, length(v));
        alpha *= vig;
       
        float edgeY = smoothstep(0.02, 0.14, uv.y) * smoothstep(0.02, 0.14, 1.0 - uv.y);
        alpha *= edgeY;

        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `;

    const nebulaGeo = new THREE.PlaneGeometry(44, 26, 1, 1);

    const makeNebulaMat = (params: {
      a: string;
      b: string;
      c: string;
      intensity: number;
      softness: number;
      opacity: number;
    }) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: nebulaVert,
        fragmentShader: nebulaFrag,
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(w, h) },
          uColorA: { value: new THREE.Color(params.a) },
          uColorB: { value: new THREE.Color(params.b) },
          uColorC: { value: new THREE.Color(params.c) },
          uIntensity: { value: params.intensity },
          uSoftness: { value: params.softness },
          uOpacity: { value: params.opacity },

          uMaskStart: { value: 0.20 },
          uMaskFeather: { value: 0.28 },
        },
      });
      return mat;
    };

    const nebulaMainMat = makeNebulaMat({
      a: "#9333EA",
      b: "#DB2777",
      c: "#0891B2",
      intensity: 1.35,
      softness: 1.15,
      opacity: 0.88,
    });

    const nebulaLayer2Mat = makeNebulaMat({
      a: "#6B21A8",
      b: "#BE185D",
      c: "#0E7490",
      intensity: 1.20,
      softness: 1.25,
      opacity: 0.80,
    });

    const nebulaLayer3Mat = makeNebulaMat({
      a: "#581C87",
      b: "#9F1239",
      c: "#155E75",
      intensity: 1.05,
      softness: 1.40,
      opacity: 0.72,
    });

    const nebulaMain = new THREE.Mesh(nebulaGeo, nebulaMainMat);
    nebulaMain.position.set(1.5, 0.0, -28);
    nebulaMain.scale.set(1.8, 1.6, 1);
    scene.add(nebulaMain);

    const nebulaLayer2 = new THREE.Mesh(nebulaGeo, nebulaLayer2Mat);
    nebulaLayer2.position.set(2.0, -0.35, -24);
    nebulaLayer2.scale.set(1.6, 1.5, 1);
    nebulaLayer2.rotation.z = -0.12;
    scene.add(nebulaLayer2);

    const nebulaLayer3 = new THREE.Mesh(nebulaGeo, nebulaLayer3Mat);
    nebulaLayer3.position.set(1.2, 0.45, -32);
    nebulaLayer3.scale.set(1.9, 1.7, 1);
    nebulaLayer3.rotation.z = 0.10;
    scene.add(nebulaLayer3);

    const veilGeo = new THREE.PlaneGeometry(30, 18, 1, 1);
    const veilMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      color: 0x000000,
    });
    const veil = new THREE.Mesh(veilGeo, veilMat);
    veil.position.set(0, 0, -8);
    scene.add(veil);

    let raf = 0;

    const animate = () => {
      const t = performance.now() * 0.001;

      const expandSpeed = 0.02;
      const eased = 1.0 - Math.exp(-t * expandSpeed);

      const startMaxRight = 0.20;
      const startMinLeft = 0.05;
      const baseStart = startMaxRight + (startMinLeft - startMaxRight) * eased;

      const drift = Math.sin(t * 0.12) * 0.015;
      const startX = baseStart + drift;

      nebulaMainMat.uniforms.uMaskStart.value = startX;
      nebulaLayer2Mat.uniforms.uMaskStart.value = startX + 0.015;
      nebulaLayer3Mat.uniforms.uMaskStart.value = startX - 0.012;

      nebulaMainMat.uniforms.uMaskFeather.value = 0.28;
      nebulaLayer2Mat.uniforms.uMaskFeather.value = 0.30;
      nebulaLayer3Mat.uniforms.uMaskFeather.value = 0.32;

      (starsFar.mat as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (starsNear.mat as THREE.ShaderMaterial).uniforms.uTime.value = t * 0.95;

      nebulaMainMat.uniforms.uTime.value = t;
      nebulaLayer2Mat.uniforms.uTime.value = t * 1.05;
      nebulaLayer3Mat.uniforms.uTime.value = t * 0.92;

      nebulaMainMat.uniforms.uRes.value.set(w, h);
      nebulaLayer2Mat.uniforms.uRes.value.set(w, h);
      nebulaLayer3Mat.uniforms.uRes.value.set(w, h);

      const breath = 1.0 + Math.sin(t * 0.12) * 0.020;

      nebulaMain.scale.set(1.8 * breath, 1.6 * breath, 1);
      nebulaLayer2.scale.set(1.6 * breath, 1.5 * breath, 1);
      nebulaLayer3.scale.set(1.9 * breath, 1.7 * breath, 1);

      nebulaMain.position.x = 1.5 + Math.sin(t * 0.05) * 0.12;
      nebulaMain.position.y = 0.00 + Math.cos(t * 0.045) * 0.08;

      nebulaLayer2.position.x = 2.0 + Math.cos(t * 0.04) * 0.11;
      nebulaLayer2.position.y = -0.35 + Math.sin(t * 0.05) * 0.07;

      nebulaLayer3.position.x = 1.2 + Math.sin(t * 0.035) * 0.13;
      nebulaLayer3.position.y = 0.45 + Math.cos(t * 0.04) * 0.09;

      starsFar.pts.rotation.z = t * 0.0032;
      starsNear.pts.rotation.z = -t * 0.0024;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    animate();

    const onResize = () => setSizeFromHost();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => setSizeFromHost());
    ro.observe(host);

    requestAnimationFrame(() => {
      setIsSceneLoaded(true);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      cancelAnimationFrame(raf);

      starsFar.geo.dispose();
      (starsFar.mat as THREE.ShaderMaterial).dispose();
      starsNear.geo.dispose();
      (starsNear.mat as THREE.ShaderMaterial).dispose();

      nebulaGeo.dispose();
      nebulaMainMat.dispose();
      nebulaLayer2Mat.dispose();
      nebulaLayer3Mat.dispose();

      veilGeo.dispose();
      veilMat.dispose();

      starTex.dispose();

      renderer.dispose();
      scene.clear();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      threeInitRef.current = false;
    };
  }, []);

  const handleEnter = () => {
    setIsEntering(true);
    setTimeout(() => {
      router.push("/career-studio/workspace");
    }, 800);
  };

  return (
    <div className="relative min-h-screen">
      {/* Loading indicator */}
      {!isSceneLoaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-purple-400 font-['Orbitron']">Loading Career Studio...</p>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-purple-400/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/select-studio" className="inline-block hover:opacity-80 transition-opacity">
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

      {/* Hero */}
      <div className="relative h-screen overflow-hidden">
        {/* Background */}
        <div ref={canvasRef} className="fixed inset-0 z-0" style={{ filter: "blur(0.3px)" }} />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-6">
          <div className="flex-[0.85]" />

          {/* Career Studio Inscription (dedication-sized, but legible) */}
<div className="pointer-events-none mb-8">
  <div
    className="mx-auto"
    style={{
      width: "clamp(620px, 72vw, 1300px)", // <— bigger + responsive
      opacity: 0.92,
      filter:
        "drop-shadow(0 0 14px rgba(255,255,255,0.08)) drop-shadow(0 0 40px rgba(160,140,255,0.06))",
    }}
  >
    <Image
      src="/CareerStudio_SVG_burnished.svg"
      alt="Career Studio"
      width={1400}          // helps Next render crisp at large sizes
      height={420}
      className="w-full h-auto"
      priority
    />
  </div>
</div>

          {/* Tagline */}
          <p className="text-lg text-white/60 mb-3 text-center max-w-2xl pointer-events-auto">
            Your career isn't random particles—it's a universe waiting to form.
          </p>

          <p className="text-sm text-purple-400/70 mb-12 text-center max-w-xl">
            Analyze. Build. Align. Track your path with precision and purpose.
          </p>

          <div className="flex flex-wrap gap-4 justify-center pointer-events-auto">
            <button
              onClick={handleEnter}
              disabled={isEntering}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-['Orbitron'] font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all hover:scale-105 shadow-lg shadow-purple-500/50 disabled:opacity-50"
            >
              {isEntering ? "Entering..." : "Enter Career Studio"} <ArrowRight className="w-5 h-5" />
            </button>

            <Link
              href="/select-studio"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 transition-all"
            >
              Return to Studios
            </Link>
          </div>

          <div className="flex-1" />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="text-white/40 text-sm animate-bounce">↓ Explore the Tools</div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-20 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-7 space-y-6">
              <div className="bg-transparent border border-purple-400/30 rounded-2xl p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-transparent border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-['Orbitron'] font-semibold text-white mb-4">
                      Your career path, systematically optimized.
                    </h2>
                    <p className="text-base text-white/70 leading-relaxed">
                      Stop sending generic resumes into the void. Career Studio gives you the tools
                      to analyze roles, build targeted applications, and track every move with Lex
                      as your strategic career coach.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-transparent border border-purple-400/30 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-purple-400" />
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40 font-['Orbitron']">
                      Studio Status
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="text-xs text-emerald-300/70">READY</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatusCard title="Resume Versions" value="Ready to Build" hint="Upload or create your master resume." />
                  <StatusCard title="Job Analyses" value="Awaiting Input" hint="Paste job postings to decode requirements." />
                  <StatusCard title="Applications" value="Not Tracking" hint="Start tracking your application pipeline." />
                  <StatusCard title="Lex Integration" value="Active" hint="Your career coach is ready to help." />
                </div>
              </div>
            </section>

            <aside className="lg:col-span-5 space-y-6">
              <div className="bg-transparent border border-purple-400/30 rounded-2xl p-6">
                <h3 className="text-lg font-['Orbitron'] font-semibold text-white flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Career Studio Tools
                </h3>
                <ul className="space-y-3 text-sm text-white/70">
                  <li className="flex gap-3 items-start">
                    <span className="text-purple-400 text-lg">▸</span>
                    <span>Decode job postings for hidden requirements and red flags</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-purple-400 text-lg">▸</span>
                    <span>Build and version control your master resume</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-purple-400 text-lg">▸</span>
                    <span>Tailor applications to specific roles with ATS optimization</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-purple-400 text-lg">▸</span>
                    <span>Generate cover letters that match your authentic voice</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-purple-400 text-lg">▸</span>
                    <span>Track applications and follow-ups in one place</span>
                  </li>
                </ul>
              </div>

              <div className="bg-transparent border border-purple-400/30 rounded-2xl p-6">
                <h3 className="text-lg font-['Orbitron'] font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  How Lex Helps
                </h3>
                <p className="text-sm text-white/70 mb-6">
                  Lex isn't just AI—she's your career strategist who understands your goals and keeps you on track.
                </p>

                <div className="space-y-4">
                  <Rule
                    icon={<Target className="w-4 h-4 text-purple-400" />}
                    title="Strategic Analysis"
                    text="Lex helps you understand what jobs really want, not just what they say."
                  />
                  <Rule
                    icon={<FileText className="w-4 h-4 text-purple-400" />}
                    title="Precision Tailoring"
                    text="Every resume and cover letter gets optimized for the specific role you're targeting."
                  />
                  <Rule
                    icon={<Calendar className="w-4 h-4 text-purple-400" />}
                    title="Progress Tracking"
                    text="Lex helps you see your application pipeline and reminds you to follow up."
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
    <div className="rounded-xl border border-purple-400/30 bg-transparent p-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-['Orbitron']">{title}</div>
        <div className="text-[10px] text-purple-400/60">▸</div>
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
    <div className="flex gap-3 rounded-xl border border-purple-400/30 bg-transparent p-4 hover:bg-white/[0.02] transition-colors">
      <div className="w-10 h-10 rounded-lg bg-transparent border border-purple-400/30 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white mb-1">{title}</div>
        <div className="text-xs text-white/60 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
