# Writer

A web app for managing writing projects. Open a folder of markdown files, organize them with statuses and quality ratings, and edit multiple files at once. Multi-user with Google sign-in; each user's files are isolated.

## Usage

Sign in with Google. Files live in Postgres, keyed by your user. The UI exposes a virtual folder tree derived from file paths — create, rename, move, delete, and drag `.md` / `.txt` / `.docx` files in from Finder to import (docx gets converted to Markdown).

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- Docker (for local Postgres)

### Setup

```sh
git clone git@github.com:PersonThing/writer.git
cd writer
npm install
cp .env.example .env
```

Populate `.env`:
- `DATABASE_URL` — points at the dockerized Postgres at `postgres://writer:writer@localhost:5434/writer_dev`.
- `SESSION_SECRET` — any random string for dev.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — only needed to exercise the browser login flow (tests use a bypass). Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client, Web type. Add `http://localhost:3456/auth/google/callback` as an authorized redirect URI.
- `APP_URL` — `http://localhost:3456` for local dev.
- `ALLOWED_EMAILS` — comma-separated list of Google emails allowed to sign in.

### Run

```sh
npm run dev
```

Brings up Postgres via docker-compose, applies migrations, then starts the Express server (port 3456) and Vite dev server (port 5173) concurrently.

### Tests

Playwright API tests hit the same Postgres as dev (they truncate between runs):

```sh
npm test
```

`npm run test:ui` for Playwright's interactive runner.

### Database migrations

Schema lives in [server/schema.js](server/schema.js) using Drizzle's `pgTable` helpers.

- Edit the schema, then `npm run db:generate` to create a new versioned SQL migration in `./drizzle/`.
- Apply migrations locally with `npm run db:migrate` (also happens automatically when `npm run dev` starts).
- In production Railway runs migrations via `npm run start` before booting the server.
- `npm run db:studio` opens Drizzle's web GUI if you want to poke at rows directly.

## Deployment (Railway)

One-time bootstrap:

```sh
./scripts/setup-railway.sh
```

Run it section by section (it's not a one-shot script). It creates the Railway project, attaches Postgres, sets all env vars, generates a CI token, and pushes that token to GitHub Secrets as `RAILWAY_TOKEN`. After the first successful deploy the CI workflow in [.github/workflows/build.yml](.github/workflows/build.yml) handles every subsequent push to `master`.

### Tech stack

- **Svelte 5** — UI
- **Vite** — frontend dev server and build
- **Express** + **express-session** + **connect-pg-simple** — backend + session storage
- **google-auth-library** — OAuth 2.0 ID token verification
- **Postgres** via **Drizzle ORM** — all app data (files, stories, statuses, users, sessions)
- **Playwright** — API integration tests
- **Railway** — hosting (single service + managed Postgres)
