import type { IncomingMessage } from 'http';

import { expect } from 'chai';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { env } from '../../../src/config/env';
import { prisma } from '../../../src/lib/prisma';

const EMAIL_DOMAIN = '@notes-controller-test.local';

function bufferParser(res: IncomingMessage, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('notes controller (integration)', () => {
  const app = createApp();
  let cookie: string;

  beforeEach(async () => {
    const email = `user-${Date.now()}-${Math.random().toString(36).slice(2)}${EMAIL_DOMAIN}`;
    const res = await request(app).post('/auth/signup').send({
      name: 'Notes Test User',
      email,
      password: 'password123',
    });
    cookie = res.headers['set-cookie'][0];
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('creates a note and returns it', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', cookie)
      .send({ title: 'Grocery list', content: 'Eggs milk bread' });

    expect(res.status).to.equal(201);
    expect(res.body.note).to.include({
      title: 'Grocery list',
      type: 'TEXT',
      color: 'yellow',
      wordCount: 3,
    });
  });

  it('accepts white as a note color', async () => {
    const res = await request(app)
      .post('/notes')
      .set('Cookie', cookie)
      .send({ title: 'White note', content: 'Snowy', color: 'white' });

    expect(res.status).to.equal(201);
    expect(res.body.note).to.include({ color: 'white' });
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/notes').send({ title: 'Nope' });
    expect(res.status).to.equal(401);
  });

  it('rejects an invalid payload', async () => {
    const res = await request(app).post('/notes').set('Cookie', cookie).send({ title: '' });
    expect(res.status).to.equal(400);
  });

  it('lists notes with pagination and sidebar counts', async () => {
    const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Note 1' });
    await request(app).patch(`/notes/${created.body.note.id}`).set('Cookie', cookie).send({ pinned: true });
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Note 2', type: 'VIDEO' });

    const res = await request(app).get('/notes').set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.body.notes).to.have.length(2);
    expect(res.body.counts).to.deep.equal({ all: 2, pinned: 1, video: 1, trash: 0 });
    expect(res.body.pagination).to.include({ page: 1, pageSize: 8, total: 2 });
  });

  it('filters the list to only video/mixed notes', async () => {
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Text note' });
    const video = await request(app)
      .post('/notes')
      .set('Cookie', cookie)
      .send({ title: 'Video note', type: 'VIDEO' });

    const res = await request(app).get('/notes').query({ filter: 'video' }).set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.body.notes).to.have.length(1);
    expect(res.body.notes[0].id).to.equal(video.body.note.id);
    expect(res.body.notes[0].assets).to.deep.equal([]);
    expect(res.body.pagination.total).to.equal(1);
    expect(res.body.counts).to.deep.equal({ all: 2, pinned: 0, video: 1, trash: 0 });
  });

  it('filters the list to only pinned notes', async () => {
    const pinned = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Pin me' });
    await request(app).patch(`/notes/${pinned.body.note.id}`).set('Cookie', cookie).send({ pinned: true });
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Not pinned' });

    const res = await request(app).get('/notes').query({ filter: 'pinned' }).set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.body.notes).to.have.length(1);
    expect(res.body.notes[0].id).to.equal(pinned.body.note.id);
  });

  it('searches notes by title case-insensitively', async () => {
    const groceries = await request(app)
      .post('/notes')
      .set('Cookie', cookie)
      .send({ title: 'Weekly groceries' });
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Meeting notes' });

    const res = await request(app).get('/notes').query({ q: 'GROCER' }).set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.body.notes).to.have.length(1);
    expect(res.body.notes[0].id).to.equal(groceries.body.note.id);
    expect(res.body.pagination.total).to.equal(1);
    expect(res.body.counts).to.deep.equal({ all: 2, pinned: 0, video: 0, trash: 0 });
  });

  it('returns no notes when the search term matches nothing', async () => {
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Weekly groceries' });

    const res = await request(app).get('/notes').query({ q: 'nonexistentterm' }).set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.body.notes).to.have.length(0);
    expect(res.body.pagination.total).to.equal(0);
  });

  it('exports the user\'s active notes as a downloadable JSON file', async () => {
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Keep me', content: 'hello' });
    const trashed = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Trash me' });
    await request(app).delete(`/notes/${trashed.body.note.id}`).set('Cookie', cookie);

    const res = await request(app).get('/notes/export').set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.headers['content-disposition']).to.match(/^attachment; filename="notes-export-.*\.json"$/);
    expect(res.body.notes).to.have.length(1);
    expect(res.body.notes[0]).to.include({ title: 'Keep me', content: 'hello', type: 'TEXT', color: 'yellow' });
    expect(res.body.exportedAt).to.be.a('string');
  });

  it('rejects an unauthenticated export request', async () => {
    const res = await request(app).get('/notes/export');
    expect(res.status).to.equal(401);
  });

  it('exports notes as plain text', async () => {
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Text note', content: 'hello txt' });

    const res = await request(app).get('/notes/export').query({ format: 'txt' }).set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.include('text/plain');
    expect(res.headers['content-disposition']).to.match(/filename="notes-export-.*\.txt"/);
    expect(res.text).to.include('Text note');
    expect(res.text).to.include('hello txt');
  });

  it('exports notes as a PDF file', async () => {
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'PDF note', content: 'hello pdf' });

    const res = await request(app)
      .get('/notes/export')
      .query({ format: 'pdf' })
      .set('Cookie', cookie)
      .buffer(true)
      .parse(bufferParser);

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.include('application/pdf');
    expect(res.headers['content-disposition']).to.match(/filename="notes-export-.*\.pdf"/);
    expect((res.body as Buffer).subarray(0, 4).toString('ascii')).to.equal('%PDF');
  });

  it('exports notes as a docx file', async () => {
    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Docx note', content: 'hello docx' });

    const res = await request(app)
      .get('/notes/export')
      .query({ format: 'docx' })
      .set('Cookie', cookie)
      .buffer(true)
      .parse(bufferParser);

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.include(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers['content-disposition']).to.match(/filename="notes-export-.*\.docx"/);
    expect((res.body as Buffer).subarray(0, 2).toString('ascii')).to.equal('PK');
  });

  it('rejects an invalid export format', async () => {
    const res = await request(app).get('/notes/export').query({ format: 'exe' }).set('Cookie', cookie);
    expect(res.status).to.equal(400);
  });

  it('imports notes from a previously exported file', async () => {
    const exportPayload = {
      notes: [
        { title: 'Imported note 1', content: 'hello', type: 'TEXT', color: 'blue', pinned: true },
        { title: 'Imported note 2' },
      ],
    };

    const res = await request(app).post('/notes/import').set('Cookie', cookie).send(exportPayload);

    expect(res.status).to.equal(201);
    expect(res.body.imported).to.equal(2);

    const list = await request(app).get('/notes').set('Cookie', cookie);
    expect(list.body.notes.map((n: { title: string }) => n.title).sort()).to.deep.equal([
      'Imported note 1',
      'Imported note 2',
    ]);
    expect(list.body.counts.pinned).to.equal(1);
  });

  it('rejects an import with no notes', async () => {
    const res = await request(app).post('/notes/import').set('Cookie', cookie).send({ notes: [] });
    expect(res.status).to.equal(400);
  });

  it('rejects an import with an invalid note entry', async () => {
    const res = await request(app)
      .post('/notes/import')
      .set('Cookie', cookie)
      .send({ notes: [{ title: '' }] });
    expect(res.status).to.equal(400);
  });

  it('rejects an unauthenticated import request', async () => {
    const res = await request(app).post('/notes/import').send({ notes: [{ title: 'Nope' }] });
    expect(res.status).to.equal(401);
  });

  it('imports a single note from an uploaded .txt file', async () => {
    const res = await request(app)
      .post('/notes/import/file')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('Line one\nLine two', 'utf-8'), {
        filename: 'My Meeting Notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).to.equal(201);
    expect(res.body.imported).to.equal(1);
    expect(res.body.note.title).to.equal('My Meeting Notes');
    expect(res.body.note.content).to.equal('Line one\nLine two');
  });

  it('rejects a file-import request with no file attached', async () => {
    const res = await request(app).post('/notes/import/file').set('Cookie', cookie);
    expect(res.status).to.equal(400);
  });

  it('rejects a file-import request with an unsupported file extension', async () => {
    const res = await request(app)
      .post('/notes/import/file')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('data'), { filename: 'notes.exe', contentType: 'application/octet-stream' });

    expect(res.status).to.equal(400);
  });

  it('rejects an unauthenticated file-import request', async () => {
    const res = await request(app)
      .post('/notes/import/file')
      .attach('file', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).to.equal(401);
  });

  it('returns a clear error when summarizing without a configured AI API key', async () => {
    const created = await request(app)
      .post('/notes')
      .set('Cookie', cookie)
      .send({ title: 'Standup recap', content: 'Team agreed on MVP scope.' });

    // Explicitly clear the key for this test rather than relying on the
    // environment happening to have none configured (a developer's local
    // .env may well have a real key for manual testing).
    const originalKey = env.aiApiKey;
    env.aiApiKey = undefined;
    try {
      const res = await request(app).post(`/notes/${created.body.note.id}/summarize`).set('Cookie', cookie);
      expect(res.status).to.equal(400);
      expect(res.body.error.message).to.match(/not configured/i);
    } finally {
      env.aiApiKey = originalKey;
    }
  });

  it('returns 404 when summarizing a nonexistent note', async () => {
    const res = await request(app)
      .post('/notes/00000000-0000-0000-0000-000000000000/summarize')
      .set('Cookie', cookie);
    expect(res.status).to.equal(404);
  });

  it('rejects an unauthenticated summarize request', async () => {
    const res = await request(app).post('/notes/00000000-0000-0000-0000-000000000000/summarize');
    expect(res.status).to.equal(401);
  });

  it('gets a single note by id', async () => {
    const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Solo note' });

    const res = await request(app).get(`/notes/${created.body.note.id}`).set('Cookie', cookie);

    expect(res.status).to.equal(200);
    expect(res.body.note.title).to.equal('Solo note');
  });

  it('returns 404 for a nonexistent note', async () => {
    const res = await request(app)
      .get('/notes/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie);

    expect(res.status).to.equal(404);
  });

  it('updates a note and recomputes word count', async () => {
    const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Old title' });

    const res = await request(app)
      .patch(`/notes/${created.body.note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'New title', content: 'one two three four' });

    expect(res.status).to.equal(200);
    expect(res.body.note.title).to.equal('New title');
    expect(res.body.note.wordCount).to.equal(4);
  });

  it('soft-deletes a note so it no longer appears in the default list', async () => {
    const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'To trash' });

    const del = await request(app).delete(`/notes/${created.body.note.id}`).set('Cookie', cookie);
    expect(del.status).to.equal(204);

    const list = await request(app).get('/notes').set('Cookie', cookie);
    expect(list.body.notes).to.have.length(0);
    expect(list.body.counts.trash).to.equal(1);
  });

  describe('trash', () => {
    it('lists trashed notes', async () => {
      const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Trashed one' });
      await request(app).delete(`/notes/${created.body.note.id}`).set('Cookie', cookie);

      const res = await request(app).get('/notes/trash').set('Cookie', cookie);

      expect(res.status).to.equal(200);
      expect(res.body.notes).to.have.length(1);
      expect(res.body.notes[0].title).to.equal('Trashed one');
    });

    it('restores a trashed note back into the main list', async () => {
      const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Restore me' });
      await request(app).delete(`/notes/${created.body.note.id}`).set('Cookie', cookie);

      const res = await request(app)
        .post(`/notes/${created.body.note.id}/restore`)
        .set('Cookie', cookie);

      expect(res.status).to.equal(200);
      expect(res.body.note.deletedAt).to.equal(null);

      const list = await request(app).get('/notes').set('Cookie', cookie);
      expect(list.body.notes).to.have.length(1);
    });

    it('returns 404 when restoring a note that is not in trash', async () => {
      const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Not trashed' });

      const res = await request(app)
        .post(`/notes/${created.body.note.id}/restore`)
        .set('Cookie', cookie);

      expect(res.status).to.equal(404);
    });

    it('permanently purges a trashed note', async () => {
      const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Purge me' });
      await request(app).delete(`/notes/${created.body.note.id}`).set('Cookie', cookie);

      const purgeRes = await request(app)
        .delete(`/notes/${created.body.note.id}/purge`)
        .set('Cookie', cookie);
      expect(purgeRes.status).to.equal(204);

      const trash = await request(app).get('/notes/trash').set('Cookie', cookie);
      expect(trash.body.notes).to.have.length(0);
    });

    it('returns 404 when purging a note that is not in trash', async () => {
      const created = await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Not trashed' });

      const res = await request(app)
        .delete(`/notes/${created.body.note.id}/purge`)
        .set('Cookie', cookie);

      expect(res.status).to.equal(404);
    });
  });
});
