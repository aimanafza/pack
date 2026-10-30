import { useState } from 'react'
import styles from './LookPhoto.module.css'

// Looks are generated at 2:3 and every frame is 2:3, so most photos fill it exactly.
// Some older looks are taller than that: cropping them would cut off the head or
// shoes, so they're shown whole, with a blurred copy of the same photo behind them
// filling the sides with its own studio backdrop instead of an empty band.
// `ratio` is the frame's width / height when it isn't 2:3 (shopping looks are 4:5);
// photos made at the frame's shape fill it, older ones show whole the same way.
export default function LookPhoto({ src, alt, className = '', ratio = 2 / 3 }) {
  const [tall, setTall] = useState(false)

  function handleLoad(e) {
    const img = e.currentTarget
    setTall(img.naturalWidth / img.naturalHeight < ratio * 0.99)
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
