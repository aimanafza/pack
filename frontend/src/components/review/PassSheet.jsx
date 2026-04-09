import { useRef } from 'react'
import { motion } from 'framer-motion'
import styles from './PassSheet.module.css'

export default function PassSheet({ onRestyle, onSkip, onDone, onDismiss }) {
  const touchStartY = useRef(null)

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null) return
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta > 60) onDismiss()
    touchStartY.current = null
  }

  return (
    <>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onDismiss}
      />
      <motion.div
        className={styles.sheet}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle} />
        <p className={styles.title}>Not feeling this one?</p>

        <div className={styles.options}>
          <button className={styles.option} onClick={onRestyle}>
            <span className={styles.optionLabel}>Keep some pieces, restyle the rest</span>
            <span className={styles.optionArrow}>→</span>
          </button>
          <button className={styles.option} onClick={onSkip}>
            <span className={styles.optionLabel}>Skip this outfit entirely</span>
            <span className={styles.optionArrow}>→</span>
          </button>
          <button className={`${styles.option} ${styles.optionMuted}`} onClick={onDone}>
            <span className={styles.optionLabel}>I'm done packing</span>
          </button>
        </div>
      </motion.div>
    </>
  )
}
