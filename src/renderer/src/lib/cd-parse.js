/**
 * Parse a creative-direction piece's markdown body into a brief (short
 * direction-note paragraphs) plus an ordered list of images. Each
 * creative-direction piece follows the shape:
 *
 *   <direction-note paragraph>
 *   <direction-note paragraph>
 *   ...
 *   ![](/path/to/image1.jpg)
 *   ![](/path/to/image2.jpg)
 *   ...
 *
 * Some pieces omit brief text entirely; some mix a ## Heading. This
 * helper is deliberately simple — it scans for image lines and lumps
 * everything else into `briefNotes[]` as plain text strings.
 */
export function parseCreativeDirection(body) {
  const notes = []
  const images = []
  if (!body) return { notes, images }

  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (img) {
      images.push({ alt: img[1], src: img[2] })
      continue
    }
    if (line.startsWith('#')) continue
    notes.push(line)
  }
  return { notes, images }
}
