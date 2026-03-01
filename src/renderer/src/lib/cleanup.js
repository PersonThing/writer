/**
 * Formatting cleanup engine for files imported from Word or other sources.
 * Each rule is a pure function: text → text.
 */

export const CLEANUP_RULES = [
  {
    id: 'fixLineEndings',
    label: 'Fix Windows line endings',
    apply: (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
  },
  {
    id: 'normalizeHR',
    label: 'Normalize section breaks to ---',
    apply: normalizeHR,
  },
  {
    id: 'collapseBlankLines',
    label: 'Collapse excessive blank lines',
    apply: (text) => text.replace(/\n{4,}/g, '\n\n\n'),
  },
  {
    id: 'trimWhitespace',
    label: 'Remove trailing whitespace',
    apply: (text) => text.replace(/[ \t]+$/gm, ''),
  },
];

/**
 * Detect lines that are only made up of dashes, asterisks, underscores,
 * slashes, and whitespace (like -/-/-/-/-/ from Word) and replace with ---.
 */
function normalizeHR(text) {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return line;
    // Only dashes, asterisks, underscores, slashes, backslashes, and whitespace
    if (!/^[-*_\/\\\s]+$/.test(trimmed)) return line;
    // Must contain at least 2 separator characters (-, *, _)
    const sepCount = (trimmed.match(/[-*_]/g) || []).length;
    if (sepCount >= 2) return '---';
    return line;
  }).join('\n');
}

/**
 * Apply selected cleanup rules to text.
 * @param {string} text - The text to clean up
 * @param {Object} enabledRules - Map of rule id → boolean
 * @returns {string} Cleaned text
 */
export function applyCleanup(text, enabledRules) {
  let result = text;
  for (const rule of CLEANUP_RULES) {
    if (enabledRules[rule.id]) {
      result = rule.apply(result);
    }
  }
  return result;
}

/**
 * Simple line-based diff for cleanup preview.
 * Returns array of { type: 'same' | 'changed', original, cleaned, lineNum }
 */
export function computeDiff(original, cleaned) {
  const origLines = original.split('\n');
  const cleanLines = cleaned.split('\n');
  const maxLen = Math.max(origLines.length, cleanLines.length);
  const diff = [];

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i] ?? '';
    const clean = cleanLines[i] ?? '';
    diff.push({
      type: orig === clean ? 'same' : 'changed',
      original: orig,
      cleaned: clean,
      lineNum: i + 1,
    });
  }

  return diff;
}
