'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface SpotlightProps {
  id: string; // unique ID for dismissal
  targetId: string; // DOM element ID to highlight
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  condition?: boolean; // additional condition to show (e.g., specific onboarding step is active)
}

export function Spotlight({ id, targetId, title, description, placement = 'bottom', condition = true }: SpotlightProps) {
  const { isSpotlightDismissed, dismissSpotlight, showWelcome, showWizard } = useOnboarding();
  const [rect, setRect] = useState<DOMRect | null>(null);

  const shouldShow = condition && !isSpotlightDismissed(id) && !showWelcome && !showWizard;

  useEffect(() => {
    if (!shouldShow) return;

    const updateRect = () => {
      const el = document.getElementById(targetId);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    updateRect();
    
    // Create an observer to catch layout changes or element appearing
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [shouldShow, targetId]);

  if (!shouldShow || !rect) return null;

  // Calculate tooltip position
  const MARGIN = 16;
  let top = 0;
  let left = 0;

  switch (placement) {
    case 'bottom':
      top = rect.bottom + MARGIN;
      left = rect.left + rect.width / 2;
      break;
    case 'top':
      top = rect.top - MARGIN;
      left = rect.left + rect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2;
      left = rect.left - MARGIN;
      break;
    case 'right':
      top = rect.top + rect.height / 2;
      left = rect.right + MARGIN;
      break;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 pointer-events-none">
        {/* Soft highlight overlay - SVG Mask approach for premium feel */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id={`spotlight-mask-${id}`}>
              <rect width="100%" height="100%" fill="white" />
              <motion.rect
                initial={{ rx: 8, ry: 8 }}
                animate={{ 
                  x: rect.left - 8, 
                  y: rect.top - 8, 
                  width: rect.width + 16, 
                  height: rect.height + 16,
                  rx: 16,
                  ry: 16
                }}
                transition={{ type: 'spring', bounce: 0.2 }}
                fill="black"
              />
            </mask>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="rgba(5, 7, 11, 0.6)" 
            mask={`url(#spotlight-mask-${id})`} 
            className="transition-all duration-300 pointer-events-auto"
          />
        </svg>

        {/* Highlight border on the element */}
        <motion.div
          animate={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
          transition={{ type: 'spring', bounce: 0.2 }}
          className="absolute border-2 border-purple-500/50 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.3)] pointer-events-none"
        />

        {/* Coach Mark Tooltip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: placement === 'bottom' ? -10 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{ 
            position: 'absolute', 
            top, 
            left,
            transform: placement === 'bottom' || placement === 'top' 
              ? 'translateX(-50%)' 
              : 'translateY(-50%)'
          }}
          className="w-72 bg-[#0F1117] border border-white/[0.1] rounded-2xl p-5 shadow-2xl pointer-events-auto"
        >
          <button 
            onClick={() => dismissSpotlight(id)}
            className="absolute top-3 right-3 text-[#4A5168] hover:text-[#F1F3F9] transition-colors p-1"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-purple-400" />
            <h4 className="font-bold text-[#F1F3F9] text-sm">{title}</h4>
          </div>
          <p className="text-[#8892AA] text-sm leading-relaxed mb-4">
            {description}
          </p>
          <button 
            onClick={() => dismissSpotlight(id)}
            className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] text-[#F1F3F9] text-sm font-semibold rounded-xl transition-colors"
          >
            Got it
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
