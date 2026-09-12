import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { NavLink } from 'react-router-dom';

import type { ExportFormat } from '../../api/notes.api';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useExportNotes, useNotes } from '../../hooks/useNotes';
import { useNoteImport } from '../../hooks/useNoteImport';
import { downloadBlob } from '../../lib/downloadFile';

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  all: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
  pinned: 'M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.7L12 16.9 5.8 20.2l1.6-6.7L2.2 8.9l6.9-.6z',
  video: 'M15 8l6-3v14l-6-3M3 6h12v12H3z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  export: 'M12 3v10 M8 9l4 4 4-4 M5 21h14',
  import: 'M12 21V11 M8 15l4-4 4 4 M5 3h14',
};

const EXPORT_FORMAT_OPTIONS: { format: ExportFormat; label: string }[] = [
  { format: 'json', label: 'JSON (re-importable)' },
  { format: 'txt', label: 'Plain text (.txt)' },
  { format: 'pdf', label: 'PDF' },
  { format: 'docx', label: 'Word (.docx)' },
];

const IMPORT_FILE_ACCEPT =
  '.json,.txt,.text,.md,.markdown,.csv,.log,.pdf,.docx,application/json,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function Sidebar() {
  const { data } = useNotes();
  const counts = data?.counts;
  const exportNotes = useExportNotes();
  const { importFile, status: importStatus, setStatus: setImportStatus, isImporting } = useNoteImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(exportMenuRef, () => setIsExportMenuOpen(false), isExportMenuOpen);

  const items = [
    { to: '/notes', label: 'All notes', count: counts?.all, icon: ICONS.all, end: true },
    { to: '/notes/pinned', label: 'Pinned', count: counts?.pinned, icon: ICONS.pinned, end: false },
    { to: '/notes/video', label: 'Video notes', count: counts?.video, icon: ICONS.video, end: false },
    { to: '/notes/trash', label: 'Trash', count: counts?.trash, icon: ICONS.trash, end: false },
  ];

  async function handleExport(format: ExportFormat) {
    setIsExportMenuOpen(false);
    setImportStatus(null);
    try {
      const { blob, filename } = await exportNotes.mutateAsync(format);
      downloadBlob(filename, blob);
    } catch {
      setImportStatus("Couldn't export notes. Please try again.");
    }
  }

  function handleImportClick() {
    setImportStatus(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    await importFile(file);
  }

  return (
    <nav className="sidebar" aria-label="Notes navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <span className="sidebar-link-label">
            <NavIcon path={item.icon} />
            {item.label}
          </span>
          <span className="sidebar-count">{item.count ?? '–'}</span>
        </NavLink>
      ))}

      <div className="sidebar-secondary">
        <div className="sidebar-export-menu" ref={exportMenuRef}>
          <button
            type="button"
            className="sidebar-link sidebar-action"
            onClick={() => setIsExportMenuOpen((open) => !open)}
            disabled={exportNotes.isPending}
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
          >
            <span className="sidebar-link-label">
              <NavIcon path={ICONS.export} />
              {exportNotes.isPending ? 'Exporting…' : 'Export notes'}
            </span>
          </button>
          {isExportMenuOpen && (
            <div className="sidebar-export-dropdown" role="menu">
              {EXPORT_FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.format}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void handleExport(option.format);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-link sidebar-action"
          onClick={handleImportClick}
          disabled={isImporting}
        >
          <span className="sidebar-link-label">
            <NavIcon path={ICONS.import} />
            {isImporting ? 'Importing…' : 'Import notes'}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMPORT_FILE_ACCEPT}
          className="sidebar-file-input"
          aria-label="Import notes file"
          onChange={(event) => {
            void handleFileSelected(event);
          }}
        />
        {importStatus && <p className="sidebar-import-status">{importStatus}</p>}
      </div>
    </nav>
  );
}
