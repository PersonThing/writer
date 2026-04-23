#!/usr/bin/env node
// Restore status/quality from legacy desktop-app metadata JSON by POSTing
// to /api/set-meta. Matches legacy paths to live paths by basename.
//
// Usage:
//   WRITER_URL=https://shigorika-production.up.railway.app \
//   WRITER_COOKIE='s%3A...' \
//   node scripts/restore-meta.mjs [--apply]
//
// Without --apply, runs a dry run: prints the plan, writes nothing.

import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const META_PATH = path.join(__dirname, 'meta', 'legacy-meta.json')

const APPLY = process.argv.includes('--apply')
const URL_BASE = process.env.WRITER_URL
const COOKIE = process.env.WRITER_COOKIE

if (!URL_BASE || !COOKIE) {
  console.error('Missing WRITER_URL or WRITER_COOKIE env var.')
  process.exit(1)
}

const api = async (endpoint, body) => {
  const res = await fetch(`${URL_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `connect.sid=${COOKIE}`,
    },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(`${endpoint} → ${res.status} ${await res.text()}`)
  return res.json()
}

const basename = (p) => p.split('/').pop()

const raw = JSON.parse(await readFile(META_PATH, 'utf8'))

// Drop the _fileOrder / _statuses / _noStatusPosition meta keys.
const legacy = Object.fromEntries(
  Object.entries(raw).filter(([k]) => !k.startsWith('_')),
)

// Fetch live files.
const { files: liveFiles } = await api('/api/scan-directory')
const livePaths = Object.keys(liveFiles)

// Build basename → [livePaths] map.
const liveByBase = {}
for (const p of livePaths) (liveByBase[basename(p)] ||= []).push(p)

// Group legacy entries by basename so duplicate legacy entries collapse.
const legacyByBase = {}
for (const [legacyPath, meta] of Object.entries(legacy)) {
  const base = basename(legacyPath)
  ;(legacyByBase[base] ||= []).push({ legacyPath, meta })
}

const plan = [] // { livePath, status, quality, reason }
const skipped = [] // { base, reason, detail }

for (const [base, entries] of Object.entries(legacyByBase)) {
  const liveMatches = liveByBase[base] || []

  if (liveMatches.length === 0) {
    skipped.push({ base, reason: 'no live file', detail: entries.map((e) => e.legacyPath).join(', ') })
    continue
  }

  // Collapse legacy entries: require all non-empty statuses to agree.
  const statuses = new Set(entries.map((e) => e.meta.status))
  const qualities = new Set(entries.map((e) => e.meta.quality))
  if (statuses.size > 1) {
    skipped.push({ base, reason: 'legacy status conflict', detail: [...statuses].map((s) => `"${s}"`).join(', ') })
    continue
  }
  if (qualities.size > 1) {
    skipped.push({ base, reason: 'legacy quality conflict', detail: [...qualities].join(', ') })
    continue
  }
  const status = [...statuses][0]
  const quality = [...qualities][0]

  // If status is empty AND quality is 0, nothing to restore.
  if (status === '' && quality === 0) {
    skipped.push({ base, reason: 'no metadata to restore', detail: '' })
    continue
  }

  // Multiple live matches with agreeing legacy status → update all of them.
  for (const livePath of liveMatches) {
    const live = liveFiles[livePath]
    if (live.status === status && live.quality === quality) {
      skipped.push({ base, reason: 'already up-to-date', detail: livePath })
      continue
    }
    plan.push({
      livePath,
      status,
      quality,
      current: { status: live.status, quality: live.quality },
    })
  }
}

console.log(`\n=== PLAN (${plan.length} updates) ===`)
for (const p of plan) {
  console.log(
    `  ${p.livePath}`,
    `\n    status: "${p.current.status}" → "${p.status}"`,
    p.quality !== p.current.quality ? `  quality: ${p.current.quality} → ${p.quality}` : '',
  )
}

console.log(`\n=== SKIPPED (${skipped.length}) ===`)
const bucket = {}
for (const s of skipped) (bucket[s.reason] ||= []).push(s)
for (const [reason, items] of Object.entries(bucket)) {
  console.log(`\n  [${reason}] (${items.length})`)
  for (const it of items) console.log(`    ${it.base}${it.detail ? `  — ${it.detail}` : ''}`)
}

if (!APPLY) {
  console.log('\n(dry run — rerun with --apply to write changes)')
  process.exit(0)
}

console.log('\n=== APPLYING ===')
let ok = 0
let fail = 0
for (const p of plan) {
  try {
    await api('/api/set-meta', { path: p.livePath, status: p.status, quality: p.quality })
    console.log(`  ✓ ${p.livePath}`)
    ok++
  } catch (e) {
    console.log(`  ✗ ${p.livePath} — ${e.message}`)
    fail++
  }
}
console.log(`\nDone. ${ok} updated, ${fail} failed.`)
