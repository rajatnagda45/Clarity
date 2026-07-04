'use client';
import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  userId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmRemoveDialog({ userId, onConfirm, onCancel, isLoading }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm bg-[#0F1117] border border-white/[0.08] rounded-2xl shadow-2xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-remove-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-[#8892AA] hover:text-[#F1F3F9]"
          >
            <X size={16} />
          </button>
        </div>

        <h2 id="confirm-remove-title" className="text-base font-bold text-[#F1F3F9] mb-2">
          Remove member?
        </h2>
        <p className="text-sm text-[#8892AA] mb-6">
          <span className="text-[#F1F3F9] font-medium">{userId}</span> will lose access to this
          workspace immediately. This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#F1F3F9] text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
