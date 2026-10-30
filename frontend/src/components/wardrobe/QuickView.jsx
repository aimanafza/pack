import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, useDragControls } from 'framer-motion'
import ConfirmModal from '../ui/ConfirmModal.jsx'
import { formatWeight, useWeightUnit } from '../../utils/weight.js'
import styles from './QuickView.module.css'

const PHONE_QUERY = '(max-width: 767px)'

function isPhone() {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
}

function Detail({ label, children }) {
  return (
    <div className={styles.detailRow}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{children}</dd>
    </div>
  )
}

// A centered card on laptops, a sheet that slides up from the bottom on phones.
// Both close with the ✕, Escape or a click outside; the sheet also closes on a swipe down.
export default function QuickView({ item, onClose, onDelete }) {
  const unit = useWeightUnit()
  const [phone] = useState(isPhone)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmingRef = useRef(false)
  confirmingRef.current = confirmDelete
  const closeRef = useRef(null)
  const dragControls = useDragControls()
  const itemId = item.id || item._id

  useEffect(() => {
    const returnFocusTo = document.activeElement
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKey(e) {
      if (e.key !== 'Escape') return
      // Escape backs out of the remove question first, then the quick view
      if (confirmingRef.current) setConfirmDelete(false)
      else onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      returnFocusTo?.focus?.()
    }
  }, [onClose])

  const tags = [...(item.occasions || []), ...(item.season || [])]
  const subtitle = [item.category, item.subcategory].filter(Boolean).join(' / ')

  const panelMotion = phone
    ? {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] },
        drag: 'y',
        // Swipes start from the handle or photo only, so the details can still scroll
        dragControls,
        dragListener: false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.6 },
        onDragEnd: (_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) onClose()
        },
      }
    : {
        initial: { opacity: 0, scale: 0.97 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 },
        transition: { duration: 0.18, ease: 'easeOut' },
      }

  return createPortal(
    <>
      <motion.div
        className={styles.backdrop}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <div className={styles.positioner}>
        <motion.div
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-view-title"
          {...panelMotion}
        >
          {phone && (
            <div className={styles.handle} aria-hidden="true" onPointerDown={(e) => dragControls.start(e)} />
          )}

          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close quick view"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>

          <div className={styles.imageSide} onPointerDown={phone ? (e) => dragControls.start(e) : undefined}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className={styles.image} draggable="false" />
            ) : (
              <span className={styles.imageInitial} aria-hidden="true">{item.name.charAt(0)}</span>
            )}
          </div>

          <div className={styles.infoSide}>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            <h2 id="quick-view-title" className={styles.name}>{item.name}</h2>
            {item.weight_grams > 0 && <p className={styles.weight}>{formatWeight(item.weight_grams, unit)}</p>}

            <dl className={styles.details}>
              {item.fabric && <Detail label="Fabric">{item.fabric}</Detail>}
              {item.color?.length > 0 && (
                <Detail label="Colour">{item.color.join(', ')}</Detail>
              )}
              {item.formality?.length > 0 && (
                <Detail label="Dress code">{item.formality.join(', ')}</Detail>
              )}
            </dl>

            {tags.length > 0 && (
              <div className={styles.tags}>
                {tags.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            )}

            {item.notes && <p className={styles.notes}>{item.notes}</p>}
            {item.source_url && (
              <p className={styles.source}>
                Source:{' '}
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                  {item.source_label || 'Original listing'}
                </a>
              </p>
            )}

            <div className={styles.actions}>
              <Link to={`/wardrobe/${itemId}`} className={styles.detailsLink} onClick={onClose}>
                View details
              </Link>
              {onDelete && (
                <button type="button" className={styles.remove} onClick={() => setConfirmDelete(true)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="Remove this item from your wardrobe? This can't be undone."
          confirmLabel="Yes, remove it"
          onConfirm={() => { setConfirmDelete(false); onClose(); onDelete(itemId) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>,
    document.body
  )
}
