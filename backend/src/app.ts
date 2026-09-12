import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';

import { env } from './config/env';
import { httpLogger } from './logger/httpLogger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { UPLOADS_ROOT } from './lib/storage';
import { authRouter } from './modules/auth/auth.routes';
import { notesRouter } from './modules/notes/notes.routes';

export function createApp(): Express {
  const app = express();

  app.use(httpLogger);
  app.use(cors({ origin: env.corsOrigin, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOADS_ROOT));

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', env: env.nodeEnv });
  });

  app.use('/auth', authRouter);
  app.use('/notes', notesRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
