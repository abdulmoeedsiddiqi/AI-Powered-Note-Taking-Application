import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';

// Real-time sync is delivered via Ably (see lib/realtime.ts), so no long-running
// WebSocket server is needed — this runs fine on serverless too.
const app = createApp();

app.listen(env.port, () => {
  logger.info(`Backend listening on port ${env.port} [${env.nodeEnv}]`);
});
