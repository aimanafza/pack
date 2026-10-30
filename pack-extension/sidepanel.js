// PACK Extension — Side Panel State Machine
// All DOM manipulation is isolated to render functions.
// State is a plain object; renderView() is the single re-render entry point.

// ── Config ──────────────────────────────────────────────────────────────────
// Addresses live in config.js, shared with the content script
const PACK_API_BASE = PACK_CONFIG.apiBase
const PACK_WEB_URL  = PACK_CONFIG.webUrl

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  view: 'loading',
  token: null,
  product: null,
  analysis: null,
  analysisId: null,
  looks: null,
  expansionAnswer: null,
  expansionStats: null,   // { impulse, answered } once the shopper answers
  lookImages: {},         // outfit position -> image of the avatar wearing it
  dressing: {},           // outfit position -> true while that image is being made
  lookErrors: {},         // outfit position -> what went wrong
  tabId: null,
  windowId: null,
  error: null,
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  // Get the active tab ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  state.tabId = tab?.id ?? null
  state.windowId = tab?.windowId ?? null

  // Check auth token
  const stored = await chrome.storage.local.get('pack_auth_token')
  state.token = stored.pack_auth_token || null

  if (!state.token) {
    renderView('login')
    return
  }

  // Check for product data on this tab
  if (state.tabId) {
    const session = await chrome.storage.session.get(`product_${state.tabId}`)
    state.product = session[`product_${state.tabId}`] || null
  }

  await showProduct()
}

// Open on the saved analysis when this product has been checked before, so a
// reload or a second visit never pays for the same analysis twice
async function showProduct() {
  if (!state.product) return renderView('no-product')
  renderView('product')
  try {
    const res = await apiGet(`/purchase-analysis/for-product?url=${encodeURIComponent(state.product.url)}`)
    if (res.data && state.view === 'product') useAnalysis(res.data)
  } catch {
    // No saved analysis to show; the product view already offers a fresh one
  }
}

function useAnalysis(analysis) {
  state.analysis = analysis
  state.analysisId = analysis?.id || analysis?._id || null
  state.expansionAnswer = analysis?.expansion_answer || null
  applyLookState(analysis)
  state.error = null
  renderView('results')
  if (Object.keys(state.dressing).length) watchLooks()
}

// Looks are dressed on the server: copy what it says is ready, in progress or failed
function applyLookState(analysis) {
  state.lookImages = { ...(analysis?.look_images || {}) }
  state.dressing = Object.fromEntries(Object.keys(analysis?.look_pending || {}).map((k) => [k, true]))
  state.lookErrors = { ...(analysis?.look_errors || {}) }
}

// ── Follow the shopper ────────────────────────────────────────────────────────
// The panel stays open while you browse, so it follows the tab you're on and
// picks up a product as soon as the page reports one. Mid-analysis views stay put.
const SETTLED_VIEWS = ['no-product', 'product', 'login']

async function showTab(tabId) {
  state.tabId = tabId
  const session = await chrome.storage.session.get(`product_${tabId}`)
  state.product = session[`product_${tabId}`] || null
  resetProductState()
  if (state.token) showProduct()
}

function resetProductState() {
  state.analysis = null
  state.analysisId = null
  state.looks = null
  state.expansionAnswer = null
  state.expansionStats = null
  state.lookImages = {}
  state.dressing = {}
  state.lookErrors = {}
  state.notesState = 'idle'
  state.error = null
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  // Each Chrome window has its own panel; only follow tabs in this one, and never mid-analysis
  if (windowId !== state.windowId || state.view === 'analysing') return
  showTab(tabId)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session' || !state.tabId) return
  const change = changes[`product_${state.tabId}`]
  if (change && SETTLED_VIEWS.includes(state.view)) {
    state.product = change.newValue || null
    resetProductState()
    if (state.token) showProduct()
  }
})

