// PACK Extension: Service Worker
// Keeps track of the product found on each tab and opens the side panel.
// There is one panel per window; it reads the current tab's product from
// session storage and follows you as you switch tabs.

// Clicking the toolbar icon opens the panel on any page, product or not.
// Must be called at service worker startup, not inside a listener.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id
  if (message.type === 'PRODUCT_DETECTED' && tabId != null) {
    chrome.storage.session.set({ [`product_${tabId}`]: message.data })
  } else if (message.type === 'NO_PRODUCT' && tabId != null) {
    chrome.storage.session.remove(`product_${tabId}`)
  } else if (message.type === 'STORE_TOKEN' && typeof message.token === 'string') {
    // Relayed by the content script from textpack.co after sign-in (it checks the origin).
    // Writing to storage triggers chrome.storage.onChanged in the side panel.
    chrome.storage.local.set({ pack_auth_token: message.token })
  } else if (message.type === 'OPEN_PANEL' && sender.tab) {
    // Fired by the floating button on product pages. Called straight away so
    // Chrome still counts it as part of the click.
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(() => {})
  }
})

// Clean up stored product data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([`product_${tabId}`])
})
