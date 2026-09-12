import { createApp } from '../src/app';

// Vercel serverless entry point for the backend service. Exports the Express
// app as a handler (no app.listen — that's src/index.ts, for local dev only).
// createApp() strips a leading /api internally, so requests routed here as
// /api/* resolve to the real routes (/auth, /notes) in every environment.
export default createApp();
