let store = { rules: [], skills: [], projects: [], projectRoots: [], skillRoots: [] }
let presets = []
let selectedRuleId = null
let selectedSkillId = null
let selectedMemoryId = null
let memories = []

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

function toast(msg) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 2800)
}

function rulesForProject(projectId) {
  return store.rules.filter((r) => (r.assignments?.projectIds || []).includes(projectId))
}

function renderPresets(containerId) {
  const el = document.getElementById(containerId)
  if (!el) return
  if (!presets.length) {
    el.innerHTML = '<p class="muted">Đang tải presets…</p>'
    return
  }
  el.innerHTML = presets
    .map((p) => {
      const suggested = (p.suggestedProjects || [])
        .filter((id) => store.projects.some((pr) => pr.id === id))
        .map((id) => store.projects.find((pr) => pr.id === id)?.name || id)
      const sugLabel = suggested.length ? suggested.join(', ') : 'chọn thủ công'
      return `<div class="preset-card" data-preset="${p.id}">
        <div class="icon">${p.icon}</div>
        <h3>${p.name}</h3>
        <p>${p.summary}<br><small>Gợi ý: ${sugLabel}</small></p>
        <div class="preset-actions">
          <button class="btn primary" data-install="${p.id}">Cài + Đồng bộ</button>
          <button class="btn" data-preview="${p.id}">Xem / sửa</button>
        </div>
      </div>`
    })
    .join('')

  el.querySelectorAll('[data-install]').forEach((btn) => {
    btn.onclick = () => installPreset(btn.dataset.install, 'install')
  })
  el.querySelectorAll('[data-preview]').forEach((btn) => {
    btn.onclick = () => installPreset(btn.dataset.preview, 'preview')
  })
}

async function loadPresets() {
  const data = await api('/api/presets')
  presets = data.presets || []
  renderPresets('preset-grid')
  renderPresets('preset-grid-rules')
}

function suggestedProjectIds(presetId) {
  const p = presets.find((x) => x.id === presetId)
  if (!p) return []
  return (p.suggestedProjects || []).filter((id) => store.projects.some((pr) => pr.id === id))
}

async function installPreset(presetId, mode) {
  const p = presets.find((x) => x.id === presetId)
  if (!p || !p.rule) return

  if (mode === 'preview') {
    selectedRuleId = null
    $('#rule-id').disabled = false
    const ids = suggestedProjectIds(presetId)
    fillForm({
      ...p.rule,
      assignments: { global: false, projectIds: ids },
    })
    showView('rules')
    toast('Template đã nạp — chọn projects, Lưu + Đồng bộ')
    return
  }

  const projectIds = suggestedProjectIds(presetId)
  if (!projectIds.length) {
    toast('Không có project gợi ý — dùng Xem/sửa để gán thủ công')
    return installPreset(presetId, 'preview')
  }

  const data = await api(`/api/presets/${encodeURIComponent(presetId)}/install`, {
    method: 'POST',
    body: JSON.stringify({ global: false, projectIds, sync: true }),
  })
  store = data.store
  selectedRuleId = data.rule.id
  await refresh()
  toast(`Đã cài ${p.name} → ${projectIds.length} project(s)`)
}

function renderStats() {
  $('#stat-rules').textContent = store.rules.length
  $('#stat-skills').textContent = (store.skills || []).length
  $('#stat-projects').textContent = store.projects.length
  $('#stat-global').textContent = store.rules.filter((r) => r.assignments?.global).length
  if ($('#stat-memories')) $('#stat-memories').textContent = memories.length || '—'
}

function memoryListItem(m) {
  const preview = (m.text || '').slice(0, 100)
  return `<div class="list-item${selectedMemoryId === m.id ? ' active' : ''}" data-memory="${m.id}">
    <strong>${m.createdAt ? new Date(m.createdAt).toLocaleDateString('vi') : m.id.slice(0, 8)}</strong>
    <small>${preview || '—'}</small>
  </div>`
}

function renderMemoriesList() {
  const el = $('#memories-list')
  if (!el) return
  el.innerHTML = memories.length
    ? memories.map((m) => memoryListItem(m)).join('')
    : '<p class="muted">Chưa có memory hoặc Qdrant chưa chạy.</p>'
  el.querySelectorAll('[data-memory]').forEach((node) => {
    node.onclick = () => selectMemory(node.dataset.memory)
  })
}

function selectMemory(id) {
  selectedMemoryId = id
  const m = memories.find((x) => x.id === id)
  if (!m) return
  $('#memory-detail')?.classList.remove('hidden')
  $('#memory-detail-text').textContent = m.text || JSON.stringify(m.payload, null, 2)
  renderMemoriesList()
}

