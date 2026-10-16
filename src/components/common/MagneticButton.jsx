import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { sound } from "../../lib/sound.js";

export default function MagneticButton({
  children,
  variant = "primary", // 'primary' | 'secondary' | 'ghost'
  className = "",
  onClick,
  disabled = false,
  type = "button",
  magnetic = true,
  title,
  ...props
}) {
  const btnRef = useRef(null);
  const prefersReduced = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState([]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!btnRef.current || prefersReduced || !magnetic || disabled) return;
      const rect = btnRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Magnetic pull up to 8px
      const pullX = ((e.clientX - centerX) / (rect.width / 2)) * 8;
      const pullY = ((e.clientY - centerY) / (rect.height / 2)) * 8;

      setOffset({ x: pullX, y: pullY });
    },
    [prefersReduced, magnetic, disabled]
  );

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  const handleClick = (e) => {
    if (disabled) return;
    sound.tick();

    // Spawn click ripple
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now() + Math.random();

      setRipples((prev) => [...prev.slice(-3), { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    }

    if (onClick) onClick(e);
  };

  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "secondary"
      ? "btn-secondary"
      : "btn-ghost";

  return (
    <motion.button
      ref={btnRef}
      type={type}
      disabled={disabled}
      title={title}
      className={clsx(variantClass, className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      animate={
        prefersReduced || disabled
          ? {}
          : {
              x: offset.x,
              y: offset.y,
            }
      }
      whileTap={prefersReduced || disabled ? {} : { scale: 0.97 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 18,
      }}
      style={{
        position: "relative",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...props.style,
      }}
      {...props}
    >
      {/* Click ripple overlay */}
      {ripples.map((r) => (
        <span
          key={r.id}
          style={{
            position: "absolute",
            top: r.y,
            left: r.x,
            width: 8,
            height: 8,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(255, 255, 255, 0.4)",
            animation: "ripple-anim 0.6s cubic-bezier(0, 0.2, 0.8, 1) forwards",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      ))}
      <span style={{ position: "relative", zIndex: 2, display: "inline-flex", alignItems: "center", gap: 8 }}>
        {children}
      </span>
    </motion.button>
  );
}
