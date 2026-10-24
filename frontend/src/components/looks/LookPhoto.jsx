import { useState } from 'react'
import styles from './LookPhoto.module.css'

// Looks are generated at 2:3 and every frame is 2:3, so most photos fill it exactly.
// Some older looks are taller than that: cropping them would cut off the head or
// shoes, so they're shown whole, with a blurred copy of the same photo behind them
// filling the sides with its own studio backdrop instead of an empty band.
export default function LookPhoto({ src, alt, className = '' }) {
  const [tall, setTall] = useState(false)

  function handleLoad(e) {
    const img = e.currentTarget
    setTall(img.naturalWidth / img.naturalHeight < 0.66)
  }

  return (
    <div className={`${styles.frame} ${className}`}>
      {tall && <img src={src} alt="" aria-hidden="true" className={styles.backdrop} />}
      <img
        src={src}
        alt={alt}
        className={`${styles.photo} ${tall ? styles.photoWhole : ''}`}
        onLoad={handleLoad}
      />
    </div>
  )
}
