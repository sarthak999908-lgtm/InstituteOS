import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function Sparkline({
  data = [12, 18, 15, 24, 28, 22, 35, 42, 38, 50],
  width = 120,
  height = 40,
  color = "#22d3ee",
  glowColor = "rgba(34, 211, 238, 0.4)",
  fillGradientId = "sparkline-grad",
}) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true });

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ""
  );

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const lastPoint = points[points.length - 1];

  return (
    <div ref={containerRef} style={{ width, height, position: "relative", overflow: "visible" }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`glow-${fillGradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Gradient fill */}
        <motion.path
          d={fillD}
          fill={`url(#${fillGradientId})`}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* Glowing stroke */}
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#glow-${fillGradientId})`}
          initial={{ pathLength: 0 }}
          animate={isInView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* End pulse dot */}
        {lastPoint && (
          <motion.circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill="#ffffff"
            stroke={color}
            strokeWidth="2"
            initial={{ scale: 0, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          />
        )}
      </svg>
    </div>
  );
}
