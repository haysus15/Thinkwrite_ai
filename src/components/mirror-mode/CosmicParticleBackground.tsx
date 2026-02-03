// src/components/mirror-mode/CosmicParticleBackground.tsx
// Three.js cosmic particle background - realistic night sky with varied star brightness
// ✅ Ambient-only visible drift (no mouse) + ✅ BODY-mounted canvas (fixes "fixed inside transformed parent" issue)
// ✅ Two star layers for parallax + nebula + full GPU cleanup
'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

type Props = {
  starCount?: number;
  nebulaIntensity?: number;
  driftSpeed?: number; // 0.1 = very slow, 1 = faster
};

export default function CosmicParticleBackground({
  starCount = 2000,
  nebulaIntensity = 0.15,
  driftSpeed = 0.15,
}: Props) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationRef = useRef<number | null>(null);

  // Star layers for parallax + reflections
  const starsFarRef = useRef<THREE.Points | null>(null);
  const starsNearRef = useRef<THREE.Points | null>(null);
  const starsReflectFarRef = useRef<THREE.Points | null>(null);
  const starsReflectNearRef = useRef<THREE.Points | null>(null);
  const nebulaRef = useRef<THREE.Points | null>(null);

  // GPU cleanup refs
  const farGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const farMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const nearGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const nearMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const reflectFarGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const reflectFarMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const reflectNearGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const reflectNearMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const nebulaGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const nebulaMatRef = useRef<THREE.ShaderMaterial | null>(null);

  const cleanupScene = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (sceneRef.current) {
      if (starsFarRef.current) sceneRef.current.remove(starsFarRef.current);
      if (starsNearRef.current) sceneRef.current.remove(starsNearRef.current);
      if (starsReflectFarRef.current) sceneRef.current.remove(starsReflectFarRef.current);
      if (starsReflectNearRef.current) sceneRef.current.remove(starsReflectNearRef.current);
      if (nebulaRef.current) sceneRef.current.remove(nebulaRef.current);
 
    }

    starsFarRef.current = null;
    starsNearRef.current = null;
    starsReflectFarRef.current = null;
    starsReflectNearRef.current = null;
    nebulaRef.current = null;

    // Dispose GPU resources
    farGeoRef.current?.dispose();
    farMatRef.current?.dispose();
    nearGeoRef.current?.dispose();
    nearMatRef.current?.dispose();
    reflectFarGeoRef.current?.dispose();
    reflectFarMatRef.current?.dispose();
    reflectNearGeoRef.current?.dispose();
    reflectNearMatRef.current?.dispose();
    nebulaGeoRef.current?.dispose();
    nebulaMatRef.current?.dispose();

    farGeoRef.current = null;
    farMatRef.current = null;
    nearGeoRef.current = null;
    nearMatRef.current = null;
    reflectFarGeoRef.current = null;
    reflectFarMatRef.current = null;
    reflectNearGeoRef.current = null;
    reflectNearMatRef.current = null;
    nebulaGeoRef.current = null;
    nebulaMatRef.current = null;

    // Remove canvas from BODY + dispose renderer
    if (rendererRef.current) {
      const canvas = rendererRef.current.domElement;
      if (canvas && canvas.parentElement === document.body) {
        document.body.removeChild(canvas);
      }
      rendererRef.current.dispose();
    }

    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
  }, []);

  const buildStarLayer = useCallback(
    (
      renderer: THREE.WebGLRenderer,
      count: number,
      layer: 'far' | 'near',
      isReflection: boolean = false
    ): { points: THREE.Points; geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial } => {
      const geo = new THREE.BufferGeometry();

      const positions: number[] = [];
      const sizes: number[] = [];
      const colors: number[] = [];
      const phases: number[] = [];
      const seeds: number[] = [];

      for (let i = 0; i < count; i++) {
        const radius = layer === 'near' ? 60 + Math.random() * 160 : 180 + Math.random() * 520;

        const theta = Math.random() * Math.PI * 2;
        // Full sphere for even coverage (reflection still handled in shader)
        const phi = Math.acos(2 * Math.random() - 1); // 0..PI

        const x = radius * Math.sin(phi) * Math.cos(theta);
        let y = radius * Math.sin(phi) * Math.sin(theta);
        // Slight downward bias so the lower half isn't sparse
        y -= 20;
        const z = -radius * Math.cos(phi) - 120;

        positions.push(x, y, z);

        // SMALLER star sizes (reduced from original)
        const v = Math.random();
        let size: number;
        if (v < 0.80) size = layer === 'near' ? 0.6 + Math.random() * 0.6 : 0.4 + Math.random() * 0.5;
        else if (v < 0.95) size = layer === 'near' ? 1.2 + Math.random() * 0.8 : 0.9 + Math.random() * 0.7;
        else size = layer === 'near' ? 2.0 + Math.random() * 1.0 : 1.6 + Math.random() * 0.8;
        sizes.push(size);

        // Color variation
        const cv = Math.random();
        let r: number, g: number, b: number;
        if (cv < 0.6) {
          r = 0.9 + Math.random() * 0.1;
          g = 0.9 + Math.random() * 0.1;
          b = 0.95 + Math.random() * 0.05;
        } else if (cv < 0.8) {
          r = 0.8 + Math.random() * 0.1;
          g = 0.85 + Math.random() * 0.1;
          b = 0.95 + Math.random() * 0.05;
        } else {
          r = 0.95 + Math.random() * 0.05;
          g = 0.9 + Math.random() * 0.05;
          b = 0.8 + Math.random() * 0.1;
        }
        colors.push(r, g, b);

        phases.push(Math.random() * Math.PI * 2);
        seeds.push(Math.random());
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
      geo.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          pixelRatio: { value: renderer.getPixelRatio() },
          driftSpeed: { value: driftSpeed },
          driftAmp: { value: layer === 'near' ? 10.0 : 6.0 },
          isReflection: { value: isReflection ? 1.0 : 0.0 },
          horizonY: { value: 0.0 }, // horizon line at center
        },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          attribute float phase;
          attribute float seed;

          varying vec3 vColor;
          varying float vSize;
          varying float vIsReflection;

          uniform float time;
          uniform float pixelRatio;
          uniform float driftSpeed;
          uniform float driftAmp;
          uniform float isReflection;
          uniform float horizonY;

          void main() {
            vColor = color;
            vSize = size;
            vIsReflection = isReflection;

            vec3 p = position;

            // Per-star ambient drift
            float t = time * driftSpeed;
            float sx = sin(t * 0.18 + seed * 10.0 + p.y * 0.002);
            float sy = cos(t * 0.15 + seed * 12.0 + p.x * 0.002);

            p.x += sx * driftAmp;
            p.y += sy * (driftAmp * 0.7);
            p.z += sin(t * 0.08 + seed * 8.0) * 2.0;

            // Mirror reflection: flip Y below horizon
            if (isReflection > 0.5) {
              p.y = horizonY - (p.y - horizonY);
              // Add subtle ripple distortion to reflection
              float ripple = sin(t * 0.5 + p.x * 0.02) * 3.0;
              p.y += ripple;
            }

            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

            // Twinkle
            float twinkle = sin(time * 1.5 + phase + position.x * 0.05) * 0.15 + 0.85;

            gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z) * twinkle;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vSize;
          varying float vIsReflection;

          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;

            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha = pow(alpha, 1.5);

            if (vSize > 1.5) {
              float core = 1.0 - smoothstep(0.0, 0.15, dist);
              alpha = max(alpha, core * 0.85);
            }

            // Reflection is dimmer and slightly bluer (like water reflection)
            vec3 finalColor = vColor;
            if (vIsReflection > 0.5) {
              alpha *= 0.4; // 40% opacity for reflection
              finalColor = mix(vColor, vec3(0.7, 0.8, 1.0), 0.15); // slight blue tint
            } else {
              alpha = min(alpha * 1.15, 1.0); // brighten main stars
            }

            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geo, mat);
      return { points, geo, mat };
    },
    [driftSpeed]
  );

  const initScene = useCallback(() => {
    cleanupScene();

    const getViewport = () => ({
      width: Math.max(window.innerWidth, document.documentElement.clientWidth || 0),
      height: Math.max(window.innerHeight, document.documentElement.clientHeight || 0),
    });

    const { width, height } = getViewport();

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1200);
    camera.position.z = 1;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);

    // ✅ IMPORTANT: attach canvas to BODY so "fixed" isn't trapped by transformed parents
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.zIndex = '-10';
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.style.background = '#000000';

    document.body.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // FAR star layer (upper sky)
    const far = buildStarLayer(renderer, Math.floor(starCount * 0.72), 'far', false);
    scene.add(far.points);
    starsFarRef.current = far.points;
    farGeoRef.current = far.geo;
    farMatRef.current = far.mat;

    // NEAR star layer (upper sky, parallax)
    const near = buildStarLayer(renderer, Math.floor(starCount * 0.28), 'near', false);
    scene.add(near.points);
    starsNearRef.current = near.points;
    nearGeoRef.current = near.geo;
    nearMatRef.current = near.mat;

    // REFLECTED FAR stars (mirror below horizon)
    const reflectFar = buildStarLayer(renderer, Math.floor(starCount * 0.72), 'far', true);
    scene.add(reflectFar.points);
    starsReflectFarRef.current = reflectFar.points;
    reflectFarGeoRef.current = reflectFar.geo;
    reflectFarMatRef.current = reflectFar.mat;

    // REFLECTED NEAR stars (mirror below horizon)
    const reflectNear = buildStarLayer(renderer, Math.floor(starCount * 0.28), 'near', true);
    scene.add(reflectNear.points);
    starsReflectNearRef.current = reflectNear.points;
    reflectNearGeoRef.current = reflectNear.geo;
    reflectNearMatRef.current = reflectNear.mat;

    // Nebula (very faint)
    if (nebulaIntensity > 0) {
      const nebulaGeometry = new THREE.BufferGeometry();
      const nebulaPositions: number[] = [];
      const nebulaSizes: number[] = [];
      const nebulaColors: number[] = [];
      const nebulaCount = 18;

      const nebulaColorPalette = [
        [0.95, 0.95, 1.0],
        [0.9, 0.9, 0.95],
        [0.85, 0.88, 0.92],
        [0.92, 0.9, 0.88],
      ];

      for (let i = 0; i < nebulaCount; i++) {
        const x = (Math.random() - 0.5) * 900;
        const y = (Math.random() - 0.5) * 700;
        const z = -260 - Math.random() * 420;

        nebulaPositions.push(x, y, z);
        nebulaSizes.push(190 + Math.random() * 260);

        const c = nebulaColorPalette[Math.floor(Math.random() * nebulaColorPalette.length)];
        nebulaColors.push(c[0], c[1], c[2]);
      }

      nebulaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nebulaPositions, 3));
      nebulaGeometry.setAttribute('size', new THREE.Float32BufferAttribute(nebulaSizes, 1));
      nebulaGeometry.setAttribute('color', new THREE.Float32BufferAttribute(nebulaColors, 3));

      const nebulaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          intensity: { value: nebulaIntensity },
          driftSpeed: { value: driftSpeed * 0.6 },
        },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          uniform float time;
          uniform float driftSpeed;

          void main() {
            vColor = color;

            vec3 p = position;

            float t = time * driftSpeed;
            p.x += sin(t * 0.08 + p.y * 0.002) * 22.0;
            p.y += cos(t * 0.06 + p.x * 0.002) * 16.0;

            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          uniform float intensity;

          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;

            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha = pow(alpha, 4.0) * intensity;

            gl_FragColor = vec4(vColor, alpha * 0.25);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
      scene.add(nebula);
      nebulaRef.current = nebula;
      nebulaGeoRef.current = nebulaGeometry;
      nebulaMatRef.current = nebulaMaterial;
    }
  }, [starCount, nebulaIntensity, driftSpeed, cleanupScene, buildStarLayer]);

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const time = performance.now() * 0.001;

    // Update time uniforms for all star layers
    if (starsFarRef.current) {
      const mat = starsFarRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.driftSpeed.value = driftSpeed;
    }
    if (starsNearRef.current) {
      const mat = starsNearRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.driftSpeed.value = driftSpeed;
    }
    // Update reflection layers
    if (starsReflectFarRef.current) {
      const mat = starsReflectFarRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.driftSpeed.value = driftSpeed;
    }
    if (starsReflectNearRef.current) {
      const mat = starsReflectNearRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.driftSpeed.value = driftSpeed;
    }
    if (nebulaRef.current) {
      const mat = nebulaRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.driftSpeed.value = driftSpeed * 0.6;
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationRef.current = requestAnimationFrame(animate);
  }, [driftSpeed]);

  const handleResize = useCallback(() => {
    if (!cameraRef.current || !rendererRef.current) return;

    const width = Math.max(window.innerWidth, document.documentElement.clientWidth || 0);
    const height = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();

    rendererRef.current.setSize(width, height, false);

    const pr = Math.min(window.devicePixelRatio, 2);
    rendererRef.current.setPixelRatio(pr);

    // Update pixelRatio uniform on all star layers
    if (starsFarRef.current) {
      const mat = starsFarRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.pixelRatio.value = pr;
    }
    if (starsNearRef.current) {
      const mat = starsNearRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.pixelRatio.value = pr;
    }
    if (starsReflectFarRef.current) {
      const mat = starsReflectFarRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.pixelRatio.value = pr;
    }
    if (starsReflectNearRef.current) {
      const mat = starsReflectNearRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.pixelRatio.value = pr;
    }
  }, []);

  useEffect(() => {
    initScene();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupScene();
    };
  }, [initScene, animate, handleResize, cleanupScene]);

  // ✅ We mount the canvas to <body>, so this component renders nothing.
  return null;
}
