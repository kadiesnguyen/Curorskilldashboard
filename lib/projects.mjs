import fs from 'node:fs'
import path from 'node:path'

export function slugFromPath(projectPath) {
  return path.basename(projectPath).replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
}

export function scanProjectRoots(roots) {
  const found = new Map()

  for (const root of roots) {
    const expanded = root.replace(/^~/, process.env.HOME || '')
    if (!fs.existsSync(expanded)) continue

    let entries = []
    try {
      entries = fs.readdirSync(expanded, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = path.join(expanded, entry.name)
      if (!fs.existsSync(path.join(full, '.git'))) continue
      const id = slugFromPath(full)
      found.set(id, {
        id,
        name: entry.name,
        path: full,
        enabled: true,
      })
    }
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function mergeProjects(existing, scanned) {
  const byPath = new Map(existing.map((p) => [p.path, p]))
  for (const p of scanned) {
    if (!byPath.has(p.path)) byPath.set(p.path, p)
  }
  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name))
}
