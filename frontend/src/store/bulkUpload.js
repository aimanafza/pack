import { create } from 'zustand'
import api from '../utils/api.js'
import { resizeImage } from '../utils/resizeImage.js'
import { missingField } from '../utils/itemFields.js'

// Bulk upload lives here, not in the review page, so photos keep uploading and the
// review keeps its progress while the user moves around the app. The server holds the
// drafts themselves; this store tracks what's on its way and polls while Claude reads.

const POLL_MS = 2500
const UPLOAD_CONCURRENCY = 3
export const IN_PROGRESS = ['uploading', 'queued', 'reading', 'saving']
export const EDITABLE = ['ready', 'failed', 'save_failed']

export const EMPTY_FIELDS = {
  name: '', category: '', subcategory: '', color: [], fabric: '',
  formality: [], occasions: [], season: [], notes: '', weight_grams: 0,
}

const fromDraft = (d) => ({
  draftId: d.id,
  batchId: d.batch_id,
  status: d.status,
  fields: d.fields,
  error: d.error,
  image_url: d.image_url,
})

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

// Counts the review page and the wardrobe banner both show
export function summarise(items) {
  const read = items.filter((i) => EDITABLE.includes(i.status))
  return {
    total: items.length,
    inProgress: items.filter((i) => IN_PROGRESS.includes(i.status)).length,
    uploading: items.filter((i) => i.status === 'uploading').length,
    saving: items.filter((i) => i.status === 'saving').length,
    read: read.length,
    complete: read.filter((i) => !missingField(i.fields)).length,
    failedUploads: items.filter((i) => i.status === 'upload_failed').length,
  }
}

// Run `worker` over `list`, at most `limit` at a time
async function inPool(list, limit, worker) {
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const index = next++
      await worker(list[index])
    }
  })
  await Promise.all(lanes)
}

// How far the current "add to wardrobe" has got. Saved drafts drop out of the server's
// list, so a draft we're adding that's no longer listed has landed in the wardrobe.
function trackAdding(adding, byId) {
  if (!adding) return {}
  let added = 0
  let failed = 0
  for (const id of adding.ids) {
    const d = byId.get(id)
    if (!d || d.status === 'saved') added++
    else if (d.status === 'save_failed') failed++
  }
  if (added + failed < adding.total) return { adding: { ...adding, added, failed } }
  const notice = failed === 0
    ? `Added ${plural(added, 'piece')} to your wardrobe.`
    : `Added ${plural(added, 'piece')} to your wardrobe. ${plural(failed, 'piece')} didn't make it; tap Add to try again.`
  return { adding: null, notice, addedAt: Date.now() }
}

// Batches with photos still uploading. Their drafts arrive through each upload's own
// response, so a poll that sees them first mustn't add them too (that would show a photo twice).
const uploadingBatches = new Map()
let pollTimer = null

function warnBeforeLeaving(e) {
  e.preventDefault()
  e.returnValue = ''
}

