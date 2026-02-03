"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Image from "next/image";
import Link from "next/link";

type AnimationPhase = "inspiration" | "voice" | "style" | "journey";

const PHASE_LABELS: Record<AnimationPhase, string> = {
  inspiration: "Your Moment of Inspiration...",
  voice: "Learning Your Voice...",
  style: "Identifying Your Style...",
  journey: "Let's Start Your Journey...",
};

export default function ParticleHero() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>("inspiration");
  const [isLoaded, setIsLoaded] = useState(false);
  const initializingRef = useRef(false);
  const cleanupFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (initializingRef.current) return; // Prevent double initialization
    
    // Mark as initializing
    initializingRef.current = true;

    // Ensure DOM is fully ready before initializing
    const initScene = () => {
      if (!canvasRef.current) {
        initializingRef.current = false;
        return;
      }

      // Double-check window is available
      if (typeof window === 'undefined') {
        initializingRef.current = false;
        return;
      }

      // Double-check window is available
      if (typeof window === 'undefined') {
        initializingRef.current = false;
        return;
      }

      // Ensure window dimensions are available
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;

    // ============================================================
    // PERF TUNING (prevents "forever to load")
    // ============================================================
    const DPR_CAP = 1.25;

    // Particle counts (keeps the look, loads way faster)
    const backgroundStarCount = 9000;
    const hazeCount = 9000;
    const haloCount = 6500;
    const coreCount = 11000;
    const laneCount = 4200;
    const floatCount = 900;

    // ============================================================
    // SCENE / CAMERA / RENDERER
    // ============================================================
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
    
    // Clear any existing canvas first
    const existingCanvas = canvasRef.current?.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    
    canvasRef.current?.appendChild(renderer.domElement);

    // ============================================================
    // HELPERS
    // ============================================================
    function makeGlowTexture() {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d")!;
      const g = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );

      g.addColorStop(0.0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.18, "rgba(255,255,255,0.55)");
      g.addColorStop(0.45, "rgba(255,255,255,0.18)");
      g.addColorStop(1.0, "rgba(255,255,255,0.0)");

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }

    const glowTex = makeGlowTexture();

    // Parallax drift
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      mouse.x = (e.clientX - cx) / cx;
      mouse.y = (e.clientY - cy) / cy;
    };
    window.addEventListener("mousemove", onMouseMove);

    // ============================================================
    // BACKGROUND STARS
    // ============================================================
    const bgStarPositions = new Float32Array(backgroundStarCount * 3);
    const bgStarColors = new Float32Array(backgroundStarCount * 3);

    for (let i = 0; i < backgroundStarCount; i++) {
      const i3 = i * 3;

      const radius = 55 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      bgStarPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      bgStarPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      bgStarPositions[i3 + 2] = radius * Math.cos(phi) - 25;

      const colorChoice = Math.random();
      if (colorChoice < 0.78) {
        // neutral white
        bgStarColors[i3] = 1.0;
        bgStarColors[i3 + 1] = 1.0;
        bgStarColors[i3 + 2] = 1.0;
      } else if (colorChoice < 0.92) {
        // slightly cool silver
        bgStarColors[i3] = 0.96;
        bgStarColors[i3 + 1] = 0.98;
        bgStarColors[i3 + 2] = 1.05;
      } else {
        // faint warm tint (gold-ish)
        bgStarColors[i3] = 1.05;
        bgStarColors[i3 + 1] = 1.02;
        bgStarColors[i3 + 2] = 0.95;
      }
    }

    const bgStarGeometry = new THREE.BufferGeometry();
    bgStarGeometry.setAttribute("position", new THREE.BufferAttribute(bgStarPositions, 3));
    bgStarGeometry.setAttribute("color", new THREE.BufferAttribute(bgStarColors, 3));

    const bgStarMaterial = new THREE.PointsMaterial({
      size: 0.03,
      transparent: true,
      opacity: 0.92,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });

    const backgroundStars = new THREE.Points(bgStarGeometry, bgStarMaterial);
    scene.add(backgroundStars);

    // ============================================================
    // MILKY WAY
    // ============================================================
    const MW_TILT = -0.42;
    const MW_CENTER_Y = 0.6;
    const MW_Z = -28;
    const MW_RADIUS = 34;
    const MW_THICKNESS = 3.2;

    // --- 1) HAZE ---
    const hazePos = new Float32Array(hazeCount * 3);
    const hazeCol = new Float32Array(hazeCount * 3);

    for (let i = 0; i < hazeCount; i++) {
      const i3 = i * 3;

      const t = (Math.random() * 2 - 1) * Math.PI;
      const r = MW_RADIUS + Math.random() * 18;
      const ySpread = (Math.random() - Math.random()) * MW_THICKNESS;

      let x = Math.cos(t) * r;
      let y = Math.sin(t) * r * 0.22 + MW_CENTER_Y + ySpread;
      let z = MW_Z + Math.random() * 12;

      const ct = Math.cos(MW_TILT);
      const st = Math.sin(MW_TILT);
      const rx = x * ct - y * st;
      const ry = x * st + y * ct;

      hazePos[i3] = rx;
      hazePos[i3 + 1] = ry;
      hazePos[i3 + 2] = z;

      const dist = Math.min(Math.abs(ySpread) / MW_THICKNESS, 1);
      const glow = 0.06 + (1 - dist) * 0.16;

      // slightly warm-white haze
      hazeCol[i3] = glow * 1.02;
      hazeCol[i3 + 1] = glow * 1.00;
      hazeCol[i3 + 2] = glow * 0.98;
    }

    const hazeGeo = new THREE.BufferGeometry();
    hazeGeo.setAttribute("position", new THREE.BufferAttribute(hazePos, 3));
    hazeGeo.setAttribute("color", new THREE.BufferAttribute(hazeCol, 3));

    const hazeMat = new THREE.PointsMaterial({
      size: 0.22,
      map: glowTex,
      transparent: true,
      opacity: 0.32,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: true,
    });

    const milkyHaze = new THREE.Points(hazeGeo, hazeMat);
    scene.add(milkyHaze);

    // --- HALO (soft bloom around band) ---
    const haloPos = new Float32Array(haloCount * 3);
    const haloCol = new Float32Array(haloCount * 3);

    for (let i = 0; i < haloCount; i++) {
      const i3 = i * 3;

      const t = (Math.random() * 2 - 1) * Math.PI;
      const r = MW_RADIUS + 6 + Math.random() * 26;
      const ySpread = (Math.random() - Math.random()) * (MW_THICKNESS * 2.4);

      let x = Math.cos(t) * r;
      let y = Math.sin(t) * r * 0.22 + MW_CENTER_Y + ySpread;
      let z = MW_Z - 2 + Math.random() * 10;

      const ct = Math.cos(MW_TILT);
      const st = Math.sin(MW_TILT);
      const rx = x * ct - y * st;
      const ry = x * st + y * ct;

      haloPos[i3] = rx;
      haloPos[i3 + 1] = ry;
      haloPos[i3 + 2] = z;

      const dist = Math.min(Math.abs(ySpread) / (MW_THICKNESS * 2.4), 1);
      const core = 1 - dist;

      const glow = 0.10 + core * 0.12;

      // warm silver-gold bloom (angelic)
      haloCol[i3] = glow * 1.08;
      haloCol[i3 + 1] = glow * 1.05;
      haloCol[i3 + 2] = glow * 0.98;
    }

    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
    haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));

    const haloMat = new THREE.PointsMaterial({
      size: 0.35,
      map: glowTex,
      transparent: true,
      opacity: 0.14,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true,
    });

    const milkyHalo = new THREE.Points(haloGeo, haloMat);
    scene.add(milkyHalo);

    // --- CORE / DENSE CLOUD ---
    const corePos = new Float32Array(coreCount * 3);
    const coreCol = new Float32Array(coreCount * 3);

    for (let i = 0; i < coreCount; i++) {
      const i3 = i * 3;

      const t = (Math.random() * 2 - 1) * Math.PI;
      const r = MW_RADIUS + Math.random() * 14;
      const ySpread = (Math.random() - Math.random()) * (MW_THICKNESS * 0.7);

      let x = Math.cos(t) * r;
      let y = Math.sin(t) * r * 0.22 + MW_CENTER_Y + ySpread;
      let z = MW_Z + 2 + Math.random() * 10;

      const ct = Math.cos(MW_TILT);
      const st = Math.sin(MW_TILT);
      const rx = x * ct - y * st;
      const ry = x * st + y * ct;

      corePos[i3] = rx;
      corePos[i3 + 1] = ry;
      corePos[i3 + 2] = z;

      const coreBoost = Math.exp(-Math.abs(t) * 0.55);
      const intensity = 0.55 + coreBoost * 1.2;

      // shift core slightly warm, not cyan
      coreCol[i3] = intensity * 1.08;
      coreCol[i3 + 1] = intensity * 1.03;
      coreCol[i3 + 2] = intensity * 0.96;
    }

    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute("position", new THREE.BufferAttribute(corePos, 3));
    coreGeo.setAttribute("color", new THREE.BufferAttribute(coreCol, 3));

    const coreMat = new THREE.PointsMaterial({
      size: 0.045,
      transparent: true,
      opacity: 0.48,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });

    const milkyCore = new THREE.Points(coreGeo, coreMat);
    scene.add(milkyCore);

    // --- DUST LANES ---
    const lanePos = new Float32Array(laneCount * 3);

    for (let i = 0; i < laneCount; i++) {
      const i3 = i * 3;

      const t = (Math.random() * 2 - 1) * Math.PI;
      const r = MW_RADIUS + Math.random() * 14;
      const ySpread = (Math.random() - Math.random()) * (MW_THICKNESS * 0.35);

      let x = Math.cos(t) * r;
      let y = Math.sin(t) * r * 0.22 + MW_CENTER_Y + ySpread;
      let z = MW_Z + 4 + Math.random() * 8;

      const ct = Math.cos(MW_TILT);
      const st = Math.sin(MW_TILT);
      const rx = x * ct - y * st;
      const ry = x * st + y * ct;

      lanePos[i3] = rx;
      lanePos[i3 + 1] = ry;
      lanePos[i3 + 2] = z;
    }

    const laneGeo = new THREE.BufferGeometry();
    laneGeo.setAttribute("position", new THREE.BufferAttribute(lanePos, 3));

    const laneMat = new THREE.PointsMaterial({
      size: 0.18,
      map: glowTex,
      transparent: true,
      opacity: 0.06,
      color: new THREE.Color(0x05060a),
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: true,
    });

    const dustLanes = new THREE.Points(laneGeo, laneMat);
    scene.add(dustLanes);

    // ============================================================
    // FLOATING FOREGROUND STARS
    // ============================================================
    const floatPos = new Float32Array(floatCount * 3);
    const floatCol = new Float32Array(floatCount * 3);
    const floatVel = new Float32Array(floatCount * 3);

    for (let i = 0; i < floatCount; i++) {
      const i3 = i * 3;

      floatPos[i3] = (Math.random() - 0.5) * 22;
      floatPos[i3 + 1] = (Math.random() - 0.5) * 12;
      floatPos[i3 + 2] = -6 + Math.random() * 10;

      floatVel[i3] = (Math.random() - 0.5) * 0.28;
      floatVel[i3 + 1] = (Math.random() - 0.5) * 0.18;
      floatVel[i3 + 2] = (Math.random() - 0.5) * 0.05;

      // neutral/silver (no cyan)
      const base = 0.9 + Math.random() * 0.2;
      floatCol[i3] = base;
      floatCol[i3 + 1] = base;
      floatCol[i3 + 2] = base * 0.98;
    }

    const floatGeo = new THREE.BufferGeometry();
    floatGeo.setAttribute("position", new THREE.BufferAttribute(floatPos, 3));
    floatGeo.setAttribute("color", new THREE.BufferAttribute(floatCol, 3));

    const floatMat = new THREE.PointsMaterial({
      size: 0.055,
      map: glowTex,
      transparent: true,
      opacity: 0.22,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: true,
    });

    const floatingStars = new THREE.Points(floatGeo, floatMat);
    scene.add(floatingStars);

    // ============================================================
    // 3 SHOOTING STARS
    // ============================================================
    type Meteor = {
      group: THREE.Group;
      headGeo: THREE.BufferGeometry;
      headMat: THREE.PointsMaterial;
      head: THREE.Points;
      tailGeo: THREE.BufferGeometry;
      tailMat: THREE.LineBasicMaterial;
      tail: THREE.Line;
      active: boolean;
      t: number;
      delay: number;
      life: number;
      speed: number;
      start: THREE.Vector3;
      dir: THREE.Vector3;
    };

    function makeMeteor(): Meteor {
      const group = new THREE.Group();

      const headGeo = new THREE.BufferGeometry();
      headGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3)
      );

      const headMat = new THREE.PointsMaterial({
        size: 0.14,
        map: glowTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        color: new THREE.Color(0xffffff),
      });

      const head = new THREE.Points(headGeo, headMat);

      const tailGeo = new THREE.BufferGeometry();
      tailGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3)
      );

      // warm-silver tail
      const tailMat = new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        color: 0xfff2c6, // pale gold
        depthWrite: false,
      });

      const tail = new THREE.Line(tailGeo, tailMat);

      group.add(tail);
      group.add(head);
      scene.add(group);

      return {
        group,
        headGeo,
        headMat,
        head,
        tailGeo,
        tailMat,
        tail,
        active: false,
        t: 0,
        delay: 0,
        life: 0.5,
        speed: 55,
        start: new THREE.Vector3(),
        dir: new THREE.Vector3(),
      };
    }

    const meteors: Meteor[] = [makeMeteor(), makeMeteor(), makeMeteor()];

    function spawnMeteor(m: Meteor, preset: 0 | 1 | 2) {
      if (preset === 0) {
        m.start.set(-20, 11, -14);
        m.dir.set(1.2, -0.75, 0.1).normalize();
      } else if (preset === 1) {
        m.start.set(22, 10, -16);
        m.dir.set(-1.35, -0.65, 0.08).normalize();
      } else {
        m.start.set(-22, 2.5, -15);
        m.dir.set(1.55, -0.25, 0.06).normalize();
      }

      m.speed = 60 + Math.random() * 18;
      m.life = 0.45 + Math.random() * 0.12;
      m.t = 0;
      m.active = true;

      m.headMat.opacity = 0.95;
      m.tailMat.opacity = 0.65;

      const headPos = m.headGeo.getAttribute("position") as THREE.BufferAttribute;
      headPos.setXYZ(0, m.start.x, m.start.y, m.start.z);
      headPos.needsUpdate = true;

      const tailPos = m.tailGeo.getAttribute("position") as THREE.BufferAttribute;
      tailPos.setXYZ(0, m.start.x, m.start.y, m.start.z);
      tailPos.setXYZ(1, m.start.x, m.start.y, m.start.z);
      tailPos.needsUpdate = true;
    }

    meteors[0].delay = 1.2;
    meteors[1].delay = 2.6;
    meteors[2].delay = 4.0;

    const tmpV = new THREE.Vector3();

    function updateMeteor(m: Meteor, dt: number, preset: 0 | 1 | 2) {
      if (!m.active) {
        m.delay -= dt;
        if (m.delay <= 0) spawnMeteor(m, preset);
        return;
      }

      m.t += dt;

      tmpV.copy(m.start).addScaledVector(m.dir, m.speed * m.t);

      const headPos = m.headGeo.getAttribute("position") as THREE.BufferAttribute;
      headPos.setXYZ(0, tmpV.x, tmpV.y, tmpV.z);
      headPos.needsUpdate = true;

      const tailLen = 4.4;
      const tailStart = tmpV.clone().addScaledVector(m.dir, -tailLen);

      const tailPos = m.tailGeo.getAttribute("position") as THREE.BufferAttribute;
      tailPos.setXYZ(0, tailStart.x, tailStart.y, tailStart.z);
      tailPos.setXYZ(1, tmpV.x, tmpV.y, tmpV.z);
      tailPos.needsUpdate = true;

      const fade = Math.max(1 - m.t / m.life, 0);
      m.headMat.opacity = 0.95 * fade;
      m.tailMat.opacity = 0.65 * fade;

      if (
        m.t > m.life ||
        tmpV.x < -30 ||
        tmpV.x > 30 ||
        tmpV.y < -18 ||
        tmpV.y > 18
      ) {
        m.active = false;
        m.headMat.opacity = 0.0;
        m.tailMat.opacity = 0.0;
        m.delay = 8 + Math.random() * 10;
      }
    }

    // ============================================================
    // RENDER LOOP
    // ============================================================
    let animationFrameId = 0;
    let lastTime = performance.now();
    const parallax = { x: 0, y: 0 };

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      // ============================================================
      // GENTLE SKY DRIFT - Slow rotation
      // ============================================================
      const time = now * 0.00002; // Very slow time progression
      
      // Background stars - gentle rotation
      backgroundStars.rotation.y = time * 0.15;
      backgroundStars.rotation.z = Math.sin(time * 0.3) * 0.01;
      
      // Milky Way components - synchronized slow drift
      const mwRotation = time * 0.12;
      const mwTilt = Math.sin(time * 0.25) * 0.008;
      
      milkyHaze.rotation.y = mwRotation;
      milkyHaze.rotation.z = mwTilt;
      
      milkyHalo.rotation.y = mwRotation * 0.95;
      milkyHalo.rotation.z = mwTilt * 0.9;
      
      milkyCore.rotation.y = mwRotation;
      milkyCore.rotation.z = mwTilt;
      
      dustLanes.rotation.y = mwRotation * 1.05;
      dustLanes.rotation.z = mwTilt * 1.1;

      parallax.x += (mouse.x - parallax.x) * 0.04;
      parallax.y += (mouse.y - parallax.y) * 0.04;

      floatingStars.position.x = parallax.x * 0.55;
      floatingStars.position.y = -parallax.y * 0.35;

      const posAttr = floatGeo.getAttribute("position") as THREE.BufferAttribute;

      for (let i = 0; i < floatCount; i++) {
        const i3 = i * 3;

        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        let z = posAttr.getZ(i);

        x += floatVel[i3] * dt;
        y += floatVel[i3 + 1] * dt;
        z += floatVel[i3 + 2] * dt;

        if (x > 13) x = -13;
        if (x < -13) x = 13;
        if (y > 7) y = -7;
        if (y < -7) y = 7;
        if (z > 5) z = -7;
        if (z < -7) z = 5;

        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;

      updateMeteor(meteors[0], dt, 0);
      updateMeteor(meteors[1], dt, 1);
      updateMeteor(meteors[2], dt, 2);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // ============================================================
    // RESIZE
    // ============================================================
    const handleResize = () => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
    };

    window.addEventListener("resize", handleResize);

    // ============================================================
    // CLEANUP
    // ============================================================
    const cleanup = () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);

      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      bgStarGeometry.dispose();
      bgStarMaterial.dispose();

      hazeGeo.dispose();
      hazeMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      laneGeo.dispose();
      laneMat.dispose();

      floatGeo.dispose();
      floatMat.dispose();

      for (const m of meteors) {
        m.headGeo.dispose();
        m.headMat.dispose();
        m.tailGeo.dispose();
        m.tailMat.dispose();
      }

      glowTex.dispose();

      renderer.dispose();
      scene.clear();

      if (canvasRef.current?.contains(renderer.domElement)) {
        canvasRef.current.removeChild(renderer.domElement);
      }
      
      initializingRef.current = false;
    };
    
    // Store cleanup function
    cleanupFnRef.current = cleanup;
    
    // Mark as loaded after first render
    requestAnimationFrame(() => {
      setIsLoaded(true);
    });
    };
    
    // Initialize with a slight delay to ensure DOM is ready
    const timeoutId = setTimeout(initScene, 50);
    
    // Also try immediate initialization
    requestAnimationFrame(initScene);

    return () => {
      clearTimeout(timeoutId);
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
    };
  }, []);

  // Cycle through storytelling labels every 4 seconds
  useEffect(() => {
    const phases: AnimationPhase[] = ["inspiration", "voice", "style", "journey"];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % phases.length;
      setCurrentPhase(phases[currentIndex]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* Loading indicator */}
      {!isLoaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#FFD37A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#FFD37A] font-['Orbitron']">Loading...</p>
          </div>
        </div>
      )}
      
      {/* 3D Canvas Container - FIXED to cover entire viewport */}
      <div ref={canvasRef} className="fixed inset-0 z-0" />

      {/* Warm / angelic atmospheric overlay - FIXED */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 35% at 50% 85%, rgba(255,205,120,0.08), transparent 55%)," +
            "linear-gradient(to top, rgba(35,30,60,0.35), transparent 55%)",
        }}
      />

      {/* Simple horizon silhouette - FIXED at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-0">
        <svg viewBox="0 0 1400 120" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0,120 L0,60 Q200,45 400,55 T800,50 T1200,52 T1400,55 L1400,120 Z"
            fill="rgba(8, 12, 20, 0.95)"
          />
          <path
            d="M0,120 L0,75 Q300,65 600,70 T1200,68 T1400,70 L1400,120 Z"
            fill="rgba(5, 8, 15, 0.98)"
          />
        </svg>
      </div>

      {/* Storytelling Label */}
      <div className="absolute top-1/4 left-0 right-0 flex justify-center z-20 pointer-events-none">
        <div
          className="text-2xl md:text-3xl font-['Orbitron'] transition-opacity duration-500"
          style={{
            color: "#FFE7A3",
            textShadow:
              "0 0 14px rgba(255,210,120,0.30), 0 0 28px rgba(255,210,120,0.16)",
          }}
        >
          {PHASE_LABELS[currentPhase]}
        </div>
      </div>

      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <div className="relative mb-8">
          <Image
            src="/thinkwrite-logo-transparent.png"
            alt="THINKWRITE - AI"
            width={900}
            height={120}
            className="w-auto h-auto max-w-[90vw] opacity-0 absolute"
            priority
          />

          <svg width="900" height="120" viewBox="0 0 900 120" className="max-w-[90vw] w-auto h-auto">
            <defs>
              {/* Silver → White → Champagne → Gold */}
              <linearGradient id="logoGradientGold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#BFC6CF" stopOpacity="1" />
                <stop offset="28%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="56%" stopColor="#F6E7B8" stopOpacity="1" />
                <stop offset="80%" stopColor="#FFD37A" stopOpacity="1" />
                <stop offset="100%" stopColor="#B8860B" stopOpacity="1" />
              </linearGradient>

              {/* Sheen band for "divine" shine */}
              <linearGradient id="sheenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="45%" stopColor="rgba(255,255,255,0.0)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="65%" stopColor="rgba(255,255,255,0.0)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>

              {/* Stronger glow (still clean) */}
              <filter id="holyGlow">
                <feGaussianBlur stdDeviation="3.6" result="b" />
                <feColorMatrix
                  in="b"
                  type="matrix"
                  values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.9 0"
                  result="b2"
                />
                <feMerge>
                  <feMergeNode in="b2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <mask id="textMask">
                <image href="/thinkwrite-logo-transparent.png" x="0" y="0" width="900" height="120" />
              </mask>
            </defs>

            {/* Base gold fill */}
            <rect
              x="0"
              y="0"
              width="900"
              height="120"
              fill="url(#logoGradientGold)"
              mask="url(#textMask)"
              filter="url(#holyGlow)"
            />

            {/* Sheen overlay (static shimmer look, no perf hit) */}
            <rect
              x="0"
              y="0"
              width="900"
              height="120"
              fill="url(#sheenGradient)"
              mask="url(#textMask)"
              style={{ mixBlendMode: "screen", opacity: 0.6 }}
            />
          </svg>
        </div>

        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl text-center px-4">
          AI that writes in{" "}
          <span
            className="font-semibold"
            style={{
              color: "#FFD37A",
              textShadow: "0 0 12px rgba(255,210,120,0.28)",
            }}
          >
            YOUR
          </span>{" "}
          voice.
          <br />
          Authentic. Powerful. Revolutionary.
        </p>

        <Link href="/select-studio">
          <button
            className="pointer-events-auto px-8 py-4 text-black font-['Orbitron'] font-bold text-lg rounded-lg hover:scale-105 transition-transform duration-300"
            style={{
              background:
                "linear-gradient(90deg, #FFFFFF 0%, #E7E9EE 25%, #FFD37A 60%, #B8860B 100%)",
              boxShadow:
                "0 0 18px rgba(255,210,120,0.22), 0 0 42px rgba(255,210,120,0.10), inset 0 0 18px rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            GET STARTED
          </button>
        </Link>
      </div>
    </div>
  );
}