import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useBulkUpload, { EDITABLE, IN_PROGRESS, summarise } from '../store/bulkUpload.js'
import { missingField, capitalise } from '../utils/itemFields.js'
import { formatWeight, useWeightUnit } from '../utils/weight.js'
import BulkItemEditor from '../components/wardrobe/BulkItemEditor.jsx'
import styles from '../components/wardrobe/BulkUpload.module.css'

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

function statusLabel(item) {
  if (item.status === 'uploading') return 'Uploading'
  if (item.status === 'queued' || item.status === 'reading') return 'Reading'
  if (item.status === 'upload_failed') return 'Upload failed'
  if (item.status === 'failed') return 'Fill in details'
  if (missingField(item.fields)) return 'Needs details'
  return ''
}

// The review screen. Uploads run in the bulk upload store, so this page can be left
// and reopened at any point without losing progress.
export default function BulkUploadPage() {
  const unit = useWeightUnit()
  const items = useBulkUpload((s) => s.items)
  const loaded = useBulkUpload((s) => s.loaded)
  const notice = useBulkUpload((s) => s.notice)
  const refresh = useBulkUpload((s) => s.refresh)
  const startUploads = useBulkUpload((s) => s.startUploads)
  const retryUpload = useBulkUpload((s) => s.retryUpload)
  const removeItem = useBulkUpload((s) => s.removeItem)
  const saveFields = useBulkUpload((s) => s.saveFields)
  const [editingKey, setEditingKey] = useState(null)
  const fileInputRef = useRef(null)

  // Pick up drafts from earlier visits (and anything finished while the user was away)
  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleRemove(item) {
    if (editingKey === item.key) setEditingKey(null)
    await removeItem(item.key)
  }

  const editable = items.filter((i) => EDITABLE.includes(i.status))
  const editingIndex = editable.findIndex((i) => i.key === editingKey)
  const editing = editingIndex >= 0 ? editable[editingIndex] : null

  async function saveEdits(fields, goNext) {
    await saveFields(editing.key, fields)
    setEditingKey(goNext && editable[editingIndex + 1] ? editable[editingIndex + 1].key : null)
  }

  const counts = useMemo(() => summarise(items), [items])
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
                      onClick={(e) => { e.stopPropagation(); handleRemove(item) }}
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
                    <button type="button" className={styles.retry} onClick={() => retryUpload(item.key)} disabled={!item.file}>
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
          onRemove={() => handleRemove(editing)}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  )
}
