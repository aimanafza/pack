import styles from './OutfitCollage.module.css'

export default function OutfitCollage({ imageUrls = [], size = 'md' }) {
  const images = [...imageUrls]
  while (images.length < 3) images.push(null)
  const [left, center, right] = images

  return (
    <div className={`${styles.root} ${styles[size]}`}>
      <div className={`${styles.img} ${styles.left}`}>
        {left
          ? <img src={left} alt="" className={styles.photo} />
          : <div className={styles.placeholder} />
        }
      </div>
      <div className={`${styles.img} ${styles.center}`}>
        {center
          ? <img src={center} alt="" className={styles.photo} />
          : <div className={styles.placeholder} />
        }
      </div>
      <div className={`${styles.img} ${styles.right}`}>
        {right
          ? <img src={right} alt="" className={styles.photo} />
          : <div className={styles.placeholder} />
        }
      </div>
    </div>
  )
}
