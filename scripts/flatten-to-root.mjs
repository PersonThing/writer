#!/usr/bin/env node
// Move all files on the live app to the root. Resolve basename collisions by
// suffixing `-1`, `-2`, etc. before the extension. Files already at root keep
// their names; folder files resolve alphabetically by source path.
//
// Usage:
//   WRITER_URL=https://shigorika-production.up.railway.app \
//   WRITER_COOKIE='s%3A...' \
//   node scripts/flatten-to-root.mjs [--apply]

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
const isRoot = (p) => !p.includes('/')

// Split "Foo.md" into ["Foo", ".md"]. Handles "no extension" and "dotfile".
const splitExt = (name) => {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return [name, '']
  return [name.slice(0, dot), name.slice(dot)]
}

const { files: liveFiles } = await api('/api/scan-directory')
// Skip story files — they live under _stories/ and moving them to root
// would break the story feature.
const livePaths = Object.keys(liveFiles).filter((p) => !p.startsWith('_stories/'))

// Depth 0 = root, 1 = one-folder-deep, etc. Sort: root first, then shallower
// folders, then alphabetical by source path as a tiebreaker.
const sortKey = (p) => [p.split('/').length, p.toLowerCase()]
const sortedPaths = [...livePaths].sort((a, b) => {
  const [ad, as] = sortKey(a)
  const [bd, bs] = sortKey(b)
  if (ad !== bd) return ad - bd
  return as < bs ? -1 : as > bs ? 1 : 0
})

const taken = new Set() // target root names that are already claimed
const plan = [] // { oldPath, newPath }
const noop = [] // already at root

for (const oldPath of sortedPaths) {
  const name = basename(oldPath)

  if (isRoot(oldPath)) {
    taken.add(name)
    noop.push(oldPath)
    continue
  }

  if (!taken.has(name)) {
    taken.add(name)
    plan.push({ oldPath, newPath: name })
    continue
  }

  // Collide: add -1, -2, ... before the extension.
  const [stem, ext] = splitExt(name)
  let n = 1
  let candidate
  do {
    candidate = `${stem}-${n}${ext}`
    n++
  } while (taken.has(candidate))
  taken.add(candidate)
  plan.push({ oldPath, newPath: candidate })
}

console.log(`\n=== PLAN (${plan.length} moves, ${noop.length} already at root) ===`)
for (const p of plan) {
  const suffixed = basename(p.newPath) !== basename(p.oldPath)
  console.log(`  ${p.oldPath}  →  ${p.newPath}${suffixed ? '  [renamed — collision]' : ''}`)
}

if (noop.length > 0) {
  console.log(`\n=== ALREADY AT ROOT (${noop.length}) ===`)
  for (const p of noop) console.log(`  ${p}`)
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
    await api('/api/move-file', { oldPath: p.oldPath, newPath: p.newPath })
    console.log(`  ✓ ${p.oldPath}  →  ${p.newPath}`)
    ok++
  } catch (e) {
    console.log(`  ✗ ${p.oldPath} — ${e.message}`)
    fail++
  }
}
console.log(`\nDone. ${ok} moved, ${fail} failed.`)
