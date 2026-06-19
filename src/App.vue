<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import seatList1Url from './assets/seat-list-1.jpg'
import seatList2Url from './assets/seat-list-2.jpg'
import { positions, tables, type WeddingTable } from './data/weddingData'

type GuestMatch = {
  table: string
  guest: string
  tableGuests: string[]
}

type SignRecord = {
  id: string
  name: string
  table: string
  count: number
  message: string
  createdAt: string
}

type PageKey = 'home' | 'search' | 'map' | 'sign' | 'admin'

type HighlightPart = {
  text: string
  matched: boolean
}

const ADMIN_PASSWORD = '5201314'
const LOCAL_KEY = 'wedding_sign_records'
const navItems: Array<{ key: PageKey; label: string }> = [
  { key: 'home', label: '首页' },
  { key: 'search', label: '查座' },
  { key: 'map', label: '座位图' },
  { key: 'sign', label: '签到' },
  { key: 'admin', label: '后台' },
]

const seatImages = [
  { src: seatList1Url, alt: '座次表第一页' },
  { src: seatList2Url, alt: '座次表第二页' },
]

const searchKeyword = ref('')
const currentPage = ref<PageKey>('home')
const hasSearched = ref(false)
const selectedTableNo = ref('')
const signName = ref('')
const signTable = ref('')
const signCount = ref(1)
const signMessage = ref('')
const signStatus = ref('')
const adminPassword = ref('')
const isAdminOpen = ref(false)
const adminRecords = ref<SignRecord[]>([])
const adminDataMode = ref<'cloud' | 'local'>('local')
const tableDetailRef = ref<HTMLElement | null>(null)
const focusedGuestName = ref('')

const normalizedKeyword = computed(() => normalize(searchKeyword.value))
const flattenedGuests = computed<GuestMatch[]>(() =>
  tables.flatMap((table) =>
    table.guests.map((guest) => ({
      table: table.table,
      guest,
      tableGuests: table.guests,
    })),
  ),
)
const searchResults = computed(() => {
  const query = normalizedKeyword.value

  if (!query) return []

  return flattenedGuests.value.filter((item) => {
    const name = normalize(item.guest)
    return name.includes(query) || query.includes(name)
  })
})
const selectedTable = computed(() => getTable(selectedTableNo.value))
const normalizedRecords = computed(() =>
  adminRecords.value.map((item) => ({
    ...item,
    table: tableText(item.table) || '未填',
    count: Number(item.count) || 1,
  })),
)
const peopleCount = computed(() =>
  normalizedRecords.value.reduce((sum, item) => sum + item.count, 0),
)
const tableSummary = computed(() =>
  normalizedRecords.value.reduce<Record<string, number>>((map, item) => {
    map[item.table] = (map[item.table] || 0) + item.count
    return map
  }, {}),
)
const tableSummaryEntries = computed(() =>
  Object.entries(tableSummary.value).sort(([first], [second]) => first.localeCompare(second)),
)

