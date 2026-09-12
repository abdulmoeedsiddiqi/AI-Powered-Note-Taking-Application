import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';

const NOTE_EVENTS = ['note:created', 'note:updated', 'note:deleted', 'note:restored', 'note:purged'] as const;

// Socket.IO needs a long-running server, which Vercel's serverless functions
// can't provide. Real-time is therefore opt-in via VITE_ENABLE_REALTIME=true
// (local dev / a WebSocket-capable host). When off, note lists stay fresh via
// React Query invalidation on mutations and refetch-on-focus.
const REALTIME_ENABLED = import.meta.env.VITE_ENABLE_REALTIME === 'true';

export function useNotesRealtime(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !REALTIME_ENABLED) {
      return;
    }

    const socket = getSocket();
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    };

    NOTE_EVENTS.forEach((event) => socket.on(event, invalidate));
    socket.connect();

    return () => {
      NOTE_EVENTS.forEach((event) => socket.off(event, invalidate));
      socket.disconnect();
    };
  }, [user, queryClient]);
}