const useBulkUpload = create((set, get) => ({
  items: [],
  loaded: false,
  notice: '',
  // The batch being added to the wardrobe right now: which drafts, and how many have landed
  adding: null,
  // Bumped when items land in the wardrobe, so the wardrobe page knows to reload
  addedAt: 0,

  setNotice: (notice) => set({ notice }),

  updateItem: (key, patch) => set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) })),

  // Server drafts update the cards we have and add any we don't (from an earlier visit)
  mergeDrafts: (drafts) => set((s) => {
    const byId = new Map(drafts.map((d) => [d.id, d]))
    const progress = trackAdding(s.adding, byId)
    const known = new Set(s.items.map((i) => i.draftId).filter(Boolean))
    const items = s.items
      // Drafts gone from the server (saved, expired or removed elsewhere) leave too. Not while
      // their batch is still uploading: a poll sent just before an upload finished won't list it yet.
      .filter((i) => !i.draftId || byId.has(i.draftId) || uploadingBatches.has(i.batchId))
      .map((i) => (i.draftId ? { ...i, ...fromDraft(byId.get(i.draftId)) } : i))
    for (const d of drafts) {
      if (known.has(d.id) || uploadingBatches.has(d.batch_id) || d.status === 'saved') continue
      items.push({ key: d.id, ...fromDraft(d) })
    }
    return { items, loaded: true, ...progress }
  }),

  refresh: async () => {
    try {
      const { data } = await api.get('/api/v1/drafts/')
      get().mergeDrafts(data.data)
    } catch {
      if (!get().loaded) set({ loaded: true, notice: "We couldn't load your uploads. Refresh to try again." })
    }
    get().syncPolling()
  },

  // Poll only while Claude is still reading or items are still being added
  syncPolling: () => {
    const reading = get().items.some((i) => ['queued', 'reading', 'saving'].includes(i.status))
    if (reading && !pollTimer) {
      pollTimer = setInterval(() => get().refresh(), POLL_MS)
    } else if (!reading && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  },

  uploadOne: async (item) => {
    try {
      const fd = new FormData()
      fd.append('batch_id', item.batchId)
      fd.append('image', await resizeImage(item.file))
      const { data } = await api.post('/api/v1/drafts/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      get().updateItem(item.key, { ...fromDraft(data.data), file: null })
    } catch (err) {
      get().updateItem(item.key, {
        status: 'upload_failed',
        error: err.response?.data?.detail || "That photo didn't upload. Check your connection and retry.",
      })
      if (err.response?.status === 429) set({ notice: err.response.data.detail })
    }
    get().syncPolling()
  },

  startUploads: async (fileList) => {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    set({ notice: '' })

    let allowed = files.length
    try {
      const { data } = await api.get('/api/v1/wardrobe/usage')
      const usage = data.data
      // Photos already waiting here will need saving slots too
      const waiting = get().items.filter((i) => i.status !== 'upload_failed').length
      const itemsLeft = Math.max(0, usage.items.left - waiting)
      allowed = Math.min(files.length, usage.batch_max, itemsLeft)
      if (allowed === 0) {
        set({
          notice: usage.items.left === 0
            ? `You've added ${usage.items.limit} new items this month. You can add more on ${usage.resets_label}.`
            : usage.photo_reads.left === 0
              ? `Autofill has read ${usage.photo_reads.limit} photos this month. It comes back on ${usage.resets_label}.`
              : 'Save or remove the photos waiting here before adding more.',
        })
        return
      }
      if (allowed < files.length) {
        set({
          notice: allowed === usage.batch_max && usage.batch_max < itemsLeft
            ? `One upload can hold up to ${usage.batch_max} photos, so we kept the first ${allowed}.`
            : `You can add ${plural(allowed, 'more item')} this month, so we kept the first ${allowed} photos.`,
        })
      }
    } catch {
      // Usage couldn't load: the server still enforces the limits photo by photo
    }

    const batchId = crypto.randomUUID()
    const placeholders = files.slice(0, allowed).map((file, i) => ({
      key: `local-${batchId}-${i}`,
      batchId,
      status: 'uploading',
      fields: EMPTY_FIELDS,
      error: '',
      previewUrl: URL.createObjectURL(file),
      file,
    }))
    set((s) => ({ items: [...s.items, ...placeholders], loaded: true }))

    uploadingBatches.set(batchId, placeholders.length)
    window.addEventListener('beforeunload', warnBeforeLeaving)
    try {
      await inPool(placeholders, UPLOAD_CONCURRENCY, (item) => get().uploadOne(item))
    } finally {
      uploadingBatches.delete(batchId)
      if (uploadingBatches.size === 0) window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  },

  retryUpload: (key) => {
    const item = get().items.find((i) => i.key === key)
    if (!item?.file) return
    get().updateItem(key, { status: 'uploading', error: '' })
    get().uploadOne(item)
  },

  removeItem: async (key) => {
    const item = get().items.find((i) => i.key === key)
    if (!item) return
    if (item.draftId) {
      try {
        await api.delete(`/api/v1/drafts/${item.draftId}`)
      } catch (err) {
        set({ notice: err.response?.data?.detail || "That photo wasn't removed. Try again." })
        return
      }
    }
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    set((s) => ({ items: s.items.filter((i) => i.key !== key) }))
  },

  // Add every complete, read piece to the wardrobe. The server saves them a few at a
  // time with the background removed; polling shows each one landing.
  addToWardrobe: async () => {
    const ready = get().items.filter((i) => EDITABLE.includes(i.status) && !missingField(i.fields))
    if (ready.length === 0) return
    set({ notice: '' })
    try {
      await api.post('/api/v1/drafts/confirm', { draft_ids: ready.map((i) => i.draftId) })
    } catch (err) {
      set({ notice: err.response?.data?.detail || "Those pieces weren't added. Check your connection and try again." })
      return
    }
    const ids = new Set(ready.map((i) => i.draftId))
    set((s) => ({
      items: s.items.map((i) => (ids.has(i.draftId) ? { ...i, status: 'saving', error: '' } : i)),
      adding: { ids, total: ids.size, added: 0, failed: 0 },
    }))
    get().syncPolling()
  },

  saveFields: async (key, fields) => {
    const item = get().items.find((i) => i.key === key)
    const { data } = await api.patch(`/api/v1/drafts/${item.draftId}`, fields)
    get().updateItem(key, { fields: data.data.fields })
  },

  // On logout: the next person mustn't see these
  reset: () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    uploadingBatches.clear()
    window.removeEventListener('beforeunload', warnBeforeLeaving)
    get().items.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl))
    set({ items: [], loaded: false, notice: '', adding: null })
  },
}))

export default useBulkUpload
