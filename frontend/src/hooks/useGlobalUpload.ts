import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { uploadDocument } from '@/lib/api';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function useGlobalUpload() {
  const { activeWorkspace } = useWorkspace();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!activeWorkspace?.id) {
      toast.error('Choose a workspace before uploading documents.');
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`File ${file.name} exceeds the 50MB limit.`);
        return false;
      }
      if (file.type && !ALLOWED_TYPES.has(file.type)) {
        toast.error(`File ${file.name} is not a supported format.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      const token = await getToken();
      if (!token) throw new Error('Clerk session token unavailable.');

      // We'll upload sequentially
      for (const file of validFiles) {
        if (validFiles.length > 1) {
          toast.info(`Uploading ${file.name}...`);
        }
        await uploadDocument({ token, workspaceId: activeWorkspace.id }, file);
        successCount++;
      }

      toast.success(`Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }, [activeWorkspace?.id, getToken, toast]);

  const triggerUpload = useCallback(() => {
    if (isUploading) {
      toast.info('An upload is already in progress.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.docx';
    
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const filesArray = Array.from(target.files);
        void handleFilesSelected(filesArray);
      }
      // Clean up the dynamically created input
      input.remove();
    };

    // Trigger the file browser
    input.click();
  }, [handleFilesSelected, isUploading, toast]);

  return {
    triggerUpload,
    isUploading
  };
}