async function switchPage(page: PageKey, scrollTop = true) {
  currentPage.value = page
  await nextTick()
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function normalize(value: string) {
  return String(value || '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function tableText(value: string | number) {
  const text = String(value || '').trim()
  return text ? text.padStart(2, '0') : ''
}

function getTable(tableNo: string | number): WeddingTable | undefined {
  return tables.find((item) => item.table === tableText(tableNo))
}

function runSearch() {
  hasSearched.value = true
}

function getHighlightedName(name: string): HighlightPart[] {
  const query = normalize(searchKeyword.value)
  if (!query) return [{ text: name, matched: false }]

  const normalizedName = normalize(name)
  if (query.includes(normalizedName)) return [{ text: name, matched: true }]

  const index = normalizedName.indexOf(query)
  if (index < 0) return [{ text: name, matched: false }]

  return [
    { text: name.slice(0, index), matched: false },
    { text: name.slice(index, index + query.length), matched: true },
    { text: name.slice(index + query.length), matched: false },
  ].filter((part) => part.text)
}

function isFocusedGuest(name: string) {
  return Boolean(focusedGuestName.value && name === focusedGuestName.value)
}

async function scrollToTableDetail() {
  await nextTick()

  const detail = tableDetailRef.value
  if (!detail) return

  const detailRect = detail.getBoundingClientRect()
  const tabsRect = document.querySelector('.tabs')?.getBoundingClientRect()
  const targetBottom = (tabsRect?.top ?? window.innerHeight) - 14
  const top = Math.max(0, window.scrollY + detailRect.bottom - targetBottom)

  window.scrollTo({ top, behavior: 'smooth' })
}

async function selectTable(tableNo: string, jump = false, guestName = '') {
  const table = getTable(tableNo)
  if (!table) return

  selectedTableNo.value = table.table
  focusedGuestName.value = guestName
  if (jump) await switchPage('map', false)
  await scrollToTableDetail()
}

function fillSignForm(match: GuestMatch) {
  signName.value = match.guest
  signTable.value = match.table
  void switchPage('sign')
}

function getLocalRecords(): SignRecord[] {
  try {
    const records = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

function saveLocalRecord(record: SignRecord) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify([record, ...getLocalRecords()]))
}

async function submitRecord(record: SignRecord) {
  try {
    const response = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })

    if (!response.ok) throw new Error('remote unavailable')
    return { mode: 'cloud' as const }
  } catch {
    saveLocalRecord(record)
    return { mode: 'local' as const }
  }
}