// ── Auth bridge listener ──────────────────────────────────────────────────────
// The web page cannot postMessage directly to the sidepanel window.
// Instead: page → content script → background (STORE_TOKEN) → chrome.storage.local
// This storage listener is the correct way to receive the token in the sidepanel.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pack_auth_token?.newValue) {
    state.token = changes.pack_auth_token.newValue
    state.signedOutNote = null
    // Re-render only if we were sitting on the login screen waiting for auth
    if (state.view === 'login') showProduct()
  }
})

// ── API helpers ──────────────────────────────────────────────────────────────
// Sign-ins expire after a week (and whenever PACK rotates its keys). Rather than
// failing every request, forget the token and go back to the connect screen.
async function signedOut() {
  await chrome.storage.local.remove('pack_auth_token')
  state.token = null
  state.signedOutNote = 'Your sign-in expired. Connect again to keep going.'
  renderView('login')
  throw new Error('signed out')
}

async function apiGet(path) {
  const res = await fetch(`${PACK_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${state.token}` },
  })
  if (res.status === 401) return signedOut()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPost(path, body) {
  const res = await fetch(`${PACK_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) return signedOut()
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function apiPatch(path, body) {
  const res = await fetch(`${PACK_API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) return signedOut()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Analysis flow ─────────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  'Reading your wardrobe…',
  'Researching the brand…',
  'Counting outfit combinations…',
  'Writing your verdict…',
]

async function startAnalysis() {
  renderView('analysing')

  try {
    const res = await apiPost('/purchase-analysis/analyse', {
      product_url: state.product.url,
      product_name: state.product.name,
      product_image_url: state.product.image,
      price: state.product.price ? parseFloat(state.product.price) : null,
      currency: state.product.currency || 'USD',
      brand: state.product.brand || '',
    })
    useAnalysis(res.data)
  } catch (err) {
    if (!state.token) return  // signed out: the connect screen is already showing
    state.error = err.message
    renderView('results')
  }
}

async function startLooks() {
  // Looks come from the analysis, so run (and save) one first if there isn't one yet
  if (!state.analysis) {
    await startAnalysis()
    if (!state.analysis) return
  }
  state.looks = state.analysis
  renderView('looks')
}

// Ask the server to put the shopper's avatar in one outfit. It keeps going if the
// panel closes or the tab changes; the panel just checks back for the result.
async function dressLook(index) {
  if (!state.analysisId || state.dressing[index] || state.lookImages[index]) return
  state.dressing[index] = true
  delete state.lookErrors[index]
  updateLookFigure(index)
  try {
    const res = await apiPost(`/purchase-analysis/${state.analysisId}/looks/${index}/on-me`, {})
    if (res.data?.image_url) {
      state.lookImages[index] = res.data.image_url
      delete state.dressing[index]
    }
  } catch (err) {
    if (!state.token) return
    delete state.dressing[index]
    state.lookErrors[index] = err.message
  }
  updateLookFigure(index)
  if (state.dressing[index]) watchLooks()
}

// Check back every few seconds while any look is still being dressed
let lookWatch = null

function watchLooks() {
  if (lookWatch) return
  lookWatch = setInterval(async () => {
    const id = state.analysisId
    if (!id || !Object.keys(state.dressing).length) {
      clearInterval(lookWatch)
      lookWatch = null
      return
    }
    try {
      const res = await apiGet(`/purchase-analysis/${id}`)
      if (state.analysisId !== id) return  // moved on to another product meanwhile
      state.analysis = res.data
      applyLookState(res.data)
      ;(state.analysis?.outfit_combinations || []).forEach((_, i) => updateLookFigure(i))
    } catch {
      // Try again on the next tick
    }
  }, 4000)
}

async function sendExpansionAnswer(answer) {
  state.expansionAnswer = answer
  renderView('results')
  if (!state.analysisId) return
  try {
    const res = await apiPatch(`/purchase-analysis/${state.analysisId}/expansion`, { answer })
    state.expansionStats = res.data || null
  } catch {
    state.expansionStats = null
  }
  if (!state.token || state.view !== 'results') return
  const reply = document.getElementById('expansion-reply')
  if (reply) reply.innerHTML = expansionReplyHtml()
}

function expansionReplyHtml() {
  if (!state.expansionAnswer) return ''
  const lead = state.expansionAnswer === 'impulse' ? 'Thanks for being honest.' : 'Noted as a considered buy.'
  const st = state.expansionStats
  const tally = st && st.answered
    ? ` That's ${st.impulse} impulse moment${st.impulse === 1 ? '' : 's'} in ${st.answered} check${st.answered === 1 ? '' : 's'}.`
    : ''
  return `${lead}${tally} PACK keeps this in mind for your next verdicts.`
}

async function saveToHistory() {
  // Analysis is already saved — just show a confirmation in the UI
  const btn = document.getElementById('btn-save')
  if (btn) {
    btn.textContent = 'SAVED'
    btn.disabled = true
  }

  // Mark extension as connected on the backend (idempotent)
  await apiPost('/users/me/extension-connected', {}).catch(() => {})
}

// ── Render helpers ────────────────────────────────────────────────────────────
function header(tag = '') {
  return `
    <div class="panel-header">
      <span class="panel-logo">pack</span>
      <div class="panel-header-right">
        ${tag ? `<span class="header-tag">${tag}</span>` : ''}
      </div>
    </div>`
}

function productCardHtml(product) {
  if (!product) return ''
  const imgHtml = product.image
    ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`
    : `<div class="product-img-placeholder">
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
           <rect x="3" y="3" width="18" height="18" rx="1"/>
           <path d="M3 9h18M9 21V9"/>
         </svg>
       </div>`
  const priceHtml = product.price
    ? `<span class="product-price">${esc(product.currency || '')} ${esc(String(product.price))}</span>`
    : ''
  return `
    <div class="product-card">
      <div class="product-img-wrap">${imgHtml}</div>
      <div class="product-meta">
        ${product.brand ? `<p class="product-brand">${esc(product.brand)}</p>` : ''}
        <p class="product-name">${esc(product.name || 'Product')}</p>
        ${priceHtml}
      </div>
    </div>`
}

// What each score measures, shown when a score is opened
const SCORE_MEANINGS = {
  versatility:     'How many different outfits it makes with what you already own, across the occasions you dress for.',
  style_alignment: 'How closely it matches your style profile: the colours, shapes and mood you wear most.',
  gap_fill:        'Whether it covers something your wardrobe is missing, or repeats what you already have.',
  quality:         "The brand's track record on fabric, construction, sizing and how its pieces wear over time.",
  cost_per_outfit: 'The price divided by the outfits it makes. A higher score means each wear costs you less.',
  color_harmony:   'How easily its colour works with the colours already in your wardrobe.',
  overall:         "PACK's overall read, weighing the scores above against your wardrobe and how you shop.",
}

function scoreNoteText(key) {
  const note = state.analysis?.score_notes?.[key]
  if (note) return esc(note)
  if (state.notesState === 'loading') return 'Reading your wardrobe…'
  if (state.notesState === 'error') return "Couldn't explain this score right now. Close it and open it again to retry."
  return ''
}

// Each score opens (native details/summary, so it works by keyboard too) to say
// what it measures and why this piece got it
function scoreBarsHtml(scores) {
  if (!scores) return ''
  const metrics = [
    { key: 'versatility',     label: 'Versatility' },
    { key: 'style_alignment', label: 'Style fit' },
    { key: 'gap_fill',        label: 'Gap fill' },
    { key: 'quality',         label: 'Brand quality' },
    { key: 'cost_per_outfit', label: 'Cost/outfit' },
    { key: 'color_harmony',   label: 'Colour harmony' },
    { key: 'overall',         label: 'Overall' },
  ]
  const rows = metrics
    .filter(({ key }) => scores[key] != null)
    .map(({ key, label }) => {
      const val = Math.min(10, Math.max(0, Number(scores[key]) || 0))
      return `
        <details class="score-item ${key === 'overall' ? 'overall' : ''}" data-score="${key}">
          <summary class="score-row">
            <span class="score-label">${label}</span>
            <span class="score-bar-track"><span class="score-bar-fill" style="width: ${(val / 10) * 100}%"></span></span>
            <span class="score-value">${val.toFixed(1)}</span>
            <svg class="score-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </summary>
          <div class="score-detail">
            <p class="score-detail-label">What it measures</p>
            <p class="score-detail-text">${SCORE_MEANINGS[key]}</p>
            <p class="score-detail-label">For this piece</p>
            <p class="score-detail-text" data-score-note="${key}">${scoreNoteText(key)}</p>
          </div>
        </details>`
    })
  return `<div class="scores-section">${rows.join('')}</div>`
}

// Older analyses don't have their score explanations yet: the first time one is
// opened, ask the server to write them (it keeps them after that)
async function loadScoreNotes() {
  if (!state.analysisId || state.notesState === 'loading') return
  if (Object.keys(state.analysis?.score_notes || {}).length) return
  state.notesState = 'loading'
  refreshScoreNotes()
  try {
    const res = await apiPost(`/purchase-analysis/${state.analysisId}/score-notes`, {})
    state.analysis = { ...state.analysis, score_notes: res.data || {} }
    state.notesState = 'idle'
  } catch {
    if (!state.token) return
    state.notesState = 'error'
  }
  refreshScoreNotes()
}

function refreshScoreNotes() {
  document.querySelectorAll('[data-score-note]').forEach((el) => {
    el.innerHTML = scoreNoteText(el.dataset.scoreNote)
  })
}

// One look: the avatar wearing it (or a way to get that), then the pieces it's made of
function lookFigureHtml(index) {
  const image = state.lookImages[index]
  if (image) return `<img src="${esc(image)}" alt="Your avatar wearing this look">`
  if (state.dressing[index]) {
    return `<div class="look-wait"><div class="loading-spinner"></div><p>Dressing your avatar…</p></div>`
  }
  const error = state.lookErrors[index]
  return `
    <div class="look-wait">
      ${error ? `<p class="look-error">${esc(error)}</p>` : ''}
      <button class="btn-secondary look-dress" data-look="${index}">${error ? 'Try again' : 'See it on me'}</button>
    </div>`
}

function lookBlockHtml(index, pieces, outfitName, occasion, stylingNote) {
  const piecesHtml = pieces.map((url, i) =>
    `<div class="look-piece ${i === 0 ? 'is-new' : ''}"><img src="${esc(url)}" alt="" loading="lazy"></div>`
  ).join('')
  return `
    <div class="outfit-block">
      <div class="look-figure" id="look-figure-${index}">${lookFigureHtml(index)}</div>
      ${piecesHtml ? `<div class="look-pieces">${piecesHtml}</div>` : ''}
      ${outfitName ? `<p class="outfit-name">${esc(outfitName)}</p>` : ''}
      ${occasion ? `<div class="outfit-occasions"><span class="occasion-tag">${esc(occasion)}</span></div>` : ''}
      ${stylingNote ? `<p class="outfit-note">${esc(stylingNote)}</p>` : ''}
    </div>`
}

// Swap just one look's picture, so the panel doesn't jump while others load
function updateLookFigure(index) {
  if (state.view !== 'looks') return
  const el = document.getElementById(`look-figure-${index}`)
  if (!el) return
  el.innerHTML = lookFigureHtml(index)
  el.querySelector('.look-dress')?.addEventListener('click', () => dressLook(index))
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── View renderers ────────────────────────────────────────────────────────────
function renderView(view) {
  state.view = view
  const app = document.getElementById('app')
  if (!app) return

  switch (view) {
    case 'loading':     app.innerHTML = renderLoading();    break
    case 'login':       app.innerHTML = renderLogin();      bindLogin();     break
    case 'no-product':  app.innerHTML = renderNoProduct();  bindNoProduct(); break
    case 'product':     app.innerHTML = renderProduct();    bindProduct();   break
    case 'analysing':   app.innerHTML = renderAnalysing();  startLoadingCycle(); break
    case 'results':     app.innerHTML = renderResults();    bindResults();   break
    case 'looks':       app.innerHTML = renderLooks();      bindLooks();     break
    default:            app.innerHTML = renderLoading()
  }
}

// ── Loading ───────────────────────────────────────────────────────────────────
function renderLoading() {
  return `
    ${header()}
    <div class="loading-wrap">
      <div class="loading-spinner"></div>
      <p class="loading-label">Loading…</p>
    </div>`
}

// ── Analysing (animated messages) ─────────────────────────────────────────────
function renderAnalysing() {
  return `
    ${header('Analysing')}
    <div class="loading-wrap">
      <div class="loading-spinner"></div>
      <p class="loading-label" id="loading-msg">${LOADING_MESSAGES[0]}</p>
    </div>`
}

function startLoadingCycle() {
  let i = 0
  const interval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length
    const el = document.getElementById('loading-msg')
    if (!el) { clearInterval(interval); return }
    el.style.opacity = '0'
    setTimeout(() => {
      if (el) { el.textContent = LOADING_MESSAGES[i]; el.style.opacity = '1' }
    }, 250)
  }, 2500)
}

// ── Login ─────────────────────────────────────────────────────────────────────
function renderLogin() {
  return `
    ${header()}
    <div class="login-wrap">
      <p class="login-logo">pack</p>
      <p class="login-body">
        ${state.signedOutNote ? esc(state.signedOutNote) : 'Connect your PACK account to analyse purchases and style items with your wardrobe.'}
      </p>
      <button class="btn-primary" id="btn-connect">Connect to PACK</button>
    </div>`
}

function bindLogin() {
  document.getElementById('btn-connect')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${PACK_WEB_URL}/auth/extension-login` })
  })
  document.getElementById('btn-token-save')?.addEventListener('click', () => {
    const val = document.getElementById('token-input')?.value?.trim()
    if (!val) return
    chrome.storage.local.set({ pack_auth_token: val })
    state.token = val
    renderView(state.product ? 'product' : 'no-product')
  })
}

