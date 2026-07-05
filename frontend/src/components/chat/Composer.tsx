'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Paperclip, Square } from 'lucide-react';

interface ComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function Composer({ value, onChange, onSubmit, onStop, isStreaming, disabled }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAttachTooltip, setShowAttachTooltip] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isStreaming && !disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <motion.div
        animate={{
          borderColor: value.trim() ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)',
          boxShadow: value.trim() ? '0 0 20px rgba(168, 85, 247, 0.1)' : '0 0 0px rgba(0,0,0,0)',
        }}
        className="relative bg-[#0F1117] border rounded-2xl p-2 transition-colors duration-300 flex items-end gap-2"
      >
        {/* Attachment — not yet supported */}
        <div className="relative mb-0.5">
          <button
            type="button"
            disabled
            aria-label="Attach file (coming soon)"
            onMouseEnter={() => setShowAttachTooltip(true)}
            onMouseLeave={() => setShowAttachTooltip(false)}
            onFocus={() => setShowAttachTooltip(true)}
            onBlur={() => setShowAttachTooltip(false)}
            className="p-2.5 text-[#4A5168] rounded-xl cursor-not-allowed"
          >
            <Paperclip size={18} aria-hidden="true" />
          </button>
          {showAttachTooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-[#151923] border border-white/10 px-2.5 py-1 text-[11px] text-[#8892AA] shadow-lg pointer-events-none z-10">
              File attachments coming soon
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your documents..."
          disabled={disabled}
          aria-label="Message input"
          className="flex-1 max-h-[200px] min-h-[44px] py-3 bg-transparent resize-none text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none scrollbar-hide text-[15px] leading-relaxed"
          rows={1}
        />

        <div className="mb-1 mr-1">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="p-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors flex items-center justify-center w-10 h-10"
            >
              <Square size={14} className="fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!value.trim() || disabled}
              aria-label="Send message"
              className={`p-2 rounded-xl transition-all flex items-center justify-center w-10 h-10
                ${value.trim() && !disabled
                  ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'bg-white/5 text-[#4A5168] cursor-not-allowed'
                }
              `}
            >
              <ArrowUp size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </motion.div>

      <p className="text-center mt-3 text-[11px] text-[#4A5168]">
        Clarity AI can make mistakes. Verify critical claims against source documents.
      </p>
    </div>
  );
}
