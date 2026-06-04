// PACK Extension — Content Script
// Runs on every page at document_idle. Detects fashion product pages and
// extracts product metadata without modifying the DOM or injecting UI.

(function () {
  'use strict'

  // ── Signal 1: JSON-LD Product schema ─────────────────────────────────────

  function extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent)
        const nodes = Array.isArray(data) ? data : [data]
        for (const node of nodes) {
          // Handle @graph containers
          const items = node['@graph'] ? node['@graph'] : [node]
          for (const item of items) {
            if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
              const offers = item.offers || item.Offers || {}
              const offerNode = Array.isArray(offers) ? offers[0] : offers
              return {
                matched: true,
                name: item.name || '',
                image: Array.isArray(item.image) ? item.image[0] : item.image || '',
                price: offerNode.price || offerNode.lowPrice || '',
                brand: item.brand?.name || item.brand || '',
                currency: offerNode.priceCurrency || 'USD',
              }
            }
          }
        }
      } catch {
        // Malformed JSON — skip
      }
    }
    return { matched: false }
  }

  // ── Signal 2: Open Graph meta tags ───────────────────────────────────────

  function getMeta(property) {
    const el =
      document.querySelector(`meta[property="${property}"]`) ||
      document.querySelector(`meta[name="${property}"]`)
    return el ? (el.getAttribute('content') || '').trim() : ''
  }

  function extractFromOpenGraph() {
    const ogType = getMeta('og:type').toLowerCase()
    const isProduct = ogType === 'product' || ogType === 'og:product'
    if (!isProduct) return { matched: false }
    return {
      matched: true,
      name: getMeta('og:title') || getMeta('product:name') || '',
      image: getMeta('og:image') || '',
      price: getMeta('product:price:amount') || getMeta('og:price:amount') || '',
      currency: getMeta('product:price:currency') || getMeta('og:price:currency') || 'USD',
      brand: getMeta('og:site_name') || '',
    }
  }

  // ── Signal 3: Fashion domain list ────────────────────────────────────────

  const FASHION_DOMAINS = [
    'zara', 'asos', 'hm.com', 'dior', 'netaporter', 'net-a-porter',
    'revolve', 'shopbop', 'farfetch', 'ssense', 'matchesfashion',
    'selfridges', 'nordstrom', 'bloomingdales', 'anthropologie',
    'freepeople', 'urbanoutfitters', 'mango', 'cos.com', 'arket',
    'uniqlo', 'lululemon', 'nike.com', 'adidas', 'newbalance',
    'converse', 'vans.com', 'losangelesapparel', 'shein',
    'prettylittlething', 'fashionnova', 'reformation', 'everlane',
    'aritzia', 'abercrombie', 'hollister', 'forever21', 'express',
    'bananarepublic', 'jcrew', 'madewell', 'patagonia', 'allbirds',
    'sezane', 'rouje', 'sandro', 'maje', 'bash.com', 'ami', 'ba-sh',
    'isabelmarant', 'jacquemus', 'ganni', 'staud', 'rag-bone',
    'ragandbone', 'theory', 'vince', 'equipment', 'frame', 'veronicabeard',
    'aliceandolivia', 'zimmermann', 'ajeworld', 'faithfullthebrand',
    'realisationpar', 'loefflerrandall', 'khaite', 'toteme',
    'wardrobenyc', 'therow', 'bottega', 'prada', 'gucci', 'loewe',
    'celine', 'ysl.com', 'valentino', 'burberry', 'coach', 'katespade',
    'toryburch', 'michaelkors', 'longchamp', 'mulberry', 'strathberry',
    'polene', 'mansurgavriel', 'byfarshoes', 'simonmiller', 'mlouye',
    'cultgaia', 'nanushka', 'standstudio', 'remain', 'holzweiler',
    'rotate', 'gestuz', 'secondfemale', 'soeur-paris', 'shopbash',
    'ssqrd',
  ]

  function isFashionDomain() {
    const host = window.location.hostname.toLowerCase()
    return FASHION_DOMAINS.some((d) => host.includes(d))
  }

  // ── Signal 4: Add to cart button ─────────────────────────────────────────

  function hasAddToCartButton() {
    const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]')
    const pattern = /add\s+to\s+(cart|bag)|buy\s+now/i
    for (const btn of buttons) {
      if (pattern.test(btn.textContent) || pattern.test(btn.value || '')) {
        return true
      }
    }
    return false
  }

  // ── Best-effort product image extraction ─────────────────────────────────

  function findBestProductImage() {
    // Prefer OG image, then largest image on page
    const ogImg = getMeta('og:image')
    if (ogImg) return ogImg

    const imgs = [...document.querySelectorAll('img')]
    let best = null
    let bestArea = 0
    for (const img of imgs) {
      const area = img.naturalWidth * img.naturalHeight
      if (area > bestArea && img.src && !img.src.includes('logo') && !img.src.includes('icon')) {
        bestArea = area
        best = img
      }
    }
    return best?.src || ''
  }

  // ── Main detection logic ──────────────────────────────────────────────────

  function detect() {
    const jsonLd = extractFromJsonLd()
    const og = extractFromOpenGraph()
    const isFashion = isFashionDomain()
    const hasCart = hasAddToCartButton()

    // Count matched signals (need at least 2)
    let matchCount = 0
    if (jsonLd.matched) matchCount++
    if (og.matched) matchCount++
    if (isFashion) matchCount++
    if (hasCart) matchCount++

    if (matchCount < 2) {
      chrome.runtime.sendMessage({ type: 'NO_PRODUCT' })
      return
    }

    // Merge data with priority: JSON-LD > OG > page fallbacks
    const name =
      jsonLd.name || og.name ||
      document.querySelector('h1')?.textContent?.trim() ||
      document.title

    const image =
      jsonLd.image || og.image || findBestProductImage()

    const price = jsonLd.price || og.price || ''
    const brand = jsonLd.brand || og.brand || ''
    const currency = jsonLd.currency || og.currency || 'USD'

    chrome.runtime.sendMessage({
      type: 'PRODUCT_DETECTED',
      data: {
        url: window.location.href,
        name: name.trim(),
        image,
        price,
        brand,
        currency,
      },
    })

    injectFloatingButton()
  }

  // ── Auth bridge relay ────────────────────────────────────────────────────
  // The PACK web app posts PACK_EXTENSION_AUTH to its own window.
  // This content script (which runs on every page, including /auth/extension-login)
  // picks it up and forwards it to the background service worker, which writes
  // the token to chrome.storage.local. The sidepanel listens to storage changes.

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.type === 'PACK_EXTENSION_AUTH' && event.data?.token) {
      chrome.runtime.sendMessage({
        type: 'STORE_TOKEN',
        token: event.data.token,
      })
    }
  })

  // ── Floating trigger button ───────────────────────────────────────────────
  // Injected directly into the page DOM on product detection — same pattern
  // as Phia. Lets users open the PACK panel without touching the toolbar icon.

  function injectFloatingButton() {
    if (document.getElementById('pack-float-btn')) return

    const btn = document.createElement('div')
    btn.id = 'pack-float-btn'

    // 2×2 dot grid — matches Phia's badge accent
    const dotGrid = `
      <div style="
        display: grid;
        grid-template-columns: 3px 3px;
        grid-template-rows: 3px 3px;
        gap: 2.5px;
        opacity: 0.55;
      ">
        <div style="width:3px;height:3px;background:#f7f5f2;border-radius:50%"></div>
        <div style="width:3px;height:3px;background:#f7f5f2;border-radius:50%"></div>
        <div style="width:3px;height:3px;background:#f7f5f2;border-radius:50%"></div>
        <div style="width:3px;height:3px;background:#f7f5f2;border-radius:50%"></div>
      </div>
    `

    btn.innerHTML = `
      <div style="
        position: fixed;
        bottom: 80px;
        right: 16px;
        width: 48px;
        height: 48px;
        background: #1a1a1a;
        border-radius: 12px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 16px rgba(0,0,0,0.18);
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      ">
        <span style="
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 20px;
          font-style: italic;
          font-weight: 400;
          color: #f7f5f2;
          line-height: 1;
          letter-spacing: -0.01em;
        ">p</span>
        ${dotGrid}
      </div>
    `

    const inner = btn.firstElementChild
    inner.addEventListener('mouseenter', () => {
      inner.style.transform = 'scale(1.07)'
      inner.style.boxShadow = '0 4px 24px rgba(0,0,0,0.26)'
    })
    inner.addEventListener('mouseleave', () => {
      inner.style.transform = 'scale(1)'
      inner.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)'
    })

    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_PANEL' })
    })

    document.body.appendChild(btn)
  }

  // Run detection. Small delay to let JS-rendered meta tags settle.
  if (document.readyState === 'complete') {
    setTimeout(detect, 300)
  } else {
    window.addEventListener('load', () => setTimeout(detect, 300))
  }
})()
