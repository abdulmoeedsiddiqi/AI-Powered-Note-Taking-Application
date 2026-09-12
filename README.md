# Notes Taking App

A full-stack notes application built for the 10Pearls Cohort 9 MERN internship — React + TypeScript on the frontend, Express + TypeScript + PostgreSQL on the backend, with real-time sync, rich-text editing, video notes, multi-format export/import, and AI-powered summarization.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Real-Time Sync](#real-time-sync)
- [AI Summarization](#ai-summarization)
- [File Uploads & Limits](#file-uploads--limits)
- [Security Notes](#security-notes)
- [Testing](#testing)
- [Contributing](#contributing)

## Features

- **Authentication** — email/password signup and login, httpOnly-cookie JWT sessions, protected routes, session persists 7 days by default.
- **Rich-text notes** — a [Tiptap](https://tiptap.dev/)-based editor supporting bold, italic, underline, strikethrough, headings (H1–H3), bullet/numbered lists, and a font-color picker, with a live preview of the note's card color while writing.
- **Video notes** — record a video directly from the browser (camera + mic), with thumbnail generation and duration validation (max 5 minutes); notes can be text-only, video-only, or mixed.
- **Notes management** — create, edit, pin, color-tag (8 colors, see [Note Colors](#note-colors)), search by title, filter (all/pinned/video), paginate, soft-delete to Trash, restore, and permanently purge.
- **Real-time sync** — note changes (create/update/delete) broadcast live to all of a user's open sessions over an authenticated Socket.IO connection.
- **Export & import** — export all notes as JSON, plain text, PDF, or Word (.docx), with bold/italic/underline/strikethrough/headings/lists/color preserved in PDF/DOCX; import notes back from a JSON backup or from a single PDF/Word/text file.
- **AI summarization** — a "Summarize" button generates a short summary of a note's content via any OpenAI-compatible chat completions API (OpenAI, Groq, etc.), with an optional local, offline extractive-summary fallback if the external provider is unavailable, unconfigured, or fails.
- **Light/dark theme** — a persisted theme toggle with a matching palette across the whole UI, including note colors.

### Note Colors

`white`, `yellow`, `blue`, `green`, `purple`, `pink`, `orange`, `red` — each with its own light- and dark-theme hex value, applied consistently to the note grid card, the editor's live writing-area preview, and the color picker swatches. New notes default to `yellow`.

## Tech Stack

**Backend**
- Node.js + [Express](https://expressjs.com/) + TypeScript (strict mode)
- [Prisma](https://www.prisma.io/) ORM + PostgreSQL
- JWT auth via httpOnly cookies (`jsonwebtoken`, `bcryptjs`)
- [Socket.IO](https://socket.io/) for real-time note events
- [Zod](https://zod.dev/) for request validation
- [Pino](https://getpino.io/) structured logging (`pino-http` for request logs, `pino-pretty` in dev)
- `multer` for multipart file uploads (in-memory storage)
- `pdfkit` (PDF generation), `docx` (Word generation), `mammoth` + `pdf-parse` (Word/PDF text extraction for import)
- `openai` SDK, used generically against any OpenAI-compatible endpoint
- Mocha + Chai + Supertest for testing

**Frontend**
- React 19 + TypeScript + [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query) for server state
- [Tiptap](https://tiptap.dev/) rich-text editor (`starter-kit`, `underline`, `text-style`, `color`, `placeholder` extensions)
- `react-router-dom` for routing
- `axios` for HTTP, `socket.io-client` for real-time updates
- Jest + React Testing Library for testing

## Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # User, Note, NoteAsset models
│   ├── src/
│   │   ├── config/               # env loading
│   │   ├── lib/                  # storage helpers
│   │   ├── logger/                # Pino setup
│   │   ├── middleware/            # auth, upload, error handling
│   │   ├── modules/
│   │   │   ├── auth/               # signup/login/me/logout
│   │   │   ├── ai/                 # summarization service + local fallback
│   │   │   └── notes/               # CRUD, export/import, video assets
│   │   ├── socket/                # Socket.IO server + note events
│   │   └── utils/                 # Tiptap JSON parsing, word count, ApiError
│   ├── test/                     # Mocha/Chai/Supertest tests, mirrors src/
│   └── docker-compose.yml        # local PostgreSQL container
└── frontend/
    └── src/
        ├── api/                  # axios client + per-resource API modules
        ├── components/
        │   ├── auth/               # login/signup forms
        │   ├── common/              # topbar, sidebar, theme toggle
        │   ├── editor/               # Tiptap editor, toolbar, AI summary panel
        │   ├── layout/               # dashboard shell
        │   └── notes/                # note/trash cards, grid, pagination, video recorder
        ├── context/                # auth + theme context providers
        ├── hooks/                  # React Query hooks (useNotes, realtime sync, debounce)
        ├── lib/                    # Tiptap JSON → text/preview helpers, asset URL resolution
        ├── pages/                  # route-level pages
        ├── routes/                 # protected/guest route guards
        └── types/                  # shared TS types
```

## Data Model

Defined in `backend/prisma/schema.prisma`, PostgreSQL via Prisma.

**User**
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | primary key |
| `name` | `String` | |
| `email` | `String` | unique |
| `passwordHash` | `String` | bcrypt hash, never returned to the client |
| `avatarColor`, `themePref` | `String?` | UI preferences |
| `createdAt`, `updatedAt` | `DateTime` | |

**Note**
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | primary key |
| `userId` | `String` | owner, cascades on user delete |
| `title` | `String` | max 200 chars |
| `content` | `Json?` | Tiptap/ProseMirror document JSON, or a plain string |
| `type` | `TEXT \| VIDEO \| MIXED` | default `TEXT` |
| `color` | `String` | one of the 8 [note colors](#note-colors), default `yellow` |
| `pinned` | `Boolean` | default `false` |
| `wordCount` | `Int` | recomputed server-side on every save |
| `summary`, `summaryUpdatedAt` | `String?`, `DateTime?` | set by the AI summarize endpoint |
| `deletedAt` | `DateTime?` | non-null while in Trash |
| `createdAt`, `updatedAt` | `DateTime` | |

Indexed on `userId` and `(userId, deletedAt)` for fast list/trash queries.

**NoteAsset**
| Field | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | primary key |
| `noteId` | `String` | cascades on note delete |
| `kind` | `VIDEO` | only kind currently supported |
| `filePath`, `thumbnailPath` | `String` | relative to `backend/uploads/` |
| `mimeType`, `durationSec`, `sizeBytes` | | |
| `createdAt` | `DateTime` | |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for the local PostgreSQL database), or a PostgreSQL instance you point `DATABASE_URL` at

### 1. Clone and install

```bash
git clone <this-repo-url>
cd cohort-9-mern-9876-abdul

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Copy each `.env.example` to `.env` and fill in values as needed:

```bash
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env
```

See [Environment Variables](#environment-variables) below for what each value does.

### 3. Start the database

```bash
cd backend
docker compose up -d
npm run prisma:migrate
```

This starts PostgreSQL in Docker on port `5433` (chosen to avoid clashing with a locally-installed Postgres on the default `5432`) and applies the Prisma schema.

### 4. Run the app

In two terminals:

```bash
# backend — http://localhost:4000
cd backend
npm run dev

# frontend — http://localhost:5173
cd frontend
npm run dev
```

Open `http://localhost:5173` and sign up for an account.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Node environment |
| `PORT` | `4000` | Port the API server listens on |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for cross-origin requests (the frontend's URL) |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level |
| `DATABASE_URL` | — | PostgreSQL connection string (see `docker-compose.yml` for local defaults) |
| `JWT_SECRET` | *(insecure dev default)* | Secret used to sign auth JWTs — set a real value outside development |
| `JWT_EXPIRES_IN_DAYS` | `7` | Auth session lifetime |
| `COOKIE_NAME` | `auth_token` | Name of the httpOnly auth cookie |
| `AI_API_KEY` | *(unset)* | API key for the AI summarization provider. Leaving this unset disables the "Summarize" feature (with a clear error), unless `AI_ENABLE_FALLBACK` is set. The literal values `local` or `mock` force the offline summarizer directly, without calling any external API |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Base URL of an OpenAI-compatible chat completions API — swap for Groq, etc. |
| `AI_MODEL` | `gpt-4o-mini` | Model name to request from that API |
| `AI_ENABLE_FALLBACK` | `false` | If `true`, falls back to a local, offline extractive summary when the external AI provider fails |

See [AI Summarization](#ai-summarization) for the full fallback behavior.

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000` | Base URL of the backend API (used by the axios client, asset URL resolution, and the Socket.IO client) |

## Available Scripts

### Backend (run from `backend/`)

| Script | Description |
|---|---|
| `npm run dev` | Start the API with hot-reload (`ts-node-dev`) |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Run the Mocha/Chai/Supertest test suite |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run prisma:generate` | Regenerate the Prisma client (also runs automatically on `npm install`) |
| `npm run prisma:migrate` | Apply Prisma migrations to the database |
| `npm run prisma:studio` | Open Prisma Studio to browse the database |

### Frontend (run from `frontend/`)

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Jest + React Testing Library test suite |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

## API Reference

All `/notes/*` routes require authentication via the session cookie (`Cookie: auth_token=...`), set automatically by the browser after login/signup. Error responses follow `{ "error": { "message": string, "details"?: object } }`.

### Auth (`/auth`)

| Method & Path | Body | Response |
|---|---|---|
| `POST /auth/signup` | `{ name, email, password }` | `201` sets the session cookie, returns `{ user }` |
| `POST /auth/login` | `{ email, password }` | `200` sets the session cookie, returns `{ user }` |
| `GET /auth/me` | — | `200 { user }`, or `401` if not authenticated |
| `POST /auth/logout` | — | `204`, clears the session cookie |

### Notes (`/notes`)

| Method & Path | Body / Query | Description |
|---|---|---|
| `GET /notes` | `?page=1&pageSize=8&filter=all\|pinned\|video&q=<search>` | Paginated, filterable, title-search list (`pageSize` capped at 50) |
| `POST /notes` | `{ title, content?, type?, color? }` | Create a note |
| `GET /notes/:id` | — | Get a single note |
| `PATCH /notes/:id` | `{ title?, content?, type?, color?, pinned? }` | Update a note |
| `DELETE /notes/:id` | — | Soft-delete (moves to Trash) |
| `POST /notes/:id/summarize` | `{ content? }` | Generate/refresh the AI summary; an optional `content` field lets the client summarize unsaved editor content (persisting it first) rather than only the last-saved version |
| `GET /notes/export` | `?format=json\|txt\|pdf\|docx` | Download all of the user's notes in the given format (defaults to `json`) |
| `POST /notes/import` | `{ notes: [...] }` | Bulk-import from a JSON backup (max 500 notes per request) |
| `POST /notes/import/file` | multipart `file` | Import a single note from a `.txt`, `.pdf`, or `.docx` file |
| `GET /notes/trash` | `?page=&pageSize=` | List soft-deleted notes |
| `POST /notes/:id/restore` | — | Restore a soft-deleted note |
| `DELETE /notes/:id/purge` | — | Permanently delete a note (and its assets) |
| `POST /notes/:id/assets` | multipart `video`, `thumbnail`, `durationSec` | Attach a video to a note |
| `DELETE /notes/:id/assets/:assetId` | — | Remove a video asset |

## Real-Time Sync

The backend runs a Socket.IO server (`backend/src/socket`) alongside the HTTP API. On connection, the socket handshake is authenticated the same way as HTTP requests — it reads and verifies the `auth_token` cookie — and each connected client is placed into a room scoped to their `userId`. Note mutations then emit `note:created`, `note:updated`, and `note:deleted` events only into that user's room, so every open tab/device for that user stays in sync without polling, and users never see each other's events.

## AI Summarization

`POST /notes/:id/summarize` resolves a summary in this order:

1. If `AI_API_KEY` is unset, the request fails with a clear `400` ("AI summarization is not configured on this server") — unless it's the literal value `local`/`mock` (see below).
2. If `AI_API_KEY` is `local` or `mock`, the built-in offline extractive summarizer (`localSummary.ts`) runs directly — no network call. It picks the lead sentence plus the highest-scoring "action" sentence (scored by keyword matches like *agreed*, *next*, *deadline*, *plan*, and by sentence length).
3. Otherwise, it calls the configured OpenAI-compatible endpoint (`AI_BASE_URL` + `AI_MODEL`) with the note's content (truncated to 8,000 characters) and a system prompt asking for a 1–2 sentence summary.
4. If that call fails (rate limit, auth error, network issue, etc.) and `AI_ENABLE_FALLBACK=true`, it transparently falls back to the same offline extractive summarizer instead of erroring out.

## File Uploads & Limits

| Upload | Limit | Accepted types |
|---|---|---|
| Video note asset | 100 MB, 5 minutes duration | any `video/*` mimetype |
| Video thumbnail | (shares the 100 MB request limit) | any `image/*` mimetype |
| Import file | 20 MB | `.txt`, `.pdf`, `.docx` |
| JSON import batch | 500 notes per request | — |

Uploads are received in memory (`multer` memory storage) and written to `backend/uploads/`, served statically at `/uploads/*`.

## Security Notes

- Passwords are hashed with `bcryptjs` before storage; the hash is never returned in API responses.
- Sessions are httpOnly, `SameSite=Lax` cookies (so they're inaccessible to client-side JS and not sent on cross-site requests), marked `Secure` automatically when `NODE_ENV=production`.
- CORS is locked to `CORS_ORIGIN` with credentials enabled; only the `Content-Disposition` response header is explicitly exposed cross-origin (needed for export downloads to get the real filename).
- All request bodies/queries are validated with Zod before reaching business logic.

## Testing

Both apps have their own test suite, run independently:

```bash
cd backend && npm test    # Mocha/Chai/Supertest
cd frontend && npm test   # Jest + React Testing Library
```

Backend tests use dependency injection (repository/service functions accept an optional collaborator, defaulting to the real implementation) so most of the suite runs fully offline against fakes, without a real database or external API calls.

## Contributing

This project follows a stacked-branch workflow: `feature/<area>/<name>` and `bugfix/<area>/<name>` branches (where `<area>` is `frontend` or `backend`), opened as pull requests against `develop`. See individual PRs for CodeRabbit-reviewed change history.
