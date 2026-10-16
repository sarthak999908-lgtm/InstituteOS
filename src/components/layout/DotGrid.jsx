import { useEffect, useRef } from "react";

export default function DotGrid({ calmMode = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (calmMode) return;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let animId;

    const handleMouseMove = (e) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      // Max parallax shift 8px
      targetX = ((e.clientX - centerX) / centerX) * 8;
      targetY = ((e.clientY - centerY) / centerY) * 8;
    };

    const loop = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }

      animId = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, [calmMode]);

  if (calmMode) return null;

  return (
    <div
      ref={containerRef}
      className="dot-grid-canvas"
      style={{
        position: "fixed",
        inset: -20,
        pointerEvents: "none",
        zIndex: 1,
        backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        color: "var(--text-primary)",
        opacity: 0.06,
        maskImage: "radial-gradient(ellipse at 50% 45%, black 25%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 25%, transparent 75%)",
        willChange: "transform",
      }}
      aria-hidden="true"
    />
  );
}
