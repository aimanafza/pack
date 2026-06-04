import { motion } from 'framer-motion'
import styles from './VibeSelector.module.css'

const VIBES = [
  { label: 'Keep it lowkey 🤍', value: 'lowkey' },
  { label: 'We\'re going out out 🔥', value: 'going_out_out' },
  { label: 'Cute but casual ✨', value: 'cute_casual' },
  { label: 'Dress to impress 💅', value: 'dress_to_impress' },
  { label: 'Match the group energy 👯', value: 'match_energy' },
  { label: 'Surprise me', value: 'surprise' },
]

export default function VibeSelector({ value, onChange }) {
  return (
    <motion.div
      className={styles.root}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <div className={styles.inner}>
        <p className={styles.label}>WHAT'S THE ENERGY?</p>
        <p className={styles.subLabel}>Friends always ask what you're wearing.</p>
        <div className={styles.pillGrid}>
          {VIBES.map((vibe) => (
            <button
              key={vibe.value}
              type="button"
              className={`${styles.pill} ${value === vibe.value ? styles.pillSelected : ''}`}
              onClick={() => onChange(value === vibe.value ? null : vibe.value)}
            >
              {vibe.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