// ── No product ────────────────────────────────────────────────────────────────
function renderNoProduct() {
  return `
    ${header()}
    <div class="no-product-wrap">
      <div class="no-product-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      </div>
      <p class="no-product-title">No product detected</p>
      <p class="no-product-body">
        Open a clothing or accessory page and PACK will find the piece. Already on one? Reload it so PACK can see it.
      </p>
      <button class="btn-secondary" id="btn-reload">Reload this page</button>
    </div>`
}

function bindNoProduct() {
  // Pages opened before PACK was installed never got checked; a reload fixes that
  document.getElementById('btn-reload')?.addEventListener('click', () => {
    if (state.tabId) chrome.tabs.reload(state.tabId)
  })
}

// ── Product ───────────────────────────────────────────────────────────────────
function renderProduct() {
  return `
    ${header()}
    ${productCardHtml(state.product)}
    <div class="product-actions">
      <button class="btn-primary" id="btn-analyse">Analyse this purchase</button>
      <button class="btn-secondary" id="btn-looks">See looks on me</button>
    </div>`
}

function bindProduct() {
  document.getElementById('btn-analyse')?.addEventListener('click', startAnalysis)
  document.getElementById('btn-looks')?.addEventListener('click', startLooks)
}

// ── Results ───────────────────────────────────────────────────────────────────
function renderResults() {
  const a = state.analysis
  const errorHtml = state.error
    ? `<div class="error-banner">${esc(state.error)}</div>`
    : ''

  if (!a && !state.error) {
    return `${header('Analysis')}${errorHtml}<div class="loading-wrap"><p class="loading-label">No results.</p></div>`
  }

  // Expansion question
  const expansionHtml = `
    <div class="expansion-block">
      <p class="expansion-question">
        ${a?.style_expansion_note
          ? `${esc(a.style_expansion_note)}<br><br>`
          : ''}
        Was this more of a planned purchase, or an impulse moment?
      </p>
      <div class="expansion-btns">
        <button class="expansion-btn ${state.expansionAnswer === 'exploring' ? 'selected' : ''}"
          id="btn-exploring">Exploring</button>
        <button class="expansion-btn ${state.expansionAnswer === 'impulse' ? 'selected' : ''}"
          id="btn-impulse">Honest, maybe impulse</button>
      </div>
      <p class="expansion-reply" id="expansion-reply" aria-live="polite">${expansionReplyHtml()}</p>
    </div>`

  // Archetype + brand notes
  const archetypeHtml = a?.archetype_note
    ? `<div class="note-block">
         <span class="note-label">Your archetype: ${esc(a.archetype || '')}</span>
         <p class="note-text">${esc(a.archetype_note)}</p>
       </div>`
    : ''

  const brandHtml = a?.brand_quality_note
    ? `<div class="note-block">
         <span class="note-label">Brand quality</span>
         <p class="note-text">${esc(a.brand_quality_note)}</p>
       </div>`
    : ''

  return `
    ${header('Analysis')}
    ${errorHtml}
    ${productCardHtml(state.product)}
    ${expansionHtml}
    ${scoreBarsHtml(a?.scores)}
    ${a?.verdict ? `<div class="verdict-block"><p class="verdict-text">${esc(a.verdict)}</p></div>` : ''}
    ${archetypeHtml}
    ${brandHtml}
    <div class="results-actions">
      <button class="btn-primary" id="btn-save">Save to shopping history</button>
      <button class="btn-secondary" id="btn-to-looks">See looks on me</button>
    </div>`
}

