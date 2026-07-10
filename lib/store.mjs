import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { parseMdc } from './mdc.mjs'
import { parseSkill } from './skill.mjs'
import { mergeProjects, scanProjectRoots, slugFromPath } from './projects.mjs'

const DATA_DIR = path.join(import.meta.dirname, '..', 'data')
const STORE_PATH = path.join(DATA_DIR, 'store.json')
const GLOBAL_RULES_DIR = path.join(process.env.HOME || '', '.cursor', 'rules')
const HOME = process.env.HOME || ''

const DEFAULT_SKILL_ROOTS = [
  path.join(HOME, '.cursor', 'skills'),
  path.join(HOME, '.cursor', 'skills-cursor'),
  path.join(HOME, '.agents', 'skills'),
]

const DEFAULT_MEM0 = {
  userId: process.env.MEM0_USER_ID || 'default',
  qdrantHost: process.env.MEM0_QDRANT_HOST || 'localhost',
  qdrantPort: Number(process.env.MEM0_QDRANT_PORT || 6333),
  collection: process.env.MEM0_COLLECTION || 'mem0',
}

const DEFAULT_STORE = {
  version: 1,
  projectRoots: [path.join(HOME, 'Documents', 'GitHub')],
  skillRoots: DEFAULT_SKILL_ROOTS,
  mem0: DEFAULT_MEM0,
  projects: [],
  rules: [],
  skills: [],
}

const STORE_EXAMPLE = path.join(DATA_DIR, 'store.example.json')

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function bootstrapStore() {
  if (fs.existsSync(STORE_EXAMPLE)) {
    return JSON.parse(fs.readFileSync(STORE_EXAMPLE, 'utf8'))
  }
  return structuredClone(DEFAULT_STORE)
}

export function loadStore() {
  ensureDataDir()
  if (!fs.existsSync(STORE_PATH)) {
    const seeded = seedFromDisk(bootstrapStore())
    saveStore(seeded)
    return seeded
  }
  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
  if (!Array.isArray(store.skills)) store.skills = []
  if (!store.mem0) store.mem0 = { ...DEFAULT_MEM0 }
  normalizeSkillRoots(store)
  if (store.skills.length === 0) {
    scanSkills(store)
    saveStore(store)
  }
  return store
}

export function saveStore(store) {
  ensureDataDir()
  store.version = 1
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
  return store
}

function normalizeSkillRoots(store) {
  if (!Array.isArray(store.skillRoots)) {
    store.skillRoots = DEFAULT_SKILL_ROOTS
    return store
  }
  if (store.skillRoots.length === 0) {
    store.skillRoots = DEFAULT_SKILL_ROOTS
    return store
  }
  if (typeof store.skillRoots[0] === 'string') {
    store.skillRoots = store.skillRoots.map((p) => skillRootEntry(p))
  }
  return store
}

function skillRootEntry(rootPath) {
  const resolved = path.resolve(rootPath.replace(/^~/, HOME))
  return {
    id: slugFromPath(resolved),
    name: path.basename(resolved),
    path: resolved,
    enabled: true,
  }
}

function discoverSkillsInRoot(rootPath) {
  const resolved = path.resolve(rootPath.replace(/^~/, HOME))
  if (!fs.existsSync(resolved)) return []

  const found = []
  let entries = []
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillFile = path.join(resolved, entry.name, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue
    const raw = fs.readFileSync(skillFile, 'utf8')
    const parsed = parseSkill(raw)
    const id = parsed.name || entry.name
    found.push({
      id,
      name: parsed.name || entry.name,
      description: parsed.description,
      body: parsed.body.replace(/\n\n<!-- skill-portal-id:.*-->\n?$/s, '').trim(),
      sourcePath: skillFile,
      sourceRoot: resolved,
      updatedAt: new Date().toISOString(),
    })
  }

  return found
}

function seedFromDisk(store) {
  store.projects = mergeProjects(store.projects, scanProjectRoots(store.projectRoots))
  normalizeSkillRoots(store)

  if (store.rules.length === 0 && fs.existsSync(GLOBAL_RULES_DIR)) {
    for (const file of fs.readdirSync(GLOBAL_RULES_DIR)) {
      if (!file.endsWith('.mdc')) continue
      const full = path.join(GLOBAL_RULES_DIR, file)
      const raw = fs.readFileSync(full, 'utf8')
      const parsed = parseMdc(raw)
      const id = file.replace(/\.mdc$/, '')
      store.rules.push({
        id,
        filename: file,
        description: parsed.description,
        alwaysApply: parsed.alwaysApply,
        globs: parsed.globs,
        body: parsed.body,
        assignments: { global: true, projectIds: [] },
        updatedAt: new Date().toISOString(),
      })
    }
  }

  if (store.skills.length === 0) {
    const seen = new Set()
    for (const root of store.skillRoots.filter((r) => r.enabled !== false)) {
      for (const skill of discoverSkillsInRoot(root.path)) {
        if (seen.has(skill.id)) continue
        seen.add(skill.id)
        const rootEntry = store.skillRoots.find((r) => r.path === skill.sourceRoot)
        store.skills.push({
          ...skill,
          assignments: {
            global: skill.sourceRoot === path.join(HOME, '.cursor', 'skills'),
            projectIds: [],
            skillRootIds: rootEntry ? [rootEntry.id] : [],
          },
        })
      }
    }
    store.skills.sort((a, b) => a.id.localeCompare(b.id))
  }

  return store
}

