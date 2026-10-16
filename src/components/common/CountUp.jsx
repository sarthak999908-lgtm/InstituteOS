import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export default function CountUp({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  formatter,
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const prefersReduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(0);

  // Parse numeric target
  const targetNumber =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;

  useEffect(() => {
    if (!isInView) return;
    if (prefersReduced) {
      setDisplayValue(targetNumber);
      return;
    }

    let startTimestamp = null;
    let animId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      // Ease-out cubic: 1 - pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = easeProgress * targetNumber;

      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetNumber);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isInView, targetNumber, duration, prefersReduced]);

  const formattedOutput = formatter
    ? formatter(displayValue)
    : `${prefix}${displayValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

  return (
    <span
      ref={ref}
      className={`kpi-number ${className}`}
      style={{
        fontVariantNumeric: "tabular-nums",
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      }}
    >
      {/* If raw value is non-numeric (e.g. "—"), show it directly */}
      {isNaN(targetNumber) || (typeof value === "string" && !/\d/.test(value))
        ? value
        : formattedOutput}
    </span>
  );
}
