import { useEffect, useState, useRef } from "react";

export default function FpsMeter() {
  const [visible, setVisible] = useState(false);
  const [fps, setFps] = useState(60);
  const [frameTime, setFrameTime] = useState(16.6);
  const framesRef = useRef(0);
  const prevTimeRef = useRef(performance.now());
  const lastUpdateRef = useRef(performance.now());

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Shift+F toggle
      if (e.shiftKey && (e.key === "F" || e.key === "f")) {
        const target = e.target;
        if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName))) return;
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let animId;

    const loop = (now) => {
      framesRef.current++;
      const elapsed = now - lastUpdateRef.current;

      if (elapsed >= 500) {
        const currentFps = Math.round((framesRef.current * 1000) / elapsed);
        setFps(currentFps);
        setFrameTime(Math.round((elapsed / framesRef.current) * 10) / 10);
        framesRef.current = 0;
        lastUpdateRef.current = now;
      }

      prevTimeRef.current = now;
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [visible]);

  if (!visible) return null;

  const fpsColor = fps >= 55 ? "#a3e635" : fps >= 30 ? "#fbbf24" : "#fb7185";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 99999,
        background: "rgba(5, 6, 15, 0.88)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "10px",
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "11px",
        color: "#f4f5ff",
        boxShadow: "0 8px 30px rgba(0,0,0,0.6), 0 0 16px rgba(34, 211, 238, 0.2)",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: fpsColor,
            boxShadow: `0 0 8px ${fpsColor}`,
          }}
        />
        <span style={{ fontWeight: 700, color: fpsColor }}>{fps} FPS</span>
      </div>
      <span style={{ color: "#6b7094" }}>|</span>
      <span style={{ color: "#a8acc8" }}>{frameTime} ms</span>
      <span style={{ color: "#6b7094" }}>|</span>
      <span style={{ color: "#22d3ee", fontSize: "10px" }}>Shift+F</span>
    </div>
  );
}
