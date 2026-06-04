import styles from './DailyOutfitSwipe.module.css'
import ItemScrollRow from '../review/ItemScrollRow'

function buildItems(outfit) {
  const ids = outfit.item_ids || []
  const names = outfit.item_names || []
  const urls = outfit.item_image_urls || []
  return ids.map((id, i) => ({
    wardrobe_item_id: id,
    name: names[i] || '',
    image_url: urls[i] || null,
    category: '',
    in_wardrobe: true,
  }))
}

export default function DailyOutfitSwipe({
  outfit,
  wardrobeItems = [],
  index,
  total,
  onChoose,
  onNext,
  weatherSummary,
  occasion,
  choosing = false,
}) {
  const wardrobeById = wardrobeItems.reduce((acc, item) => {
    acc[item.id] = item
    return acc
  }, {})

  const items = buildItems(outfit)
  const isLast = index === total - 1
  const nextLabel = isLast ? 'Back to first' : 'Next option →'

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.progress}>OPTION {index + 1} OF {total}</p>
        <div className={styles.tagRow}>
          {(outfit.occasion_tags || []).map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      </div>

      {outfit.claude_note && (
        <p className={styles.claudeNote}>{outfit.claude_note}</p>
      )}

      {items.length > 0 && (
        <ItemScrollRow items={items} wardrobeById={wardrobeById} />
      )}

      {(weatherSummary || occasion) && (
        <p className={styles.context}>
          {[weatherSummary, occasion].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onNext}
          disabled={choosing}
        >
          {nextLabel}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onChoose}
          disabled={choosing}
        >
          {choosing ? 'Saving...' : 'Wear this today'}
        </button>
      </div>
    </div>
  )
}
