# Deploying to Vercel

This app deploys as a **single Vercel project with two services**, wired by the
root `vercel.json`:

- **`frontend`** service — root `frontend`, framework Vite → served at `/`
- **`backend`** service — root `backend`, Express → served at `/api/*`

Both share one domain, so the auth cookie stays **first-party** (cross-domain
cookies are blocked by modern browsers), and the `/api/*` rewrite routes API
calls to the backend. The Express app strips the `/api` prefix internally, so
its routes (`/auth`, `/notes`) match in every environment.

## What changed for serverless (and the trade-offs)

| Concern | Local dev | Production on Vercel |
|---|---|---|
| **Database** | Postgres in Docker (`docker compose up`) | Managed, **pooled** Postgres (Neon / Supabase / Vercel Postgres) |
| **File uploads** | written to `backend/uploads/` on disk | **Vercel Blob** object storage (auto when `BLOB_READ_WRITE_TOKEN` is set) |
| **Real-time sync** | Socket.IO (set `VITE_ENABLE_REALTIME=true`) | **Off** — serverless can't hold WebSocket connections. Lists still refresh via React Query on mutation + window focus. |
| **Auth cookie** | `SameSite=Lax`, not Secure | `SameSite=Lax`, **Secure** (set `NODE_ENV=production`), first-party via same domain |
| **Prisma** | single client | reused singleton + `rhel-openssl-3.0.x` engine target for the Vercel runtime |

## Prerequisites

- A [Vercel](https://vercel.com) account with this repo imported.
- A managed Postgres database. [Neon](https://neon.tech) is a good free option — **use the pooled connection string** (its host contains `-pooler`).
- (For video notes) a **Vercel Blob** store on the project.

## Steps

### 1. Provision the database and apply the schema

Create the Postgres database, then apply the migrations from your machine
(pointing at the cloud DB, not the local Docker one):

```bash
cd backend
DATABASE_URL="<your-pooled-postgres-url>" npx prisma migrate deploy
```

### 2. Import the project into Vercel

- New Project → import this Git repository.
- **Framework Preset: Other.** Leave Build/Output settings empty — `vercel.json` controls the build.
- (If you deploy from your fork, that's fine — Vercel builds whatever branch you connect.)

### 3. Add a Blob store (for uploads)

Project → **Storage** → create a **Blob** store and connect it. Vercel adds the
`BLOB_READ_WRITE_TOKEN` environment variable automatically. Without it, uploads
fall back to local disk (which does not persist on serverless).

### 4. Set environment variables

Project → **Settings → Environment Variables** (Production):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your **pooled** Postgres URL |
| `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN_DAYS` | `7` |
| `COOKIE_NAME` | `auth_token` |
| `AI_API_KEY` | your OpenAI-compatible key (or `local` to force the offline summarizer) |
| `AI_BASE_URL` | e.g. `https://api.openai.com/v1` |
| `AI_MODEL` | e.g. `gpt-4o-mini` |
| `AI_ENABLE_FALLBACK` | `true` |
| `BLOB_READ_WRITE_TOKEN` | *(added automatically by the Blob store)* |

Frontend build vars are **optional**: `VITE_API_BASE_URL` defaults to `/api`, and
`VITE_ENABLE_REALTIME` should stay unset (real-time is off on serverless).

### 5. Deploy

Push to the connected branch (or click **Deploy**). Visit the deployment URL and
sign up.

## Troubleshooting

- **500s from `/api/*` mentioning the Prisma engine**: ensure `prisma generate`
  ran during the build (it does via the backend `postinstall`) and that
  `binaryTargets` includes `rhel-openssl-3.0.x` (it does, in `schema.prisma`). If
  the query engine still isn't bundled, add an `includeFiles` entry for
  `node_modules/.prisma/client/*.node` to the backend build in `vercel.json`.
- **Login "works" but you're logged out on refresh**: confirm `NODE_ENV=production`
  (so the cookie is `Secure`) and that the frontend and API are on the same domain.
- **Too many DB connections**: use the **pooled** connection string, not the direct one.

## Security

- **Rotate the AI key** that currently sits in `backend/.env` before going public,
  and set the real key only in Vercel's env vars. Never commit `.env`.
- Use a strong, unique `JWT_SECRET` in production — never the dev default.
