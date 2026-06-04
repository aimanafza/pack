import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../utils/api'
import OutfitCollage from './OutfitCollage'
import styles from './TodayCard.module.css'

function formatToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function TodayCard({ todayLook, onStyleMe }) {
  const navigate = useNavigate()
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    if (todayLook?.weather_summary) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.get('/api/v1/weather/current', {
            params: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          })
          setWeather(res.data.data?.summary || null)
        } catch {}
      },
      () => {},
      { timeout: 5000 }
    )
  }, [todayLook])

  const hasChosen = todayLook?.status === 'chosen' && todayLook.chosen_outfit_index != null
  const isGenerated = todayLook?.status === 'generated'

  if (hasChosen) {
    const outfit = todayLook.generated_outfits?.[todayLook.chosen_outfit_index]
    return (
      <motion.div
        className={styles.card}
        whileHover={{ scale: 1.01, borderColor: 'var(--color-border-medium)' }}
        transition={{ duration: 0.2 }}
      >
        <div className={styles.tagRow}>
          {todayLook.occasion && (
            <span className={styles.pill}>{todayLook.occasion.replace(/_/g, ' ')}</span>
          )}
          {todayLook.vibe && (
            <span className={styles.pill}>{todayLook.vibe.replace(/_/g, ' ')}</span>
          )}
        </div>
        <div className={styles.collageArea}>
          <OutfitCollage
            imageUrls={outfit?.item_image_urls || []}
            size="md"
          />
        </div>
        <div className={styles.bottom}>
          {outfit?.claude_note && (
            <p className={styles.claudeNote}>{outfit.claude_note}</p>
          )}
          <button
            type="button"
            className={styles.changeLink}
            onClick={() => navigate('/daily')}
          >
            Change look →
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={styles.card}
      whileHover={{ scale: 1.01, borderColor: 'var(--color-border-medium)' }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.topMeta}>
        <span className={styles.metaDate}>{formatToday()}</span>
        {(todayLook?.weather_summary || weather) && (
          <span className={styles.metaWeather}>
            {todayLook?.weather_summary || weather}
          </span>
        )}
      </div>
      <div className={styles.center}>
        <p className={styles.prompt}>What are you wearing today?</p>
        <p className={styles.ready}>Your stylist is ready.</p>
      </div>
      <div className={styles.ctaRow}>
        <button
          type="button"
          className={styles.ctaBtn}
          onClick={onStyleMe}
        >
          {isGenerated ? 'Continue styling →' : 'Style me today →'}
        </button>
      </div>
    </motion.div>
  )
}
