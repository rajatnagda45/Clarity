# Animation System

Clarity feels premium because of its rigid adherence to a motion system powered by `framer-motion`.

## Core Animation Principles
1. **Never Snap**: Nothing should snap into or out of existence. Everything fades and slides.
2. **Springs over Tweens**: For interactive elements (hovering, toggling), we prefer spring physics (`type: 'spring', stiffness: 300, damping: 30`) over linear/ease transitions.
3. **Shared Layout**: Elements that move across the screen (like active tab indicators) use `layoutId`.

## Page Transitions
Implemented in `DarkAppLayout.tsx`.
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```
*Note*: `mode="wait"` ensures the old page fully fades out before the new page mounts, preventing layout thrashing.

## Micro-interactions
- **Buttons**: `whileHover={{ scale: 1.02 }}` and `whileTap={{ scale: 0.98 }}`.
- **Sidebar Indicator**: Uses a shared `layoutId="activeNavIndicator"` to glide smoothly between nav items as you click them.

## Background Animations
`PremiumBackground.tsx` uses subtle, math-driven animations (floating particles, shifting gradients) that do not interfere with the main thread.
