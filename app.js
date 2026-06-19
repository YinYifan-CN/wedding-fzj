const ADMIN_PASSWORD = '5201314'
const LOCAL_KEY = 'wedding_sign_records'
const { tables, positions } = window.WEDDING_DATA
const $ = (selector) => document.querySelector(selector)
const normalize = (value) => String(value || '').replace(/\s+/g, '').toLowerCase()
const tableText = (value) => {
  const text = String(value || '').trim()
  return text ? text.padStart(2, '0') : ''
}
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

function flattenGuests() {
  return tables.flatMap((table) => table.guests.map((guest) => ({ table: table.table, guest, tableGuests: table.guests })))
}

function findGuests(keyword) {
  const query = normalize(keyword)
  if (!query) return []
  return flattenGuests().filter((item) => {
    const name = normalize(item.guest)
    return name.includes(query) || query.includes(name)
  })
}

function getTable(tableNo) {
  return tables.find((item) => item.table === tableText(tableNo))
}

function renderSearchResults(results) {
  const container = $('#searchResults')
  if (!results.length) {
    container.innerHTML = '<div class="panel result-card">暂未找到，请确认姓名是否与座次表一致。</div>'
    return
  }
  container.innerHTML = results.map((item, index) => `
    <article class="panel result-card">
      <span class="badge">${item.table}号桌</span>
      <div class="guest-name">${escapeHtml(item.guest)}</div>
      <div class="guest-list">同桌宾客：${item.tableGuests.map(escapeHtml).join('、')}</div>
      <div class="card-actions">
        <button class="button ghost" data-action="map" data-table="${item.table}">看位置</button>
        <button class="button primary" data-action="sign" data-index="${index}">签到</button>
      </div>
    </article>
  `).join('')
  container.querySelectorAll('[data-action="map"]').forEach((button) => button.addEventListener('click', () => selectTable(button.dataset.table, true)))
  container.querySelectorAll('[data-action="sign"]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = results[Number(button.dataset.index)]
      $('#signName').value = item.guest
      $('#signTable').value = item.table
      location.hash = '#sign'
    })
  })
}

function renderMap() {
  $('#seatMap').innerHTML = tables.map((table) => {
    const pos = positions[table.table] || { x: 50, y: 50 }
    return `<button class="table-dot" style="left:${pos.x}%;top:${pos.y}%;" data-table="${table.table}">${table.table}</button>`
  }).join('')
  document.querySelectorAll('.table-dot').forEach((button) => button.addEventListener('click', () => selectTable(button.dataset.table, false)))
}

function selectTable(tableNo, jump) {
  const table = getTable(tableNo)
  if (!table) return
  document.querySelectorAll('.table-dot').forEach((button) => button.classList.toggle('active', button.dataset.table === table.table))
  const detail = $('#tableDetail')
  detail.classList.remove('hidden')
  detail.innerHTML = `<h3>${table.table}号桌</h3><div class="tags">${table.guests.map((guest) => `<span class="tag">${escapeHtml(guest)}</span>`).join('')}</div>`
  if (jump) location.hash = '#map'
}

function getLocalRecords() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch (error) { return [] }
}

function saveLocalRecord(record) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify([record, ...getLocalRecords()]))
}

async function submitRecord(record) {
  try {
    const response = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    })
    if (!response.ok) throw new Error('remote unavailable')
    return { mode: 'cloud' }
  } catch (error) {
    saveLocalRecord(record)
    return { mode: 'local' }
  }
}

async function loadRecords() {
  try {
    const response = await fetch('/api/sign')
    if (!response.ok) throw new Error('remote unavailable')
    const payload = await response.json()
    return { mode: 'cloud', records: payload.records || [] }
  } catch (error) {
    return { mode: 'local', records: getLocalRecords() }
  }
}

function formatTime(value) {
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function refreshAdmin() {
  const { mode, records } = await loadRecords()
  const normalized = records.map((item) => ({ ...item, table: tableText(item.table) || '未填', count: Number(item.count) || 1 }))
  $('#recordCount').textContent = normalized.length
  $('#peopleCount').textContent = normalized.reduce((sum, item) => sum + item.count, 0)
  const summaryMap = normalized.reduce((map, item) => {
    map[item.table] = (map[item.table] || 0) + item.count
    return map
  }, {})
  $('#tableSummary').innerHTML = `<strong>${mode === 'cloud' ? '云端数据' : '本机数据'} · 桌号统计</strong><div class="summary-grid">${Object.keys(summaryMap).sort().map((table) => `<div class="summary-item"><span>${table}桌</span><span>${summaryMap[table]}人</span></div>`).join('') || '<span>暂无签到</span>'}</div>`
  $('#recordList').innerHTML = normalized.map((item) => `
    <article class="panel record-card">
      <div class="record-top"><span class="record-name">${escapeHtml(item.name)}</span><span class="record-table">${escapeHtml(item.table)}号桌 / ${item.count}人</span></div>
      ${item.message ? `<div class="record-message">${escapeHtml(item.message)}</div>` : ''}
      <div class="record-time">${formatTime(item.createdAt)}</div>
    </article>
  `).join('') || '<div class="panel record-card">暂无签到记录</div>'
}

function bindEvents() {
  $('#searchButton').addEventListener('click', () => renderSearchResults(findGuests($('#searchInput').value)))
  $('#searchInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') renderSearchResults(findGuests($('#searchInput').value))
  })
  $('#signForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const record = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: $('#signName').value.trim(),
      table: tableText($('#signTable').value),
      count: Number($('#signCount').value) || 1,
      message: $('#signMessage').value.trim(),
      createdAt: new Date().toISOString()
    }
    if (!record.name) {
      $('#signStatus').textContent = '请先填写姓名。'
      return
    }
    $('#signStatus').textContent = '正在提交...'
    const result = await submitRecord(record)
    $('#signStatus').textContent = result.mode === 'cloud' ? '签到成功，已同步到后台。' : '已保存到本机；如需多人汇总，请配置 Vercel KV。'
    if (record.table) selectTable(record.table, true)
  })
  $('#adminLoginButton').addEventListener('click', async () => {
    if ($('#adminPassword').value !== ADMIN_PASSWORD) {
      alert('密码不正确')
      return
    }
    $('#adminLogin').classList.add('hidden')
    $('#adminPanel').classList.remove('hidden')
    await refreshAdmin()
  })
  $('#refreshAdmin').addEventListener('click', refreshAdmin)
}

renderMap()
bindEvents()