async function loadMem0Status() {
  const el = $('#mem0-status')
  if (!el) return
  try {
    const data = await api('/api/mem0/status')
    el.textContent = `OK · ${data.config.userId} @ ${data.config.host}:${data.config.port}/${data.config.collection}`
    el.classList.remove('error')
  } catch (e) {
    el.textContent = `Lỗi: ${e.message}`
    el.classList.add('error')
  }
}

async function loadMemories(q = '') {
  try {
    const data = await api(`/api/memories?limit=80&q=${encodeURIComponent(q)}`)
    memories = data.memories || []
    renderMemoriesList()
    renderStats()
  } catch (e) {
    memories = []
    renderMemoriesList()
    toast(e.message)
  }
}

function fillMem0Settings() {
  const m = store.mem0 || {}
  if ($('#mem0-user-id')) $('#mem0-user-id').value = m.userId || 'default'
  if ($('#mem0-host')) $('#mem0-host').value = m.qdrantHost || 'localhost'
  if ($('#mem0-port')) $('#mem0-port').value = m.qdrantPort || 6333
  if ($('#mem0-collection')) $('#mem0-collection').value = m.collection || 'mem0'
}

function skillScopeLabel(s) {
  const parts = []
  if (s.assignments?.global) parts.push('Global')
  const pc = (s.assignments?.projectIds || []).length
  if (pc) parts.push(`${pc} project(s)`)
  const rc = (s.assignments?.skillRootIds || []).length
  if (rc) parts.push(`${rc} thư mục`)
  return parts.length ? parts.join(' · ') : 'Chưa gán'
}

function skillListItem(s) {
  return `<div class="list-item${selectedSkillId === s.id ? ' active' : ''}" data-skill="${s.id}">
    <strong>${s.name || s.id}</strong>
    <small>${(s.description || '—').slice(0, 80)} · ${skillScopeLabel(s)}</small>
  </div>`
}

function renderRecentSkills() {
  const el = $('#recent-skills')
  if (!el) return
  const items = [...(store.skills || [])].slice(-5).reverse()
  el.innerHTML = items.length
    ? items.map((s) => skillListItem(s)).join('')
    : '<p class="muted">Chưa có skill. Bấm + Skill mới hoặc Quét skills.</p>'
  bindSkillClicks(el)
}

function renderSkillsList() {
  const el = $('#skills-list')
  if (!el) return
  el.innerHTML = (store.skills || []).map((s) => skillListItem(s)).join('') || '<p class="muted">Chưa có skill.</p>'
  bindSkillClicks(el)
}

function bindSkillClicks(container) {
  container.querySelectorAll('[data-skill]').forEach((node) => {
    node.onclick = () => selectSkill(node.dataset.skill)
  })
}

function renderSkillRoots() {
  const el = $('#skill-roots-list')
  if (!el) return
  const roots = store.skillRoots || []
  el.innerHTML = roots.length
    ? roots.map((r) => `<div class="list-item static">
        <strong>${r.name}</strong>
        <small><code>${r.path}</code></small>
      </div>`).join('')
    : '<p class="muted">Chưa có thư mục skill. Thêm path ở trên.</p>'
}

function getSkillFormAssignments() {
  const global = $('#skill-assign-global').checked
  const projectIds = [...$('#skill-assign-projects').querySelectorAll('input:checked')].map((i) => i.value)
  const skillRootIds = [...$('#skill-assign-roots').querySelectorAll('input:checked')].map((i) => i.value)
  return { global, projectIds, skillRootIds }
}

function renderSkillAssignProjects() {
  const el = $('#skill-assign-projects')
  if (!el) return
  const ids = new Set(getSkillFormAssignments().projectIds)
  el.innerHTML = store.projects
    .map(
      (p) => `<label class="chip">
      <input type="checkbox" value="${p.id}" ${ids.has(p.id) ? 'checked' : ''} />
      ${p.name}
    </label>`,
    )
    .join('')
}

function renderSkillAssignRoots() {
  const el = $('#skill-assign-roots')
  if (!el) return
  const ids = new Set(getSkillFormAssignments().skillRootIds)
  el.innerHTML = (store.skillRoots || [])
    .map(
      (r) => `<label class="chip">
      <input type="checkbox" value="${r.id}" ${ids.has(r.id) ? 'checked' : ''} />
      ${r.name}
    </label>`,
    )
    .join('') || '<span class="muted">Thêm thư mục skill ở trên</span>'
}

