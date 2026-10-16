import { useEffect, useRef } from "react";

export default function Starfield({ calmMode = false, isDark = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Light theme has NO stars; only Dark theme has ~80 stars
    if (calmMode || !isDark) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize, { passive: true });

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const onMouseMove = (e) => {
      const centerX = width / 2;
      const centerY = height / 2;
      targetMouseX = ((e.clientX - centerX) / centerX) * 8;
      targetMouseY = ((e.clientY - centerY) / centerY) * 8;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ~80 faint stars for dark theme
    const starCount = 80;
    const stars = Array.from({ length: starCount }, () => ({
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      radius: Math.random() * 0.9 + 0.5,
      twinkleSpeed: 0.008 + Math.random() * 0.02,
      twinklePhase: Math.random() * Math.PI * 2,
      driftX: 0.02 + Math.random() * 0.04,
      driftY: 0.01 + Math.random() * 0.02,
      alpha: 0.35 + Math.random() * 0.45,
    }));

    let lastTime = performance.now();

    const render = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.baseX += s.driftX * 60 * delta;
        s.baseY += s.driftY * 60 * delta;
        if (s.baseX > width) s.baseX = 0;
        if (s.baseY > height) s.baseY = 0;

        s.twinklePhase += s.twinkleSpeed;
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const a = s.alpha * (0.6 + 0.4 * twinkle);

        const cx = (s.baseX + mouseX + width) % width;
        const cy = (s.baseY + mouseY + height) % height;

        ctx.beginPath();
        ctx.arc(cx, cy, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 215, 255, ${a})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [calmMode, isDark]);

  if (calmMode || !isDark) return null;

  return (
    <canvas
      ref={canvasRef}
      className="starfield-canvas"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
      aria-hidden="true"
    />
  );
}
