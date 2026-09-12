import type { Server } from 'socket.io';

let io: Server | null = null;

export function attachIo(server: Server | null): void {
  io = server;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export type NoteEventName =
  | 'note:created'
  | 'note:updated'
  | 'note:deleted'
  | 'note:restored'
  | 'note:purged'
  | 'notes:imported';

export function emitNoteEvent(userId: string, event: NoteEventName, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
