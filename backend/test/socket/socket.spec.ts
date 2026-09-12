import type { AddressInfo } from 'net';
import { createServer } from 'http';

import { expect } from 'chai';
import request from 'supertest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { createSocketServer } from '../../src/socket';
import { attachIo } from '../../src/socket/notesEvents';

const EMAIL_DOMAIN = '@notes-socket-test.local';

describe('socket server (integration)', () => {
  const app = createApp();
  const httpServer = createServer(app);

  let baseUrl: string;
  let cookie: string;
  const clients: ClientSocket[] = [];

  before((done) => {
    // Attached here, not at describe-body scope: other spec files' cleanup
    // (e.g. notesEvents.spec.ts resetting the shared io singleton to null in
    // its afterEach) runs between mocha collecting this file and actually
    // running its tests, so attaching earlier would get silently undone.
    createSocketServer(httpServer);
    httpServer.listen(0, () => {
      const { port } = httpServer.address() as AddressInfo;
      baseUrl = `http://localhost:${port}`;
      done();
    });
  });

  after((done) => {
    httpServer.close(() => {
      attachIo(null);
      void prisma.$disconnect().then(() => done());
    });
  });

  beforeEach(async () => {
    const email = `user-${Date.now()}-${Math.random().toString(36).slice(2)}${EMAIL_DOMAIN}`;
    const res = await request(app).post('/auth/signup').send({
      name: 'Socket Test User',
      email,
      password: 'password123',
    });
    cookie = res.headers['set-cookie'][0];
  });

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.close());
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  function connect(cookieHeader?: string): ClientSocket {
    const client = ioClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    clients.push(client);
    return client;
  }

  it('rejects a connection with no auth cookie', (done) => {
    const client = connect();
    client.on('connect_error', (err) => {
      expect(err.message).to.equal('Authentication required');
      done();
    });
    client.on('connect', () => done(new Error('expected connect_error, got connect')));
  });

  it('rejects a connection with an invalid auth cookie', (done) => {
    const client = connect('auth_token=not-a-real-token');
    client.on('connect_error', (err) => {
      expect(err.message).to.equal('Invalid or expired session');
      done();
    });
  });

  it('accepts a connection with a valid auth cookie', (done) => {
    const client = connect(cookie);
    client.on('connect', () => done());
    client.on('connect_error', (err) => done(err));
  });

  it('emits note:created to the owning user when a note is created via the REST API', async () => {
    const client = connect(cookie);
    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', reject);
    });

    const received = new Promise<{ title: string }>((resolve) => {
      client.on('note:created', resolve);
    });

    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Realtime note' });

    const payload = await received;
    expect(payload.title).to.equal('Realtime note');
  });

  it('does not emit note events to a different user', async () => {
    const otherEmail = `user-${Date.now()}-${Math.random().toString(36).slice(2)}${EMAIL_DOMAIN}`;
    const otherRes = await request(app).post('/auth/signup').send({
      name: 'Other Socket User',
      email: otherEmail,
      password: 'password123',
    });
    const otherCookie = otherRes.headers['set-cookie'][0];

    const client = connect(otherCookie);
    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', reject);
    });

    let receivedForOtherUser = false;
    client.on('note:created', () => {
      receivedForOtherUser = true;
    });

    await request(app).post('/notes').set('Cookie', cookie).send({ title: 'Not for the other user' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(receivedForOtherUser).to.equal(false);
  });
});
