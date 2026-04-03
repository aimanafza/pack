import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import styles from './WardrobeGateModal.module.css'

export default function WardrobeGateModal({ missing, onClose }) {
  const navigate = useNavigate()

  function goToWardrobe() {
    onClose()
    navigate('/wardrobe')
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <p className={styles.label}>Before you pack</p>
        <h2 className={styles.headline}>Your wardrobe needs a few more pieces.</h2>
        <p className={styles.body}>
          To plan a trip, you need a complete base to work from. Add the following:
        </p>
        <ul className={styles.list}>
          {missing.map((item, i) => (
            <li key={i} className={styles.listItem}>{item}</li>
          ))}
        </ul>
        <div className={styles.actions}>
          <button className={styles.dismissBtn} onClick={onClose} type="button">
            Not yet
          </button>
          <button className={styles.wardrobeBtn} onClick={goToWardrobe} type="button">
            Go to Wardrobe
          </button>
        </div>
      </motion.div>
    </div>,
    document.getElementById('portal-root')
  )
}