function fillSkillForm(skill) {
  $('#skill-id').value = skill?.id || ''
  $('#skill-id').disabled = Boolean(skill)
  $('#skill-name').value = skill?.name || ''
  $('#skill-description').value = skill?.description || ''
  $('#skill-body').value = skill?.body || ''
  $('#skill-assign-global').checked = skill?.assignments?.global ?? false
  renderSkillAssignProjects()
  renderSkillAssignRoots()
  if (skill?.assignments?.projectIds) {
    for (const id of skill.assignments.projectIds) {
      const cb = $(`#skill-assign-projects input[value="${id}"]`)
      if (cb) cb.checked = true
    }
  }
  if (skill?.assignments?.skillRootIds) {
    for (const id of skill.assignments.skillRootIds) {
      const cb = $(`#skill-assign-roots input[value="${id}"]`)
      if (cb) cb.checked = true
    }
  }
}

function skillFormPayload() {
  const id = $('#skill-id').value.trim()
  return {
    id,
    name: ($('#skill-name').value.trim() || id),
    description: $('#skill-description').value.trim(),
    body: $('#skill-body').value,
    assignments: getSkillFormAssignments(),
  }
}

function selectSkill(id) {
  selectedSkillId = id
  const skill = (store.skills || []).find((s) => s.id === id)
  fillSkillForm(skill)
  renderSkillsList()
  showView('skills')
}

async function saveSkill(andSync = false) {
  const payload = skillFormPayload()
  if (!payload.id) return toast('Nhập ID skill')
  const isEdit = (store.skills || []).some((s) => s.id === payload.id)
  const data = await api(isEdit ? `/api/skills/${encodeURIComponent(payload.id)}` : '/api/skills', {
    method: isEdit ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  })
  store = data.store
  selectedSkillId = payload.id
  if (andSync) await api(`/api/sync-skills/${encodeURIComponent(payload.id)}`, { method: 'POST' })
  await refresh()
  toast(andSync ? 'Đã lưu và đồng bộ skill' : 'Đã lưu skill')
}

function renderRecentRules() {
  const el = $('#recent-rules')
  const items = [...store.rules].slice(-5).reverse()
  el.innerHTML = items.length
    ? items.map((r) => ruleListItem(r)).join('')
    : '<p class="muted">Chưa có rule. Bấm + Rule mới.</p>'
  bindRuleClicks(el)
}

function ruleListItem(r) {
  const scope = r.assignments?.global
    ? 'Global'
    : `${(r.assignments?.projectIds || []).length} project(s)`
  return `<div class="list-item${selectedRuleId === r.id ? ' active' : ''}" data-rule="${r.id}">
    <strong>${r.id}</strong>
    <small>${r.description || '—'} · ${scope}</small>
  </div>`
}

function renderRulesList() {
  const el = $('#rules-list')
  el.innerHTML = store.rules.map((r) => ruleListItem(r)).join('') || '<p class="muted">Chưa có rule.</p>'
  bindRuleClicks(el)
}

function bindRuleClicks(container) {
  container.querySelectorAll('[data-rule]').forEach((node) => {
    node.onclick = () => selectRule(node.dataset.rule)
  })
}

function renderAssignProjects() {
  const el = $('#assign-projects')
  const ids = new Set(getFormAssignments().projectIds)
  el.innerHTML = store.projects
    .map(
      (p) => `<label class="chip">
      <input type="checkbox" value="${p.id}" ${ids.has(p.id) ? 'checked' : ''} />
      ${p.name}
    </label>`,
    )
    .join('')
}

function renderProjects() {
  const el = $('#projects-grid')
  el.innerHTML = store.projects
    .map((p) => {
      const assigned = rulesForProject(p.id)
      return `<div class="project-card">
        <h3>${p.name}</h3>
        <code>${p.path}</code>
        <div class="tags">${assigned.map((r) => `<span class="tag">${r.id}</span>`).join('') || '<span class="muted">Chưa gán rule</span>'}</div>
      </div>`
    })
    .join('')
}

function getFormAssignments() {
  const global = $('#assign-global').checked
  const projectIds = [...$('#assign-projects').querySelectorAll('input:checked')].map((i) => i.value)
  return { global, projectIds }
}

