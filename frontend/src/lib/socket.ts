import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_BASE_URL ?? '/api', {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}
