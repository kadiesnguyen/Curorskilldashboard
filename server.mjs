import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addProject,
  addSkillRoot,
  deleteRule,
  deleteSkill,
  loadStore,
  saveStore,
  scanProjects,
  scanSkills,
  upsertRule,
  upsertSkill,
} from './lib/store.mjs'
import { removeRuleFromDisk, syncAll, syncRule } from './lib/sync.mjs'
import { removeSkillFromDisk, syncAllSkills, syncSkill } from './lib/skill-sync.mjs'
import { getPreset, PRESETS } from './lib/presets.mjs'
import {
  addMemory,
  checkMem0Connection,
  deleteMemory,
  getMem0Config,
  listMemories,
} from './lib/mem0.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, 'public')
const PORT = Number(process.env.CUROR_SKILL_DASHBOARD_PORT || process.env.RULE_PORTAL_PORT || 3847)

function send(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function serveStatic(req, res) {
  let urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  const file = path.join(PUBLIC_DIR, urlPath)
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found')
    return
  }
  const ext = path.extname(file)
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
  res.writeHead(200, { 'Content-Type': `${types[ext] || 'text/plain'}; charset=utf-8` })
  fs.createReadStream(file).pipe(res)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const { pathname } = url

  try {
    if (pathname === '/api/store' && req.method === 'GET') {
      return send(res, 200, loadStore())
    }

    if (pathname === '/api/projects/scan' && req.method === 'POST') {
      const store = loadStore()
      scanProjects(store)
      saveStore(store)
      return send(res, 200, store)
    }

    if (pathname === '/api/projects' && req.method === 'POST') {
      const body = await readBody(req)
      const store = loadStore()
      addProject(store, body.path)
      saveStore(store)
      return send(res, 200, store)
    }

    if (pathname === '/api/rules' && req.method === 'POST') {
      const body = await readBody(req)
      const store = loadStore()
      const rule = upsertRule(store, body)
      saveStore(store)
      return send(res, 201, { store, rule })
    }

    const ruleMatch = pathname.match(/^\/api\/rules\/([^/]+)$/)
    if (ruleMatch) {
      const ruleId = decodeURIComponent(ruleMatch[1])
      const store = loadStore()

      if (req.method === 'PUT') {
        const body = await readBody(req)
        const rule = upsertRule(store, { ...body, id: ruleId })
        saveStore(store)
        return send(res, 200, { store, rule })
      }

      if (req.method === 'DELETE') {
        const removed = deleteRule(store, ruleId)
        if (!removed) return send(res, 404, { error: 'Rule not found' })
        const paths = removeRuleFromDisk(removed, store.projects)
        saveStore(store)
        return send(res, 200, { store, removed, paths })
      }
    }

    if (pathname === '/api/sync' && req.method === 'POST') {
      const store = loadStore()
      const enabledProjects = store.projects.filter((p) => p.enabled !== false)
      const enabledRoots = (store.skillRoots || []).filter((r) => r.enabled !== false)
      const ruleResults = syncAll(store.rules, enabledProjects)
      const skillResults = syncAllSkills(store.skills || [], enabledProjects, enabledRoots)
      return send(res, 200, {
        results: ruleResults,
        skillResults,
        syncedAt: new Date().toISOString(),
      })
    }

    const syncOne = pathname.match(/^\/api\/sync\/([^/]+)$/)
    if (syncOne && req.method === 'POST') {
      const ruleId = decodeURIComponent(syncOne[1])
      const store = loadStore()
      const rule = store.rules.find((r) => r.id === ruleId)
      if (!rule) return send(res, 404, { error: 'Rule not found' })
      const results = syncRule(rule, store.projects.filter((p) => p.enabled !== false))
      return send(res, 200, { results, syncedAt: new Date().toISOString() })
    }

    if (pathname === '/api/presets' && req.method === 'GET') {
      return send(res, 200, {
        presets: PRESETS.map((p) => ({
          id: p.id,
          name: p.name,
          icon: p.icon,
          summary: p.summary,
          suggestedProjects: p.suggestedProjects,
          rule: p.rule,
        })),
      })
    }

    const presetGet = pathname.match(/^\/api\/presets\/([^/]+)$/)
    if (presetGet && req.method === 'GET') {
      const preset = getPreset(decodeURIComponent(presetGet[1]))
      if (!preset) return send(res, 404, { error: 'Preset not found' })
      return send(res, 200, preset)
    }

    const presetInstall = pathname.match(/^\/api\/presets\/([^/]+)\/install$/)
    if (presetInstall && req.method === 'POST') {
      const presetId = decodeURIComponent(presetInstall[1])
      const preset = getPreset(presetId)
      if (!preset) return send(res, 404, { error: 'Preset not found' })
      const body = await readBody(req)
      const store = loadStore()
      const rule = upsertRule(store, {
        ...preset.rule,
        assignments: {
          global: Boolean(body.global),
          projectIds: Array.isArray(body.projectIds) ? body.projectIds : [],
        },
      })
      saveStore(store)
      let syncResults = null
      if (body.sync !== false) {
        syncResults = syncRule(rule, store.projects.filter((p) => p.enabled !== false))
      }
      return send(res, 201, { store, rule, syncResults })
    }

    if (pathname === '/api/settings' && req.method === 'PUT') {
      const body = await readBody(req)
      const store = loadStore()
      if (Array.isArray(body.projectRoots)) store.projectRoots = body.projectRoots
      if (Array.isArray(body.skillRoots)) {
        store.skillRoots = body.skillRoots
          .map((p) => (typeof p === 'string' ? p : p.path))
          .filter(Boolean)
      }
      if (body.mem0 && typeof body.mem0 === 'object') {
        store.mem0 = { ...store.mem0, ...body.mem0 }
      }
      saveStore(store)
      return send(res, 200, store)
    }

    if (pathname === '/api/mem0/status' && req.method === 'GET') {
      const store = loadStore()
      const cfg = getMem0Config(store)
      const status = await checkMem0Connection(cfg)
      return send(res, 200, { ...status, config: cfg })
    }

    if (pathname === '/api/memories' && req.method === 'GET') {
      const store = loadStore()
      const cfg = getMem0Config(store)
      const limit = Number(url.searchParams.get('limit') || 50)
      const query = url.searchParams.get('q') || ''
      const offset = url.searchParams.get('offset') || null
      const data = await listMemories({ cfg, limit, query, offset })
      return send(res, 200, data)
    }

    if (pathname === '/api/memories' && req.method === 'POST') {
      const body = await readBody(req)
      const store = loadStore()
      const cfg = getMem0Config(store)
      const text = (body.text || '').trim()
      if (!text) return send(res, 400, { error: 'text required' })
      const created = await addMemory(text, cfg, body.metadata || {})
      return send(res, 201, created)
    }

    const memoryMatch = pathname.match(/^\/api\/memories\/([^/]+)$/)
    if (memoryMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(memoryMatch[1])
      const store = loadStore()
      const cfg = getMem0Config(store)
      await deleteMemory(id, cfg)
      return send(res, 200, { deleted: id })
    }

    if (pathname === '/api/skills/scan' && req.method === 'POST') {
      const store = loadStore()
      const { store: updated, imported } = scanSkills(store)
      saveStore(updated)
      return send(res, 200, { store: updated, imported })
    }

    if (pathname === '/api/skill-roots' && req.method === 'POST') {
      const body = await readBody(req)
      const store = loadStore()
      addSkillRoot(store, body.path)
      saveStore(store)
      return send(res, 200, store)
    }

    if (pathname === '/api/skills' && req.method === 'POST') {
      const body = await readBody(req)
      const store = loadStore()
      const skill = upsertSkill(store, body)
      saveStore(store)
      return send(res, 201, { store, skill })
    }

    const skillMatch = pathname.match(/^\/api\/skills\/([^/]+)$/)
    if (skillMatch) {
      const skillId = decodeURIComponent(skillMatch[1])
      const store = loadStore()

      if (req.method === 'PUT') {
        const body = await readBody(req)
        const skill = upsertSkill(store, { ...body, id: skillId })
        saveStore(store)
        return send(res, 200, { store, skill })
      }

      if (req.method === 'DELETE') {
        const removed = deleteSkill(store, skillId)
        if (!removed) return send(res, 404, { error: 'Skill not found' })
        const paths = removeSkillFromDisk(
          removed,
          store.projects,
          store.skillRoots || [],
        )
        saveStore(store)
        return send(res, 200, { store, removed, paths })
      }
    }

    const syncSkillOne = pathname.match(/^\/api\/sync-skills\/([^/]+)$/)
    if (syncSkillOne && req.method === 'POST') {
      const skillId = decodeURIComponent(syncSkillOne[1])
      const store = loadStore()
      const skill = (store.skills || []).find((s) => s.id === skillId)
      if (!skill) return send(res, 404, { error: 'Skill not found' })
      const results = syncSkill(
        skill,
        store.projects.filter((p) => p.enabled !== false),
        (store.skillRoots || []).filter((r) => r.enabled !== false),
      )
      return send(res, 200, { results, syncedAt: new Date().toISOString() })
    }

    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      return serveStatic(req, res)
    }

    send(res, 404, { error: 'Not found' })
  } catch (err) {
    send(res, 500, { error: err.message || String(err) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  loadStore()
  console.log(`CurorSkillDashboard → http://127.0.0.1:${PORT}`)
})
