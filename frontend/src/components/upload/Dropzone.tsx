'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileType, CheckCircle2, Loader2, FileText, Cpu, Layers } from 'lucide-react';

interface DropzoneProps {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  uploadProgressText?: string;
}

export function Dropzone({ disabled = false, onFilesSelected, isUploading = false, uploadProgressText }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
      event.target.value = '';
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
  }

  return (
    <div className="w-full relative">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      
      <AnimatePresence mode="wait">
        {isUploading ? (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full rounded-2xl border border-purple-500/30 bg-[#0F1117] p-8 shadow-[0_0_40px_rgba(168,85,247,0.1)] overflow-hidden relative"
          >
            {/* Animated background gradient */}
            <motion.div 
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent skew-x-12"
            />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 mb-4 border border-purple-500/20">
                <Loader2 size={32} className="text-purple-400 animate-spin" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl border border-purple-400"
                />
              </div>
              <h3 className="text-lg font-bold text-[#F1F3F9]">{uploadProgressText || 'Uploading & Queueing...'}</h3>
              <p className="mt-2 text-sm text-[#8892AA] max-w-md">
                Securely storing your documents and initializing the AI pipeline. Extraction and chunking will begin momentarily.
              </p>
              
              {/* Mini Pipeline Preview */}
              <div className="flex items-center gap-4 mt-6 text-[#4A5168]">
                <div className="flex flex-col items-center gap-1">
                  <UploadCloud size={16} className="text-purple-400" />
                  <span className="text-[10px] uppercase tracking-wider text-purple-400">Upload</span>
                </div>
                <div className="h-px w-8 bg-white/10" />
                <div className="flex flex-col items-center gap-1 opacity-50">
                  <FileText size={16} />
                  <span className="text-[10px] uppercase tracking-wider">Extract</span>
                </div>
                <div className="h-px w-8 bg-white/10" />
                <div className="flex flex-col items-center gap-1 opacity-50">
                  <Layers size={16} />
                  <span className="text-[10px] uppercase tracking-wider">Chunk</span>
                </div>
                <div className="h-px w-8 bg-white/10" />
                <div className="flex flex-col items-center gap-1 opacity-50">
                  <Cpu size={16} />
                  <span className="text-[10px] uppercase tracking-wider">Embed</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            className={`w-full group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-12 relative overflow-hidden bg-[#0F1117]/50 backdrop-blur-sm
              ${isDragActive 
                ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_30px_rgba(168,85,247,0.15)]' 
                : disabled 
                  ? 'border-white/[0.04] opacity-50 cursor-not-allowed' 
                  : 'border-white/[0.08] hover:border-purple-500/30 hover:bg-white/[0.02]'
              }
            `}
          >
            {/* Hover glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/0 via-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-500 mb-4
              ${isDragActive ? 'bg-purple-500/20 scale-110' : 'bg-white/[0.04] group-hover:bg-purple-500/10 group-hover:scale-105'}
            `}>
              <UploadCloud size={32} className={`${isDragActive ? 'text-purple-400' : 'text-[#8892AA] group-hover:text-purple-400'} transition-colors`} />
            </div>
            
            <h3 className="text-xl font-semibold text-[#F1F3F9] mb-2 tracking-tight">
              {isDragActive ? 'Drop documents here' : 'Upload new documents'}
            </h3>
            
            <p className="text-sm text-[#8892AA] mb-6 text-center max-w-md">
              Drag and drop your files here, or click to browse. We support multiple PDF and DOCX formats up to 50MB.
            </p>

            <div className="flex items-center gap-4 text-xs font-medium text-[#4A5168]">
              <span className="flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.04]">
                <FileType size={14} /> PDF
              </span>
              <span className="flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.04]">
                <FileType size={14} /> DOCX
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
