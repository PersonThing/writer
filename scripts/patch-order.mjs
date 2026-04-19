#!/usr/bin/env node
/**
 * Reads /tmp/order-audit.json (or scripts/crawl/order.json if you run
 * audit-order.mjs again) and writes an `order: NN` field into each piece's
 * frontmatter so CategoryPage can sort by it.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const AUDIT = process.argv[2] || '/tmp/order-audit.json'
const CONTENT = path.join(ROOT, 'content/portfolio')

const audit = JSON.parse(await readFile(AUDIT, 'utf-8'))

for (const [cat, items] of Object.entries(audit.categories)) {
  // cat is "/creative-direction" etc
  const category = cat.replace(/^\//, '')
  items.forEach(async ({ slug }, i) => {
    // Normalize wix slug (some have URL-encoded colons, like azzedine-alaia%3A-)
    const decoded = decodeURIComponent(slug)
    // Wix slug:  azzedine-alaia:-master-and-maverick
    // Our slug:  azzedine-alaia--master-and-maverick   (colon replaced with extra -)
    const localSlug = decoded
      .replace(/:/g, '-')
      .replace(/-{3,}/g, '---') // keep triple-dashes as-is where present
    const file = path.join(CONTENT, category, `${localSlug}.md`)
    let src
    try {
      src = await readFile(file, 'utf-8')
    } catch {
      console.log('miss:', file)
      return
    }
    const order = i + 1
    if (src.includes(`\norder: `)) {
      const updated = src.replace(/\norder:\s*\d+/, `\norder: ${order}`)
      await writeFile(file, updated)
    } else {
      // Insert after "title:" line
      const updated = src.replace(/^(title:.*)$/m, `$1\norder: ${order}`)
      await writeFile(file, updated)
    }
    console.log(`${category}/${localSlug} → order=${order}`)
  })
}
