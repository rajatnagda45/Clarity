import type { Variants } from 'framer-motion';

export const transition = {
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  fast: { type: 'spring', bounce: 0, duration: 0.2 },
  spring: { type: 'spring', bounce: 0.25, duration: 0.5 },
  ease: { type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.3 },
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
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
