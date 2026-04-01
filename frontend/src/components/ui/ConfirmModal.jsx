import { createPortal } from 'react-dom'
import styles from './ConfirmModal.module.css'

export default function ConfirmModal({ message, confirmLabel = 'Yes, remove it', onConfirm, onCancel, loading }) {
  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.modal}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            className={styles.btnConfirm}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? 'Removing...' : confirmLabel}
          </button>
          <button
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