function fillForm(rule) {
  $('#rule-id').value = rule?.id || ''
  $('#rule-id').disabled = Boolean(rule)
  $('#rule-filename').value = rule?.filename || ''
  $('#rule-description').value = rule?.description || ''
  $('#rule-always').checked = rule?.alwaysApply ?? true
  $('#rule-globs').value = rule?.globs || ''
  $('#rule-body').value = rule?.body || ''
  $('#assign-global').checked = rule?.assignments?.global ?? false
  renderAssignProjects()
  if (rule?.assignments?.projectIds) {
    for (const id of rule.assignments.projectIds) {
      const cb = $(`#assign-projects input[value="${id}"]`)
      if (cb) cb.checked = true
    }
  }
}

function formPayload() {
  const id = $('#rule-id').value.trim()
  return {
    id,
    filename: ($('#rule-filename').value.trim() || `${id}.mdc`),
    description: $('#rule-description').value.trim(),
    alwaysApply: $('#rule-always').checked,
    globs: $('#rule-globs').value.trim() || null,
    body: $('#rule-body').value,
    assignments: getFormAssignments(),
  }
}

function selectRule(id) {
  selectedRuleId = id
  const rule = store.rules.find((r) => r.id === id)
  fillForm(rule)
  renderRulesList()
  showView('rules')
}

