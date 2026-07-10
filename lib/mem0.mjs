/** Local mem0 via Qdrant REST (same store as mem0-local-mcp). */

const DEFAULTS = {
  host: process.env.MEM0_QDRANT_HOST || 'localhost',
  port: Number(process.env.MEM0_QDRANT_PORT || 6333),
  collection: process.env.MEM0_COLLECTION || 'mem0',
  userId: process.env.MEM0_USER_ID || 'default',
}

function baseUrl(cfg) {
  return `http://${cfg.host}:${cfg.port}`
}

async function qdrant(path, opts = {}, cfg = DEFAULTS) {
  const res = await fetch(`${baseUrl(cfg)}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data.status?.error || data.error || res.statusText
    throw new Error(msg)
  }
  return data
}

function memoryText(payload) {
  return payload?.data || payload?.text || payload?.memory || ''
}

export function getMem0Config(store) {
  const mem0 = store?.mem0 || {}
  return {
    host: mem0.qdrantHost || DEFAULTS.host,
    port: Number(mem0.qdrantPort || DEFAULTS.port),
    collection: mem0.collection || DEFAULTS.collection,
    userId: mem0.userId || DEFAULTS.userId,
  }
}

export async function checkMem0Connection(cfg) {
  await qdrant(`/collections/${cfg.collection}`, {}, cfg)
  return { ok: true, collection: cfg.collection }
}

export async function listMemories({ cfg, limit = 50, offset = null, query = '' }) {
  const body = {
    limit,
    with_payload: true,
    filter: {
      must: [{ key: 'user_id', match: { value: cfg.userId } }],
    },
  }
  if (offset) body.offset = offset

  const data = await qdrant(`/collections/${cfg.collection}/points/scroll`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, cfg)

  let points = (data.result?.points || []).map((p) => ({
    id: String(p.id),
    text: memoryText(p.payload),
    payload: p.payload,
    createdAt: p.payload?.created_at || null,
  }))

  const q = query.trim().toLowerCase()
  if (q) {
    points = points.filter((m) => m.text.toLowerCase().includes(q))
  }

  return {
    memories: points,
    nextOffset: data.result?.next_page_offset || null,
    total: data.result?.points?.length || 0,
  }
}

export async function deleteMemory(id, cfg) {
  await qdrant(`/collections/${cfg.collection}/points/delete`, {
    method: 'POST',
    body: JSON.stringify({ points: [id] }),
  }, cfg)
  return { deleted: id }
}

export async function addMemory(text, cfg, metadata = {}) {
  const { spawnSync } = await import('node:child_process')
  const script = new URL('../scripts/mem0_add.py', import.meta.url).pathname
  const payload = JSON.stringify({ text, userId: cfg.userId, metadata })
  const result = spawnSync('python3', [script, payload], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MEM0_QDRANT_HOST: cfg.host,
      MEM0_QDRANT_PORT: String(cfg.port),
      MEM0_COLLECTION: cfg.collection,
    },
  })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'mem0_add failed')
  }
  return JSON.parse(result.stdout || '{}')
}