async function loadRecords() {
  try {
    const response = await fetch('/api/sign')

    if (!response.ok) throw new Error('remote unavailable')

    const payload = (await response.json()) as { records?: SignRecord[] }
    return { mode: 'cloud' as const, records: payload.records || [] }
  } catch {
    return { mode: 'local' as const, records: getLocalRecords() }
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  const pad = (number: number) => String(number).padStart(2, '0')

  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function handleSignSubmit() {
  const record: SignRecord = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: signName.value.trim(),
    table: tableText(signTable.value),
    count: Number(signCount.value) || 1,
    message: signMessage.value.trim(),
    createdAt: new Date().toISOString(),
  }

  if (!record.name) {
    signStatus.value = '请先填写姓名。'
    return
  }

  signStatus.value = '正在提交...'
  const result = await submitRecord(record)
  signStatus.value =
    result.mode === 'cloud'
      ? '签到成功，已同步到后台。'
      : '已保存到本机；如需多人汇总，请配置 Vercel KV。'

  if (record.table) selectTable(record.table, true)
}

async function refreshAdmin() {
  const { mode, records } = await loadRecords()
  adminDataMode.value = mode
  adminRecords.value = records
}

async function openAdmin() {
  if (adminPassword.value !== ADMIN_PASSWORD) {
    window.alert('密码不正确')
    return
  }

  isAdminOpen.value = true
  await refreshAdmin()
}
</script>

<template>
  <main class="app">
    <section v-if="currentPage === 'home'" class="hero section">
      <p class="date">2026年6月20日</p>
      <h1 class="hero-title">朴昶植先生 & 范嘉瑞女士</h1>
      <p class="subtitle">婚宴座位查询与签到</p>

      <div class="welcome panel">
        <strong>欢迎莅临婚礼现场</strong>
        <span>输入姓名即可查看桌号，完成签到后可直接查看会场位置。</span>
      </div>

      <div class="actions">
        <button class="button primary" type="button" @click="switchPage('search')">
          查找我的座位
        </button>
        <button class="button ghost" type="button" @click="switchPage('map')">
          查看会场平面图
        </button>
      </div>
    </section>

    <nav class="tabs" aria-label="页面导航">
      <button
        v-for="item in navItems"
        :key="item.key"
        :class="{ active: currentPage === item.key }"
        type="button"
        @click="switchPage(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <section v-if="currentPage === 'search'" class="section">
      <div class="section-head">
        <h2>姓名查座</h2>
        <p>支持输入姓名、称呼或家庭组合名。</p>
      </div>

      <form class="search-row" @submit.prevent="runSearch">
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="例如：张燕 / 范志刚 / 新娘父母"
          autocomplete="off"
        />
        <button class="button primary" type="submit">查询</button>
      </form>

      <div class="results" aria-live="polite">
        <article
          v-for="match in searchResults"
          :key="`${match.table}-${match.guest}`"
          class="panel result-card"
        >
          <span class="badge">{{ match.table }}号桌</span>
          <div class="guest-name">
            <span
              v-for="(part, index) in getHighlightedName(match.guest)"
              :key="`${match.table}-${match.guest}-${index}`"
              :class="{ highlight: part.matched }"
            >
              {{ part.text }}
            </span>
          </div>
          <div class="guest-list">同桌宾客：{{ match.tableGuests.join('、') }}</div>
          <div class="card-actions">
            <button
              class="button ghost"
              type="button"
              @click="selectTable(match.table, true, match.guest)"
            >
              看位置
            </button>
            <button class="button primary" type="button" @click="fillSignForm(match)">签到</button>
          </div>
        </article>

        <div v-if="hasSearched && !searchResults.length" class="panel result-card">
          暂未找到，请确认姓名是否与座次表一致。
        </div>
      </div>
    </section>

    <section v-if="currentPage === 'map'" class="section">
      <div class="section-head">
        <h2>会场座位图</h2>
        <p>点击桌号查看同桌名单，底部可放大查看原始座次图。</p>
      </div>

      <div class="map-panel panel">
        <div class="stage">舞台</div>
        <div class="seat-map">
          <button
            v-for="table in tables"
            :key="table.table"
            class="table-dot"
            :class="{ active: selectedTableNo === table.table }"
            :style="{
              left: `${positions[table.table]?.x ?? 50}%`,
              top: `${positions[table.table]?.y ?? 50}%`,
            }"
            type="button"
            @click="selectTable(table.table)"
          >
            {{ table.table }}
          </button>
        </div>
      </div>

      <div v-if="selectedTable" ref="tableDetailRef" class="table-detail panel">
        <h3>{{ selectedTable.table }}号桌</h3>
        <div class="tags">
          <span
            v-for="guest in selectedTable.guests"
            :key="guest"
            class="tag"
            :class="{ 'tag-highlight': isFocusedGuest(guest) }"
          >
            {{ guest }}
          </span>
        </div>
      </div>

      <div class="source-images">
        <a
          v-for="image in seatImages"
          :key="image.src"
          :href="image.src"
          target="_blank"
          rel="noreferrer"
        >
          <img :src="image.src" :alt="image.alt" />
        </a>
      </div>
    </section>

    <section v-if="currentPage === 'sign'" class="section">
      <div class="section-head">
        <h2>宾客签到</h2>
        <p>填写姓名、桌号和到场人数即可提交。</p>
      </div>

      <form class="form panel" @submit.prevent="handleSignSubmit">
        <label>
          <span>姓名</span>
          <input v-model="signName" required placeholder="请输入姓名" />
        </label>
        <label>
          <span>桌号</span>
          <input v-model="signTable" placeholder="例如 08" inputmode="numeric" />
        </label>
        <label>
          <span>到场人数</span>
          <input v-model.number="signCount" type="number" min="1" />
        </label>
        <label>
          <span>祝福留言</span>
          <textarea v-model="signMessage" placeholder="可选"></textarea>
        </label>
        <button class="button primary" type="submit">提交签到</button>
        <p class="status">{{ signStatus }}</p>
      </form>
    </section>

    <section v-if="currentPage === 'admin'" class="section">
      <div class="section-head">
        <h2>签到管理</h2>
      </div>

      <div v-if="!isAdminOpen" class="form panel">
        <label>
          <span>管理密码</span>
          <input
            v-model="adminPassword"
            type="password"
            placeholder="请输入管理密码"
            @keydown.enter="openAdmin"
          />
        </label>
        <button class="button primary" type="button" @click="openAdmin">进入后台</button>
      </div>

      <div v-else>
        <div class="stats">
          <div class="stat panel">
            <strong>{{ normalizedRecords.length }}</strong>
            <span>签到记录</span>
          </div>
          <div class="stat panel">
            <strong>{{ peopleCount }}</strong>
            <span>到场人数</span>
          </div>
        </div>

        <button class="button ghost" type="button" @click="refreshAdmin">刷新数据</button>

        <div class="summary panel">
          <strong>{{ adminDataMode === 'cloud' ? '云端数据' : '本机数据' }} · 桌号统计</strong>
          <div class="summary-grid">
            <div v-for="[table, count] in tableSummaryEntries" :key="table" class="summary-item">
              <span>{{ table }}桌</span>
              <span>{{ count }}人</span>
            </div>
            <span v-if="!tableSummaryEntries.length">暂无签到</span>
          </div>
        </div>

        <div class="record-list">
          <article v-for="record in normalizedRecords" :key="record.id" class="panel record-card">
            <div class="record-top">
              <span class="record-name">{{ record.name }}</span>
              <span class="record-table">{{ record.table }}号桌 / {{ record.count }}人</span>
            </div>
            <div v-if="record.message" class="record-message">{{ record.message }}</div>
            <div class="record-time">{{ formatTime(record.createdAt) }}</div>
          </article>

          <div v-if="!normalizedRecords.length" class="panel record-card">暂无签到记录</div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html) {
  min-height: 100%;
  background:
    linear-gradient(120deg, rgba(162, 92, 68, 0.12), transparent 36%),
    linear-gradient(300deg, rgba(104, 141, 130, 0.14), transparent 42%), #fbf6ee;
  scroll-behavior: smooth;
}

