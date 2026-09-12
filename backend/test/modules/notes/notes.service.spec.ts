import { expect } from 'chai';

import * as notesService from '../../../src/modules/notes/notes.service';

interface FakeNote {
  id: string;
  userId: string;
  title: string;
  content: unknown;
  type: 'TEXT' | 'VIDEO' | 'MIXED';
  color: string;
  pinned: boolean;
  wordCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  summary?: string | null;
  summaryUpdatedAt?: Date | null;
}

function makeFakeRepository(initialNotes: FakeNote[] = []) {
  const notes = [...initialNotes];

  function matching(userId: string, filter?: 'all' | 'pinned' | 'video', q?: string) {
    const trimmedQ = q?.trim().toLowerCase();
    return notes.filter((n) => {
      if (n.userId !== userId || n.deletedAt) return false;
      if (filter === 'pinned' && !n.pinned) return false;
      if (filter === 'video' && n.type === 'TEXT') return false;
      if (trimmedQ && !n.title.toLowerCase().includes(trimmedQ)) return false;
      return true;
    });
  }

  return {
    notes,
    findManyForUser: async ({
      userId,
      filter,
      q,
    }: {
      userId: string;
      filter?: 'all' | 'pinned' | 'video';
      q?: string;
    }) => matching(userId, filter, q),
    countMatchingForUser: async (userId: string, filter?: 'all' | 'pinned' | 'video', q?: string) =>
      matching(userId, filter, q).length,
    countForUser: async (userId: string) => notes.filter((n) => n.userId === userId && !n.deletedAt).length,
    countPinnedForUser: async (userId: string) =>
      notes.filter((n) => n.userId === userId && !n.deletedAt && n.pinned).length,
    countVideoForUser: async (userId: string) =>
      notes.filter((n) => n.userId === userId && !n.deletedAt && n.type !== 'TEXT').length,
    countTrashForUser: async (userId: string) =>
      notes.filter((n) => n.userId === userId && n.deletedAt).length,
    findOneForUser: async (id: string, userId: string) =>
      notes.find((n) => n.id === id && n.userId === userId && !n.deletedAt) ?? null,
    findManyTrashForUser: async ({ userId }: { userId: string }) =>
      notes.filter((n) => n.userId === userId && n.deletedAt),
    findOneTrashedForUser: async (id: string, userId: string) =>
      notes.find((n) => n.id === id && n.userId === userId && n.deletedAt) ?? null,
    findAllForExport: async (userId: string) =>
      notes
        .filter((n) => n.userId === userId && !n.deletedAt)
        .map((n) => ({
          title: n.title,
          content: n.content,
          type: n.type,
          color: n.color,
          pinned: n.pinned,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        })),
    createManyForUser: async (
      userId: string,
      rows: {
        title: string;
        content?: unknown;
        type: FakeNote['type'];
        color: string;
        pinned: boolean;
        wordCount: number;
      }[],
    ) => {
      const now = new Date();
      for (const row of rows) {
        notes.push({
          id: `note-${notes.length + 1}`,
          userId,
          title: row.title,
          content: row.content ?? null,
          type: row.type,
          color: row.color,
          pinned: row.pinned,
          wordCount: row.wordCount,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      return rows.length;
    },
    create: async (
      userId: string,
      data: { title: string; content?: unknown; type: FakeNote['type']; color: string; wordCount: number },
    ) => {
      const now = new Date();
      const note: FakeNote = {
        id: `note-${notes.length + 1}`,
        userId,
        title: data.title,
        content: data.content ?? null,
        type: data.type,
        color: data.color,
        pinned: false,
        wordCount: data.wordCount,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      notes.push(note);
      return note;
    },
    update: async (id: string, data: Partial<FakeNote>) => {
      const note = notes.find((n) => n.id === id)!;
      Object.assign(note, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
      note.updatedAt = new Date();
      return note;
    },
    updateSummary: async (id: string, summary: string) => {
      const note = notes.find((n) => n.id === id)!;
      note.summary = summary;
      note.summaryUpdatedAt = new Date();
      return note;
    },
    softDelete: async (id: string) => {
      const note = notes.find((n) => n.id === id)!;
      note.deletedAt = new Date();
      return note;
    },
    restore: async (id: string) => {
      const note = notes.find((n) => n.id === id)!;
      note.deletedAt = null;
      return note;
    },
    purge: async (id: string) => {
      const index = notes.findIndex((n) => n.id === id);
      notes.splice(index, 1);
    },
  };
}

describe('notes.service', () => {
  describe('createNote', () => {
    it('computes wordCount from string content and defaults type/color', async () => {
      const repository = makeFakeRepository();

      const note = await notesService.createNote(
        'user-1',
        { title: 'Grocery list', content: 'Eggs milk bread' },
        repository,
      );

      expect(note).to.include({ title: 'Grocery list', type: 'TEXT', color: 'yellow', wordCount: 3 });
    });
  });

  describe('listNotes', () => {
    it('returns notes, pagination, and counts for the user', async () => {
      const repository = makeFakeRepository();
      await notesService.createNote('user-1', { title: 'Note 1' }, repository);
      await notesService.createNote('user-1', { title: 'Note 2', type: 'VIDEO' }, repository);
      await notesService.createNote('user-2', { title: 'Someone else' }, repository);

      const result = await notesService.listNotes('user-1', { page: 1, pageSize: 8 }, repository);

      expect(result.notes).to.have.length(2);
      expect(result.counts).to.deep.equal({ all: 2, pinned: 0, video: 1, trash: 0 });
      expect(result.pagination).to.deep.equal({ page: 1, pageSize: 8, total: 2, totalPages: 1 });
    });

    it('filters to only video/mixed notes when filter is "video"', async () => {
      const repository = makeFakeRepository();
      await notesService.createNote('user-1', { title: 'Text note' }, repository);
      await notesService.createNote('user-1', { title: 'Video note', type: 'VIDEO' }, repository);

      const result = await notesService.listNotes('user-1', { page: 1, pageSize: 8, filter: 'video' }, repository);

      expect(result.notes.map((n) => n.title)).to.deep.equal(['Video note']);
      expect(result.pagination.total).to.equal(1);
    });

    it('filters to only pinned notes when filter is "pinned"', async () => {
      const repository = makeFakeRepository();
      const pinned = await notesService.createNote('user-1', { title: 'Pinned' }, repository);
      await notesService.createNote('user-1', { title: 'Not pinned' }, repository);
      await notesService.updateNote('user-1', pinned.id, { pinned: true }, repository);

      const result = await notesService.listNotes('user-1', { page: 1, pageSize: 8, filter: 'pinned' }, repository);

      expect(result.notes.map((n) => n.title)).to.deep.equal(['Pinned']);
      expect(result.pagination.total).to.equal(1);
    });

    it('searches by title case-insensitively when q is given', async () => {
      const repository = makeFakeRepository();
      await notesService.createNote('user-1', { title: 'Grocery list' }, repository);
      await notesService.createNote('user-1', { title: 'Meeting notes' }, repository);

      const result = await notesService.listNotes('user-1', { page: 1, pageSize: 8, q: 'grocery' }, repository);

      expect(result.notes.map((n) => n.title)).to.deep.equal(['Grocery list']);
      expect(result.pagination.total).to.equal(1);
      expect(result.counts).to.deep.equal({ all: 2, pinned: 0, video: 0, trash: 0 });
    });

    it('combines filter and q together', async () => {
      const repository = makeFakeRepository();
      await notesService.createNote('user-1', { title: 'Grocery list', type: 'VIDEO' }, repository);
      await notesService.createNote('user-1', { title: 'Grocery reminder' }, repository);

      const result = await notesService.listNotes(
        'user-1',
        { page: 1, pageSize: 8, filter: 'video', q: 'grocery' },
        repository,
      );

      expect(result.notes.map((n) => n.title)).to.deep.equal(['Grocery list']);
    });
  });

  describe('exportNotes', () => {
    it('returns only the active notes for the user, in creation order', async () => {
      const repository = makeFakeRepository();
      await notesService.createNote('user-1', { title: 'First', content: 'a' }, repository);
      const trashed = await notesService.createNote('user-1', { title: 'Trashed' }, repository);
      await notesService.softDeleteNote('user-1', trashed.id, repository);
      await notesService.createNote('user-1', { title: 'Second', type: 'VIDEO', color: 'blue' }, repository);
      await notesService.createNote('user-2', { title: 'Someone else' }, repository);

      const result = await notesService.exportNotes('user-1', repository);

      expect(result.notes.map((n) => n.title)).to.deep.equal(['First', 'Second']);
      expect(result.notes[1]).to.include({ type: 'VIDEO', color: 'blue', pinned: false });
      expect(result.exportedAt).to.be.a('string');
    });

    it('returns an empty list when the user has no notes', async () => {
      const repository = makeFakeRepository();

      const result = await notesService.exportNotes('user-1', repository);

      expect(result.notes).to.deep.equal([]);
    });
  });

  describe('importNotes', () => {
    it('creates a note per entry, defaulting type/color/pinned and computing wordCount', async () => {
      const repository = makeFakeRepository();

      const result = await notesService.importNotes(
        'user-1',
        [
          { title: 'Imported 1', content: 'one two three' },
          { title: 'Imported 2', type: 'VIDEO', color: 'blue', pinned: true },
        ],
        repository,
      );

      expect(result.imported).to.equal(2);
      const created = repository.notes.filter((n) => n.userId === 'user-1');
      expect(created).to.have.length(2);
      expect(created[0]).to.include({ title: 'Imported 1', type: 'TEXT', color: 'yellow', wordCount: 3 });
      expect(created[1]).to.include({ title: 'Imported 2', type: 'VIDEO', color: 'blue', pinned: true });
    });

    it('does not affect other users\' notes', async () => {
      const repository = makeFakeRepository();
      await notesService.createNote('user-2', { title: 'Not mine' }, repository);

      await notesService.importNotes('user-1', [{ title: 'Mine' }], repository);

      expect(repository.notes.filter((n) => n.userId === 'user-2')).to.have.length(1);
      expect(repository.notes.filter((n) => n.userId === 'user-1')).to.have.length(1);
    });
  });

  describe('getNote', () => {
    it('throws 404 when the note does not exist or belongs to someone else', async () => {
      const repository = makeFakeRepository();

      try {
        await notesService.getNote('user-1', 'nonexistent', repository);
        expect.fail('expected getNote to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(404);
      }
    });
  });

  describe('updateNote', () => {
    it('recomputes wordCount when content changes', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Old', content: 'one two' }, repository);

      const updated = await notesService.updateNote(
        'user-1',
        note.id,
        { content: 'one two three four' },
        repository,
      );

      expect(updated.wordCount).to.equal(4);
    });

    it('throws 404 for a note owned by another user', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Mine' }, repository);

      try {
        await notesService.updateNote('user-2', note.id, { title: 'Hijacked' }, repository);
        expect.fail('expected updateNote to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(404);
      }
    });
  });

  describe('summarizeNote', () => {
    it('persists the summary returned by the injected summarizer', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote(
        'user-1',
        { title: 'Standup recap', content: 'Team agreed on MVP scope for next sprint.' },
        repository,
      );
      const fakeSummarize = async (text: string) => `Summary of: ${text}`;

      const updated = await notesService.summarizeNote('user-1', note.id, repository, fakeSummarize);

      expect(updated.summary).to.equal('Summary of: Team agreed on MVP scope for next sprint.');
      expect(updated.summaryUpdatedAt).to.not.equal(null);
    });

    it('throws 404 for a note owned by another user', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Mine' }, repository);

      try {
        await notesService.summarizeNote('user-2', note.id, repository, async () => 'x');
        expect.fail('expected summarizeNote to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(404);
      }
    });

    it('propagates an error from the summarizer without persisting anything', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Empty' }, repository);
      const failingSummarize = async (): Promise<string> => {
        throw Object.assign(new Error('boom'), { statusCode: 500 });
      };

      try {
        await notesService.summarizeNote('user-1', note.id, repository, failingSummarize);
        expect.fail('expected summarizeNote to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(500);
      }
      expect(repository.notes.find((n) => n.id === note.id)?.summary).to.equal(undefined);
    });

    it('summarizes and persists new content when overrideContent is provided', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote(
        'user-1',
        { title: 'Standup recap', content: 'Old content.' },
        repository,
      );
      const fakeSummarize = async (text: string) => `Summary of: ${text}`;

      const updated = await notesService.summarizeNote(
        'user-1',
        note.id,
        repository,
        fakeSummarize,
        'Brand new in-progress editor text.',
      );

      expect(updated.summary).to.equal('Summary of: Brand new in-progress editor text.');
      expect(updated.content).to.equal('Brand new in-progress editor text.');
      expect(updated.wordCount).to.equal(5);
    });
  });

  describe('softDeleteNote', () => {
    it('marks the note as deleted', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'To trash' }, repository);

      await notesService.softDeleteNote('user-1', note.id, repository);

      expect(repository.notes.find((n) => n.id === note.id)?.deletedAt).to.not.equal(null);
    });
  });

  describe('listTrash', () => {
    it('returns only the trashed notes for the user', async () => {
      const repository = makeFakeRepository();
      const kept = await notesService.createNote('user-1', { title: 'Keep' }, repository);
      const trashed = await notesService.createNote('user-1', { title: 'Trash me' }, repository);
      await notesService.softDeleteNote('user-1', trashed.id, repository);

      const result = await notesService.listTrash('user-1', 1, 8, repository);

      expect(result.notes.map((n) => n.id)).to.deep.equal([trashed.id]);
      expect(result.notes.map((n) => n.id)).to.not.include(kept.id);
      expect(result.pagination.total).to.equal(1);
    });
  });

  describe('restoreNote', () => {
    it('clears deletedAt for a trashed note', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'To restore' }, repository);
      await notesService.softDeleteNote('user-1', note.id, repository);

      const restored = await notesService.restoreNote('user-1', note.id, repository);

      expect(restored.deletedAt).to.equal(null);
    });

    it('throws 404 when the note is not in trash', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Not trashed' }, repository);

      try {
        await notesService.restoreNote('user-1', note.id, repository);
        expect.fail('expected restoreNote to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(404);
      }
    });
  });

  describe('purgeNote', () => {
    it('permanently removes a trashed note', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Gone forever' }, repository);
      await notesService.softDeleteNote('user-1', note.id, repository);

      await notesService.purgeNote('user-1', note.id, repository);

      expect(repository.notes.find((n) => n.id === note.id)).to.equal(undefined);
    });

    it('throws 404 when the note is not in trash', async () => {
      const repository = makeFakeRepository();
      const note = await notesService.createNote('user-1', { title: 'Not trashed' }, repository);

      try {
        await notesService.purgeNote('user-1', note.id, repository);
        expect.fail('expected purgeNote to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(404);
      }
    });
  });
});
