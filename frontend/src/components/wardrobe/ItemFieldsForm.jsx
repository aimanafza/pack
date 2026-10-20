import { useState } from 'react'
import { CATEGORIES, FABRICS, FORMALITIES, OCCASIONS, SEASONS, capitalise } from '../../utils/itemFields.js'
import { toUnit } from '../../utils/weight.js'
import styles from './UploadModal.module.css'

// The wardrobe item fields as a controlled form: `value` holds the fields (weight as
// `weightInput`, a string in the user's unit) and every edit calls `onChange` with the
// whole updated object. Styled with the add-item form's classes so both look the same.
export default function ItemFieldsForm({ value, onChange, unit }) {
  const [colorInput, setColorInput] = useState('')
  const [customOccasion, setCustomOccasion] = useState('')
  const [showCustomOccasion, setShowCustomOccasion] = useState(
    () => (value.occasions || []).some((o) => o.startsWith('other:'))
  )

  const set = (patch) => onChange({ ...value, ...patch })
  const toggle = (key, option) => {
    const list = value[key] || []
    set({ [key]: list.includes(option) ? list.filter((x) => x !== option) : [...list, option] })
  }

  function addColor(e) {
    if (e.key !== 'Enter' || !colorInput.trim()) return
    e.preventDefault()
    const c = colorInput.trim().toLowerCase()
    if (!value.color.includes(c)) set({ color: [...value.color, c] })
    setColorInput('')
  }

  function addCustomOccasion(e) {
    if (e.key !== 'Enter' || !customOccasion.trim()) return
    e.preventDefault()
    const occ = `other:${customOccasion.trim().toLowerCase()}`
    if (!value.occasions.includes(occ)) set({ occasions: [...value.occasions, occ] })
    setCustomOccasion('')
  }

  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="bulk-name">Name</label>
        <input
          id="bulk-name"
          className={styles.input}
          type="text"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="White linen shirt"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="bulk-category">Category</label>
          <select
            id="bulk-category"
            className={styles.select}
            value={value.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            <option value="">Select</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{capitalise(c)}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="bulk-subcategory">Subcategory</label>
          <input
            id="bulk-subcategory"
            className={styles.input}
            type="text"
            value={value.subcategory}
            onChange={(e) => set({ subcategory: e.target.value })}
            placeholder="Shirt, blazer..."
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="bulk-color">Color(s)</label>
        <div className={styles.tagInputWrap} onClick={() => document.getElementById('bulk-color')?.focus()}>
          {value.color.map((c) => (
            <span key={c} className={styles.tag}>
              {c}
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => set({ color: value.color.filter((x) => x !== c) })}
                aria-label={`Remove ${c}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="bulk-color"
            className={styles.tagInput}
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onKeyDown={addColor}
            placeholder={value.color.length === 0 ? 'Type a color, press Enter' : ''}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="bulk-fabric">Fabric</label>
        <select
          id="bulk-fabric"
          className={styles.select}
          value={value.fabric}
          onChange={(e) => set({ fabric: e.target.value })}
        >
          <option value="">Select</option>
          {FABRICS.map((f) => <option key={f} value={f}>{capitalise(f)}</option>)}
        </select>
      </div>

      <div className={styles.field}>
        <p className={styles.label}>Formality</p>
        <div className={styles.pillGroup}>
          {FORMALITIES.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.pill} ${value.formality.includes(f) ? styles.pillActive : ''}`}
              onClick={() => toggle('formality', f)}
              aria-pressed={value.formality.includes(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <p className={styles.label}>Occasions</p>
        <div className={styles.pillGroup}>
          {OCCASIONS.map((occ) => (
            <button
              key={occ}
              type="button"
              className={`${styles.pill} ${value.occasions.includes(occ) ? styles.pillActive : ''}`}
              onClick={() => toggle('occasions', occ)}
              aria-pressed={value.occasions.includes(occ)}
            >
              {occ}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.pill} ${showCustomOccasion ? styles.pillActive : ''}`}
            onClick={() => setShowCustomOccasion((s) => !s)}
          >
            other +
          </button>
        </div>
        {showCustomOccasion && (
          <input
            className={`${styles.input} ${styles.customOccInput}`}
            placeholder="Type occasion, press Enter"
            value={customOccasion}
            onChange={(e) => setCustomOccasion(e.target.value)}
            onKeyDown={addCustomOccasion}
          />
        )}
        {value.occasions.filter((o) => o.startsWith('other:')).map((o) => (
          <span key={o} className={styles.tag}>
            {o.replace('other:', '')}
            <button
              type="button"
              className={styles.tagRemove}
              onClick={() => set({ occasions: value.occasions.filter((x) => x !== o) })}
              aria-label={`Remove ${o.replace('other:', '')}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className={styles.field}>
        <p className={styles.label}>Season</p>
        <div className={styles.pillGroup}>
          {SEASONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.pill} ${value.season.includes(s) ? styles.pillActive : ''}`}
              onClick={() => toggle('season', s)}
              aria-pressed={value.season.includes(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="bulk-notes">Notes</label>
        <textarea
          id="bulk-notes"
          className={styles.textarea}
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="How you style it, what it pairs with..."
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="bulk-weight">Weight ({unit})</label>
        <input
          id="bulk-weight"
          className={styles.input}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value.weightInput}
          onChange={(e) => set({ weightInput: e.target.value })}
          placeholder={String(toUnit(300, unit))}
        />
      </div>
    </div>
  )
}
