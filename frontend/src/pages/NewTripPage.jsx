import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useTrips } from '../hooks/useTrips.js'
import api from '../utils/api.js'
import styles from './NewTripPage.module.css'
import { CarryOnIcon, CheckedBagIcon, HandbagIcon, BackpackIcon } from '../components/ui/BagIllustration.jsx'
import WardrobePickerModal from '../components/trips/WardrobePickerModal.jsx'

const OCCASIONS = [
  'Sightseeing',
  'Business meetings',
  'Casual days',
  'Dinners out',
  'Beach',
  'Hiking',
  'Formal events',
  'Nightlife',
]

const CLIMATES = [
  { label: 'Hot', value: 'hot' },
  { label: 'Warm', value: 'warm' },
  { label: 'Mild', value: 'mild' },
  { label: 'Cold', value: 'cold' },
  { label: 'Variable', value: 'variable' },
]

const BAG_TYPES = [
  {
    type: 'carry_on',
    label: 'Carry-On',
    defaultLimit: 7,
    defaultEmpty: 2,
    Icon: CarryOnIcon,
  },
  {
    type: 'checked',
    label: 'Checked Bag',
    defaultLimit: 23,
    defaultEmpty: 3,
    Icon: CheckedBagIcon,
  },
  {
    type: 'handbag',
    label: 'Handbag',
    defaultLimit: 5,
    defaultEmpty: 0.5,
    Icon: HandbagIcon,
  },
  {
    type: 'backpack',
    label: 'Backpack',
    defaultLimit: 10,
    defaultEmpty: 0.8,
    Icon: BackpackIcon,
  },
]

const MAX_IMAGES = 5

let bagCounter = 0

function generateBagId() {
  return `bag_${++bagCounter}_${Date.now()}`
}

function getBagLabel(type, existingBags) {
  const names = {
    carry_on: 'Carry-On',
    checked: 'Checked Bag',
    handbag: 'Handbag',
    backpack: 'Backpack',
  }
  const base = names[type] || type
  const count = existingBags.filter((b) => b.bag_type === type).length
  return count === 0 ? base : `${base} ${count + 1}`
}

