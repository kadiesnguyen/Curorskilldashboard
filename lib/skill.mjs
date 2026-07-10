/** Parse / serialize Cursor SKILL.md files. */

export function parseSkill(raw) {
  const trimmed = raw.replace(/^\uFEFF/, '').trim()
  if (!trimmed.startsWith('---')) {
    return { name: '', description: '', body: trimmed }
  }

  const end = trimmed.indexOf('---', 3)
  if (end === -1) {
    return { name: '', description: '', body: trimmed }
  }

  const front = trimmed.slice(3, end).trim()
  const body = trimmed.slice(end + 3).trim()
  const meta = { name: '', description: '' }

  let inDescription = false
  const descLines = []

  for (const line of front.split('\n')) {
    if (inDescription) {
      if (/^\S/.test(line)) {
        inDescription = false
      } else {
        descLines.push(line.replace(/^\s+/, ''))
        continue
      }
    }

    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const [, key, value] = m
    if (key === 'name') meta.name = value.trim()
    if (key === 'description') {
      if (value.trim() === '>-' || value.trim() === '|' || value.trim() === '') {
        inDescription = true
      } else {
        meta.description = value.trim()
      }
    }
  }

  if (descLines.length) meta.description = descLines.join(' ').trim()

  return { ...meta, body }
}

export function serializeSkill({ name, description, body }) {
  const desc = (description || '').trim()
  const lines = ['---', `name: ${name}`]
  if (desc.includes('\n')) {
    lines.push('description: >-', ...desc.split('\n').map((l) => `  ${l}`))
  } else if (desc.length > 72) {
    lines.push('description: >-', `  ${desc}`)
  } else {
    lines.push(`description: ${desc}`)
  }
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}
