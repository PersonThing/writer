# Shigorika

A public-facing **portfolio site** at `/` for Shigorika's editorial, copywriting, creative-direction, and poetry work, plus a private **writing tool** at `/writer` for managing markdown files, statuses, and multi-pane editing.

The two live in one Svelte 5 app. The portfolio is static content compiled from [`content/portfolio/`](content/portfolio/); the writing tool is auth-gated and backed by Postgres.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- Docker (for local Postgres)

### Setup

```sh
git clone git@github.com:PersonThing/shigorika.git
cd shigorika
npm install
cp .env.local.template .env.local
```

Populate `.env.local` (gitignored). See the template for the required vars (`DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `APP_URL`, `ALLOWED_EMAILS`).

### Run

```sh
npm run dev
```

Brings up Postgres via docker-compose, applies migrations, then starts the Express server (3456) and Vite dev server (5173).

### Tests

```sh
npm test
```

Playwright API tests hit the same Postgres as dev and truncate between runs. `npm run test:ui` for the interactive runner.

### Database migrations

Schema in [server/schema.js](server/schema.js). `npm run db:generate` to create a new migration, `npm run db:migrate` to apply locally. Production migrations run on boot via `npm run start`.

## Deployment

- **Portfolio** → GitHub Pages, auto-deployed on push to `master` via [.github/workflows/build.yml](.github/workflows/build.yml).
- **Writing tool** → Railway (currently disabled in CI; bootstrap with `./scripts/setup-railway.sh` when you want to turn it back on).

### Tech stack

- **Svelte 5** — UI
- **Vite** — frontend dev server and build
- **Express** + **express-session** + **connect-pg-simple** — backend + session storage
- **google-auth-library** — OAuth 2.0 ID token verification
- **Postgres** via **Drizzle ORM** — writing-tool data (files, stories, statuses, users, sessions)
- **Playwright** — API integration tests
- **GitHub Pages** — portfolio hosting
- **Railway** — writing-tool hosting (single service + managed Postgres)
