import fs from 'fs';
import path from 'path';

import { expect } from 'chai';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { prisma } from '../../../src/lib/prisma';

const EMAIL_DOMAIN = '@notes-assets-test.local';

describe('notes assets controller (integration)', () => {
  const app = createApp();
  let cookie: string;
  let noteId: string;

  beforeEach(async () => {
    const email = `user-${Date.now()}-${Math.random().toString(36).slice(2)}${EMAIL_DOMAIN}`;
    const signupRes = await request(app).post('/auth/signup').send({
      name: 'Assets Test User',
      email,
      password: 'password123',
    });
    cookie = signupRes.headers['set-cookie'][0];

    const noteRes = await request(app)
      .post('/notes')
      .set('Cookie', cookie)
      .send({ title: 'Video note', type: 'VIDEO' });
    noteId = noteRes.body.note.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('uploads a video asset with duration and returns a playable url', async () => {
    const res = await request(app)
      .post(`/notes/${noteId}/assets`)
      .set('Cookie', cookie)
      .field('durationSec', '42')
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' });

    expect(res.status).to.equal(201);
    expect(res.body.asset.mimeType).to.equal('video/webm');
    expect(res.body.asset.durationSec).to.equal(42);
    expect(res.body.asset.url).to.include('/uploads/notes/');
    expect(res.body.asset.thumbnailUrl).to.equal(null);

    const note = await request(app).get(`/notes/${noteId}`).set('Cookie', cookie);
    expect(note.body.note.assets).to.have.length(1);
    expect(note.body.note.assets[0].url).to.include('/uploads/notes/');
  });

  it('uploads a thumbnail alongside the video and returns a thumbnail url', async () => {
    const res = await request(app)
      .post(`/notes/${noteId}/assets`)
      .set('Cookie', cookie)
      .field('durationSec', '10')
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' })
      .attach('thumbnail', Buffer.from('fake image bytes'), { filename: 'frame.jpg', contentType: 'image/jpeg' });

    expect(res.status).to.equal(201);
    expect(res.body.asset.thumbnailUrl).to.include('/uploads/notes/');
    expect(res.body.asset.thumbnailUrl).to.include('/thumbnails/');
  });

  it('rejects a video longer than 5 minutes', async () => {
    const res = await request(app)
      .post(`/notes/${noteId}/assets`)
      .set('Cookie', cookie)
      .field('durationSec', '301')
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' });

    expect(res.status).to.equal(400);
  });

  it('rejects an upload with no duration provided', async () => {
    const res = await request(app)
      .post(`/notes/${noteId}/assets`)
      .set('Cookie', cookie)
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' });

    expect(res.status).to.equal(400);
  });

  it('rejects a non-video file', async () => {
    const res = await request(app)
      .post(`/notes/${noteId}/assets`)
      .set('Cookie', cookie)
      .field('durationSec', '10')
      .attach('video', Buffer.from('not a video'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).to.equal(400);
  });

  it('rejects an unauthenticated upload', async () => {
    const res = await request(app)
      .post(`/notes/${noteId}/assets`)
      .field('durationSec', '10')
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' });

    expect(res.status).to.equal(401);
  });

  it('returns 404 uploading to a nonexistent note', async () => {
    const res = await request(app)
      .post('/notes/00000000-0000-0000-0000-000000000000/assets')
      .set('Cookie', cookie)
      .field('durationSec', '10')
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' });

    expect(res.status).to.equal(404);
  });

  it('deletes an asset and removes the video and thumbnail files from disk', async () => {
    const uploadRes = await request(app)
      .post(`/notes/${noteId}/assets`)
      .set('Cookie', cookie)
      .field('durationSec', '10')
      .attach('video', Buffer.from('fake video bytes'), { filename: 'clip.webm', contentType: 'video/webm' })
      .attach('thumbnail', Buffer.from('fake image bytes'), { filename: 'frame.jpg', contentType: 'image/jpeg' });
    const assetId = uploadRes.body.asset.id;
    const videoPath = path.join(process.cwd(), 'uploads', uploadRes.body.asset.filePath);
    const thumbnailPath = path.join(process.cwd(), 'uploads', uploadRes.body.asset.thumbnailPath);
    expect(fs.existsSync(videoPath)).to.equal(true);
    expect(fs.existsSync(thumbnailPath)).to.equal(true);

    const delRes = await request(app).delete(`/notes/${noteId}/assets/${assetId}`).set('Cookie', cookie);
    expect(delRes.status).to.equal(204);
    expect(fs.existsSync(videoPath)).to.equal(false);
    expect(fs.existsSync(thumbnailPath)).to.equal(false);
  });

  it('returns 404 deleting a nonexistent asset', async () => {
    const res = await request(app)
      .delete(`/notes/${noteId}/assets/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookie);

    expect(res.status).to.equal(404);
  });
});
