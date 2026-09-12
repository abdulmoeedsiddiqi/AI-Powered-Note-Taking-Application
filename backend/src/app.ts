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

  // When deployed behind Vercel's "/api" service rewrite, requests may arrive
  // prefixed with /api. Strip it so the routes (/auth, /notes, /health) match
  // in every environment; a no-op locally where there is no prefix.
  app.use((req, _res, next) => {
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
    }
    next();
  });

  app.use(httpLogger);
  app.use(cors({ origin: env.corsOrigin, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  // Only serve local disk uploads when not using Blob object storage (prod).
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    app.use('/uploads', express.static(UPLOADS_ROOT));
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', env: env.nodeEnv });
  });

  app.use('/auth', authRouter);
  app.use('/notes', notesRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
