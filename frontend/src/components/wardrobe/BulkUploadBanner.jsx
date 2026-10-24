import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import useBulkUpload, { summarise } from '../../store/bulkUpload.js'
import styles from './BulkUpload.module.css'

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

// Sits on the wardrobe page whenever a bulk upload is under way or waiting for review,
// so leaving the review screen never loses track of it.
export default function BulkUploadBanner() {
  const items = useBulkUpload((s) => s.items)
  const refresh = useBulkUpload((s) => s.refresh)
  const adding = useBulkUpload((s) => s.adding)

  useEffect(() => {
    refresh()
  }, [refresh])

  const c = summarise(items)
  if (c.total === 0) return null

  const message = adding
    ? `Adding to your wardrobe. ${adding.added} of ${adding.total} added.`
    : c.uploading > 0
    ? `Uploading your photos. ${c.read} of ${c.total} ready to review.`
    : c.inProgress > 0
      ? `Reading your photos. ${c.read} of ${c.total} ready.`
      : `${plural(c.read, 'piece')} ready to review.`

  return (
    <div className={styles.banner} role="status">
      <div className={styles.bannerText}>
        <p className={styles.pageLabel}>New pieces</p>
        <p className={styles.bannerMessage}>
          {message}
          {c.failedUploads > 0 && ` ${plural(c.failedUploads, 'photo')} didn't upload.`}
        </p>
        <div className={styles.progressTrack} aria-hidden="true">
          <span
            className={styles.progressFill}
            style={{ width: `${adding ? (adding.added / adding.total) * 100 : (c.read / c.total) * 100}%` }}
          />
        </div>
      </div>
      <Link to="/wardrobe/review" className={styles.btnOutline}>Review</Link>
    </div>
  )
}