function bindResults() {
  document.getElementById('btn-exploring')?.addEventListener('click', () => sendExpansionAnswer('exploring'))
  document.getElementById('btn-impulse')?.addEventListener('click', () => sendExpansionAnswer('impulse'))
  document.getElementById('btn-save')?.addEventListener('click', saveToHistory)
  document.getElementById('btn-to-looks')?.addEventListener('click', startLooks)
  document.querySelectorAll('.score-item').forEach((item) =>
    item.addEventListener('toggle', () => { if (item.open) loadScoreNotes() })
  )
}

// ── Looks ─────────────────────────────────────────────────────────────────────
function renderLooks() {
  const collages = state.looks?.outfit_collages || []
  const combos = state.looks?.outfit_combinations || []

  const looksHtml = combos.length
    ? combos.slice(0, 3).map((combo, i) => {
        // The server puts the product first, then the wardrobe pieces
        const pieces = (collages[i] || []).filter(Boolean)
        return lookBlockHtml(i, pieces.length ? pieces : [state.product?.image].filter(Boolean),
          combo.name || `Look ${i + 1}`, combo.occasion || '', combo.styling_note || '')
      }).join('')
    : `<p class="looks-empty">No looks for this piece yet.</p>`

  return `
    ${header('Looks')}
    ${productCardHtml(state.product)}
    <div class="looks-section">
      <div class="section-label">On you, with your wardrobe</div>
      ${looksHtml}
    </div>
    <div class="results-actions">
      <button class="btn-primary" id="btn-open-pack">View full analysis in PACK</button>
      <button class="btn-secondary" id="btn-back-results">Back to analysis</button>
    </div>`
}

function bindLooks() {
  document.getElementById('btn-open-pack')?.addEventListener('click', () => {
    const path = state.analysisId ? `/profile/shopping/${state.analysisId}` : '/profile/shopping'
    chrome.tabs.create({ url: `${PACK_WEB_URL}${path}` })
  })
  document.getElementById('btn-back-results')?.addEventListener('click', () => renderView('results'))
  document.querySelectorAll('.look-dress').forEach((btn) =>
    btn.addEventListener('click', () => dressLook(Number(btn.dataset.look)))
  )
  // The first look dresses itself; the rest wait to be asked, so nobody pays for looks they skip
  if ((state.looks?.outfit_combinations || []).length) dressLook(0)
}

// ── Kick off ──────────────────────────────────────────────────────────────────
init()
