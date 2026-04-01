import { useState } from 'react'
import styles from './ItemScrollRow.module.css'

export default function ItemScrollRow({ items, wardrobeById }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeItem = items[activeIndex]
  // Enrich with wardrobe data when available
  const activeWardrobe = activeItem?.wardrobe_item_id ? wardrobeById[activeItem.wardrobe_item_id] : null

  return (
    <div className={styles.root}>
      {/* Horizontal scroll row */}
      <div className={styles.row}>
        {items.map((item, i) => (
          <button
            key={i}
            className={`${styles.card} ${i === activeIndex ? styles.active : ''}`}
            onClick={() => setActiveIndex(i)}
            aria-label={`View ${item.name}`}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className={styles.img}
              />
            ) : (
              <div className={styles.placeholder}>
                <span>{item.name}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected item detail */}
      {activeItem && (
        <div className={styles.detail}>
          <h3 className={styles.itemName}>{activeItem.name}</h3>
          <div className={styles.tags}>
            <span className={styles.tag}>{activeItem.category}</span>
            {(activeWardrobe?.formality || activeItem.formality) && (
              <span className={styles.tag}>{activeWardrobe?.formality || activeItem.formality}</span>
            )}
          </div>
          {(activeWardrobe?.notes || activeItem.notes) && (
            <p className={styles.notes}>{activeWardrobe?.notes || activeItem.notes}</p>
          )}
          {!activeItem.in_wardrobe && (
            <p className={styles.notInWardrobe}>Not in your wardrobe — add to shopping list</p>
          )}
        </div>
      )}
    </div>
  )
}
