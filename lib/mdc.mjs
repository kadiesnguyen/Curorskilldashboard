/** Parse / serialize Cursor .mdc rule files. */

export function parseMdc(raw) {
  const trimmed = raw.replace(/^\uFEFF/, '').trim()
  if (!trimmed.startsWith('---')) {
    return { description: '', alwaysApply: false, globs: null, body: trimmed }
  }

  const end = trimmed.indexOf('---', 3)
  if (end === -1) {
    return { description: '', alwaysApply: false, globs: null, body: trimmed }
  }

  const front = trimmed.slice(3, end).trim()
  const body = trimmed.slice(end + 3).trim()
  const meta = { description: '', alwaysApply: false, globs: null }

  for (const line of front.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const [, key, value] = m
    if (key === 'description') meta.description = value.trim()
    if (key === 'alwaysApply') meta.alwaysApply = value.trim() === 'true'
    if (key === 'globs') meta.globs = value.trim() || null
  }

  return { ...meta, body }
}

export function serializeMdc({ description, alwaysApply, globs, body }) {
  const lines = ['---']
  if (description) lines.push(`description: ${description}`)
  lines.push(`alwaysApply: ${alwaysApply ? 'true' : 'false'}`)
  if (globs) lines.push(`globs: ${globs}`)
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}
