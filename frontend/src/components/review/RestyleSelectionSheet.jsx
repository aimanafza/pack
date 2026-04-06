import { useState } from 'react'
import { motion } from 'framer-motion'
import styles from './RestyleSelectionSheet.module.css'

export default function RestyleSelectionSheet({ items, onConfirm, onCancel }) {
  const [selectedIds, setSelectedIds] = useState(new Set())

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onCancel}
    >
      <motion.div
        className={styles.panel}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.title}>Which pieces are you keeping?</p>
        <p className={styles.subtitle}>Select the items you want to build around.</p>

        <div className={styles.itemGrid}>
          {items.map((item, i) => {
            const id = item.wardrobe_item_id || item.name
            const selected = selectedIds.has(id)
            return (
              <button
                key={i}
                className={`${styles.itemCard} ${selected ? styles.itemCardSelected : ''}`}
                onClick={() => toggle(id)}
                type="button"
              >
                <div className={styles.itemThumb}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className={styles.itemThumbImg} />
                  ) : (
                    <div className={styles.itemThumbPlaceholder}>
                      <span className={styles.itemThumbInitial}>
                        {item.category?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {selected && <span className={styles.checkmark}>✓</span>}
                </div>
                <p className={styles.itemName}>{item.name}</p>
                <p className={styles.itemCategory}>{item.category?.toUpperCase()}</p>
              </button>
            )
          })}
        </div>

        <button
          className={styles.confirmBtn}
          disabled={selectedIds.size === 0}
          onClick={() => onConfirm(Array.from(selectedIds))}
          type="button"
        >
          Restyle with {selectedIds.size > 0 ? `${selectedIds.size} piece${selectedIds.size > 1 ? 's' : ''}` : 'these pieces'} →
        </button>

        <button className={styles.cancelBtn} onClick={onCancel} type="button">
          Cancel
        </button>
      </motion.div>
    </motion.div>
  )
}
