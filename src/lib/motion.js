/**
 * Cosmic Aurora Motion System
 * Shared easings, springs, durations, and Framer Motion variants
 */

export const easings = {
  entrance: [0.22, 1, 0.36, 1],
  movement: [0.65, 0, 0.35, 1],
  easeOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.65, 0, 0.35, 1],
};

export const springs = {
  layout: { type: "spring", stiffness: 260, damping: 24 },
  snappy: { type: "spring", stiffness: 340, damping: 26 },
  bouncy: { type: "spring", stiffness: 400, damping: 22 },
  gentle: { type: "spring", stiffness: 180, damping: 22 },
};

export const durations = {
  instant: 0.12,
  fast: 0.22,
  normal: 0.38,
  slow: 0.6,
};

// Route & Page transition: outgoing blur & scale 0.98, incoming rises 16px with blur-in
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 16,
    filter: "blur(6px)",
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: {
      duration: durations.normal,
      ease: easings.entrance,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(4px)",
    scale: 0.98,
    transition: {
      duration: durations.fast,
      ease: easings.movement,
    },
  },
};

export const pageVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.fast } },
  exit: { opacity: 0, transition: { duration: durations.instant } },
};

// Staggered grid container
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.entrance,
    },
  },
};

// Modal backdrop & dialog
export const modalBackdrop = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  visible: {
    opacity: 1,
    backdropFilter: "blur(16px)",
    transition: { duration: durations.fast },
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: { duration: durations.instant },
  },
};

export const modalDialog = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...springs.layout },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -8,
    transition: { duration: durations.fast, ease: easings.movement },
  },
};

// Drawer from right
export const drawerVariants = {
  hidden: { x: "100%", opacity: 0.4 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { ...springs.layout },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: durations.fast, ease: easings.movement },
  },
};

// Toast notification
export const toastVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...springs.snappy },
  },
  exit: {
    opacity: 0,
    x: 80,
    scale: 0.95,
    transition: { duration: durations.fast, ease: easings.movement },
  },
};
