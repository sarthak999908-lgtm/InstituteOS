import clsx from "clsx";

export default function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "var(--radius-sm)",
  className = "",
  style = {},
}) {
  return (
    <div
      className={clsx("skeleton-shimmer", className)}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
