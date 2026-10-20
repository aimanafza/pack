import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ItemFieldsForm from './ItemFieldsForm.jsx'
import { missingField } from '../../utils/itemFields.js'
import { toGrams, toUnit, useWeightUnit } from '../../utils/weight.js'
import formStyles from './UploadModal.module.css'
import styles from './BulkUpload.module.css'

// Editable copy of a draft's fields, with weight as text in the user's unit
function toEditable(fields, unit) {
  return {
    ...fields,
    color: fields.color || [],
    formality: fields.formality || [],
    occasions: fields.occasions || [],
    season: fields.season || [],
    weightInput: fields.weight_grams ? String(toUnit(fields.weight_grams, unit)) : '',
  }
}

function fromEditable(value, unit) {
  const { weightInput, ...fields } = value
  return { ...fields, name: fields.name.trim(), weight_grams: toGrams(weightInput, unit) || 0 }
}

// Review one bulk-upload photo: the add-item form's fields, saved back to its draft.
export default function BulkItemEditor({ item, position, total, onSave, onRemove, onClose, hasNext }) {
  const unit = useWeightUnit()
  const [value, setValue] = useState(() => toEditable(item.fields, unit))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cardRef = useRef(null)
  // The page re-renders while it polls; reading onClose through a ref keeps this setup
  // to one run, so focus isn't pulled out of a field mid-typing
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(e) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKey)
    cardRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  async function save(goNext) {
    setSaving(true)
    setError('')
    try {
      await onSave(fromEditable(value, unit), goNext)
    } catch (err) {
      setError(err.response?.data?.detail || "That didn't save. Check your connection and try again.")
      setSaving(false)
    }
  }

  const missing = missingField(value)

  return createPortal(
    <div className={formStyles.overlay} onClick={onClose}>
      <div
        className={`${formStyles.card} ${styles.editorCard}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-editor-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <p className={styles.editorCount}>{position} of {total}</p>
        <p id="bulk-editor-title" className={formStyles.title}>Check the details</p>

        <div className={styles.editorPhoto}>
          <img src={item.previewUrl || item.image_url} alt={value.name || 'Your photo'} />
        </div>

        {item.status === 'failed' && (
          <p className={styles.editorNote}>{item.error || "We couldn't read this photo. Fill in the details yourself."}</p>
        )}

        <ItemFieldsForm value={value} onChange={setValue} unit={unit} />

        {missing && <p className={styles.editorMissing}>{missing}</p>}
        {error && <p className={formStyles.error}>{error}</p>}

        <div className={styles.editorActions}>
          <button type="button" className={styles.btnRemove} onClick={onRemove} disabled={saving}>
            Remove photo
          </button>
          <div className={styles.editorButtons}>
            <button
              type="button"
              className={hasNext ? formStyles.btnSecondary : formStyles.btnPrimary}
              onClick={() => save(false)}
              disabled={saving}
            >
              {saving && !hasNext ? 'Saving...' : 'Save'}
            </button>
            {hasNext && (
              <button type="button" className={formStyles.btnPrimary} onClick={() => save(true)} disabled={saving}>
                {saving ? 'Saving...' : 'Save & next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
