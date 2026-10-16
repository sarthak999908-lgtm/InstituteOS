import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";

export default function GlassCard({
  children,
  className = "",
  style = {},
  tilt = true,
  glow = true,
  frosted = false,
  onClick,
  as = "div",
  glowColor = "var(--brand-glow)",
  ...props
}) {
  const cardRef = useRef(null);
  const prefersReduced = useReducedMotion();
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e) => {
      if (!cardRef.current || prefersReduced || !tilt) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x, y });

      // Max 5 degrees tilt (Clear Sky specification)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const tiltX = -((y - centerY) / centerY) * 4.5;
      const tiltY = ((x - centerX) / centerX) * 4.5;

      setRotateX(tiltX);
      setRotateY(tiltY);
    },
    [prefersReduced, tilt]
  );

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const Component = motion[as] || motion.div;

  return (
    <Component
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={clsx(frosted ? "clear-card-frosted" : "clear-card", className)}
      style={{
        perspective: 900,
        transformStyle: "preserve-3d",
        overflow: "hidden",
        ...style,
      }}
      animate={
        prefersReduced || !tilt
          ? {}
          : {
              rotateX,
              rotateY,
              y: isHovered ? -3 : 0, // 3px hover lift
            }
      }
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 22,
      }}
      {...props}
    >
      {/* Cursor-following local spotlight sheen */}
      {glow && isHovered && !prefersReduced && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            zIndex: 1,
            background: `radial-gradient(320px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}, transparent 70%)`,
            transition: "opacity 0.2s ease",
          }}
        />
      )}

      {/* Content wrapper */}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </Component>
  );
}
