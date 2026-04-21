#!/usr/bin/env bash
# Railway + GitHub bootstrap for the shigorika app.
#
# The Express server at server/index.js serves the portfolio (static from
# dist/), the writer app (SPA routes under /writer/*), the API (/api/*),
# and the OAuth flow (/auth/*). Everything is same-origin on Railway.
#
# The GitHub Pages workflow (.github/workflows/pages.yml) continues to
# publish a portfolio-only build at personthing.github.io/shigorika/ for
# the URL we've already shared. That's a parallel, static-only deploy —
# Railway is the canonical app. Once DNS transfers we'll retire Pages
# and add a redirect.
#
# RUN THIS FILE ONE SECTION AT A TIME — do not execute it wholesale. Each
# section is independent; re-run a section if something goes wrong.
# Commands use the Railway and GitHub CLIs (brew install railway gh;
# railway login; gh auth login).

# ──────────────────────────────────────────────────────────────────────
# 0. Prerequisites — verify before starting
# ──────────────────────────────────────────────────────────────────────
railway whoami              # must show your account, else `railway login`
gh auth status              # must show authed, else `gh auth login`
command -v openssl          # must resolve

# ──────────────────────────────────────────────────────────────────────
# 1. Create Railway project (skip if .railway/ already linked)
# ──────────────────────────────────────────────────────────────────────
railway init --name shigorika

# ──────────────────────────────────────────────────────────────────────
# 2. Add managed Postgres (exposes DATABASE_URL to the service)
# ──────────────────────────────────────────────────────────────────────
railway add --database postgres

# ──────────────────────────────────────────────────────────────────────
# 3. Set env vars — replace the placeholder values first
# ──────────────────────────────────────────────────────────────────────
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET come from Google Cloud Console
# → APIs & Services → Credentials. Use the existing OAuth client we set
# up earlier (you'll add its new redirect URI in step 6). ALLOWED_EMAILS
# is a comma-separated list of Google emails allowed to sign in to /writer.
railway variables \
  --set "GOOGLE_CLIENT_ID=PASTE_HERE" \
  --set "GOOGLE_CLIENT_SECRET=PASTE_HERE" \
  --set "ALLOWED_EMAILS=tschottler@gmail.com" \
  --set "SESSION_SECRET=$(openssl rand -hex 32)" \
  --set "NODE_ENV=production"

# ──────────────────────────────────────────────────────────────────────
# 4. Generate the public domain BEFORE first deploy so APP_URL is set
#    correctly when the server boots for the first time
# ──────────────────────────────────────────────────────────────────────
railway domain              # prints the https URL once allocated
# Copy the URL printed above and paste it into APP_URL:
railway variables --set "APP_URL=https://<paste-the-domain-here>"

# ──────────────────────────────────────────────────────────────────────
# 5. First deploy (migrations run on boot via `npm start`)
# ──────────────────────────────────────────────────────────────────────
railway up --detach

# ──────────────────────────────────────────────────────────────────────
# 6. ACTION: update Google OAuth client redirect URI
# ──────────────────────────────────────────────────────────────────────
# In Google Cloud Console → APIs & Services → Credentials, open the OAuth
# 2.0 Client and add:
#     https://<your-domain>/auth/google/callback
# as an Authorized redirect URI. Save. You can leave any localhost
# redirect URI in place for local dev.

# ──────────────────────────────────────────────────────────────────────
# 7. Create a Railway project token for CI
# ──────────────────────────────────────────────────────────────────────
# Flag names vary by CLI version — check `railway tokens --help` if the
# --name flag is rejected.
RAILWAY_TOKEN=$(railway tokens create --name "gh-actions")
echo "$RAILWAY_TOKEN"       # sanity-check it looks like a token

# ──────────────────────────────────────────────────────────────────────
# 8. Push the token to GitHub Secrets (enables the Actions workflow)
# ──────────────────────────────────────────────────────────────────────
gh secret set RAILWAY_TOKEN --body "$RAILWAY_TOKEN"

# ──────────────────────────────────────────────────────────────────────
# 9. Trigger the CI deploy to confirm end-to-end
# ──────────────────────────────────────────────────────────────────────
git push                    # kicks off Actions → test → deploy
gh run watch                # or open the Actions tab in the browser

# ──────────────────────────────────────────────────────────────────────
# 10. Smoke-test the live deploy
# ──────────────────────────────────────────────────────────────────────
# Visit:
#   https://<your-domain>/                 → portfolio home renders
#   https://<your-domain>/about            → portfolio about page renders
#   https://<your-domain>/writer           → writer sign-in screen
#   Click "Sign in with Google" on /writer → completes OAuth round-trip
#                                             and lands you inside the app
