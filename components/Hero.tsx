// components/Hero.tsx
"use client";
import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; vz: number };

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const starsRef = useRef<Star[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let width = 0, height = 0, cx = 0, cy = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * DPR);
      canvas.height = Math.floor(height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = width / 2;
      cy = height / 2;
    };

    const initStars = () => {
      const count = Math.min(600, Math.floor((width * height) / 2500));
      const arr: Star[] = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: (Math.random() - 0.5) * width,
          y: (Math.random() - 0.5) * height,
          z: Math.random() * 1 + 0.2,
          vz: Math.random() * 0.015 + 0.003,
        });
      }
      starsRef.current = arr;
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cx, cy));
      bg.addColorStop(0, "rgba(56,189,248,0.10)");
      bg.addColorStop(1, "rgba(0,0,0,0.0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(234,255,255,0.9)";
      for (const s of starsRef.current) {
        s.z += s.vz;
        if (s.z > 2.2) {
          s.x = (Math.random() - 0.5) * width;
          s.y = (Math.random() - 0.5) * height;
          s.z = Math.random() * 0.2 + 0.1;
          s.vz = Math.random() * 0.015 + 0.003;
        }
        const px = cx + s.x / s.z;
        const py = cy + s.y / s.z;
        const size = Math.max(0.6, 1.6 / s.z);
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    const onResize = () => {
      resize();
      initStars();
    };

    resize();
    initStars();
    render();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section id="hero" className="hero">
      <canvas id="gl" ref={canvasRef} />
      <div className="hero-content">
        <h1>Ben Sandivar</h1>
        <p>Transformative Ideas.</p>
        <a href="/#projects" className="scroll-arrow">→ View My Work</a>
      </div>
    </section>
  );
}