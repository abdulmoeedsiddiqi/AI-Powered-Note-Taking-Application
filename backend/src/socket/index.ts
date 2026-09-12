import { parse } from 'cookie';
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';
import { attachIo, userRoom } from './notesEvents';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = cookieHeader ? parse(cookieHeader)[env.cookieName] : undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired session'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(userRoom(socket.data.userId as string));
  });

  attachIo(io);
  return io;
}
