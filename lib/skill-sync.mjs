import fs from 'node:fs'
import path from 'node:path'
import { serializeSkill } from './skill.mjs'

const GLOBAL_SKILLS_DIR = path.join(process.env.HOME || '', '.cursor', 'skills')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeSkill(filePath, skill) {
  ensureDir(path.dirname(filePath))
  const content = serializeSkill({
    name: skill.name || skill.id,
    description: skill.description,
    body: skill.body,
  })
  fs.writeFileSync(filePath, content, 'utf8')
}

function removeIfPortalManaged(filePath, skillId) {
  if (!fs.existsSync(filePath)) return false
  const raw = fs.readFileSync(filePath, 'utf8')
  if (!raw.includes(`skill-portal-id: ${skillId}`)) return false
  fs.unlinkSync(filePath)
  const dir = path.dirname(filePath)
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir)
  }
  return true
}

function skillDir(base, skillId) {
  return path.join(base, skillId)
}

function skillFile(base, skillId) {
  return path.join(skillDir(base, skillId), 'SKILL.md')
}

export function syncSkill(skill, projects, skillRoots) {
  const results = []
  const skillId = skill.id
  const marker = `<!-- skill-portal-id: ${skillId} -->`
  const body = skill.body.includes(marker) ? skill.body : `${skill.body.trim()}\n\n${marker}\n`
  const payload = { ...skill, body }

  const assignedProjectIds = new Set(skill.assignments?.projectIds || [])
  const assignedRootIds = new Set(skill.assignments?.skillRootIds || [])
  const global = Boolean(skill.assignments?.global)

  if (global) {
    const target = skillFile(GLOBAL_SKILLS_DIR, skillId)
    writeSkill(target, payload)
    results.push({ scope: 'global', path: target, action: 'written' })
  } else {
    const globalTarget = skillFile(GLOBAL_SKILLS_DIR, skillId)
    if (removeIfPortalManaged(globalTarget, skillId)) {
      results.push({ scope: 'global', path: globalTarget, action: 'removed' })
    }
  }

  for (const project of projects) {
    const shouldHave = assignedProjectIds.has(project.id)
    const target = skillFile(path.join(project.path, '.cursor', 'skills'), skillId)

    if (shouldHave) {
      writeSkill(target, payload)
      results.push({ scope: 'project', project: project.name, path: target, action: 'written' })
    } else if (removeIfPortalManaged(target, skillId)) {
      results.push({ scope: 'project', project: project.name, path: target, action: 'removed' })
    }
  }

  for (const root of skillRoots) {
    const shouldHave = assignedRootIds.has(root.id)
    const target = skillFile(root.path, skillId)

    if (shouldHave) {
      writeSkill(target, payload)
      results.push({ scope: 'skillRoot', root: root.name, path: target, action: 'written' })
    } else if (removeIfPortalManaged(target, skillId)) {
      results.push({ scope: 'skillRoot', root: root.name, path: target, action: 'removed' })
    }
  }

  return results
}

export function syncAllSkills(skills, projects, skillRoots) {
  const enabledProjects = projects.filter((p) => p.enabled !== false)
  const enabledRoots = skillRoots.filter((r) => r.enabled !== false)
  return skills.map((skill) => ({
    skillId: skill.id,
    results: syncSkill(skill, enabledProjects, enabledRoots),
  }))
}

export function removeSkillFromDisk(skill, projects, skillRoots) {
  const skillId = skill.id
  const removed = []

  const globalTarget = skillFile(GLOBAL_SKILLS_DIR, skillId)
  if (removeIfPortalManaged(globalTarget, skillId)) removed.push(globalTarget)

  for (const project of projects) {
    const target = skillFile(path.join(project.path, '.cursor', 'skills'), skillId)
    if (removeIfPortalManaged(target, skillId)) removed.push(target)
  }

  for (const root of skillRoots) {
    const target = skillFile(root.path, skillId)
    if (removeIfPortalManaged(target, skillId)) removed.push(target)
  }

  return removed
}
