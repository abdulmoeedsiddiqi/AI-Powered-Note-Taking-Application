import { useQueryClient } from '@tanstack/react-query';
import * as Ably from 'ably';
import { useEffect } from 'react';

import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

const NOTE_EVENTS = [
  'note:created',
  'note:updated',
  'note:deleted',
  'note:restored',
  'note:purged',
  'notes:imported',
] as const;

// Real-time note sync via Ably (works on Vercel/serverless — the browser holds a
// persistent WebSocket to Ably, not to our API). On any note event for the
// current user, refetch the notes list. If Ably isn't configured on the server,
// the token request fails and this quietly does nothing.
export function useNotesRealtime(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      return;
    }

    const ably = new Ably.Realtime({
      // Token auth: fetch a short-lived, user-scoped token from our backend
      // (authenticated by the session cookie). The Ably key never reaches here.
      authCallback: (_params, callback) => {
        apiClient
          .get('/auth/ably-token')
          .then((res) => callback(null, res.data))
          .catch((err: unknown) => callback(err instanceof Error ? err.message : 'auth failed', null));
      },
    });

    const channel = ably.channels.get(`user:${user.id}`);
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    };

    NOTE_EVENTS.forEach((event) => {
      void channel.subscribe(event, invalidate);
    });

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, [user, queryClient]);
}
