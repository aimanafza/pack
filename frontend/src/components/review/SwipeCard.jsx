import { useState } from 'react'
import ItemScrollRow from './ItemScrollRow.jsx'
import styles from './SwipeCard.module.css'

export default function SwipeCard({ outfit, wardrobeById, packingList, onApprove, onReject }) {
  const [rationaleOpen, setRationaleOpen] = useState(false)

  const label = outfit.day_label || outfit.name
  const occasionDisplay = outfit.occasion_tag || outfit.occasion
  const note = outfit.styling_notes || outfit.styling_note
  const rationale = outfit.design_rationale
  const gaps = outfit.style_gaps || []

  return (
    <div className={styles.card}>
      {/* Outfit header */}
      <div className={styles.header}>
        {label && <p className={styles.outfitLabel}>{label}</p>}
        {occasionDisplay && (
          <span className={styles.occasionPill}>{occasionDisplay}</span>
        )}
      </div>

      {/* Item scroll row */}
      <div className={styles.scrollSection}>
        <ItemScrollRow items={outfit.items} wardrobeById={wardrobeById} />
      </div>

      {/* Weight bar */}
      {packingList?.weight_budget > 0 && (
        <div className={styles.weightSection}>
          <p className={styles.weightLabel}>PACKING WEIGHT</p>
          <div className={styles.weightBarTrack}>
            <div
              className={`${styles.weightBarFill} ${
                packingList.weight_status === 'over'
                  ? styles.weightBarFillRed
                  : packingList.weight_remaining <= 0.5
                  ? styles.weightBarFillAmber
                  : ''
              }`}
              style={{ width: `${Math.min((packingList.packing_weight_total / packingList.weight_budget) * 100, 100)}%` }}
            />
          </div>
          <div className={styles.weightBarMeta}>
            <span>{packingList.packing_weight_total?.toFixed(1)}kg / {packingList.weight_budget}kg</span>
            <span className={styles.weightRemaining}>{packingList.weight_remaining?.toFixed(1)}kg remaining</span>
          </div>
        </div>
      )}

      {/* Style gaps — items missing from wardrobe */}
      {gaps.length > 0 && (
        <ul className={styles.gapList}>
          {gaps.map((gap, i) => (
            <li key={i} className={styles.gapItem}>
              Not in your wardrobe — {gap}
            </li>
          ))}
        </ul>
      )}

      {/* Stylist note */}
      {note && (
        <p className={styles.stylistNote}>{note}</p>
      )}

      {/* Design rationale — expandable */}
      {rationale && (
        <div className={styles.rationaleWrap}>
          <button
            className={styles.rationaleToggle}
            onClick={() => setRationaleOpen((o) => !o)}
            type="button"
            aria-expanded={rationaleOpen}
          >
            Stylist's notes {rationaleOpen ? '↑' : '→'}
          </button>
          {rationaleOpen && (
            <div className={styles.rationaleBody}>
              {rationale.silhouette && (
                <p className={styles.rationaleRow}>
                  <span className={styles.rationaleKey}>Silhouette</span>
                  <span className={styles.rationaleVal}>{rationale.silhouette}</span>
                </p>
              )}
              {rationale.color_story && (
                <p className={styles.rationaleRow}>
                  <span className={styles.rationaleKey}>Color story</span>
                  <span className={styles.rationaleVal}>{rationale.color_story}</span>
                </p>
              )}
              {rationale.occasion_fit && (
                <p className={styles.rationaleRow}>
                  <span className={styles.rationaleKey}>Occasion</span>
                  <span className={styles.rationaleVal}>{rationale.occasion_fit}</span>
                </p>
              )}
              {rationale.the_detail && (
                <p className={styles.rationaleRow}>
                  <span className={styles.rationaleKey}>The detail</span>
                  <span className={styles.rationaleVal}>{rationale.the_detail}</span>
                </p>
              )}
            </div>
          )}
        </div>
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
