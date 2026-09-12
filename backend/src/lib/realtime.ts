import * as Ably from 'ably';

import { env } from '../config/env';

export type NoteEventName =
  | 'note:created'
  | 'note:updated'
  | 'note:deleted'
  | 'note:restored'
  | 'note:purged'
  | 'notes:imported';

// Each user gets a private channel; tokens are scoped so a user can only
// subscribe to their own.
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

let restClient: Ably.Rest | null = null;

function getRest(): Ably.Rest | null {
  if (!env.ablyApiKey) {
    return null;
  }
  if (!restClient) {
    restClient = new Ably.Rest({ key: env.ablyApiKey });
  }
  return restClient;
}

export function isRealtimeConfigured(): boolean {
  return Boolean(env.ablyApiKey);
}

// Fire-and-forget publish of a note event to the owner's channel. The browser
// only uses the event name (to refetch), so no note data is sent. Never blocks
// or fails the request — real-time is best-effort.
export function emitNoteEvent(userId: string, event: NoteEventName, _payload?: unknown): void {
  const rest = getRest();
  if (!rest) {
    return;
  }
  rest.channels
    .get(userChannel(userId))
    .publish(event, {})
    .catch(() => {
      /* ignore real-time publish failures */
    });
}

// Issue a short-lived Ably token scoped to the user's own channel (subscribe
// only) so the API key never reaches the browser.
export async function createAblyTokenRequest(userId: string) {
  const rest = getRest();
  if (!rest) {
    throw new Error('Real-time is not configured');
  }
  return rest.auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify({ [userChannel(userId)]: ['subscribe'] }),
  });
}
