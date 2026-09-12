import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import * as notesApi from '../../api/notes.api';
import { Sidebar } from './Sidebar';

jest.mock('../../api/notes.api', () => ({
  listNotes: jest.fn(),
  exportNotesFile: jest.fn(),
  importNotes: jest.fn(),
  importNoteFile: jest.fn(),
  createNote: jest.fn(),
}));

const importedDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
jest.mock('../../lib/importContent', () => ({
  fileTextToNoteContent: jest.fn(() => importedDoc),
}));
const mockedNotesApi = notesApi as jest.Mocked<typeof notesApi>;

const mockedDownloadBlob = jest.fn();
jest.mock('../../lib/downloadFile', () => ({
  downloadBlob: (filename: string, blob: Blob) => mockedDownloadBlob(filename, blob),
}));

const basePayload = {
  notes: [],
  pagination: { page: 1, pageSize: 8, total: 0, totalPages: 1 },
  counts: { all: 3, pinned: 1, video: 0, trash: 0 },
};

function renderSidebar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeJsonFile(content: unknown, name = 'export.json') {
  return new File([JSON.stringify(content)], name, { type: 'application/json' });
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockedNotesApi.listNotes.mockResolvedValue(basePayload);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows sidebar counts once notes load', async () => {
    renderSidebar();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('opens a format menu on Export notes click and downloads the chosen format', async () => {
    const exported = { blob: new Blob(['pdf bytes']), filename: 'notes-export-2026-01-01.pdf' };
    mockedNotesApi.exportNotesFile.mockResolvedValueOnce(exported);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(await screen.findByText('Export notes'));
    await user.click(await screen.findByText('PDF'));

    await waitFor(() => expect(mockedNotesApi.exportNotesFile.mock.calls[0]?.[0]).toBe('pdf'));
    await waitFor(() => expect(mockedDownloadBlob).toHaveBeenCalledWith(exported.filename, exported.blob));
  });

  it('imports a valid JSON export file and shows how many notes were imported', async () => {
    mockedNotesApi.importNotes.mockResolvedValueOnce({ imported: 2 });
    const user = userEvent.setup();
    renderSidebar();

    const file = makeJsonFile({ notes: [{ title: 'A' }, { title: 'B' }] });
    const input = document.querySelector('.sidebar-file-input') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('Imported 2 notes.')).toBeInTheDocument();
    expect(mockedNotesApi.importNotes.mock.calls[0]?.[0]).toEqual([{ title: 'A' }, { title: 'B' }]);
  });

  it('shows an error for a JSON file with no notes', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const file = makeJsonFile({ notes: [] });
    const input = document.querySelector('.sidebar-file-input') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('That file has no notes to import.')).toBeInTheDocument();
    expect(mockedNotesApi.importNotes).not.toHaveBeenCalled();
  });

  it('shows an error for a .json file that is not valid JSON', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    const input = document.querySelector('.sidebar-file-input') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText("Couldn't import that file. Make sure it's a notes export.")).toBeInTheDocument();
  });

  it('creates a note from a .txt file, titled from its first line of text', async () => {
    mockedNotesApi.createNote.mockResolvedValueOnce({ id: 'n1', title: 'Shopping list' } as never);
    const user = userEvent.setup();
    renderSidebar();

    const file = new File(['Shopping list\nMilk\nEggs'], 'notes.txt', { type: 'text/plain' });
    const input = document.querySelector('.sidebar-file-input') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('Created note "Shopping list".')).toBeInTheDocument();
    expect(mockedNotesApi.createNote.mock.calls[0]?.[0]).toEqual({
      title: 'Shopping list',
      content: importedDoc,
    });
    expect(mockedNotesApi.importNoteFile).not.toHaveBeenCalled();
  });

  it('shows an error when a .pdf/.docx import fails', async () => {
    mockedNotesApi.importNoteFile.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderSidebar();

    const file = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' });
    const input = document.querySelector('.sidebar-file-input') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText("Couldn't import that file. Use a .txt, .md, .pdf, or .docx file."),
    ).toBeInTheDocument();
  });
});
