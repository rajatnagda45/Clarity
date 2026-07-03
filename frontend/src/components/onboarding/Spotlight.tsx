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

    let prevRectString = '';

    const updateRect = () => {
      const el = document.getElementById(targetId);
      if (el) {
        const r = el.getBoundingClientRect();
        const newRectString = `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`;
        if (newRectString !== prevRectString) {
          prevRectString = newRectString;
          setRect(r);
        }
      } else {
        if (prevRectString !== '') {
          prevRectString = '';
          setRect(null);
        }
      }
    };

    updateRect();
    
    // Create an observer to catch layout changes or element appearing
    // Throttle or avoid unnecessary state updates by checking string equality above
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
  const TOOLTIP_WIDTH = 288; // w-72 = 288px
  const TOOLTIP_HEIGHT = 160; // Approx height

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'bottom':
      top = rect.bottom + MARGIN;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'top':
      top = rect.top - MARGIN - TOOLTIP_HEIGHT;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
      left = rect.left - MARGIN - TOOLTIP_WIDTH;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
      left = rect.right + MARGIN;
      break;
  }

  // Constrain to viewport bounds
  if (typeof window !== 'undefined') {
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - MARGIN));
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - TOOLTIP_HEIGHT - MARGIN));
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 pointer-events-none">
        
        {/* Highlight border on the element - No more dark screen mask! */}
        <motion.div
          animate={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
          transition={{ type: 'spring', bounce: 0.2 }}
          className="absolute border-2 border-purple-500/80 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.5)] pointer-events-none"
        />

        {/* Coach Mark Tooltip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: placement === 'bottom' ? -10 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{ 
            position: 'absolute', 
            top, 
            left
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
