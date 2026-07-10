import fs from 'node:fs'
import path from 'node:path'
import { serializeMdc } from './mdc.mjs'

const GLOBAL_RULES_DIR = path.join(process.env.HOME || '', '.cursor', 'rules')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeRule(filePath, rule) {
  ensureDir(path.dirname(filePath))
  const content = serializeMdc({
    description: rule.description,
    alwaysApply: rule.alwaysApply,
    globs: rule.globs,
    body: rule.body,
  })
  fs.writeFileSync(filePath, content, 'utf8')
}

function removeIfPortalManaged(filePath, ruleId) {
  if (!fs.existsSync(filePath)) return false
  const raw = fs.readFileSync(filePath, 'utf8')
  if (!raw.includes(`rule-portal-id: ${ruleId}`)) return false
  fs.unlinkSync(filePath)
  return true
}

export function syncRule(rule, projects) {
  const results = []
  const filename = rule.filename || `${rule.id}.mdc`
  const marker = `<!-- rule-portal-id: ${rule.id} -->`
  const body = rule.body.includes(marker) ? rule.body : `${rule.body.trim()}\n\n${marker}\n`
  const payload = { ...rule, body }

  const assignedIds = new Set(rule.assignments?.projectIds || [])
  const global = Boolean(rule.assignments?.global)

  if (global) {
    const target = path.join(GLOBAL_RULES_DIR, filename)
    writeRule(target, payload)
    results.push({ scope: 'global', path: target, action: 'written' })
  } else {
    const globalTarget = path.join(GLOBAL_RULES_DIR, filename)
    if (removeIfPortalManaged(globalTarget, rule.id)) {
      results.push({ scope: 'global', path: globalTarget, action: 'removed' })
    }
  }

  for (const project of projects) {
    const shouldHave = assignedIds.has(project.id)
    const target = path.join(project.path, '.cursor', 'rules', filename)

    if (shouldHave) {
      writeRule(target, payload)
      results.push({ scope: 'project', project: project.name, path: target, action: 'written' })
    } else if (removeIfPortalManaged(target, rule.id)) {
      results.push({ scope: 'project', project: project.name, path: target, action: 'removed' })
    }
  }

  return results
}

export function syncAll(rules, projects) {
  const all = []
  for (const rule of rules) {
    all.push({ ruleId: rule.id, results: syncRule(rule, projects) })
  }
  return all
}

export function removeRuleFromDisk(rule, projects) {
  const filename = rule.filename || `${rule.id}.mdc`
  const removed = []
  const globalTarget = path.join(GLOBAL_RULES_DIR, filename)
  if (removeIfPortalManaged(globalTarget, rule.id)) {
    removed.push(globalTarget)
  }
  for (const project of projects) {
    const target = path.join(project.path, '.cursor', 'rules', filename)
    if (removeIfPortalManaged(target, rule.id)) {
      removed.push(target)
    }
  }
  return removed
}