export function scanProjects(store) {
  store.projects = mergeProjects(store.projects, scanProjectRoots(store.projectRoots))
  return store
}

export function addProject(store, projectPath) {
  const resolved = path.resolve(projectPath.replace(/^~/, process.env.HOME || ''))
  if (!fs.existsSync(resolved)) throw new Error(`Path not found: ${resolved}`)
  const entry = {
    id: slugFromPath(resolved),
    name: path.basename(resolved),
    path: resolved,
    enabled: true,
  }
  if (!store.projects.some((p) => p.path === entry.path)) {
    store.projects.push(entry)
    store.projects.sort((a, b) => a.name.localeCompare(b.name))
  }
  return store
}

export function upsertRule(store, input) {
  const now = new Date().toISOString()
  const id = input.id || slugFromPath(input.filename?.replace(/\.mdc$/, '') || randomUUID())
  const filename = input.filename || `${id}.mdc`
  const existing = store.rules.find((r) => r.id === id)
  const rule = {
    id,
    filename,
    description: input.description ?? existing?.description ?? '',
    alwaysApply: Boolean(input.alwaysApply ?? existing?.alwaysApply),
    globs: input.globs ?? existing?.globs ?? null,
    body: input.body ?? existing?.body ?? '',
    assignments: input.assignments ?? existing?.assignments ?? { global: false, projectIds: [] },
    updatedAt: now,
  }
  if (existing) {
    Object.assign(existing, rule)
  } else {
    store.rules.push(rule)
  }
  store.rules.sort((a, b) => a.id.localeCompare(b.id))
  return rule
}

export function deleteRule(store, ruleId) {
  const idx = store.rules.findIndex((r) => r.id === ruleId)
  if (idx === -1) return null
  const [removed] = store.rules.splice(idx, 1)
  return removed
}

export function addSkillRoot(store, rootPath) {
  normalizeSkillRoots(store)
  const entry = skillRootEntry(rootPath)
  if (!fs.existsSync(entry.path)) throw new Error(`Path not found: ${entry.path}`)
  if (!store.skillRoots.some((r) => r.path === entry.path)) {
    store.skillRoots.push(entry)
    store.skillRoots.sort((a, b) => a.name.localeCompare(b.name))
  }
  return store
}

export function scanSkills(store) {
  normalizeSkillRoots(store)
  const existing = new Set(store.skills.map((s) => s.id))
  let imported = 0

  for (const root of store.skillRoots.filter((r) => r.enabled !== false)) {
    for (const skill of discoverSkillsInRoot(root.path)) {
      if (existing.has(skill.id)) continue
      existing.add(skill.id)
      store.skills.push({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        body: skill.body,
        assignments: {
          global: root.path === path.join(HOME, '.cursor', 'skills'),
          projectIds: [],
          skillRootIds: [root.id],
        },
        updatedAt: skill.updatedAt,
      })
      imported += 1
    }
  }

  store.skills.sort((a, b) => a.id.localeCompare(b.id))
  return { store, imported }
}

export function upsertSkill(store, input) {
  const now = new Date().toISOString()
  const id = input.id || slugFromPath(input.name || randomUUID())
  const existing = store.skills.find((s) => s.id === id)
  const skill = {
    id,
    name: input.name ?? existing?.name ?? id,
    description: input.description ?? existing?.description ?? '',
    body: input.body ?? existing?.body ?? '',
    assignments: input.assignments ?? existing?.assignments ?? {
      global: false,
      projectIds: [],
      skillRootIds: [],
    },
    updatedAt: now,
  }
  if (existing) {
    Object.assign(existing, skill)
  } else {
    store.skills.push(skill)
  }
  store.skills.sort((a, b) => a.id.localeCompare(b.id))
  return skill
}

export function deleteSkill(store, skillId) {
  const idx = store.skills.findIndex((s) => s.id === skillId)
  if (idx === -1) return null
  const [removed] = store.skills.splice(idx, 1)
  return removed
}
