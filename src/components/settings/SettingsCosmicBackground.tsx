"use client";

import { useEffect, useRef } from "react";

export default function SettingsCosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.2 + Math.random() * 1.2,
      opacity: 0.1 + Math.random() * 0.6,
      speed: 0.00008 + Math.random() * 0.00022,
    }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      context.fillStyle = "#0f0e0c";
      context.fillRect(0, 0, width, height);

      const upperGlow = context.createRadialGradient(
        width * 0.2,
        height * 0.15,
        0,
        width * 0.2,
        height * 0.15,
        width * 0.45
      );
      upperGlow.addColorStop(0, "rgba(91,110,174,0.08)");
      upperGlow.addColorStop(1, "rgba(91,110,174,0)");
      context.fillStyle = upperGlow;
      context.fillRect(0, 0, width, height);

      const lowerGlow = context.createRadialGradient(
        width * 0.8,
        height * 0.82,
        0,
        width * 0.8,
        height * 0.82,
        width * 0.5
      );
      lowerGlow.addColorStop(0, "rgba(126,91,174,0.06)");
      lowerGlow.addColorStop(1, "rgba(126,91,174,0)");
      context.fillStyle = lowerGlow;
      context.fillRect(0, 0, width, height);

      stars.forEach((star) => {
        star.y -= star.speed;
        if (star.y < -0.02) {
          star.y = 1.02;
          star.x = Math.random();
        }

        context.beginPath();
        context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(220,216,204,${star.opacity})`;
        context.fill();
      });

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />;
}
