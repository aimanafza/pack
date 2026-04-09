import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import styles from './TripDetail.module.css'
import ConfirmModal from '../ui/ConfirmModal.jsx'
import LookbookSection from '../LookbookSection.jsx'

const OCCASIONS = [
  'Sightseeing', 'Business meetings', 'Casual days', 'Dinners out',
  'Beach', 'Hiking', 'Formal events', 'Nightlife',
]
const CLIMATES = [
  { label: 'Hot', value: 'hot' }, { label: 'Warm', value: 'warm' },
  { label: 'Mild', value: 'mild' }, { label: 'Cold', value: 'cold' },
  { label: 'Variable', value: 'variable' },
]

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

/* ─── Vibe card ─────────────────────────────────────────────────── */
function VibeCard({ vibe }) {
  return (
    <div className={styles.vibeCard}>
      <p className={styles.vibeSummary}>{vibe.summary}</p>

      {vibe.style_keywords.length > 0 && (
        <div className={styles.vibeRow}>
          {vibe.style_keywords.map((kw) => (
            <span key={kw} className={styles.vibePill}>{kw}</span>
          ))}
        </div>
      )}

      {vibe.color_palette.length > 0 && (
        <div className={styles.vibeRow}>
          {vibe.color_palette.map((color) => (
            <span key={color} className={styles.colorChip}>
              <span
                className={styles.colorSwatch}
                style={{ background: color.toLowerCase().replace(/\s/g, '') }}
              />
              {color}
            </span>
          ))}
        </div>
      )}

      {vibe.formality_level && (
        <div className={styles.vibeRow}>
          <span className={styles.formalityTag}>{vibe.formality_level}</span>
        </div>
      )}

      {vibe.avoid.length > 0 && (
        <div className={styles.avoidRow}>
          <span className={styles.avoidLabel}>Avoid</span>
          <div className={styles.vibeRow}>
            {vibe.avoid.map((item) => (
              <span key={item} className={styles.avoidTag}>{item}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Vibe section (left column, below trip info) ─────────────── */
function VibeSection({ trip }) {
  const hasImages = trip.inspiration_images?.length > 0
  const hasVibe = !!trip.vibe_analysis
  const navigate = useNavigate()

  return (
    <div className={styles.vibeSection}>
      <p className={styles.colLabel}>Your Vibe</p>

      {hasImages && (
        <div className={styles.inspRow}>
          {trip.inspiration_images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={`Inspiration ${i + 1}`}
              className={styles.inspThumb}
            />
          ))}
        </div>
      )}

      {hasVibe ? (
        <VibeCard vibe={trip.vibe_analysis} />
      ) : hasImages ? (
        <p className={styles.analyzingText}>Analyzing your vibe...</p>
      ) : (
        <button
          className={styles.addInspLink}
          onClick={() => navigate(`/trips/new`)}
          type="button"
        >
          Add inspiration →
        </button>
      )}
    </div>
  )
}

/* ─── Regenerate Modal ────────────────────────────────────────── */
function RegenerateModal({ trip, onRegenerateAll, onRegenerateSelected, onClose, loading }) {
  const [mode, setMode] = useState('all') // 'all' | 'select'
  const [selected, setSelected] = useState(new Set())

  const approvedOutfits = trip.packing_list?.outfits?.filter(
    (o) => trip.approved_outfits?.includes(o.name)
  ) ?? []

  function toggleOutfit(name) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function handleConfirm() {
    if (mode === 'all') {
      onRegenerateAll()
    } else {
      onRegenerateSelected([...selected])
    }
  }

  const canConfirm = mode === 'all' || selected.size > 0
  const btnLabel = mode === 'all'
    ? 'Regenerate all looks'
    : selected.size > 0
    ? `Regenerate ${selected.size} look${selected.size !== 1 ? 's' : ''}`
    : 'Select looks to regenerate'

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div className={styles.regenOverlay} onClick={handleOverlayClick}>
      <div className={styles.regenModal}>
        <h2 className={styles.regenTitle}>Regenerate outfits</h2>
        <p className={styles.regenSubtitle}>Choose which looks to redo</p>

        <div className={styles.regenModeRow}>
          <button
            type="button"
            className={`${styles.regenModeBtn} ${mode === 'all' ? styles.regenModeBtnActive : ''}`}
            onClick={() => setMode('all')}
          >
            All outfits
          </button>
          <button
            type="button"
            className={`${styles.regenModeBtn} ${mode === 'select' ? styles.regenModeBtnActive : ''}`}
            onClick={() => setMode('select')}
          >
            Select looks
          </button>
        </div>

        {mode === 'select' && approvedOutfits.length > 0 && (
          <div className={styles.regenGrid}>
            {approvedOutfits.map((outfit) => {
              const isSelected = selected.has(outfit.name)
              return (
                <button
                  key={outfit.outfit_id || outfit.name}
                  type="button"
                  className={`${styles.regenCard} ${isSelected ? styles.regenCardSelected : ''}`}
                  onClick={() => toggleOutfit(outfit.name)}
                >
                  {isSelected && <span className={styles.regenCheck}>✓</span>}
                  <div className={styles.regenCardImg}>
                    {(outfit.generated_image_url || outfit.lookbook_image_url) ? (
                      <img src={outfit.generated_image_url || outfit.lookbook_image_url} alt={outfit.name} className={styles.regenCardPhoto} />
                    ) : (
                      <div className={styles.regenCardPlaceholder} />
                    )}
                  </div>
                  <p className={styles.regenCardLabel}>
                    {outfit.day_label || outfit.name}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {loading && (
          <p className={styles.regenLoading}>Generating new outfits...</p>
        )}

        <div className={styles.regenActions}>
          <button type="button" className={styles.regenCancel} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.regenConfirm}
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ─── Right column — packing ──────────────────────────────────── */
function PackingColumn({ trip, onGeneratePacking, onUnapproveOutfits, packingLoading, packingError, regenOpen, setRegenOpen }) {
  const navigate = useNavigate()
  const hasVibe = !!trip.vibe_analysis
  const hasPacking = !!trip.packing_list
  const hasApproved = trip.approved_outfits?.length > 0

  function handleRegenerateAll() {
    onGeneratePacking()
    // modal closes after navigate (triggered inside handleGeneratePacking)
    setRegenOpen(false)
  }

  function handleRegenerateSelected(outfitNames) {
    setRegenOpen(false)
    onUnapproveOutfits(outfitNames)
  }

  return (
    <div className={styles.packingCol}>
      <p className={styles.colLabel}>Packing</p>

      {!hasPacking ? (
        <button
          className={styles.btnGenerate}
          onClick={() => navigate(`/trips/${trip.id}/review`)}
          type="button"
        >
          {hasVibe ? 'Build Outfits from Your Vibe' : 'Build My Packing List'}
        </button>
      ) : (
        <div className={styles.packingReady}>
          <div className={styles.stylistNote}>
            <p className={styles.stylistNoteText}>{trip.packing_list.stylist_note}</p>
          </div>

          {hasApproved ? (
            <div className={styles.approvedSummary}>
              <p className={styles.approvedCount}>
                {trip.approved_outfits.length} outfit{trip.approved_outfits.length !== 1 ? 's' : ''} approved
              </p>
              <button
                className={styles.btnPrimary}
                onClick={() => navigate(`/trips/${trip.id}/pack`)}
                type="button"
              >
                Go to Packing
              </button>
            </div>
          ) : (
            <button
              className={styles.btnPrimary}
              onClick={() => navigate(`/trips/${trip.id}/review`)}
              type="button"
            >
              Review Outfits
            </button>
          )}
        </div>
      )}

      {hasPacking && (
        <button
          className={styles.btnRegenerate}
          onClick={() => setRegenOpen(true)}
          type="button"
        >
          Regenerate with AI
        </button>
      )}

      {packingError && (
        <p className={styles.packingError}>{packingError}</p>
      )}

      {regenOpen && (
        <RegenerateModal
          trip={trip}
          onRegenerateAll={handleRegenerateAll}
          onRegenerateSelected={handleRegenerateSelected}
          onClose={() => setRegenOpen(false)}
          loading={packingLoading}
        />
      )}
    </div>
  )
}

/* ─── Edit form ───────────────────────────────────────────────── */
function EditTripForm({ trip, onSave, onCancel }) {
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination)
  const [startDate, setStartDate] = useState(trip.start_date)
  const [endDate, setEndDate] = useState(trip.end_date)
  const [climate, setClimate] = useState(trip.climate || '')
  const [occasions, setOccasions] = useState([...(trip.occasions || [])])
  const [notes, setNotes] = useState(trip.notes || '')
  const [saving, setSaving] = useState(false)

  function toggleOccasion(occ) {
    setOccasions((prev) => prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ])
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ name, destination, start_date: startDate, end_date: endDate, climate, occasions, notes })
    setSaving(false)
  }

  return (
    <div className={styles.editForm}>
      <p className={styles.editFormLabel}>Editing Trip</p>

      <div className={styles.editField}>
        <label className={styles.editLabel}>Trip Name</label>
        <input className={styles.editInput} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className={styles.editField}>
        <label className={styles.editLabel}>Destination</label>
        <input className={styles.editInput} value={destination} onChange={(e) => setDestination(e.target.value)} />
      </div>

      <div className={styles.editRow}>
        <div className={styles.editField}>
          <label className={styles.editLabel}>Depart</label>
          <input className={styles.editInput} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className={styles.editField}>
          <label className={styles.editLabel}>Return</label>
          <input className={styles.editInput} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className={styles.editField}>
        <label className={styles.editLabel}>Climate</label>
        <select className={styles.editSelect} value={climate} onChange={(e) => setClimate(e.target.value)}>
          <option value="">Select climate</option>
          {CLIMATES.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className={styles.editField}>
        <label className={styles.editLabel}>Occasions</label>
        <div className={styles.pillGroup}>
          {OCCASIONS.map((occ) => (
            <button
              key={occ}
              type="button"
              className={`${styles.editPill} ${occasions.includes(occ) ? styles.editPillActive : ''}`}
              onClick={() => toggleOccasion(occ)}
            >
              {occ}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.editField}>
        <label className={styles.editLabel}>Notes to your stylist</label>
        <textarea className={styles.editTextarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className={styles.editActions}>
        <button className={styles.btnSave} onClick={handleSave} disabled={saving} type="button">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button className={styles.btnCancelEdit} onClick={onCancel} disabled={saving} type="button">
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ─── Main TripDetail ─────────────────────────────────────────── */
export default function TripDetail({ trip, onGeneratePacking, onUnapproveOutfits, onEditTrip, onDeleteTrip, packingLoading, packingError }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regenPrompt, setRegenPrompt] = useState(false) // post-edit regen nudge
  const [regenOpen, setRegenOpen] = useState(false)     // full regen modal

  async function handleDelete() {
    setDeleting(true)
    await onDeleteTrip()
  }

  async function handleSave(updates) {
    await onEditTrip(trip.id, updates)
    setEditing(false)
    if (trip.packing_list) {
      setRegenPrompt(true)
    }
  }

  return (
    <div className={styles.detail}>
      {/* Trip header */}
      <div className={`${styles.tripHeader} ${editing ? styles.tripHeaderEditing : ''} ${regenPrompt ? styles.tripHeaderNudge : ''}`}>
        <p className={styles.headerLabel}>Your Trip</p>
        <h1 className={styles.tripName}>{trip.name}</h1>
        <div className={styles.tripMeta}>
          <span className={styles.tripDestDates}>
            {trip.destination} &nbsp;·&nbsp; {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
          </span>
          <span className={`${styles.statusTag} ${styles[`status_${trip.status}`]}`}>
            {trip.status}
          </span>
        </div>
        <div className={styles.tripActions}>
          <button
            className={styles.btnEditTrip}
            onClick={() => setEditing((v) => !v)}
            type="button"
          >
            {editing ? 'Cancel' : 'Edit trip'}
          </button>
          <button
            className={styles.btnDeleteTrip}
            onClick={() => setConfirmingDelete(true)}
            type="button"
          >
            Delete trip
          </button>
        </div>

        {confirmingDelete && (
          <ConfirmModal
            message="Delete this trip? This can't be undone."
            confirmLabel="Yes, delete it"
            onConfirm={handleDelete}
            onCancel={() => setConfirmingDelete(false)}
            loading={deleting}
          />
        )}
      </div>

      {editing ? (
        <EditTripForm trip={trip} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <>
          {/* Post-edit regen nudge */}
          {regenPrompt && (
            <div className={styles.regenNudge}>
              <p className={styles.regenNudgeText}>Trip updated. Want to refresh your looks?</p>
              <div className={styles.regenNudgeActions}>
                <button
                  type="button"
                  className={styles.regenNudgeYes}
                  onClick={() => { setRegenPrompt(false); setRegenOpen(true) }}
                >
                  Refresh looks
                </button>
                <button
                  type="button"
                  className={styles.regenNudgeNo}
                  onClick={() => setRegenPrompt(false)}
                >
                  Keep as is
                </button>
              </div>
            </div>
          )}
          {regenPrompt && <hr className={styles.regenNudgeDivider} />}

          {/* Two-column body */}
          <div className={styles.body}>
            {/* Left column */}
            <div className={styles.leftCol}>
              <div className={styles.infoTags}>
                {trip.climate && <span className={styles.infoTag}>{trip.climate}</span>}
                <span className={styles.infoTag}>{trip.duration_days} days</span>
                {trip.occasions.map((occ) => (
                  <span key={occ} className={styles.infoTag}>{occ}</span>
                ))}
              </div>

              {trip.notes && (
                <p className={styles.tripNotes}>{trip.notes}</p>
              )}

              <VibeSection trip={trip} />
            </div>

            {/* Right column */}
            <div className={styles.rightCol}>
              <PackingColumn
                trip={trip}
                onGeneratePacking={onGeneratePacking}
                onUnapproveOutfits={onUnapproveOutfits}
                packingLoading={packingLoading}
                packingError={packingError}
                regenOpen={regenOpen}
                setRegenOpen={setRegenOpen}
              />
            </div>
          </div>

          {/* Lookbook — full width, below both columns */}
          {(() => {
            const approvedOutfits = trip.packing_list?.outfits?.filter(
              (o) => trip.approved_outfits?.includes(o.name)
            ) ?? []
            return approvedOutfits.length > 0 ? (
              <LookbookSection trip={trip} outfits={approvedOutfits} />
            ) : null
          })()}
        </>
      )}
    </div>
  )
}
