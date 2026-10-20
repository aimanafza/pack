import { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../store/index.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import WardrobeGrid from '../components/wardrobe/WardrobeGrid.jsx'
import UploadModal from '../components/wardrobe/UploadModal.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import BulkUploadBanner from '../components/wardrobe/BulkUploadBanner.jsx'
import styles from './WardrobePage.module.css'

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Tops', value: 'top' },
  { label: 'Bottoms', value: 'bottom' },
  { label: 'Dresses', value: 'dress' },
  { label: 'Outerwear', value: 'outerwear' },
  { label: 'Shoes', value: 'shoes' },
  { label: 'Bags', value: 'bag' },
  { label: 'Accessories', value: 'accessory' },
]

const CATEGORIES = FILTERS.filter((f) => f.value !== 'all')

const plural = (n) => `${n} ${n === 1 ? 'item' : 'items'}`

export default function WardrobePage() {
  const wardrobe = useStore((s) => s.wardrobe)
  const { fetchWardrobe, deleteItem, deleteItems, moveItems, loading } = useWardrobe()
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Select mode
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [moveOpen, setMoveOpen] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [notice, setNotice] = useState('')
  const movePanelRef = useRef(null)

  useEffect(() => {
    fetchWardrobe()
  }, [])

  const filtered = wardrobe
    .filter((item) => activeFilter === 'all' || item.category === activeFilter)
    .filter((item) => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))

  // Only what's on screen can be selected, so changing the filter or search starts over
  useEffect(() => {
    setSelectedIds(new Set())
    setMoveOpen(false)
  }, [activeFilter, search])

  // Escape closes the Move row. Opening it scrolls it into view, since you may be far down the grid.
  useEffect(() => {
    if (!moveOpen) return
    movePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    function handleKey(e) {
      if (e.key === 'Escape') setMoveOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [moveOpen])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const visibleIds = useMemo(() => filtered.map((i) => i.id), [filtered])
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const count = selectedIds.size

  useEffect(() => {
    if (count === 0) setMoveOpen(false)
  }, [count])

  // When everything selected is already in one category, that pill shows as current
  const currentCategory = useMemo(() => {
    const cats = new Set(wardrobe.filter((i) => selectedIds.has(i.id)).map((i) => i.category))
    return cats.size === 1 ? [...cats][0] : null
  }, [wardrobe, selectedIds])

  function startSelecting() {
    setSelecting(true)
    setNotice('')
  }

  function stopSelecting() {
    setSelecting(false)
    setSelectedIds(new Set())
    setMoveOpen(false)
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds))
  }

  async function handleMove(category) {
    const ids = [...selectedIds]
    const label = CATEGORIES.find((c) => c.value === category)?.label ?? category
    stopSelecting()
    const ok = await moveItems(ids, category)
    setNotice(ok ? `Moved ${plural(ids.length)} to ${label}.` : "Those items didn't move. Check your connection and try again.")
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    setConfirmBulkDelete(false)
    stopSelecting()
    const ok = await deleteItems(ids)
    setNotice(ok ? `Removed ${plural(ids.length)}.` : "Those items weren't removed. Check your connection and try again.")
  }

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.pageLabel}>The Wardrobe</p>
          <h1 className={styles.headline}>My Closet</h1>
        </div>
        {selecting ? (
          <div className={styles.headerRight}>
            <span className={styles.itemCount} aria-live="polite">
              {count > 0 ? `${count} selected` : 'Tap items to select'}
            </span>
            <div className={styles.headerActions}>
              <button className={styles.btnOutline} onClick={toggleSelectAll} type="button" disabled={visibleIds.length === 0}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <button className={styles.btnText} onClick={stopSelecting} type="button">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.headerRight}>
            {wardrobe.length > 0 && (
              <span className={styles.itemCount}>{plural(wardrobe.length)}</span>
            )}
            <div className={styles.headerActions}>
              {wardrobe.length > 0 && (
                <button className={styles.btnOutline} onClick={startSelecting} type="button">
                  Select
                </button>
              )}
              <button className={styles.btnAdd} onClick={() => setShowModal(true)}>
                Add Item
              </button>
            </div>
          </div>
        )}
      </div>

      <BulkUploadBanner />

      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5l3 3" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search your wardrobe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')} type="button" aria-label="Clear search">×</button>
          )}
        </div>
      </div>

      <div className={styles.filters}>
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            className={`${styles.filterPill} ${activeFilter === value ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Move to: opens under the category filter, in the same pill style */}
      {selecting && moveOpen && count > 0 && (
        <div className={styles.movePanel} ref={movePanelRef}>
          <div className={styles.moveHead}>
            <p className={styles.moveLabel}>Move {plural(count)} to</p>
            <button className={styles.btnText} type="button" onClick={() => setMoveOpen(false)}>
              Close
            </button>
          </div>
          <div className={styles.movePills} role="group" aria-label="Choose a category">
            {CATEGORIES.map(({ label, value }) => (
              <button
                key={value}
                className={`${styles.filterPill} ${styles.movePill} ${currentCategory === value ? styles.filterPillActive : ''}`}
                type="button"
                onClick={() => handleMove(value)}
                disabled={currentCategory === value}
                aria-label={currentCategory === value ? `${label}, current category` : `Move to ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <p className={styles.loadingText}>Loading your wardrobe...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {search.trim()
              ? `No items matching "${search.trim()}".`
              : activeFilter === 'all'
              ? 'Your wardrobe is empty. Add your first item to get started.'
              : `No ${activeFilter}s in your wardrobe yet.`}
          </p>
          {activeFilter === 'all' && !search.trim() && (
            <button className={styles.btnAddEmpty} onClick={() => setShowModal(true)}>
              Add Item
            </button>
          )}
        </div>
      ) : (
        <WardrobeGrid
          items={filtered}
          onDelete={deleteItem}
          selecting={selecting}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* Keeps the last row clear of the action bar */}
      {selecting && <div className={styles.barSpacer} aria-hidden="true" />}

      {selecting && (
        <div className={styles.actionBar} role="toolbar" aria-label="Selected items">
          <div className={styles.barRow}>
            <span className={styles.barCount}>{count > 0 ? `${count} selected` : 'None selected'}</span>
            <div className={styles.barActions}>
              <button
                className={`${styles.btnOutline} ${moveOpen ? styles.btnOutlineActive : ''}`}
                onClick={() => setMoveOpen((o) => !o)}
                type="button"
                disabled={count === 0}
                aria-expanded={moveOpen}
              >
                Move to
              </button>
              <button
                className={styles.btnAdd}
                onClick={() => { setMoveOpen(false); setConfirmBulkDelete(true) }}
                type="button"
                disabled={count === 0}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <p className={styles.notice} role="status">{notice}</p>
      )}

      {confirmBulkDelete && (
        <ConfirmModal
          message={`Remove ${plural(count)} from your wardrobe? This can't be undone.`}
          confirmLabel={`Yes, remove ${count === 1 ? 'it' : 'them'}`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {showModal && <UploadModal onClose={() => setShowModal(false)} />}
    </>
  )
}
