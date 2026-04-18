import session from 'express-session'
import ConnectPgSimple from 'connect-pg-simple'
import { OAuth2Client } from 'google-auth-library'
import { eq } from 'drizzle-orm'
import { db, schema, pool } from './db.js'

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  ALLOWED_EMAILS = '',
  APP_URL,
  NODE_ENV,
} = process.env

// In test mode we use the /auth/test-login bypass and don't need real Google creds.
const required = ['SESSION_SECRET', 'APP_URL']
if (NODE_ENV !== 'test') required.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERROR: ${key} is not set.`)
    process.exit(1)
  }
}

const allowedEmails = new Set(
  ALLOWED_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
)

const REDIRECT_URI = `${APP_URL.replace(/\/$/, '')}/auth/google/callback`

const oauth = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI)

const DEFAULT_STATUSES = [
  { statusId: 'draft',    label: 'Draft',    color: '#b5651d', sortOrder: 0 },
  { statusId: 'revising', label: 'Revising', color: '#c4a000', sortOrder: 1 },
  { statusId: 'ready',    label: 'Ready',    color: '#1e8a48', sortOrder: 2 },
  { statusId: 'archived', label: 'Archived', color: '#555555', sortOrder: 3 },
]

// ── Session middleware ─────────────────────────────────────────────────────
const PgStore = ConnectPgSimple(session)

export const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
})

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

// ── Routes ─────────────────────────────────────────────────────────────────
export function mountAuth(app) {
  app.get('/auth/google', (req, res) => {
    const url = oauth.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
    })
    res.redirect(url)
  })

  app.get('/auth/google/callback', async (req, res) => {
    try {
      const { code } = req.query
      if (!code) return res.status(400).send('Missing code')

      const { tokens } = await oauth.getToken(code)
      const ticket = await oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()

      if (!payload.email_verified) {
        return res.status(403).send('Email not verified')
      }

      const email = payload.email.toLowerCase()
      if (!allowedEmails.has(email)) {
        return res.status(403).send(`Access denied for ${email}`)
      }

      // Upsert user
      const [existing] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))

      let user
      if (existing) {
        // Refresh name/picture on each login
        const [updated] = await db
          .update(schema.users)
          .set({ name: payload.name, picture: payload.picture })
          .where(eq(schema.users.id, existing.id))
          .returning()
        user = updated
      } else {
        const [created] = await db
          .insert(schema.users)
          .values({ email, name: payload.name, picture: payload.picture })
          .returning()
        user = created

        // Seed default statuses for the new user
        await db
          .insert(schema.statuses)
          .values(DEFAULT_STATUSES.map((s) => ({ ...s, userId: user.id })))
      }

      req.session.userId = user.id
      req.session.save(() => res.redirect('/'))
    } catch (e) {
      console.error('OAuth callback error:', e)
      res.status(500).send('Auth failed')
    }
  })

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.status(204).end())
  })

  // Test-only auth bypass. Do not mount in production.
  if (process.env.NODE_ENV === 'test') {
    app.post('/auth/test-login', async (req, res) => {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'email required' })
      const normalized = String(email).toLowerCase()

      const [existing] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalized))

      let user = existing
      if (!user) {
        const [created] = await db
          .insert(schema.users)
          .values({ email: normalized, name: normalized, picture: null })
          .returning()
        user = created
        await db
          .insert(schema.statuses)
          .values(DEFAULT_STATUSES.map((s) => ({ ...s, userId: user.id })))
      }

      req.session.userId = user.id
      req.session.save(() =>
        res.json({ id: user.id, email: user.email, name: user.name, picture: user.picture }),
      )
    })
  }

  app.get('/auth/me', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' })
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        picture: schema.users.picture,
      })
      .from(schema.users)
      .where(eq(schema.users.id, req.session.userId))
    if (!user) {
      req.session.destroy(() => {})
      return res.status(401).json({ error: 'User not found' })
    }
    res.json(user)
  })
}