function showView(name) {
  $$('.nav').forEach((n) => n.classList.toggle('active', n.dataset.view === name))
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`))
  const titles = {
    dashboard: 'Tổng quan',
    rules: 'Rules',
    skills: 'Skills',
    memories: 'Memories',
    projects: 'Projects',
    settings: 'Cài đặt',
  }
  $('#view-title').textContent = titles[name] || name

  const isSkills = name === 'skills'
  const isMemories = name === 'memories'
  $('#btn-new-rule').classList.toggle('hidden', isSkills || isMemories)
  $('#btn-new-skill').classList.toggle('hidden', !isSkills)
  $('#btn-scan').classList.toggle('hidden', isSkills || isMemories)
  $('#btn-scan-skills').classList.toggle('hidden', !isSkills)
  $('#btn-refresh-memories')?.classList.toggle('hidden', !isMemories)
  if (isMemories) {
    loadMem0Status()
    loadMemories($('#memory-search')?.value || '')
  }
}

async function refresh() {
  store = await api('/api/store')
  if (!store.skills) store.skills = []
  if (!store.skillRoots) store.skillRoots = []
  if (!presets.length) await loadPresets()
  else {
    renderPresets('preset-grid')
    renderPresets('preset-grid-rules')
  }
  renderStats()
  renderRecentRules()
  renderRecentSkills()
  renderRulesList()
  renderSkillsList()
  renderSkillRoots()
  renderProjects()
  $('#settings-roots').value = (store.projectRoots || []).join('\n')
  $('#settings-skill-roots').value = (store.skillRoots || []).map((r) => r.path || r).join('\n')
  fillMem0Settings()
  if (selectedRuleId) fillForm(store.rules.find((r) => r.id === selectedRuleId))
  else renderAssignProjects()
  if (selectedSkillId) fillSkillForm((store.skills || []).find((s) => s.id === selectedSkillId))
  else {
    renderSkillAssignProjects()
    renderSkillAssignRoots()
  }
}

async function saveRule(andSync = false) {
  const payload = formPayload()
  if (!payload.id) return toast('Nhập ID rule')
  const isEdit = store.rules.some((r) => r.id === payload.id)
  const data = await api(isEdit ? `/api/rules/${encodeURIComponent(payload.id)}` : '/api/rules', {
    method: isEdit ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  })
  store = data.store
  selectedRuleId = payload.id
  if (andSync) await api(`/api/sync/${encodeURIComponent(payload.id)}`, { method: 'POST' })
  await refresh()
  toast(andSync ? 'Đã lưu và đồng bộ' : 'Đã lưu')
}

$$('.nav').forEach((btn) => {
  btn.onclick = () => showView(btn.dataset.view)
})

$('#btn-new-rule').onclick = () => {
  selectedRuleId = null
  fillForm(null)
  $('#rule-id').disabled = false
  showView('rules')
}

$('#rule-form').onsubmit = (e) => {
  e.preventDefault()
  saveRule(false)
}

$('#btn-sync-rule').onclick = () => saveRule(true)

$('#btn-delete-rule').onclick = async () => {
  if (!selectedRuleId || !confirm(`Xóa rule "${selectedRuleId}"?`)) return
  const data = await api(`/api/rules/${encodeURIComponent(selectedRuleId)}`, { method: 'DELETE' })
  store = data.store
  selectedRuleId = null
  fillForm(null)
  await refresh()
  toast('Đã xóa')
}

$('#btn-sync-all').onclick = async () => {
  const data = await api('/api/sync', { method: 'POST' })
  const skillCount = (data.skillResults || []).length
  toast(`Đồng bộ ${data.results.length} rule(s), ${skillCount} skill(s)`)
}

$('#btn-new-skill').onclick = () => {
  selectedSkillId = null
  fillSkillForm(null)
  $('#skill-id').disabled = false
  showView('skills')
}

$('#skill-form')?.addEventListener('submit', (e) => {
  e.preventDefault()
  saveSkill(false)
})

$('#btn-sync-skill').onclick = () => saveSkill(true)

$('#btn-delete-skill').onclick = async () => {
  if (!selectedSkillId || !confirm(`Xóa skill "${selectedSkillId}"?`)) return
  const data = await api(`/api/skills/${encodeURIComponent(selectedSkillId)}`, { method: 'DELETE' })
  store = data.store
  selectedSkillId = null
  fillSkillForm(null)
  await refresh()
  toast('Đã xóa skill')
}

$('#btn-scan-skills').onclick = async () => {
  const data = await api('/api/skills/scan', { method: 'POST' })
  store = data.store
  await refresh()
  toast(`Quét xong: +${data.imported} skill(s), tổng ${store.skills.length}`)
}

$('#btn-add-skill-root').onclick = async () => {
  const p = $('#add-skill-root-path').value.trim()
  if (!p) return
  store = await api('/api/skill-roots', { method: 'POST', body: JSON.stringify({ path: p }) })
  $('#add-skill-root-path').value = ''
  await refresh()
  toast('Đã thêm thư mục skill')
}

$('#btn-save-skill-settings').onclick = async () => {
  const roots = $('#settings-skill-roots').value.split('\n').map((s) => s.trim()).filter(Boolean)
  store = await api('/api/settings', { method: 'PUT', body: JSON.stringify({ skillRoots: roots }) })
  store = await api('/api/skills/scan', { method: 'POST' })
  await refresh()
  toast('Đã lưu skill roots')
}

$('#btn-scan').onclick = async () => {
  store = await api('/api/projects/scan', { method: 'POST' })
  await refresh()
  toast(`Quét xong: ${store.projects.length} projects`)
}

$('#btn-add-project').onclick = async () => {
  const path = $('#add-project-path').value.trim()
  if (!path) return
  store = await api('/api/projects', { method: 'POST', body: JSON.stringify({ path }) })
  $('#add-project-path').value = ''
  await refresh()
  toast('Đã thêm project')
}

$('#btn-save-settings').onclick = async () => {
  const roots = $('#settings-roots').value.split('\n').map((s) => s.trim()).filter(Boolean)
  store = await api('/api/settings', { method: 'PUT', body: JSON.stringify({ projectRoots: roots }) })
  store = await api('/api/projects/scan', { method: 'POST' })
  await refresh()
  toast('Đã lưu cài đặt')
}

$('#assign-global').onchange = renderAssignProjects

$('#memory-search')?.addEventListener('input', (e) => {
  loadMemories(e.target.value)
})

$('#memory-form')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = $('#memory-text').value.trim()
  if (!text) return
  try {
    await api('/api/memories', { method: 'POST', body: JSON.stringify({ text }) })
    $('#memory-text').value = ''
    await loadMemories($('#memory-search')?.value || '')
    toast('Đã thêm memory')
  } catch (err) {
    toast(err.message)
  }
})

$('#btn-delete-memory')?.addEventListener('click', async () => {
  if (!selectedMemoryId || !confirm('Xóa memory này?')) return
  await api(`/api/memories/${encodeURIComponent(selectedMemoryId)}`, { method: 'DELETE' })
  selectedMemoryId = null
  $('#memory-detail')?.classList.add('hidden')
  await loadMemories($('#memory-search')?.value || '')
  toast('Đã xóa')
})

$('#btn-refresh-memories')?.addEventListener('click', async () => {
  await loadMem0Status()
  await loadMemories($('#memory-search')?.value || '')
  toast('Đã làm mới')
})

$('#btn-save-mem0')?.addEventListener('click', async () => {
  store = await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({
      mem0: {
        userId: $('#mem0-user-id').value.trim() || 'default',
        qdrantHost: $('#mem0-host').value.trim() || 'localhost',
        qdrantPort: Number($('#mem0-port').value || 6333),
        collection: $('#mem0-collection').value.trim() || 'mem0',
      },
    }),
  })
  await loadMem0Status()
  toast('Đã lưu mem0')
})

refresh().catch((e) => toast(e.message))
