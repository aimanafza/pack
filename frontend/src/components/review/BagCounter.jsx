import { motion } from 'framer-motion'
import styles from './BagCounter.module.css'

export default function BagCounter({ count, isPulsing }) {
  return (
    <motion.div
      className={styles.counter}
      animate={isPulsing ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2 4h12l-1.5 9H3.5L2 4Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M5.5 4V3a2.5 2.5 0 0 1 5 0v1"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span>Bag ({count})</span>
    </motion.div>
  )
}
