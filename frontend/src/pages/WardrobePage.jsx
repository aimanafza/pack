import { useEffect, useState } from 'react'
import useStore from '../store/index.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import WardrobeGrid from '../components/wardrobe/WardrobeGrid.jsx'
import UploadModal from '../components/wardrobe/UploadModal.jsx'
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

export default function WardrobePage() {
  const wardrobe = useStore((s) => s.wardrobe)
  const { fetchWardrobe, deleteItem, loading } = useWardrobe()
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchWardrobe()
  }, [])

  const filtered = wardrobe
    .filter((item) => activeFilter === 'all' || item.category === activeFilter)
    .filter((item) => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.pageLabel}>The Wardrobe</p>
          <h1 className={styles.headline}>My Closet</h1>
        </div>
        <div className={styles.headerRight}>
          {wardrobe.length > 0 && (
            <span className={styles.itemCount}>
              {wardrobe.length} {wardrobe.length === 1 ? 'item' : 'items'}
            </span>
          )}
          <button className={styles.btnAdd} onClick={() => setShowModal(true)}>
            Add Item
          </button>
        </div>
      </div>

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
        <WardrobeGrid items={filtered} onDelete={deleteItem} />
      )}

      {showModal && <UploadModal onClose={() => setShowModal(false)} />}
    </>
  )
}
