import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useStore from '../store/index.js'
import api from '../utils/api.js'
import { resizeImage } from '../utils/resizeImage.js'
import { missingField, capitalise } from '../utils/itemFields.js'
import { formatWeight, useWeightUnit } from '../utils/weight.js'
import BulkItemEditor from '../components/wardrobe/BulkItemEditor.jsx'
import styles from '../components/wardrobe/BulkUpload.module.css'

const POLL_MS = 2500
const UPLOAD_CONCURRENCY = 3
const IN_PROGRESS = ['uploading', 'queued', 'reading']
const EDITABLE = ['ready', 'failed']

const EMPTY_FIELDS = {
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

// Run `worker` over `list`, at most `limit` at a time
async function inPool(list, limit, worker) {
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const index = next++
      await worker(list[index], index)
    }
  })
  await Promise.all(lanes)
}

function statusLabel(item) {
  if (item.status === 'uploading') return 'Uploading'
  if (item.status === 'queued' || item.status === 'reading') return 'Reading'
  if (item.status === 'upload_failed') return 'Upload failed'
  if (item.status === 'failed') return 'Fill in details'
  if (missingField(item.fields)) return 'Needs details'
  return ''
}

export default function BulkUploadPage() {
  const unit = useWeightUnit()
  const pendingUploads = useStore((s) => s.pendingUploads)
  const setPendingUploads = useStore((s) => s.setPendingUploads)

  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [editingKey, setEditingKey] = useState(null)
  const fileInputRef = useRef(null)
  const batchRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const updateItem = useCallback((key, patch) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }, [])

  // Server drafts update the cards we have. New ones are added too, except drafts from
  // the batch uploading right now: those arrive through their own upload, and adding
  // them from a poll as well could show a photo twice.
  const mergeDrafts = useCallback((drafts) => {
    setItems((prev) => {
      const byId = new Map(drafts.map((d) => [d.id, d]))
      const known = new Set(prev.map((i) => i.draftId).filter(Boolean))
      const next = prev.map((i) => (i.draftId && byId.has(i.draftId) ? { ...i, ...fromDraft(byId.get(i.draftId)) } : i))
      for (const d of drafts) {
        if (known.has(d.id) || d.batch_id === batchRef.current || d.status === 'saved') continue
        next.push({ key: d.id, ...fromDraft(d) })
      }
      return next
    })
  }, [])

  const fetchDrafts = useCallback(async () => {
    const { data } = await api.get('/api/v1/drafts/')
    return data.data
  }, [])

  async function uploadOne(item, file) {
    try {
      const fd = new FormData()
      fd.append('batch_id', item.batchId)
      fd.append('image', await resizeImage(file))
      const { data } = await api.post('/api/v1/drafts/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      updateItem(item.key, { ...fromDraft(data.data), file: null })
    } catch (err) {
      updateItem(item.key, {
        status: 'upload_failed',
        error: err.response?.data?.detail || "That photo didn't upload. Check your connection and retry.",
      })
      if (err.response?.status === 429) setNotice(err.response.data.detail)
    }
  }

  async function startUploads(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    setNotice('')

    let allowed = files.length
    try {
      const { data } = await api.get('/api/v1/wardrobe/usage')
      const usage = data.data
      // Photos already waiting here will need saving slots too
      const waiting = itemsRef.current.filter((i) => i.status !== 'upload_failed').length
      const itemsLeft = Math.max(0, usage.items.left - waiting)
      allowed = Math.min(files.length, usage.batch_max, itemsLeft)
      if (allowed === 0) {
        setNotice(
          usage.items.left === 0
            ? `You've added ${usage.items.limit} new items this month. You can add more on ${usage.resets_label}.`
            : usage.photo_reads.left === 0
              ? `Autofill has read ${usage.photo_reads.limit} photos this month. It comes back on ${usage.resets_label}.`
              : 'Save or remove the photos waiting here before adding more.'
        )
        return
      }
      if (allowed < files.length) {
        setNotice(
          allowed === usage.batch_max && usage.batch_max < itemsLeft
            ? `One upload can hold up to ${usage.batch_max} photos, so we kept the first ${allowed}.`
            : `You can add ${plural(allowed, 'more item')} this month, so we kept the first ${allowed} photos.`
        )
      }
    } catch {
      // Usage couldn't load: let the server enforce the limits photo by photo
    }

    const batchId = crypto.randomUUID()
    batchRef.current = batchId
    const kept = files.slice(0, allowed)
    const placeholders = kept.map((file, i) => ({
      key: `local-${batchId}-${i}`,
      batchId,
      status: 'uploading',
      fields: EMPTY_FIELDS,
      error: '',
      previewUrl: URL.createObjectURL(file),
      file,
    }))
    setItems((prev) => [...prev, ...placeholders])
    await inPool(placeholders, UPLOAD_CONCURRENCY, (item) => uploadOne(item, item.file))
  }

  // First load: drafts left from earlier, then any photos handed over by the add-item form
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const drafts = await fetchDrafts()
        if (!cancelled) mergeDrafts(drafts)
      } catch {
        if (!cancelled) setNotice("We couldn't load your uploads. Refresh to try again.")
      }
      if (cancelled) return
      setLoaded(true)
      if (pendingUploads.length) {
        const files = pendingUploads
        setPendingUploads([])
        startUploads(files)
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while Claude is still reading
  const anyReading = items.some((i) => i.status === 'queued' || i.status === 'reading')
  useEffect(() => {
    if (!anyReading) return
    const timer = setInterval(async () => {
      try {
        mergeDrafts(await fetchDrafts())
      } catch {
        // A missed poll is fine; the next one catches up
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [anyReading, fetchDrafts, mergeDrafts])

  // Leaving mid-upload would drop the photos still on their way
  const anyUploading = items.some((i) => i.status === 'uploading')
  useEffect(() => {
    if (!anyUploading) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyUploading])

  // Free the local previews when the page closes
  useEffect(() => () => itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), [])

  async function removeItem(item) {
    if (item.draftId) {
      try {
        await api.delete(`/api/v1/drafts/${item.draftId}`)
      } catch (err) {
        setNotice(err.response?.data?.detail || "That photo wasn't removed. Try again.")
        return
      }
    }
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setItems((prev) => prev.filter((i) => i.key !== item.key))
    if (editingKey === item.key) setEditingKey(null)
  }

  function retryUpload(item) {
    if (!item.file) return
    updateItem(item.key, { status: 'uploading', error: '' })
    uploadOne(item, item.file)
  }

  const editable = items.filter((i) => EDITABLE.includes(i.status))
  const editingIndex = editable.findIndex((i) => i.key === editingKey)
  const editing = editingIndex >= 0 ? editable[editingIndex] : null

  async function saveEdits(fields, goNext) {
    const { data } = await api.patch(`/api/v1/drafts/${editing.draftId}`, fields)
    updateItem(editing.key, { fields: data.data.fields })
    setEditingKey(goNext && editable[editingIndex + 1] ? editable[editingIndex + 1].key : null)
  }

  const counts = useMemo(() => {
    const read = items.filter((i) => EDITABLE.includes(i.status))
    return {
      total: items.length,
      inProgress: items.filter((i) => IN_PROGRESS.includes(i.status)).length,
      read: read.length,
      complete: read.filter((i) => !missingField(i.fields)).length,
      failedUploads: items.filter((i) => i.status === 'upload_failed').length,
    }
  }, [items])
  const needsDetails = counts.read - counts.complete

  if (!loaded) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Opening your uploads...</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.pageLabel}>New pieces</p>
          <h1 className={styles.headline}>Review your uploads</h1>
        </div>
        <button className={styles.btnOutline} type="button" onClick={() => fileInputRef.current?.click()}>
          Add photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.fileInput}
          onChange={(e) => { startUploads(e.target.files); e.target.value = '' }}
        />
      </header>

      {counts.total > 0 && (
        <div className={styles.progress} aria-live="polite">
          <p className={styles.progressText}>
            {counts.inProgress > 0
              ? `Reading your photos. ${counts.read} of ${counts.total} ready.`
              : `All ${plural(counts.read, 'piece')} read. Tap one to check its details.`}
          </p>
          <div className={styles.progressTrack} aria-hidden="true">
            <span className={styles.progressFill} style={{ width: `${(counts.read / counts.total) * 100}%` }} />
          </div>
        </div>
      )}

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {counts.total === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>Nothing waiting for review.</p>
          <p className={styles.emptySub}>Choose a few photos and Claude will fill in each piece for you.</p>
          <div className={styles.emptyActions}>
            <button className={styles.btnPrimary} type="button" onClick={() => fileInputRef.current?.click()}>
              Choose photos
            </button>
            <Link to="/wardrobe" className={styles.btnText}>Back to wardrobe</Link>
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => {
            const label = statusLabel(item)
            const canEdit = EDITABLE.includes(item.status)
            const busy = IN_PROGRESS.includes(item.status)
            return (
              <div key={item.key} className={styles.card}>
                <div
                  className={`${styles.photo} ${busy ? styles.photoBusy : ''} ${canEdit ? styles.photoEditable : ''}`}
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  aria-label={canEdit ? `Edit ${item.fields.name || 'this piece'}` : undefined}
                  onClick={() => canEdit && setEditingKey(item.key)}
                  onKeyDown={(e) => canEdit && e.key === 'Enter' && setEditingKey(item.key)}
                >
                  <img src={item.previewUrl || item.image_url} alt="" loading="lazy" />
                  {label && (
                    <span className={`${styles.status} ${busy ? styles.statusBusy : ''} ${!busy ? styles.statusAttention : ''}`}>
                      {label}
                    </span>
                  )}
                  {!busy && (
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={(e) => { e.stopPropagation(); removeItem(item) }}
                      aria-label={`Remove ${item.fields.name || 'this photo'}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className={styles.meta}>
                  <p className={styles.name}>{busy ? ' ' : item.fields.name || 'Untitled piece'}</p>
                  <div className={styles.metaRow}>
                    <span className={styles.category}>{item.fields.category ? capitalise(item.fields.category) : ''}</span>
                    {item.fields.weight_grams > 0 && (
                      <span className={styles.weight}>{formatWeight(item.fields.weight_grams, unit)}</span>
                    )}
                  </div>
                  {item.status === 'upload_failed' && (
                    <button type="button" className={styles.retry} onClick={() => retryUpload(item)} disabled={!item.file}>
                      Retry upload
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {counts.total > 0 && <div className={styles.barSpacer} aria-hidden="true" />}
      {counts.total > 0 && (
        <div className={styles.bar}>
          <p className={styles.barText}>
            {counts.inProgress > 0
              ? `${counts.read} of ${counts.total} ready`
              : needsDetails > 0
                ? `${plural(counts.complete, 'piece')} ready, ${needsDetails} need${needsDetails === 1 ? 's' : ''} details`
                : `${plural(counts.complete, 'piece')} ready`}
          </p>
          <button className={styles.btnPrimary} type="button" disabled>
            Add {plural(counts.complete, 'item')}
          </button>
        </div>
      )}

      {editing && (
        <BulkItemEditor
          key={editing.key}
          item={editing}
          position={editingIndex + 1}
          total={editable.length}
          hasNext={editingIndex < editable.length - 1}
          onSave={saveEdits}
          onRemove={() => removeItem(editing)}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  )
}
