import { motion } from 'framer-motion'
import OutfitCollage from './OutfitCollage'
import styles from './LookHistoryCard.module.css'

function formatLookDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

export default function LookHistoryCard({ look }) {
  const chosenIndex = look.chosen_outfit_index ?? 0
  const outfit = look.generated_outfits?.[chosenIndex]
  const imageUrls = outfit?.item_image_urls || []

  return (
    <motion.div
      className={styles.card}
      whileHover={{ scale: 1.01, borderColor: 'var(--color-border-medium)' }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.collageArea}>
        <OutfitCollage imageUrls={imageUrls} size="sm" />
      </div>
      <div className={styles.body}>
        <p className={styles.date}>{formatLookDate(look.date)}</p>
        <div className={styles.pillRow}>
          {look.occasion && (
            <span className={styles.pill}>{look.occasion.replace(/_/g, ' ')}</span>
          )}
          {look.vibe && (
            <span className={styles.pill}>{look.vibe.replace(/_/g, ' ')}</span>
          )}
        </div>
        {outfit?.claude_note && (
          <p className={styles.note}>{outfit.claude_note}</p>
        )}
      </div>
    </motion.div>
  )
}