:global(body) {
  min-height: 100svh;
  margin: 0;
  color: #5f3f20;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

:global(#app) {
  min-height: 100svh;
}

:global(button),
:global(input),
:global(textarea) {
  font: inherit;
}

.app {
  width: min(100%, 760px);
  margin: 0 auto;
  padding-bottom: calc(92px + env(safe-area-inset-bottom));
}

.section {
  padding: 42px 18px 18px;
}

.hero {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100svh - 120px - env(safe-area-inset-bottom));
  text-align: center;
  transform: translateY(-28px);
}

.date {
  margin: 0 0 18px;
  color: #9f7348;
  font-size: 15px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  color: #8f5b1e;
  font-size: 52px;
  line-height: 1.18;
}

.hero-title {
  white-space: nowrap;
  font-size: clamp(29px, 8.3cqw, 52px);
}

h2 {
  color: #6f4d1f;
  font-size: 30px;
  line-height: 1.2;
}

.subtitle {
  margin-top: 12px;
  color: #9a6831;
  font-size: 18px;
}

.panel {
  border: 1px solid rgba(142, 96, 43, 0.22);
  border-radius: 8px;
  background: rgba(255, 252, 247, 0.92);
  box-shadow: 0 16px 48px rgba(91, 58, 24, 0.08);
}

.welcome {
  display: grid;
  gap: 10px;
  margin-top: 52px;
  padding: 28px 22px;
  line-height: 1.7;
}

.welcome strong {
  color: #704b21;
  font-size: 22px;
}

.welcome span,
.section-head p,
.status {
  color: #92714c;
  line-height: 1.65;
}

.actions,
.results,
.record-list {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 700;
  cursor: pointer;
}

.primary {
  color: #fffaf2;
  background: #9b6b2d;
}

.ghost {
  color: #7a5324;
  border: 1px solid rgba(142, 96, 43, 0.42);
  background: rgba(255, 252, 247, 0.78);
}

.tabs {
  position: fixed;
  left: 50%;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: min(calc(100% - 24px), 720px);
  overflow: hidden;
  border: 1px solid rgba(142, 96, 43, 0.22);
  border-radius: 8px;
  background: rgba(255, 252, 247, 0.96);
  box-shadow: 0 12px 34px rgba(91, 58, 24, 0.14);
  transform: translateX(-50%);
  backdrop-filter: blur(12px);
}

