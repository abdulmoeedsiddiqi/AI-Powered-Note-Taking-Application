import { createServer } from 'http';

import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { createSocketServer } from './socket';

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  logger.info(`Backend listening on port ${env.port} [${env.nodeEnv}]`);
});
