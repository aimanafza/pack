import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import styles from './ItemCard.module.css'
import ConfirmModal from '../ui/ConfirmModal.jsx'
import QuickView from './QuickView.jsx'
import { formatWeight, useWeightUnit } from '../../utils/weight.js'

function IconTrash() {
  return (
    <svg className={styles.overlayIcon} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h10M5 4V2.5h4V4M5.5 7v4M8.5 7v4M3 4l.7 7.5a.5.5 0 0 0 .5.5h5.6a.5.5 0 0 0 .5-.5L11 4" />
    </svg>
  )
}

export const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

// Mouse users can hover, so a click opens the full page and the quick view has its own
// button. Touch screens can't hover, so a tap opens the quick view instead.
function canHover() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export default function ItemCard({ item, onDelete }) {
  const navigate = useNavigate()
  const unit = useWeightUnit()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [quickView, setQuickView] = useState(false)
  const itemId = item.id || item._id

  function openItem() {
    if (canHover()) navigate(`/wardrobe/${itemId}`)
    else setQuickView(true)
  }

  return (
    <motion.div className={styles.card} variants={cardVariants}>
      <div
        className={styles.imageWrap}
        onClick={openItem}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/wardrobe/${itemId}`)}
        aria-label={`View ${item.name} details`}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.placeholder}>+</div>
        )}

        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
          type="button"
          aria-label={`Delete ${item.name}`}
        >
          <IconTrash />
        </button>

        <button
          className={styles.quickViewBtn}
          onClick={(e) => { e.stopPropagation(); setQuickView(true) }}
          type="button"
        >
          Quick view
        </button>
      </div>

      <div className={styles.meta}>
        <p className={styles.name}>{item.name}</p>
        <div className={styles.metaRow}>
          <p className={styles.category}>{item.category}</p>
          {item.weight_grams > 0 && (
            <p className={styles.weight}>{formatWeight(item.weight_grams, unit)}</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {quickView && (
          <QuickView item={item} onClose={() => setQuickView(false)} onDelete={onDelete} />
        )}
      </AnimatePresence>

      {confirmDelete && (
        <ConfirmModal
          message="Remove this item from your wardrobe? This can't be undone."
          confirmLabel="Yes, remove it"
          onConfirm={() => { setConfirmDelete(false); onDelete(itemId) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </motion.div>
  )
}
