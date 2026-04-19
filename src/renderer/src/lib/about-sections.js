/**
 * Parse the About markdown into structured sections:
 *   {
 *     intro: string (raw markdown of the top paragraphs)
 *     experience: { heading, entries: [{ title, dates, lines:[], description }] }
 *     education:  { heading, entries: [{ title, dates, lines:[], description }] }
 *   }
 *
 * Each entry under ## Work Experience / ## Education is an `### Title`
 * followed either by a `- list` (Experience) or by a plain paragraph
 * (Education). The dates, when present, are detected as the last list
 * item containing a year number or the trailing year range in the
 * paragraph.
 */

const YEAR_RE = /\b(19|20)\d{2}\b/

function isDateLike(s) {
  return YEAR_RE.test(s)
}

function parseExperienceEntry(rawLines) {
  // rawLines start at the line AFTER `### Title`, up to (but not
  // including) the next ### or ##. They are either `- bullet` lines or
  // blank / paragraph text.
  const bullets = rawLines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^-\s+/, ''))

  let dates = ''
  const lines = [...bullets]
  if (lines.length && isDateLike(lines[lines.length - 1])) {
    dates = lines.pop()
  }
  return { lines, dates, description: '' }
}

function parseEducationEntry(rawLines) {
  // Education entries are paragraphs like:
  //   _Focus on European Luxury._ Istituto Marangoni, Paris, France. 2008 — 2009.
  const text = rawLines.join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return { lines: [], dates: '', description: '' }

  // Pull out a trailing "… 2005 — 2008." or "… 2008." as the date.
  const dateMatch = text.match(/((?:19|20)\d{2}(?:\s*[—–-]\s*(?:19|20)\d{2})?)\.?\s*$/)
  let body = text
  let dates = ''
  if (dateMatch) {
    dates = dateMatch[1].replace(/\s+/g, ' ')
    body = text.slice(0, dateMatch.index).trim().replace(/\.\s*$/, '')
  }

  // A leading italic _…_ becomes the short description; the rest is the institution.
  let description = ''
  const emMatch = body.match(/^_([^_]+)_\.?\s*/)
  if (emMatch) {
    description = emMatch[1].trim()
    body = body.slice(emMatch[0].length).trim().replace(/^,\s*/, '')
  }

  return {
    lines: body ? [body] : [],
    dates,
    description,
  }
}

function parseSection(heading, bodyLines, entryParser) {
  const entries = []
  let current = null
  for (const line of bodyLines) {
    const m = line.match(/^###\s+(.+)$/)
    if (m) {
      if (current) entries.push(current)
      current = { title: m[1].trim(), rawLines: [] }
    } else if (current) {
      current.rawLines.push(line)
    }
  }
  if (current) entries.push(current)
  return {
    heading,
    entries: entries.map((e) => ({
      title: e.title,
      ...entryParser(e.rawLines),
    })),
  }
}

export function parseAbout(body) {
  const result = { intro: '', experience: null, education: null }
  if (!body) return result

  const lines = body.split('\n')
  let current = { heading: null, lines: [] }
  const chunks = [current]
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/)
    if (m) {
      current = { heading: m[1].trim(), lines: [] }
      chunks.push(current)
    } else {
      current.lines.push(line)
    }
  }

  result.intro = chunks[0].lines.join('\n').trim()
  for (const c of chunks.slice(1)) {
    if (/experience/i.test(c.heading)) {
      result.experience = parseSection(c.heading, c.lines, parseExperienceEntry)
    } else if (/education/i.test(c.heading)) {
      result.education = parseSection(c.heading, c.lines, parseEducationEntry)
    }
  }
  return result
}

// Extract just the year span start/end from a "2023 — 2024" / "2023" string.
export function dateYears(dates) {
  if (!dates) return { start: null, end: null }
  const years = [...dates.matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]))
  if (!years.length) return { start: null, end: null }
  return { start: Math.min(...years), end: Math.max(...years) }
}