export default function NewTripPage() {
  const { createTrip } = useTrips()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [climate, setClimate] = useState('')
  const [occasions, setOccasions] = useState([])
  const [notes, setNotes] = useState('')
  const [inspirationFiles, setInspirationFiles] = useState([])
  const [inspirationPreviews, setInspirationPreviews] = useState([])

  // Bags
  const [bags, setBags] = useState([])
  const [reservedItems, setReservedItems] = useState([])
  const [newReservedName, setNewReservedName] = useState('')
  const [newReservedWeight, setNewReservedWeight] = useState('')

  // Anchor items
  const [anchorItems, setAnchorItems] = useState([])
  const [showPickerModal, setShowPickerModal] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Bag builder logic ──────────────────────────────────────────────

  function addBag(typeObj) {
    const label = getBagLabel(typeObj.type, bags)
    setBags((prev) => [
      ...prev,
      {
        bag_id: generateBagId(),
        bag_type: typeObj.type,
        label,
        weight_limit_kg: typeObj.defaultLimit,
        empty_bag_kg: typeObj.defaultEmpty,
      },
    ])
  }

  function removeBag(bag_id) {
    setBags((prev) => prev.filter((b) => b.bag_id !== bag_id))
  }

  function updateBag(bag_id, field, value) {
    setBags((prev) =>
      prev.map((b) => (b.bag_id === bag_id ? { ...b, [field]: value } : b))
    )
  }

  const bagRows = bags.map((b) => {
    const limitG = Math.round((parseFloat(b.weight_limit_kg) || 0) * 1000)
    const emptyG = Math.round((parseFloat(b.empty_bag_kg) || 0) * 1000)
    const availG = Math.max(0, limitG - emptyG)
    return { ...b, limitG, emptyG, availG }
  })

  const reservedTotal = reservedItems.reduce((s, r) => s + r.weight_grams, 0)
  const totalBagAvail = bagRows.reduce((s, b) => s + b.availG, 0)
  const totalClothingGrams = Math.max(0, totalBagAvail - reservedTotal)

  // ── Reserved items ─────────────────────────────────────────────────

  function addReservedItem() {
    const rname = newReservedName.trim()
    const grams = Math.round(parseFloat(newReservedWeight) * 1000)
    if (!rname || !grams) return
    setReservedItems((prev) => [...prev, { name: rname, weight_grams: grams }])
    setNewReservedName('')
    setNewReservedWeight('')
  }

  function removeReservedItem(idx) {
    setReservedItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Occasions / inspiration ────────────────────────────────────────

  function toggleOccasion(occ) {
    setOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]
    )
  }

  function handleInspirationChange(e) {
    const picked = Array.from(e.target.files || [])
    const available = MAX_IMAGES - inspirationFiles.length
    const toAdd = picked.slice(0, available)
    if (!toAdd.length) return
    setInspirationFiles((prev) => [...prev, ...toAdd])
    toAdd.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) =>
        setInspirationPreviews((prev) => [...prev, { src: ev.target.result, name: file.name }])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function removeInspiration(idx) {
    setInspirationFiles((prev) => prev.filter((_, i) => i !== idx))
    setInspirationPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleDrop(e) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    const available = MAX_IMAGES - inspirationFiles.length
    const toAdd = dropped.slice(0, available)
    if (!toAdd.length) return
    setInspirationFiles((prev) => [...prev, ...toAdd])
    toAdd.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) =>
        setInspirationPreviews((prev) => [...prev, { src: ev.target.result, name: file.name }])
      reader.readAsDataURL(file)
    })
  }

  // ── Anchor items ───────────────────────────────────────────────────

  function handlePickerConfirm(selectedItems) {
    // Merge with existing: keep notes for items already picked, add new ones
    setAnchorItems((prev) => {
      const existingMap = new Map(prev.map((a) => [a.item_id, a]))
      return selectedItems.map((item) => {
        const id = item.id || item._id
        return existingMap.has(id)
          ? existingMap.get(id)
          : { item_id: id, name: item.name, image_url: item.image_url, note: '' }
      })
    })
    setShowPickerModal(false)
  }

  function updateAnchorNote(item_id, note) {
    setAnchorItems((prev) =>
      prev.map((a) => (a.item_id === item_id ? { ...a, note } : a))
    )
  }

  function removeAnchorItem(item_id) {
    setAnchorItems((prev) => prev.filter((a) => a.item_id !== item_id))
  }

  // ── Submit ─────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !destination.trim() || !startDate || !endDate) {
      setError('Fill in the trip name, destination, and dates to continue.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const bagsPayload = bagRows.map((b) => ({
        bag_id: b.bag_id,
        bag_type: b.bag_type,
        label: b.label,
        weight_limit_grams: b.limitG,
        empty_bag_weight_grams: b.emptyG,
        available_grams: b.availG,
      }))

      const trip = await createTrip({
        name: name.trim(),
        destination: destination.trim(),
        start_date: startDate,
        end_date: endDate,
        climate,
        occasions,
        notes: notes.trim(),
        bags: bagsPayload,
        reserved_items: reservedItems,
        weight_unit: 'kg',
        anchor_items: anchorItems.map((a) => ({ item_id: a.item_id, note: a.note })),
      })

      if (inspirationFiles.length > 0) {
        const fd = new FormData()
        inspirationFiles.forEach((f) => fd.append('images', f))
        await api.post(`/api/v1/trips/${trip.id}/inspiration/upload`, fd)
        api.post(`/api/v1/trips/${trip.id}/inspiration/analyze`).catch(() => {})
      }

      navigate(`/trips/${trip.id}`)
    } catch {
      setError('Could not create trip. Check your connection and try again.')
      setLoading(false)
    }
  }

  const canAddMore = inspirationFiles.length < MAX_IMAGES

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/trips')} type="button">
          ← Trips
        </button>
        <p className={styles.pageLabel}>New Trip</p>
        <h1 className={styles.headline}>Where are you going?</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        {/* 1. Trip name */}
        <div className={styles.field}>
          <label className={styles.label}>Trip Name</label>
          <input
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Paris in June"
          />
        </div>

        {/* 2. Destination */}
        <div className={styles.field}>
          <label className={styles.label}>Destination</label>
          <input
            className={styles.input}
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Paris, France"
          />
        </div>

        {/* 3. Dates */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Depart</label>
            <input
              className={styles.input}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Return</label>
            <input
              className={styles.input}
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* 4. Climate */}
        <div className={styles.field}>
          <label className={styles.label}>Climate</label>
          <select
            className={styles.select}
            value={climate}
            onChange={(e) => setClimate(e.target.value)}
          >
            <option value="">Select climate</option>
            {CLIMATES.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* 5. Occasions */}
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
          </div>
        </div>

        {/* 6. Anchor items */}
        <div className={styles.field}>
          <label className={styles.label}>Items You're Definitely Bringing <span className={styles.labelOptional}>optional</span></label>
          <p className={styles.inspirationSubtext}>
            Select pieces from your wardrobe. Your stylist will build outfits around them.
          </p>

          {anchorItems.length > 0 && (
            <div className={styles.anchorList}>
              {anchorItems.map((a) => (
                <div key={a.item_id} className={styles.anchorRow}>
                  <div className={styles.anchorImg}>
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.name} className={styles.anchorPhoto} />
                    ) : (
                      <div className={styles.anchorPlaceholder} />
                    )}
                  </div>
                  <div className={styles.anchorBody}>
                    <p className={styles.anchorName}>{a.name}</p>
                    <input
                      className={styles.anchorNoteInput}
                      type="text"
                      placeholder="Any styling notes? (optional)"
                      value={a.note}
                      onChange={(e) => updateAnchorNote(a.item_id, e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.anchorRemove}
                    onClick={() => removeAnchorItem(a.item_id)}
                    aria-label={`Remove ${a.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className={styles.anchorPickBtn}
            onClick={() => setShowPickerModal(true)}
          >
            {anchorItems.length === 0 ? '+ Choose from wardrobe' : '+ Add more items'}
          </button>
        </div>

        {/* 7. Notes */}
        <div className={styles.field}>
          <label className={styles.label}>Notes to Your Stylist</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="I have a wedding on Saturday. I want to pack light but look put-together every day."
          />
        </div>

        {/* 8. Bag builder */}
        <div className={styles.field}>
          <label className={styles.label}>Your Bags</label>
          <p className={styles.inspirationSubtext}>Add every bag you're travelling with.</p>

          {/* Bag type buttons */}
          <div className={styles.bagTypeRow}>
            {BAG_TYPES.map(({ type, label, Icon, defaultLimit }) => (
              <button
                key={type}
                type="button"
                className={styles.bagTypeBtn}
                onClick={() => addBag({ type, label, defaultLimit, defaultEmpty: BAG_TYPES.find(b => b.type === type).defaultEmpty })}
              >
                <div className={styles.bagTypeIcon}>
                  <Icon size={0.6} style={{ color: 'var(--color-text-secondary)' }} />
                </div>
                <span className={styles.bagTypeName}>{label}</span>
                <span className={styles.bagTypeAdd}>+</span>
              </button>
            ))}
          </div>

          {/* Added bags list */}
          {bags.length > 0 && (
            <div className={styles.bagList}>
              {bagRows.map((b) => {
                const typeObj = BAG_TYPES.find((t) => t.type === b.bag_type)
                const Icon = typeObj?.Icon
                const isNegative = b.availG < 0
                return (
                  <div key={b.bag_id} className={styles.bagRow}>
                    <div className={styles.bagRowIcon}>
                      {Icon && <Icon size={0.38} style={{ color: 'var(--color-text-secondary)' }} />}
                    </div>
                    <span className={styles.bagRowLabel}>{b.label}</span>
                    <div className={styles.bagRowInputs}>
                      <div className={styles.bagInputGroup}>
                        <label className={styles.bagInputLabel}>Limit kg</label>
                        <input
                          className={styles.bagInput}
                          type="number"
                          min="0"
                          step="0.5"
                          value={b.weight_limit_kg}
                          onChange={(e) => updateBag(b.bag_id, 'weight_limit_kg', e.target.value)}
                        />
                      </div>
                      <div className={styles.bagInputGroup}>
                        <label className={styles.bagInputLabel}>Empty kg</label>
                        <input
                          className={styles.bagInput}
                          type="number"
                          min="0"
                          step="0.1"
                          value={b.empty_bag_kg}
                          onChange={(e) => updateBag(b.bag_id, 'empty_bag_kg', e.target.value)}
                        />
                      </div>
                      <span className={`${styles.bagAvail} ${isNegative ? styles.bagAvailError : ''}`}>
                        = {(b.availG / 1000).toFixed(1)} kg
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.bagRemove}
                      onClick={() => removeBag(b.bag_id)}
                      aria-label={`Remove ${b.label}`}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 9. Reserved items */}
        {bags.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Reserved Space</label>
            <p className={styles.inspirationSubtext}>
              Laptop, toiletries, shoes — things that take weight but aren't outfits.
            </p>
            {reservedItems.length > 0 && (
              <div className={styles.reservedList}>
                {reservedItems.map((r, idx) => (
                  <div key={idx} className={styles.reservedItem}>
                    <span className={styles.reservedName}>{r.name}</span>
                    <span className={styles.reservedWeight}>{(r.weight_grams / 1000).toFixed(2)} kg</span>
                    <button
                      type="button"
                      className={styles.reservedRemove}
                      onClick={() => removeReservedItem(idx)}
                      aria-label={`Remove ${r.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.reservedInputRow}>
              <input
                className={`${styles.input} ${styles.reservedInputName}`}
                type="text"
                placeholder="Item name"
                value={newReservedName}
                onChange={(e) => setNewReservedName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReservedItem())}
              />
              <input
                className={`${styles.input} ${styles.reservedInputWeight}`}
                type="number"
                min="0"
                step="0.1"
                placeholder="kg"
                value={newReservedWeight}
                onChange={(e) => setNewReservedWeight(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReservedItem())}
              />
              <button type="button" className={styles.reservedAdd} onClick={addReservedItem}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* 10. Live weight total */}
        {bags.length > 0 && (
          <div className={styles.weightCalc}>
            <p className={styles.weightCalcTitle}>Total Available for Clothes</p>
            <p className={styles.weightCalcBig}>{(totalClothingGrams / 1000).toFixed(1)} kg</p>
            <div className={styles.weightCalcBreakdown}>
              {bagRows.map((b) => (
                <div key={b.bag_id} className={`${styles.weightCalcLine} ${b.availG < 0 ? styles.weightCalcError : ''}`}>
                  {b.label}: {(b.limitG / 1000).toFixed(1)} kg − {(b.emptyG / 1000).toFixed(1)} kg bag = {(b.availG / 1000).toFixed(1)} kg
                </div>
              ))}
              {reservedItems.length > 0 && (
                <div className={styles.weightCalcLine}>
                  Reserved: −{(reservedTotal / 1000).toFixed(2)} kg
                </div>
              )}
              {bags.length > 1 && (
                <div className={`${styles.weightCalcLine} ${styles.weightCalcLineTotal}`}>
                  Total: {(totalClothingGrams / 1000).toFixed(1)} kg available for clothing
                </div>
              )}
            </div>
          </div>
        )}

        {/* 11. Inspiration upload */}
        <div className={styles.field}>
          <label className={styles.label}>Style Inspiration</label>
          <p className={styles.inspirationSubtext}>
            Drop your Pinterest screenshots, moodboards, or outfit inspo. Your stylist will study the vibe.
          </p>

          {inspirationPreviews.length > 0 && (
            <div className={styles.thumbnailRow}>
              {inspirationPreviews.map((img, idx) => (
                <div key={idx} className={styles.thumbnail}>
                  <img src={img.src} alt={img.name} className={styles.thumbnailImg} />
                  <button
                    type="button"
                    className={styles.thumbnailRemove}
                    onClick={() => removeInspiration(idx)}
                    aria-label={`Remove ${img.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {canAddMore && (
            <div
              className={styles.uploadZone}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="Upload inspiration images"
            >
              <span className={styles.uploadZoneText}>
                {inspirationFiles.length === 0
                  ? 'Drop images here or click to browse'
                  : `Add more (${MAX_IMAGES - inspirationFiles.length} remaining)`}
              </span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className={styles.fileInput}
            onChange={handleInspirationChange}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={styles.btnSubmit}
          disabled={loading || !name.trim() || !destination.trim() || !startDate || !endDate}
        >
          {loading ? 'Creating your trip...' : 'Plan This Trip'}
        </button>
      </form>

      <AnimatePresence>
        {showPickerModal && (
          <WardrobePickerModal
            selectedIds={anchorItems.map((a) => a.item_id)}
            onConfirm={handlePickerConfirm}
            onClose={() => setShowPickerModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
