import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import styles from './ItemCard.module.css'
import ConfirmModal from '../ui/ConfirmModal.jsx'

function IconEdit() {
  return (
    <svg className={styles.overlayIcon} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" />
    </svg>
  )
}

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

function formatWeight(grams) {
  if (!grams) return null
  if (grams >= 1000) return `${(grams / 1000).toFixed(1).replace(/\.0$/, '')}kg`
  return `~${grams}g`
}

export default function ItemCard({ item, onDelete, onEdit }) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const itemId = item.id || item._id

  return (
    <motion.div className={styles.card} variants={cardVariants}>
      <div
        className={styles.imageWrap}
        onClick={() => navigate(`/wardrobe/${itemId}`)}
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

        <div className={styles.overlay}>
          {onEdit && (
            <button
              className={styles.overlayBtn}
              onClick={(e) => { e.stopPropagation(); onEdit(item) }}
              type="button"
              aria-label="Edit item"
            >
              <IconEdit />
            </button>
          )}
          <button
            className={styles.overlayBtn}
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
            type="button"
            aria-label="Delete item"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <p className={styles.name}>{item.name}</p>
        <div className={styles.metaRow}>
          <p className={styles.category}>{item.category}</p>
          {item.weight_grams && (
            <p className={styles.weight}>{formatWeight(item.weight_grams)}</p>
          )}
        </div>
      </div>

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
