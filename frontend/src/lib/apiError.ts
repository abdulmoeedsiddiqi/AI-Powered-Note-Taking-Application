import axios from 'axios';

// Pull the backend's real error message out of an axios error (the API returns
// `{ error: { message } }`), falling back to a friendly default. This surfaces
// the actual cause (e.g. "Internal server error") instead of a guessed one.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}
