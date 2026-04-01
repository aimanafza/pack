import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWardrobe } from '../../hooks/useWardrobe.js'
import styles from './UploadModal.module.css'

const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory']
const FABRICS = ['linen', 'cotton', 'silk', 'wool', 'synthetic', 'denim', 'leather', 'other']
const FORMALITIES = ['casual', 'smart-casual', 'elevated casual', 'business casual', 'business', 'formal']
const OCCASIONS = ['work', 'casual', 'formal', 'travel', 'dinner', 'beach', 'hiking', 'nightlife']
const SEASONS = ['spring', 'summer', 'fall', 'winter', 'all']

export default function UploadModal({ onClose }) {
  const { uploadItem } = useWardrobe()
  const fileInputRef = useRef(null)

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [colors, setColors] = useState([])
  const [colorInput, setColorInput] = useState('')
  const [fabric, setFabric] = useState('')
  const [formality, setFormality] = useState([])
  const [occasions, setOccasions] = useState([])
  const [season, setSeason] = useState([])
  const [notes, setNotes] = useState('')
  const [weightGrams, setWeightGrams] = useState(300)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customOccasion, setCustomOccasion] = useState('')
  const [showCustomOccasion, setShowCustomOccasion] = useState(false)

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleColorKeyDown(e) {
    if (e.key === 'Enter' && colorInput.trim()) {
      e.preventDefault()
      const val = colorInput.trim().toLowerCase()
      if (!colors.includes(val)) setColors([...colors, val])
      setColorInput('')
    }
  }

  function removeColor(c) {
    setColors(colors.filter((x) => x !== c))
  }

  function toggleFormality(f) {
    setFormality((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    )
  }

  function toggleOccasion(occ) {
    if (occ === 'other') {
      setShowCustomOccasion((prev) => !prev)
      if (showCustomOccasion) {
        setOccasions((prev) => prev.filter((o) => !o.startsWith('other:')))
      }
      return
    }
    setOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]
    )
  }

  function handleCustomOccasionKeyDown(e) {
    if (e.key === 'Enter' && customOccasion.trim()) {
      e.preventDefault()
      const val = `other:${customOccasion.trim().toLowerCase()}`
      if (!occasions.includes(val)) setOccasions((prev) => [...prev, val])
      setCustomOccasion('')
    }
  }

  function toggleSeason(s) {
    setSeason((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!imageFile) { setError('Add a photo to continue.'); return }
    if (!name.trim()) { setError('Give this item a name.'); return }
    if (!category) { setError('Select a category.'); return }
    if (colors.length === 0) { setError('Add at least one color.'); return }
    if (!fabric) { setError('Select a fabric.'); return }
    if (formality.length === 0) { setError('Select at least one formality level.'); return }
    if (occasions.length === 0) { setError('Select at least one occasion.'); return }
    if (season.length === 0) { setError('Select at least one season.'); return }

    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('image', imageFile)
      fd.append('name', name.trim())
      fd.append('category', category)
      fd.append('subcategory', subcategory.trim())
      fd.append('color', JSON.stringify(colors))
      fd.append('fabric', fabric)
      fd.append('formality', JSON.stringify(formality))
      fd.append('occasions', JSON.stringify(occasions))
      fd.append('season', JSON.stringify(season))
      fd.append('notes', notes.trim())
      fd.append('weight_grams', String(weightGrams || 300))
      await uploadItem(fd)
      onClose()
    } catch {
      setError('Upload failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div
          className={styles.card}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <p className={styles.title}>Add to Wardrobe</p>

          <form onSubmit={handleSubmit} noValidate>
            <div
              className={styles.imageUpload}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
              ) : (
                <span className={styles.imageUploadLabel}>
                  Drop an image or click to upload
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={handleImageChange}
            />

            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="White linen shirt"
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Category</label>
                  <select
                    className={styles.select}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Subcategory</label>
                  <input
                    className={styles.input}
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="Shirt, blazer..."
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Color(s)</label>
                <div
                  className={styles.tagInputWrap}
                  onClick={() => document.getElementById('color-input')?.focus()}
                >
                  {colors.map((c) => (
                    <span key={c} className={styles.tag}>
                      {c}
                      <button
                        type="button"
                        className={styles.tagRemove}
                        onClick={() => removeColor(c)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="color-input"
                    className={styles.tagInput}
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={handleColorKeyDown}
                    placeholder="Type a color, press Enter"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Fabric</label>
                <select
                  className={styles.select}
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                >
                  <option value="">Select</option>
                  {FABRICS.map((f) => (
                    <option key={f} value={f}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Formality <span className={styles.req}>*</span></label>
                <div className={styles.pillGroup}>
                  {FORMALITIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`${styles.pill} ${formality.includes(f) ? styles.pillActive : ''}`}
                      onClick={() => toggleFormality(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Occasions</label>
                <div className={styles.pillGroup}>
                  {OCCASIONS.map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      className={`${styles.pill} ${occasions.includes(occ) ? styles.pillActive : ''}`}
                      onClick={() => toggleOccasion(occ)}
                    >
                      {occ}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.pill} ${showCustomOccasion ? styles.pillActive : ''}`}
                    onClick={() => toggleOccasion('other')}
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
                    onKeyDown={handleCustomOccasionKeyDown}
                    autoFocus
                  />
                )}
                {occasions.filter(o => o.startsWith('other:')).map(o => (
                  <span key={o} className={styles.tag}>
                    {o.replace('other:', '')}
                    <button type="button" className={styles.tagRemove} onClick={() => setOccasions(prev => prev.filter(x => x !== o))}>×</button>
                  </span>
                ))}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Season</label>
                <div className={styles.pillGroup}>
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.pill} ${season.includes(s) ? styles.pillActive : ''}`}
                      onClick={() => toggleSeason(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <textarea
                  className={styles.textarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How you style it, what it pairs with..."
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Weight (grams)</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  max="5000"
                  step="10"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(parseInt(e.target.value) || 300)}
                  placeholder="300"
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
