import ItemScrollRow from './ItemScrollRow.jsx'
import styles from './SwipeCard.module.css'

export default function SwipeCard({ outfit, wardrobeById, onApprove, onReject }) {
  return (
    <div className={styles.card}>
      {/* Outfit header */}
      <div className={styles.header}>
        <p className={styles.outfitLabel}>{outfit.name}</p>
        {outfit.occasion && (
          <span className={styles.occasionPill}>{outfit.occasion}</span>
        )}
      </div>

      {/* Item scroll row + selected item detail */}
      <div className={styles.scrollSection}>
        <ItemScrollRow items={outfit.items} wardrobeById={wardrobeById} />
      </div>

      {/* Stylist note */}
      {outfit.styling_note && (
        <p className={styles.stylistNote}>{outfit.styling_note}</p>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.passBtn} onClick={onReject} aria-label="Pass on this outfit">
          Pass
        </button>
        <button className={styles.approveBtn} onClick={onApprove} aria-label="Add outfit to bag">
          Add to Bag
        </button>
      </div>
    </div>
  )
}
