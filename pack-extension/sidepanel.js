// PACK Extension — Side Panel State Machine
// All DOM manipulation is isolated to render functions.
// State is a plain object; renderView() is the single re-render entry point.

// ── Config ──────────────────────────────────────────────────────────────────
// Production Railway backend — same base URL the PACK frontend uses
const PACK_API_BASE = 'https://pack-capstone.up.railway.app/api/v1'
const PACK_WEB_URL  = 'https://pack-capstone.vercel.app'

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  view: 'loading',
  token: null,
  product: null,
  analysis: null,
  analysisId: null,
  looks: null,
  expansionAnswer: null,
  tabId: null,
  error: null,
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  // Get the active tab ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  state.tabId = tab?.id ?? null

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

  renderView(state.product ? 'product' : 'no-product')
}

// ── Auth bridge listener ──────────────────────────────────────────────────────
// The web page cannot postMessage directly to the sidepanel window.
// Instead: page → content script → background (STORE_TOKEN) → chrome.storage.local
// This storage listener is the correct way to receive the token in the sidepanel.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pack_auth_token?.newValue) {
    state.token = changes.pack_auth_token.newValue
    // Re-render only if we were sitting on the login screen waiting for auth
    if (state.view === 'login') {
      renderView(state.product ? 'product' : 'no-product')
    }
  }
})

// ── API helpers ──────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  const res = await fetch(`${PACK_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify(body),
  })
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
    state.analysis = res.data
    state.analysisId = res.data?.id || res.data?._id || null
    renderView('results')
  } catch (err) {
    state.error = err.message
    renderView('results')
  }
}

async function startLooks() {
  renderView('analysing')

  try {
    const res = await apiPost('/purchase-analysis/looks', {
      product_url: state.product.url,
      product_name: state.product.name,
      product_image_url: state.product.image,
      price: state.product.price ? parseFloat(state.product.price) : null,
      currency: state.product.currency || 'USD',
      brand: state.product.brand || '',
    })
    state.looks = res.data
    renderView('looks')
  } catch (err) {
    state.error = err.message
    renderView('looks')
  }
}

async function sendExpansionAnswer(answer) {
  state.expansionAnswer = answer
  if (state.analysisId) {
    await apiPatch(`/purchase-analysis/${state.analysisId}/expansion`, { answer })
      .catch(() => {})
  }
  // Re-render results with answer selected
  renderView('results')
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
      const pct = (val / 10) * 100
      return `
        <div class="score-row ${key === 'overall' ? 'overall' : ''}">
          <span class="score-label">${label}</span>
          <div class="score-bar-track">
            <div class="score-bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="score-value">${val.toFixed(1)}</span>
        </div>`
    })
  return `<div class="scores-section">${rows.join('')}</div>`
}

function outfitCollageHtml(collage, outfitName, occasions, stylingNote) {
  const tiles = [...(collage || [])].slice(0, 4)
  // Pad to 4 tiles
  while (tiles.length < 4) tiles.push(null)
  const tileHtml = tiles.map((url) =>
    url
      ? `<div class="outfit-collage-item"><img src="${esc(url)}" alt="" loading="lazy"></div>`
      : `<div class="outfit-collage-item empty"></div>`
  ).join('')

  const tagsHtml = (occasions || []).map((t) =>
    `<span class="occasion-tag">${esc(t)}</span>`
  ).join('')

  return `
    <div class="outfit-block">
      <div class="outfit-collage">${tileHtml}</div>
      ${outfitName ? `<p class="outfit-name">${esc(outfitName)}</p>` : ''}
      ${tagsHtml ? `<div class="outfit-occasions">${tagsHtml}</div>` : ''}
      ${stylingNote ? `<p class="outfit-note">${esc(stylingNote)}</p>` : ''}
    </div>`
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
    case 'no-product':  app.innerHTML = renderNoProduct();  break
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
        Connect your PACK account to analyse purchases and style items with your wardrobe.
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
        Navigate to a fashion product page and PACK will automatically detect the item.
      </p>
    </div>`
}

// ── Product ───────────────────────────────────────────────────────────────────
function renderProduct() {
  return `
    ${header()}
    ${productCardHtml(state.product)}
    <div class="product-actions">
      <button class="btn-primary" id="btn-analyse">Analyse this purchase</button>
      <button class="btn-secondary" id="btn-looks">Generate looks with my wardrobe</button>
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
    </div>`

  // Archetype + brand notes
  const archetypeHtml = a?.archetype_note
    ? `<div class="note-block">
         <span class="note-label">Your archetype — ${esc(a.archetype || '')}</span>
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
      <button class="btn-secondary" id="btn-to-looks">Generate looks →</button>
    </div>`
}

function bindResults() {
  document.getElementById('btn-exploring')?.addEventListener('click', () => sendExpansionAnswer('exploring'))
  document.getElementById('btn-impulse')?.addEventListener('click', () => sendExpansionAnswer('impulse'))
  document.getElementById('btn-save')?.addEventListener('click', saveToHistory)
  document.getElementById('btn-to-looks')?.addEventListener('click', startLooks)
}

// ── Looks ─────────────────────────────────────────────────────────────────────
function renderLooks() {
  const errorHtml = state.error
    ? `<div class="error-banner">${esc(state.error)}</div>`
    : ''

  const looksData = state.looks?.outfit_collages || state.looks?.outfits || []
  const outfitCombinations = state.looks?.outfit_combinations || []

  let collagesHtml = ''
  if (looksData.length > 0) {
    collagesHtml = looksData.slice(0, 3).map((collage, i) => {
      const combo = outfitCombinations[i] || {}
      const urls = Array.isArray(collage) ? collage : []
      // Prepend product image as first tile
      const tiles = [state.product?.image, ...urls].filter(Boolean)
      return outfitCollageHtml(
        tiles,
        combo.name || `Look ${i + 1}`,
        combo.occasion ? [combo.occasion] : [],
        combo.styling_note || ''
      )
    }).join('')
  } else if (!state.error) {
    collagesHtml = `<p style="padding:20px 18px;font-size:12px;color:var(--ink-muted)">No looks generated yet.</p>`
  }

  return `
    ${header('Looks')}
    ${errorHtml}
    ${productCardHtml(state.product)}
    <div class="looks-section">
      <div class="section-label">Outfits with your wardrobe</div>
      ${collagesHtml}
    </div>
    <div class="results-actions">
      <button class="btn-primary" id="btn-open-pack">View full analysis in PACK</button>
      ${state.analysis ? '' : '<button class="btn-secondary" id="btn-back-results">← See analysis</button>'}
    </div>`
}

function bindLooks() {
  document.getElementById('btn-open-pack')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${PACK_WEB_URL}/profile/shopping` })
  })
  document.getElementById('btn-back-results')?.addEventListener('click', () => {
    if (state.analysis) renderView('results')
  })
}

// ── Kick off ──────────────────────────────────────────────────────────────────
init()
