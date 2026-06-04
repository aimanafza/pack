import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import api from '../../utils/api'
import styles from './WardrobePickerModal.module.css'

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

export default function WardrobePickerModal({ selectedIds = [], onConfirm, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState(new Set(selectedIds))
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/api/v1/wardrobe/').then(({ data }) => {
      setItems(data.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function toggle(id) {
    setPicked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleConfirm() {
    const selected = items.filter(i => picked.has(i.id || i._id))
    onConfirm(selected)
  }

  const visible = items
    .filter(item => activeFilter === 'all' || item.category === activeFilter)
    .filter(item => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))

  const modal = (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className={styles.sheet}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Choose items</p>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10.5 10.5l3 3" strokeLinecap="round" />
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')} type="button" aria-label="Clear">×</button>
            )}
          </div>

          <div className={styles.filterRow}>
            {FILTERS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`${styles.filterPill} ${activeFilter === value ? styles.filterPillActive : ''}`}
                onClick={() => setActiveFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          ) : items.length === 0 ? (
            <p className={styles.empty}>No items in your wardrobe yet.</p>
          ) : visible.length === 0 ? (
            <p className={styles.empty}>No items match your search.</p>
          ) : (
            <div className={styles.grid}>
              {visible.map(item => {
                const id = item.id || item._id
                const isSelected = picked.has(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                    onClick={() => toggle(id)}
                  >
                    <div className={styles.cardImg}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className={styles.cardPhoto} />
                      ) : (
                        <div className={styles.cardPlaceholder} />
                      )}
                      {isSelected && (
                        <div className={styles.checkOverlay}>
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3.5 9l4 4 7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className={styles.cardName}>{item.name}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.selectionCount}>
            {picked.size === 0 ? 'No items selected' : `${picked.size} item${picked.size > 1 ? 's' : ''} selected`}
          </p>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={picked.size === 0}
          >
            Confirm selection
          </button>
        </div>
      </motion.div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}
