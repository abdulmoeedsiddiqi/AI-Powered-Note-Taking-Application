import express from 'express';

import { createApp } from '../src/app';

// Vercel serverless entry point. The API is mounted under /api so it shares the
// frontend's domain in production (keeping the auth cookie first-party). There
// is no long-running HTTP server or Socket.IO here — those live in src/index.ts
// for local development only.
const server = express();
server.use('/api', createApp());

export default server;
