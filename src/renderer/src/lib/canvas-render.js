const SIZE = 1080
let cachedImg = null
let cachedSrc = null

export function preloadImage(imageDataUrl) {
  if (imageDataUrl === cachedSrc && cachedImg) return Promise.resolve(cachedImg)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      cachedImg = img
      cachedSrc = imageDataUrl
      resolve(img)
    }
    img.onerror = reject
    img.src = imageDataUrl
  })
}

/**
 * Parse markdown text into styled spans.
 * Each span: { text, bold, italic }
 * Returns an array of lines, where each line is an array of spans.
 */
function parseStyledText(text) {
  const rawLines = text.split('\n')
  const result = []

  for (const rawLine of rawLines) {
    // Strip heading markers
    const line = rawLine.replace(/^#{1,3}\s+/, '')

    if (!line.trim()) {
      result.push([{ text: '', bold: false, italic: false }])
      continue
    }

    // Handle trailing backslash as line break (just strip it)
    const cleanLine = line.replace(/\\$/, '').trimEnd()

    // Parse inline bold/italic markers
    const spans = []
    // Regex to match **bold**, *italic*, or plain text
    const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g
    let match
    while ((match = pattern.exec(cleanLine)) !== null) {
      if (match[1] !== undefined) {
        spans.push({ text: match[1], bold: true, italic: false })
      } else if (match[2] !== undefined) {
        spans.push({ text: match[2], bold: false, italic: true })
      } else if (match[3] !== undefined) {
        spans.push({ text: match[3], bold: false, italic: false })
      }
    }
    if (spans.length === 0) {
      spans.push({ text: cleanLine, bold: false, italic: false })
    }
    result.push(spans)
  }

  return result
}

export function renderCompositeSync(canvas, overlay) {
  if (!cachedImg) return null

  const dpr = window.devicePixelRatio || 1
  const renderSize = SIZE * dpr
  const ctx = canvas.getContext('2d')

  // Scale canvas backing store for crisp rendering
  if (canvas.width !== renderSize || canvas.height !== renderSize) {
    canvas.width = renderSize
    canvas.height = renderSize
  }

  ctx.save()
  ctx.scale(dpr, dpr)

  // Draw background image (cover-fit)
  const img = cachedImg
  const scale = Math.max(SIZE / img.width, SIZE / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)

  // Draw text overlay
  const {
    text,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    fontColor,
    fontOpacity,
    textX,
    textY,
    textAlign,
    textShadow,
  } = overlay

  if (!text) {
    ctx.restore()
    return canvas.toDataURL('image/jpeg', 0.95)
  }

  ctx.globalAlpha = fontOpacity
  ctx.fillStyle = fontColor
  ctx.textAlign = textAlign
  ctx.textBaseline = 'middle'

  if (textShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
  }

  const x = (textX / 100) * SIZE
  const y = (textY / 100) * SIZE
  const maxWidth = SIZE * 0.85
  const lineHeight = fontSize * 1.4

  const styledLines = parseStyledText(text)
  drawStyledText(
    ctx,
    styledLines,
    x,
    y,
    maxWidth,
    lineHeight,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
  )

  ctx.restore()

  return canvas.toDataURL('image/jpeg', 0.95)
}

/**
 * Render composite at exactly 1080x1080 for export (no DPR scaling).
 */
export function renderExportDataUrl(overlay) {
  if (!cachedImg) return null
  const offscreen = document.createElement('canvas')
  offscreen.width = SIZE
  offscreen.height = SIZE
  const ctx = offscreen.getContext('2d')

  // Draw background image (cover-fit)
  const img = cachedImg
  const scale = Math.max(SIZE / img.width, SIZE / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)

  const {
    text,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    fontColor,
    fontOpacity,
    textX,
    textY,
    textAlign,
    textShadow,
  } = overlay

  if (text) {
    ctx.globalAlpha = fontOpacity
    ctx.fillStyle = fontColor
    ctx.textAlign = textAlign
    ctx.textBaseline = 'middle'

    if (textShadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
    }

    const x = (textX / 100) * SIZE
    const y = (textY / 100) * SIZE
    const maxWidth = SIZE * 0.85
    const lineHeight = fontSize * 1.4
    const styledLines = parseStyledText(text)
    drawStyledText(
      ctx,
      styledLines,
      x,
      y,
      maxWidth,
      lineHeight,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
    )
  }

  return offscreen.toDataURL('image/jpeg', 0.95)
}

function buildFont(family, size, bold, italic, baseBold, baseItalic) {
  const weight = bold || baseBold === 'bold' ? 'bold' : 'normal'
  const style = italic || baseItalic === 'italic' ? 'italic' : 'normal'
  return `${style} ${weight} ${size}px "${family}"`
}

function drawStyledText(
  ctx,
  styledLines,
  x,
  y,
  maxWidth,
  lineHeight,
  fontFamily,
  fontSize,
  baseFontWeight,
  baseFontStyle,
) {
  // First pass: word-wrap all lines and compute total height
  const wrappedLines = []

  for (const spans of styledLines) {
    if (spans.length === 1 && spans[0].text === '') {
      wrappedLines.push([]) // Empty line (paragraph break)
      continue
    }

    // Break spans into words while preserving style info
    const words = []
    for (const span of spans) {
      const parts = span.text.split(/( +)/)
      for (const part of parts) {
        if (part) {
          words.push({ text: part, bold: span.bold, italic: span.italic })
        }
      }
    }

    // Word-wrap
    let currentLine = []
    let currentWidth = 0

    for (const word of words) {
      const font = buildFont(
        fontFamily,
        fontSize,
        word.bold,
        word.italic,
        baseFontWeight,
        baseFontStyle,
      )
      ctx.font = font
      const wordWidth = ctx.measureText(word.text).width

      if (
        currentWidth + wordWidth > maxWidth &&
        currentLine.length > 0 &&
        word.text.trim()
      ) {
        wrappedLines.push(currentLine)
        currentLine = []
        currentWidth = 0
        // Skip leading whitespace on new line
        if (!word.text.trim()) continue
      }
      currentLine.push(word)
      currentWidth += wordWidth
    }
    if (currentLine.length > 0) {
      wrappedLines.push(currentLine)
    }
  }

  const totalHeight = wrappedLines.length * lineHeight
  let startY = y - totalHeight / 2

  for (const line of wrappedLines) {
    if (line.length === 0) {
      // Empty paragraph break
      startY += lineHeight
      continue
    }

    // Compute total line width for alignment offset
    let lineWidth = 0
    for (const word of line) {
      const font = buildFont(
        fontFamily,
        fontSize,
        word.bold,
        word.italic,
        baseFontWeight,
        baseFontStyle,
      )
      ctx.font = font
      lineWidth += ctx.measureText(word.text).width
    }

    // Determine starting X based on textAlign
    let drawX
    const align = ctx.textAlign
    if (align === 'center') {
      drawX = x - lineWidth / 2
    } else if (align === 'right') {
      drawX = x - lineWidth
    } else {
      drawX = x
    }

    // Draw each word with its own style
    const drawY = startY + lineHeight / 2
    // Temporarily set textAlign to left for per-word drawing
    ctx.textAlign = 'left'
    for (const word of line) {
      const font = buildFont(
        fontFamily,
        fontSize,
        word.bold,
        word.italic,
        baseFontWeight,
        baseFontStyle,
      )
      ctx.font = font
      ctx.fillText(word.text, drawX, drawY)
      drawX += ctx.measureText(word.text).width
    }
    // Restore alignment
    ctx.textAlign = align

    startY += lineHeight
  }
}
