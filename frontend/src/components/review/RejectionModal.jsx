import { useState } from 'react'
import styles from './RejectionModal.module.css'

export default function RejectionModal({ outfit, onKeepPieces, onSkip }) {
  const [checked, setChecked] = useState(() =>
    Object.fromEntries((outfit?.items ?? []).map((item) => [item.name, false]))
  )

  function toggle(name) {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  function handleKeepPieces() {
    const keptItems = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([k]) => k)
    onKeepPieces(keptItems)
  }

  if (!outfit) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Rejection options">
      <div className={styles.modal}>
        <h2 className={styles.title}>Keep any pieces?</h2>

        <div className={styles.items}>
          {outfit.items.map((item) => (
            <label key={item.name} className={styles.itemRow}>
              <input
                type="checkbox"
                checked={checked[item.name] ?? false}
                onChange={() => toggle(item.name)}
                className={styles.checkbox}
              />
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemCategory}>{item.category}</span>
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.keepBtn} onClick={handleKeepPieces}>
            Keep pieces but restyle
          </button>
          <button className={styles.skipBtn} onClick={onSkip}>
            Skip entirely
          </button>
        </div>
      </div>
    </div>
  )
}
