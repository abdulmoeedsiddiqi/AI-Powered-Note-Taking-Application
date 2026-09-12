import { useEffect, useRef, useState } from 'react';

import { useNoteImport } from '../../hooks/useNoteImport';

function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/**
 * Lets the user drag files anywhere onto the dashboard to import them as notes.
 * Shows a full-window overlay while a file drag is in progress and a short
 * status toast afterwards. Listens on `window` so a drop lands wherever the
 * cursor is; the overlay itself is pointer-events: none so it never blocks it.
 */
export function ImportDropZone() {
  const { importFiles, status, setStatus, isImporting } = useNoteImport();
  const [isDragging, setIsDragging] = useState(false);
  // dragenter/dragleave fire for every nested element, so track nesting depth.
  const dragDepth = useRef(0);

  useEffect(() => {
    function onDragEnter(event: DragEvent) {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    }

    function onDragOver(event: DragEvent) {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    }

    function onDragLeave(event: DragEvent) {
      if (!dragHasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) {
        setIsDragging(false);
      }
    }

    function onDrop(event: DragEvent) {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        void importFiles(files);
      }
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFiles]);

  // Auto-dismiss the status toast after a few seconds.
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 5000);
    return () => window.clearTimeout(timer);
  }, [status, setStatus]);

  return (
    <>
      {isDragging && (
        <div className="import-dropzone-overlay" role="presentation">
          <div className="import-dropzone-card">
            <svg
              viewBox="0 0 24 24"
              width="40"
              height="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4M8 8l4-4 4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <p className="import-dropzone-title">Drop to import as notes</p>
            <p className="import-dropzone-hint">Text, Markdown, PDF, Word or JSON</p>
          </div>
        </div>
      )}
      {(isImporting || status) && (
        <div className="import-dropzone-toast" role="status" aria-live="polite">
          {isImporting ? 'Importing…' : status}
        </div>
      )}
    </>
  );
}
