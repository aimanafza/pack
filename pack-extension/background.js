// PACK Extension — Service Worker
// Manages product detection state and side panel lifecycle per tab.

// MV3 correct pattern: automatically open the side panel when the action icon is clicked.
// Must be called at service worker startup, not inside a listener.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'PRODUCT_DETECTED') {
    // Enable side panel for this specific tab and store product data
    chrome.sidePanel.setOptions({
      tabId: sender.tab.id,
      enabled: true,
    })
    chrome.storage.session.set({
      [`product_${sender.tab.id}`]: message.data,
    })
  } else if (message.type === 'NO_PRODUCT') {
    chrome.sidePanel.setOptions({
      tabId: sender.tab.id,
      enabled: false,
    })
  } else if (message.type === 'STORE_TOKEN') {
    // Relayed from content script after the PACK web app posts PACK_EXTENSION_AUTH.
    // Writing to storage triggers chrome.storage.onChanged in the sidepanel.
    chrome.storage.local.set({ pack_auth_token: message.token })
  } else if (message.type === 'OPEN_PANEL') {
    // Fired by the floating button injected into the product page
    chrome.sidePanel.setOptions({
      tabId: sender.tab.id,
      path: 'sidepanel.html',
      enabled: true,
    }, () => {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {})
    })
  }
})

// Open side panel when extension icon is clicked.
// setOptions must be called first to register the panel for the tab before open().
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'sidepanel.html',
    enabled: true,
  }, () => {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
      // Side panel may already be open — ignore
    })
  })
})

// Clean up stored product data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([`product_${tabId}`])
})
