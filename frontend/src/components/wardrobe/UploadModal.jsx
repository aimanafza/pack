import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useBulkUpload from '../../store/bulkUpload.js'
import { useWardrobe } from '../../hooks/useWardrobe.js'
import api from '../../utils/api.js'
import { toGrams, toUnit, useWeightUnit } from '../../utils/weight.js'
import styles from './UploadModal.module.css'
import { CATEGORIES, FABRICS, FORMALITIES, OCCASIONS, SEASONS, filterToList, matchOption } from '../../utils/itemFields.js'

export default function UploadModal({ onClose }) {
  const { uploadItem } = useWardrobe()
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const startUploads = useBulkUpload((s) => s.startUploads)
  const [dragging, setDragging] = useState(false)

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [preUploadedUrl, setPreUploadedUrl] = useState(null)
  // The temporary copy Claude reads; the server deletes it once the item is saved
  const [preUploadedId, setPreUploadedId] = useState(null)

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
  const unit = useWeightUnit()
  // Typed in the user's unit, saved in grams
  const [weightInput, setWeightInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customOccasion, setCustomOccasion] = useState('')
  const [showCustomOccasion, setShowCustomOccasion] = useState(false)

  // AI autofill state
  const [analysing, setAnalysing] = useState(false)
  const [hasAnalysed, setHasAnalysed] = useState(false)
  const [aiFilledFields, setAiFilledFields] = useState(new Set())

  function clearAiField(fieldName) {
    setAiFilledFields((prev) => {
      const next = new Set(prev)
      next.delete(fieldName)
      return next
    })
  }

  // One photo keeps this form. Several go to the bulk review screen, which reads them all at once.
  function handleFiles(fileList) {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    if (files.length > 1) {
      startUploads(files)
      onClose()
      navigate('/wardrobe/review')
      return
    }
    handleSingleImage(files[0])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  async function handleSingleImage(file) {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)

    // Pre-upload to Cloudinary so we have a URL for Claude Vision
    try {
      const fd = new FormData()
      fd.append('image', file)
      const { data } = await api.post('/api/v1/uploads/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = data.data.url
      setPreUploadedUrl(url)
      setPreUploadedId(data.data.public_id)

      // Only analyse once per image selection
      if (!hasAnalysed) {
        setAnalysing(true)
        try {
          const res = await api.post('/api/v1/wardrobe/analyse-image', { image_url: url })
          const result = res.data.data || {}
          applyAnalysis(result)
        } catch (err) {
          // Usually silent: the user fills it in by hand. A monthly limit gets said out loud.
          if (err.response?.status === 429) setError(err.response.data.detail)
        } finally {
          setAnalysing(false)
        }
      }
    } catch {
      // Pre-upload failed — fall back to file upload on submit
    }
  }

  function applyAnalysis(result) {
    const filled = new Set()

    if (result.name) { setName(result.name); filled.add('name') }

    const cat = matchOption(result.category, CATEGORIES)
    if (cat) { setCategory(cat); filled.add('category') }

    if (result.subcategory) { setSubcategory(result.subcategory); filled.add('subcategory') }

    if (Array.isArray(result.color) && result.color.length > 0) {
      setColors(result.color.map((c) => c.toLowerCase().trim()))
      filled.add('colors')
    }

    const fab = matchOption(result.fabric, FABRICS)
    if (fab) { setFabric(fab); filled.add('fabric') }

    const formalityFilled = filterToList(result.formality, FORMALITIES)
    if (formalityFilled.length > 0) { setFormality(formalityFilled); filled.add('formality') }

    const occasionsFilled = filterToList(result.occasions, OCCASIONS)
    if (occasionsFilled.length > 0) { setOccasions(occasionsFilled); filled.add('occasions') }

    const seasonFilled = filterToList(result.season, SEASONS)
    if (seasonFilled.length > 0) { setSeason(seasonFilled); filled.add('season') }

    if (result.weight_grams && typeof result.weight_grams === 'number') {
      setWeightInput(String(toUnit(result.weight_grams, unit)))
      filled.add('weightGrams')
    }

    if (result.notes) { setNotes(result.notes); filled.add('notes') }

    setAiFilledFields(filled)
    setHasAnalysed(true)
  }

  function handleColorKeyDown(e) {
    if (e.key === 'Enter' && colorInput.trim()) {
      e.preventDefault()
      const val = colorInput.trim().toLowerCase()
      if (!colors.includes(val)) setColors([...colors, val])
      setColorInput('')
      clearAiField('colors')
    }
  }

  function removeColor(c) {
    setColors(colors.filter((x) => x !== c))
    clearAiField('colors')
  }

  function toggleFormality(f) {
    setFormality((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    )
    clearAiField('formality')
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
    clearAiField('occasions')
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
    clearAiField('season')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!imageFile && !preUploadedUrl) { setError('Add a photo to continue.'); return }
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
      fd.append('name', name.trim())
      fd.append('category', category)
      fd.append('subcategory', subcategory.trim())
      fd.append('color', JSON.stringify(colors))
      fd.append('fabric', fabric)
      fd.append('formality', JSON.stringify(formality))
      fd.append('occasions', JSON.stringify(occasions))
      fd.append('season', JSON.stringify(season))
      fd.append('notes', notes.trim())
      fd.append('weight_grams', String(toGrams(weightInput, unit) || 300))

      // If image was pre-uploaded for analysis, pass the URL.
      // Backend re-runs it through upload_wardrobe_item so background removal
      // and proper folder/naming are always applied.
      if (preUploadedUrl) {
        fd.append('image_url', preUploadedUrl)
        if (preUploadedId) fd.append('temp_public_id', preUploadedId)
      } else {
        fd.append('image', imageFile)
      }

      await uploadItem(fd)
      onClose()
    } catch (err) {
      setError(
        err.response?.status === 429
          ? err.response.data.detail
          : 'Upload failed. Check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Helper: label with optional AI dot
  function AiLabel({ fieldName, children }) {
    return (
      <label className={styles.label}>
        {children}
        {aiFilledFields.has(fieldName) && (
          <span className={styles.aiDot} title="Filled in by PACK. Edit to change it.">✦</span>
        )}
      </label>
    )
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
              className={`${styles.imageUpload} ${dragging ? styles.imageUploadDragging : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
              ) : (
                <span className={styles.imageUploadLabel}>
                  Drop photos or click to choose
                  <span className={styles.imageUploadHint}>Choose several to add them all at once</span>
                </span>
              )}
            </div>
            {analysing && (
              <p className={styles.analysingText}>Analysing item...</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className={styles.fileInput}
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className={`${styles.fields} ${analysing ? styles.fieldsAnalysing : ''}`}>
              <div className={styles.field}>
                <AiLabel fieldName="name">Name</AiLabel>
                <input
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearAiField('name') }}
                  placeholder="White linen shirt"
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <AiLabel fieldName="category">Category</AiLabel>
                  <select
                    className={styles.select}
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); clearAiField('category') }}
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
                  <AiLabel fieldName="subcategory">Subcategory</AiLabel>
                  <input
                    className={styles.input}
                    type="text"
                    value={subcategory}
                    onChange={(e) => { setSubcategory(e.target.value); clearAiField('subcategory') }}
                    placeholder="Shirt, blazer..."
                  />
                </div>
              </div>

              <div className={styles.field}>
                <AiLabel fieldName="colors">Color(s)</AiLabel>
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
                    placeholder={colors.length === 0 ? 'Type a color, press Enter' : ''}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <AiLabel fieldName="fabric">Fabric</AiLabel>
                <select
                  className={styles.select}
                  value={fabric}
                  onChange={(e) => { setFabric(e.target.value); clearAiField('fabric') }}
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
                <AiLabel fieldName="formality">Formality <span className={styles.req}>*</span></AiLabel>
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
                <AiLabel fieldName="occasions">Occasions</AiLabel>
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
                <AiLabel fieldName="season">Season</AiLabel>
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
                <AiLabel fieldName="notes">Notes</AiLabel>
                <textarea
                  className={styles.textarea}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); clearAiField('notes') }}
                  placeholder="How you style it, what it pairs with..."
                />
              </div>

              <div className={styles.field}>
                <AiLabel fieldName="weightGrams">Weight ({unit})</AiLabel>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={weightInput}
                  onChange={(e) => { setWeightInput(e.target.value); clearAiField('weightGrams') }}
                  placeholder={String(toUnit(300, unit))}
                />
              </div>
            </div>

            {aiFilledFields.size > 0 && !analysing && (
              <p className={styles.aiBanner}>
                <span className={styles.aiBannerIcon}>✦</span>
                PACK filled these in. Check them before saving.
              </p>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={loading || analysing}>
                {loading ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
