'use client';

import { useRef } from 'react';


interface DropzoneProps {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}


export function Dropzone({ disabled = false, onFileSelected }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
      event.target.value = '';
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Upload a contract</h3>
          <p className="mt-1 text-sm text-slate-600">
            PDF and DOCX only. Files are stored securely now; parsing starts in the next milestone.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Select file
        </button>
      </div>
    </div>
  );
}