.tabs button {
  border: 0;
  padding: 13px 4px;
  color: #6f4d1f;
  background: transparent;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tabs button.active {
  color: #fffaf2;
  background: #9b6b2d;
}

.section-head {
  display: grid;
  gap: 8px;
  margin-bottom: 22px;
}

.search-row {
  display: grid;
  gap: 12px;
}

input,
textarea {
  width: 100%;
  border: 1px solid rgba(142, 96, 43, 0.28);
  border-radius: 8px;
  color: #5f3f20;
  background: #fffdf8;
  outline: none;
}

input:focus-visible,
textarea:focus-visible,
.button:focus-visible,
.table-dot:focus-visible,
.tabs button:focus-visible {
  outline: 3px solid rgba(59, 116, 111, 0.34);
  outline-offset: 2px;
}

input {
  height: 50px;
  padding: 0 15px;
}

textarea {
  min-height: 120px;
  padding: 14px 15px;
  resize: vertical;
}

.result-card,
.record-card {
  padding: 20px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 82px;
  height: 34px;
  border-radius: 999px;
  color: #fffaf2;
  background: #9b6b2d;
  font-weight: 800;
}

.guest-name {
  margin-top: 12px;
  color: #65421a;
  font-size: 28px;
  font-weight: 800;
}

.highlight {
  border-radius: 6px;
  padding: 0 4px;
  color: #fffaf2;
  background: #9b6b2d;
}

.guest-list {
  margin-top: 10px;
  color: #92714c;
  line-height: 1.7;
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.map-panel,
.form {
  padding: 18px;
}

.map-panel {
  --aisle-color: #dec48f;
}

.stage {
  width: 90%;
  height: 42px;
  margin: 0 auto;
  color: #6f4d1f;
  background: var(--aisle-color);
  text-align: center;
  line-height: 42px;
  font-weight: 800;
}

.seat-map {
  position: relative;
  min-height: 350px;
  height: min(74vw, 460px);
  margin-top: -1px;
  overflow: hidden;
}

.seat-map::before {
  position: absolute;
  top: 0;
  left: 47%;
  width: 6%;
  height: 100%;
  background: var(--aisle-color);
  content: '';
}

.table-dot {
  position: absolute;
  width: clamp(34px, 7vw, 40px);
  height: clamp(34px, 7vw, 40px);
  border: 0;
  border-radius: 50%;
  color: #fffaf2;
  background: #a8905e;
  box-shadow: 0 8px 18px rgba(85, 57, 24, 0.14);
  font-size: 15px;
  font-weight: 800;
  transform: translate(-50%, -50%);
}

.table-dot.active {
  background: #8f5b1e;
  outline: 5px solid rgba(59, 116, 111, 0.18);
}

.table-detail {
  margin-top: 18px;
  padding: 20px;
}

.table-detail h3 {
  margin: 0 0 14px;
  color: #5f3f20;
  font-size: 24px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.tag {
  padding: 8px 12px;
  border-radius: 8px;
  color: #68491f;
  background: #efe0c5;
  font-size: 14px;
}

.tag-highlight {
  color: #fffaf2;
  background: #9b6b2d;
}

.tag-highlight .highlight {
  padding: 0;
  color: inherit;
  background: transparent;
}

.source-images {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.source-images img {
  display: block;
  width: 100%;
  border-radius: 8px;
}

.form {
  display: grid;
  gap: 16px;
}

label span {
  display: block;
  margin-bottom: 8px;
  color: #704b21;
  font-weight: 700;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.stat {
  display: grid;
  gap: 6px;
  padding: 20px;
  text-align: center;
}

.stat strong {
  color: #794f1e;
  font-size: 34px;
}

.stat span {
  color: #92714c;
}

.summary {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding: 18px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.summary-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 8px;
  background: #efe0c5;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
}

.record-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.record-name {
  color: #5f3f20;
  font-size: 20px;
  font-weight: 800;
}

.record-table {
  flex-shrink: 0;
  color: #8f5b1e;
  font-weight: 800;
}

.record-message {
  margin-top: 12px;
  line-height: 1.65;
}

.record-time {
  margin-top: 8px;
  color: #92714c;
  font-size: 13px;
}

@media (min-width: 680px) {
  .search-row {
    grid-template-columns: 1fr 150px;
  }
}

@media (max-width: 420px) {
  .map-panel {
    padding: 14px 8px 18px;
  }

  .table-dot {
    width: 34px;
    height: 34px;
    font-size: 13px;
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
