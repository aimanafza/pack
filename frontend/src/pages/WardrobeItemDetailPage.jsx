import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import api from '../utils/api.js'
import StyleThisItemModal from '../components/wardrobe/StyleThisItemModal.jsx'
import styles from './WardrobeItemDetailPage.module.css'


const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory']
const FABRICS = ['linen', 'cotton', 'silk', 'wool', 'synthetic', 'denim', 'leather', 'other']
const FORMALITIES = ['casual', 'smart-casual', 'elevated casual', 'business casual', 'business', 'formal']
const OCCASIONS = ['work', 'casual', 'formal', 'travel', 'dinner', 'beach', 'hiking', 'nightlife']
const SEASONS = ['spring', 'summer', 'fall', 'winter', 'all']

function formatWeight(grams) {
  if (!grams) return null
  if (grams >= 1000) return `${(grams / 1000).toFixed(1).replace(/\.0$/, '')} kg`
  return `${grams} g`
}

function Pill({ label }) {
  return <span className={styles.pill}>{label}</span>
}

function TogglePill({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.editPill} ${active ? styles.editPillActive : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default function WardrobeItemDetailPage() {
  const { item_id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showStyleModal, setShowStyleModal] = useState(false)
  const [itemLooks, setItemLooks] = useState([])
  const [selectedLook, setSelectedLook] = useState(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSubcategory, setEditSubcategory] = useState('')
  const [editColors, setEditColors] = useState([])
  const [editColorInput, setEditColorInput] = useState('')
  const [editFabric, setEditFabric] = useState('')
  const [editFormality, setEditFormality] = useState([])
  const [editOccasions, setEditOccasions] = useState([])
  const [editSeason, setEditSeason] = useState([])
  const [editNotes, setEditNotes] = useState('')
  const [editWeight, setEditWeight] = useState(300)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [itemRes, looksRes] = await Promise.allSettled([
          api.get(`/api/v1/wardrobe/${item_id}`),
          api.get(`/api/v1/looks/item/${item_id}`),
        ])
        if (itemRes.status === 'fulfilled') {
          setItem(itemRes.value.data.data)
        } else {
          setError('Item not found.')
        }
        if (looksRes.status === 'fulfilled') {
          setItemLooks(looksRes.value.data.data || [])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [item_id])

  function startEditing() {
    setEditName(item.name)
    setEditCategory(item.category)
    setEditSubcategory(item.subcategory || '')
    setEditColors([...(item.color || [])])
    setEditFabric(item.fabric || '')
    setEditFormality([...(item.formality || [])])
    setEditOccasions([...(item.occasions || [])])
    setEditSeason([...(item.season || [])])
    setEditNotes(item.notes || '')
    setEditWeight(item.weight_grams || 300)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data } = await api.put(`/api/v1/wardrobe/${item_id}`, {
        name: editName.trim(),
        category: editCategory,
        subcategory: editSubcategory.trim(),
        color: editColors,
        fabric: editFabric,
        formality: editFormality,
        occasions: editOccasions,
        season: editSeason,
        notes: editNotes.trim(),
        weight_grams: editWeight,
      })
      setItem(data.data)
      setEditing(false)
    } catch {
      // keep form open
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/api/v1/wardrobe/${item_id}`)
      navigate('/wardrobe')
    } catch {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  function handleColorKeyDown(e) {
    if (e.key === 'Enter' && editColorInput.trim()) {
      e.preventDefault()
      const val = editColorInput.trim().toLowerCase()
      if (!editColors.includes(val)) setEditColors([...editColors, val])
      setEditColorInput('')
    }
  }

  if (loading) return <div className={styles.page}><p className={styles.stateMsg}>Loading...</p></div>
  if (error || !item) return <div className={styles.page}><p className={styles.stateMsg}>{error || 'Not found.'}</p></div>

  const allTags = [
    ...(item.color || []),
    ...(item.occasions || []).map(o => o.replace('other:', '')),
    ...(item.formality || []),
    ...(item.season || []),
  ]

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/wardrobe')} type="button">
        ← Your Wardrobe
      </button>

      <div className={styles.layout}>
        {/* Left: image */}
        <div className={styles.imageCol}>
          <div className={styles.imageWrap}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className={styles.image} />
            ) : (
              <div className={styles.imagePlaceholder}>No image</div>
            )}
          </div>
        </div>

        {/* Right: view or edit */}
        {editing ? (
          <div className={styles.detailCol}>
            <p className={styles.editModeLabel}>Editing</p>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Name</label>
              <input
                className={styles.editInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className={styles.editRow}>
              <div className={styles.editField}>
                <label className={styles.editLabel}>Category</label>
                <select
                  className={styles.editSelect}
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className={styles.editField}>
                <label className={styles.editLabel}>Subcategory</label>
                <input
                  className={styles.editInput}
                  value={editSubcategory}
                  onChange={(e) => setEditSubcategory(e.target.value)}
                  placeholder="Shirt, blazer..."
                />
              </div>
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Color(s)</label>
              <div
                className={styles.tagInputWrap}
                onClick={() => document.getElementById('edit-color-input')?.focus()}
              >
                {editColors.map(c => (
                  <span key={c} className={styles.tag}>
                    {c}
                    <button
                      type="button"
                      className={styles.tagRemove}
                      onClick={() => setEditColors(editColors.filter(x => x !== c))}
                    >×</button>
                  </span>
                ))}
                <input
                  id="edit-color-input"
                  className={styles.tagInput}
                  value={editColorInput}
                  onChange={(e) => setEditColorInput(e.target.value)}
                  onKeyDown={handleColorKeyDown}
                  placeholder="Type a color, press Enter"
                />
              </div>
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Fabric</label>
              <select
                className={styles.editSelect}
                value={editFabric}
                onChange={(e) => setEditFabric(e.target.value)}
              >
                <option value="">Select</option>
                {FABRICS.map(f => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Formality</label>
              <div className={styles.pillGroup}>
                {FORMALITIES.map(f => (
                  <TogglePill
                    key={f}
                    label={f}
                    active={editFormality.includes(f)}
                    onClick={() => setEditFormality(prev =>
                      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
                    )}
                  />
                ))}
              </div>
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Occasions</label>
              <div className={styles.pillGroup}>
                {OCCASIONS.map(o => (
                  <TogglePill
                    key={o}
                    label={o}
                    active={editOccasions.includes(o)}
                    onClick={() => setEditOccasions(prev =>
                      prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
                    )}
                  />
                ))}
              </div>
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Season</label>
              <div className={styles.pillGroup}>
                {SEASONS.map(s => (
                  <TogglePill
                    key={s}
                    label={s}
                    active={editSeason.includes(s)}
                    onClick={() => setEditSeason(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    )}
                  />
                ))}
              </div>
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Weight (grams)</label>
              <input
                className={styles.editInput}
                type="number"
                min="1"
                max="5000"
                step="10"
                value={editWeight}
                onChange={(e) => setEditWeight(parseInt(e.target.value) || 300)}
              />
            </div>

            <div className={styles.editField}>
              <label className={styles.editLabel}>Notes</label>
              <textarea
                className={styles.editTextarea}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="How you style it, what it pairs with..."
              />
            </div>

            <div className={styles.editActions}>
              <button
                className={styles.btnSave}
                onClick={handleSave}
                disabled={saving}
                type="button"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                className={styles.btnCancel}
                onClick={cancelEditing}
                disabled={saving}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.detailCol}>
            <p className={styles.categoryLabel}>{item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}</p>
            <h1 className={styles.name}>{item.name}</h1>

            {item.weight_grams && (
              <p className={styles.weight}>{formatWeight(item.weight_grams)}</p>
            )}

            <hr className={styles.divider} />

            <div className={styles.detailRows}>
              {item.fabric && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Fabric</span>
                  <span className={styles.detailVal}>{item.fabric}</span>
                </div>
              )}
              {item.color && item.color.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Color</span>
                  <span className={styles.detailVal}>{item.color.join(', ')}</span>
                </div>
              )}
              {item.season && item.season.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Season</span>
                  <span className={styles.detailVal}>{item.season.join(', ')}</span>
                </div>
              )}
            </div>

            {allTags.length > 0 && (
              <div className={styles.pillRow}>
                {allTags.map((tag, i) => <Pill key={i} label={tag} />)}
              </div>
            )}

            {item.notes && (
              <p className={styles.notes}>{item.notes}</p>
            )}

            {confirmingDelete ? (
              <div className={styles.confirmBox}>
                <p className={styles.confirmText}>Remove this item from your wardrobe? This can't be undone.</p>
                <div className={styles.confirmActions}>
                  <button
                    className={styles.btnConfirmDelete}
                    onClick={handleDelete}
                    disabled={deleting}
                    type="button"
                  >
                    {deleting ? 'Removing...' : 'Yes, remove it'}
                  </button>
                  <button
                    className={styles.btnCancelDelete}
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button className={styles.btnEdit} onClick={startEditing} type="button">
                  Edit details
                </button>
                <button className={styles.btnStyle} onClick={() => setShowStyleModal(true)} type="button">
                  Style this item
                </button>
                <button className={styles.btnDelete} onClick={() => setConfirmingDelete(true)} type="button">
                  Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Item Looks section */}
      {itemLooks.length > 0 && (
        <div className={styles.looksSection}>
          <p className={styles.looksSectionLabel}>Item Looks</p>
          <div className={styles.looksRow}>
            {itemLooks.map((look) => (
              <button
                key={look.id || look._id}
                type="button"
                className={styles.lookCard}
                onClick={() => setSelectedLook(look)}
              >
                <div className={styles.lookCardImg}>
                  {look.avatar_image_url ? (
                    <img src={look.avatar_image_url} alt={look.name} className={styles.lookCardPhoto} />
                  ) : (
                    <div className={styles.lookCardPlaceholder}>
                      <span className={styles.lookCardPlaceholderText}>{look.name || 'Look'}</span>
                    </div>
                  )}
                </div>
                <div className={styles.lookCardFoot}>
                  <span className={styles.lookCardName}>{look.name}</span>
                  <span className={styles.lookCardOccasion}>{look.occasion}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Look detail overlay */}
      <AnimatePresence>
        {selectedLook && (
          <div className={styles.lookOverlay} onClick={() => setSelectedLook(null)}>
            <div className={styles.lookOverlayCard} onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className={styles.lookOverlayClose}
                onClick={() => setSelectedLook(null)}
              >×</button>
              {selectedLook.avatar_image_url && (
                <img src={selectedLook.avatar_image_url} alt={selectedLook.name} className={styles.lookOverlayImg} />
              )}
              <div className={styles.lookOverlayBody}>
                <p className={styles.lookOverlayOccasion}>{selectedLook.occasion}</p>
                <h3 className={styles.lookOverlayName}>{selectedLook.name}</h3>
                {selectedLook.styling_notes && (
                  <p className={styles.lookOverlayNotes}>{selectedLook.styling_notes}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Style this item modal */}
      <AnimatePresence>
        {showStyleModal && (
          <StyleThisItemModal
            item={item}
            onClose={() => setShowStyleModal(false)}
            onLooksApproved={(newLooks) => {
              setItemLooks(prev => [...newLooks, ...prev])
              setShowStyleModal(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
