import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Paperclip, Square, Loader2 } from 'lucide-react';

interface ComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function Composer({ value, onChange, onSubmit, isStreaming, disabled }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          boxShadow: value.trim() ? '0 0 20px rgba(168, 85, 247, 0.1)' : '0 0 0px rgba(0,0,0,0)'
        }}
        className="relative bg-[#0F1117] border rounded-2xl p-2 transition-colors duration-300 flex items-end gap-2"
      >
        <button className="p-2.5 text-[#8892AA] hover:text-white hover:bg-white/5 rounded-xl transition-colors mb-0.5">
          <Paperclip size={18} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your documents..."
          disabled={disabled}
          className="flex-1 max-h-[200px] min-h-[44px] py-3 bg-transparent resize-none text-[#F1F3F9] placeholder:text-[#4A5168] focus:outline-none scrollbar-hide text-[15px] leading-relaxed"
          rows={1}
        />

        <div className="mb-1 mr-1">
          {isStreaming ? (
            <button 
              disabled // Assuming backend doesn't support aborting yet, we just show state
              className="p-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors flex items-center justify-center w-10 h-10"
              title="Generating..."
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button 
              onClick={onSubmit}
              disabled={!value.trim() || disabled}
              className={`p-2 rounded-xl transition-all flex items-center justify-center w-10 h-10
                ${value.trim() && !disabled 
                  ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
                  : 'bg-white/5 text-[#4A5168] cursor-not-allowed'
                }
              `}
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </motion.div>
      
      <div className="text-center mt-3 text-[11px] text-[#4A5168]">
        Clarity AI can make mistakes. Verify critical claims against source documents.
      </div>
    </div>
  );
}
