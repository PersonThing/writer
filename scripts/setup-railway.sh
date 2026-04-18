#!/usr/bin/env bash
# Railway + GitHub bootstrap script.
#
# Run this file ONE SECTION AT A TIME — do not execute it wholesale.
# Each section is independent; re-run a section if something goes wrong.
# Commands use the Railway and GitHub CLIs; both must be installed and authed
# (brew install railway gh; railway login; gh auth login).

# ──────────────────────────────────────────────────────────────────────
# 0. Prerequisites — verify before starting
# ──────────────────────────────────────────────────────────────────────
railway whoami              # must show your account, else `railway login`
gh auth status              # must show authed, else `gh auth login`
command -v openssl          # must resolve

# ──────────────────────────────────────────────────────────────────────
# 1. Create Railway project (skip if .railway/ already linked)
# ──────────────────────────────────────────────────────────────────────
railway init --name writer

# ──────────────────────────────────────────────────────────────────────
# 2. Add managed Postgres (exposes DATABASE_URL to the service)
# ──────────────────────────────────────────────────────────────────────
railway add --database postgres

# ──────────────────────────────────────────────────────────────────────
# 3. Set env vars — replace the placeholder values first
# ──────────────────────────────────────────────────────────────────────
railway variables \
  --set "GOOGLE_CLIENT_ID=PASTE_HERE" \
  --set "GOOGLE_CLIENT_SECRET=PASTE_HERE" \
  --set "ALLOWED_EMAILS=tschottler@gmail.com" \
  --set "SESSION_SECRET=$(openssl rand -hex 32)" \
  --set "NODE_ENV=production"

# ──────────────────────────────────────────────────────────────────────
# 4. First deploy — generates the public domain
# ──────────────────────────────────────────────────────────────────────
railway up --detach

# ──────────────────────────────────────────────────────────────────────
# 5. Grab the assigned domain and set APP_URL
# ──────────────────────────────────────────────────────────────────────
railway domain              # prints the https URL once allocated
railway variables --set "APP_URL=https://<paste-the-domain-here>"

# ──────────────────────────────────────────────────────────────────────
# 6. ACTION: update Google OAuth client redirect URI
# ──────────────────────────────────────────────────────────────────────
# In Google Cloud Console → APIs & Services → Credentials, open the OAuth
# 2.0 Client and add:    https://<your-domain>/auth/google/callback
# as an Authorized redirect URI. Save.

# ──────────────────────────────────────────────────────────────────────
# 7. Create a Railway project token for CI
# ──────────────────────────────────────────────────────────────────────
# Flag names vary by CLI version — check `railway tokens --help` first.
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
