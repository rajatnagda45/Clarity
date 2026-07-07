import type { Variants } from 'framer-motion';

export const transition = {
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  fast: { type: 'spring', bounce: 0, duration: 0.2 },
  spring: { type: 'spring', bounce: 0.25, duration: 0.5 },
  ease: { type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.3 },
};

// blur() was removed — it causes expensive GPU repaint on every frame
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.05 }
  }
};

export const fadeUpVariant: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};
