import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import styles from './TripCard.module.css'

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

export default function TripCard({ trip, onDelete }) {
  const navigate = useNavigate()
  const hasPacking = !!trip.packing_list
  const cover = trip.inspiration_images?.[0]?.url
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirmDelete(e) {
    e.stopPropagation()
    setDeleting(true)
    await onDelete(trip.id)
    setDeleting(false)
  }

  return (
    <motion.div
      className={styles.card}
      onClick={() => !confirmingDelete && navigate(`/trips/${trip.id}`)}
      whileHover={{ y: confirmingDelete ? 0 : -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className={styles.image}>
        {cover ? (
          <img src={cover} alt={trip.destination} className={styles.img} />
        ) : (
          <span className={styles.initial} aria-hidden="true">{trip.destination.charAt(0)}</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <p className={styles.name}>{trip.name}</p>
          <span className={styles.duration}>{trip.duration_days}d</span>
        </div>
        <p className={styles.destination}>{trip.destination}</p>
        <p className={styles.dates}>{formatDateRange(trip.start_date, trip.end_date)}</p>

        {trip.occasions.length > 0 && (
          <div className={styles.occasions}>
            {trip.occasions.map((occ) => (
              <span key={occ} className={styles.tag}>{occ}</span>
            ))}
          </div>
        )}

        {confirmingDelete ? (
          <div className={styles.confirmRow} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmText}>Remove this trip? This can't be undone.</p>
            <div className={styles.confirmActions}>
              <button
                className={styles.btnConfirmDelete}
                onClick={handleConfirmDelete}
                disabled={deleting}
                type="button"
              >
                {deleting ? 'Removing...' : 'Yes, remove it'}
              </button>
              <button
                className={styles.btnCancelDelete}
                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false) }}
                disabled={deleting}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.footer}>
            <span className={`${styles.status} ${hasPacking ? styles.statusPacked : ''}`}>
              {hasPacking ? 'packed' : trip.status}
            </span>
            <div className={styles.actions}>
              {hasPacking && (
                <button
                  className={styles.btnPack}
                  onClick={(e) => { e.stopPropagation(); navigate(`/trips/${trip.id}/pack`) }}
                  type="button"
                >
                  View List
                </button>
              )}
              <button
                className={styles.btnDelete}
                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true) }}
                type="button"
                aria-label="Delete trip"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
