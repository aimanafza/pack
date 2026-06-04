import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import api from '../../utils/api'
import VibeSelector from './VibeSelector'
import WardrobePickerModal from '../trips/WardrobePickerModal'
import styles from './ContextCard.module.css'

// ── Mood icons (28×28, stroke only) ──────────────────────────────────────────

function IconLightning() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3L10 14h5L12 25l10-13h-6L17 3z" />
    </svg>
  )
}

function IconHanger() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5a3 3 0 0 1 3 3" />
      <path d="M14 8L4 19h20L14 8z" />
    </svg>
  )
}

function IconLeaf() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4c6 0 10 4 10 10s-4 10-10 10S4 20 4 14C4 8 8 4 14 4z" />
      <path d="M14 4v20" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3l2.5 8.5H24l-7 5 2.5 8.5L14 20l-5.5 5 2.5-8.5-7-5h7.5L14 3z" />
    </svg>
  )
}

function IconMug() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 8c0-2 1.5-2 1.5-4" />
      <path d="M14 8c0-2 1.5-2 1.5-4" />
      <rect x="4" y="11" width="15" height="11" rx="2" />
      <path d="M19 13h2a2 2 0 0 1 0 4h-2" />
    </svg>
  )
}

// ── Occasion icons (18×18, stroke only) ──────────────────────────────────────

function IconGradCap() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4L1 8l8 4 8-4-8-4z" />
      <path d="M5 10v4c0 1.5 1.8 2.5 4 2.5s4-1 4-2.5v-4" />
      <path d="M15 8v5" />
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="14" height="9" rx="1.5" />
      <path d="M6 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M2 11h14" />
    </svg>
  )
}

function IconFlutes() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2h4L8 11H5L5 2z" />
      <path d="M6.5 11v4" />
      <path d="M4.5 15h4" />
      <path d="M9 2h4l-1 9h-3V2z" />
      <path d="M10.5 11v4" />
      <path d="M8.5 15h4" />
    </svg>
  )
}

function IconForkKnife() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v5" />
      <path d="M4 2v3a2 2 0 0 0 4 0V2" />
      <path d="M6 7v9" />
      <path d="M12 2c1 0 2 1.5 2 4l-2 1v7" />
    </svg>
  )
}

function IconLaptop() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="9" rx="1" />
      <path d="M1 12h16l-1.5 3h-13L1 12z" />
    </svg>
  )
}

function IconPlane() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9l12-7 2 2-5 5 3 6-3-1-2-4-4 2-1-1 2-2H2z" />
    </svg>
  )
}

function IconRunner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="3" r="1.5" />
      <path d="M10 6l2 2-4 2 2 3-3 3" />
      <path d="M12 8l2 4" />
      <path d="M8 8L6 12" />
    </svg>
  )
}

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1v4M9 13v4M1 9h4M13 9h4" />
      <path d="M3.5 3.5l2.8 2.8M11.7 11.7l2.8 2.8M14.5 3.5l-2.8 2.8M6.3 11.7L3.5 14.5" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const MOODS = [
  { Icon: IconLightning, label: 'Energised',    value: 'energised' },
  { Icon: IconHanger,    label: 'Put-together', value: 'put_together' },
  { Icon: IconLeaf,      label: 'Lowkey',       value: 'lowkey' },
  { Icon: IconStar,      label: 'Playful',      value: 'playful' },
  { Icon: IconMug,       label: 'Cozy',         value: 'cozy' },
]

const OCCASIONS = [
  { Icon: IconGradCap,   label: 'College',       value: 'college' },
  { Icon: IconBriefcase, label: 'Office',        value: 'office' },
  { Icon: IconFlutes,    label: 'Going Out',     value: 'going_out' },
  { Icon: IconForkKnife, label: 'Dinner/Date',   value: 'dinner_date' },
  { Icon: IconLaptop,    label: 'WFH',           value: 'wfh' },
  { Icon: IconPlane,     label: 'Travel Day',    value: 'travel' },
  { Icon: IconRunner,    label: 'Active',        value: 'active' },
  { Icon: IconSparkle,   label: 'Special Event', value: 'special_event' },
]

const MAX_NOTE = 280
const SOCIAL_OCCASIONS = ['going_out', 'dinner_date']

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContextCard({ onGenerate }) {
  const [mood, setMood]               = useState(null)
  const [occasion, setOccasion]       = useState(null)
  const [vibe, setVibe]               = useState(null)
  const [contextNote, setContextNote] = useState('')
  const [weather, setWeather]         = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)

  // Anchor items (wardrobe picker)
  const [anchorItems, setAnchorItems]   = useState([])
  const [showPicker, setShowPicker]     = useState(false)

  // Inspiration images (up to 3)
  const [inspirationUrls, setInspirationUrls]           = useState([])
  const [inspirationUploading, setInspirationUploading] = useState(false)
  const inspInputRef = useRef(null)
  const MAX_INSPIRATION = 3

  useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) { setWeatherLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.get('/api/v1/weather/current', {
            params: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          })
          if (!cancelled) setWeather(res.data.data)
        } catch { /* hide silently */ }
        finally { if (!cancelled) setWeatherLoading(false) }
      },
      () => { if (!cancelled) setWeatherLoading(false) },
      { timeout: 5000 }
    )
    return () => { cancelled = true }
  }, [])

  const showVibe = SOCIAL_OCCASIONS.includes(occasion)

  async function handleInspirationUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setInspirationUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post('/api/v1/uploads/image', fd)
      setInspirationUrls((prev) => [...prev, res.data.data.url].slice(0, MAX_INSPIRATION))
    } catch {
      // silently ignore
    } finally {
      setInspirationUploading(false)
      if (inspInputRef.current) inspInputRef.current.value = ''
    }
  }

  async function handleSubmit() {
    let lat = null, lon = null
    if (navigator.geolocation) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve() },
          () => resolve(),
          { timeout: 5000 }
        )
      })
    }
    onGenerate({
      occasion,
      mood,
      vibe: showVibe ? vibe : null,
      context_note: contextNote.trim() || null,
      lat,
      lon,
      anchor_items: anchorItems.map((a) => ({ item_id: a.item_id, name: a.name })),
      inspiration_image_urls: inspirationUrls,
    })
  }

  return (
    <div className={styles.content}>

      {/* Weather strip */}
      {!weatherLoading && weather && (
        <p className={styles.weatherStrip}>{weather.summary}</p>
      )}
      {weatherLoading && (
        <p className={styles.weatherLoading}>--°C · Fetching weather...</p>
      )}

      <div className={styles.divider} />

      {/* Mood */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>HOW ARE YOU FEELING?</p>
        <div className={styles.moodRow}>
          {MOODS.map(({ Icon, label, value }) => (
            <button
              key={value}
              type="button"
              className={`${styles.moodCard} ${mood === value ? styles.moodSelected : ''}`}
              onClick={() => setMood(mood === value ? null : value)}
            >
              <span className={styles.moodIcon}><Icon /></span>
              <span className={styles.moodLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* Occasion */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>WHAT'S TODAY?</p>
        <div className={styles.occasionGrid}>
          {OCCASIONS.map(({ Icon, label, value }) => (
            <button
              key={value}
              type="button"
              className={`${styles.occasionPill} ${occasion === value ? styles.occasionSelected : ''}`}
              onClick={() => {
                setOccasion(occasion === value ? null : value)
                if (!SOCIAL_OCCASIONS.includes(value)) setVibe(null)
              }}
            >
              <span className={styles.occasionIcon}><Icon /></span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Wearing today — wardrobe anchor items */}
      <div className={styles.anchorSection}>
        <p className={styles.sectionLabel}>WEARING TODAY</p>
        {anchorItems.length > 0 && (
          <div className={styles.anchorGrid}>
            {anchorItems.map((item) => (
              <div key={item.item_id} className={styles.anchorItem}>
                <div className={styles.anchorImgWrap}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className={styles.anchorImg} />
                    : <span className={styles.anchorPlaceholder}>?</span>
                  }
                </div>
                <p className={styles.anchorName}>{item.name}</p>
                <button
                  type="button"
                  aria-label="Remove item"
                  className={styles.anchorRemove}
                  onClick={() => setAnchorItems((prev) => prev.filter((a) => a.item_id !== item.item_id))}
                >×</button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className={styles.anchorPickBtn}
          onClick={() => setShowPicker(true)}
        >
          + Choose from wardrobe
        </button>
      </div>

      <div className={styles.divider} />

      {/* Inspiration images (up to 3) */}
      <div className={styles.inspirationSection}>
        <p className={styles.sectionLabel}>STYLE INSPIRATION</p>
        <p className={styles.inspirationSubtitle}>Drop your Pinterest screenshots, moodboards, or outfit inspo. Your stylist will study the vibe.</p>
        <div
          className={`${styles.dropZone} ${inspirationUploading ? styles.dropZoneUploading : ''}`}
          onClick={() => inspirationUrls.length < MAX_INSPIRATION && inspInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.dropZoneDragOver) }}
          onDragLeave={(e) => e.currentTarget.classList.remove(styles.dropZoneDragOver)}
          onDrop={async (e) => {
            e.preventDefault()
            e.currentTarget.classList.remove(styles.dropZoneDragOver)
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, MAX_INSPIRATION - inspirationUrls.length)
            for (const file of files) {
              const synth = { target: { files: [file] } }
              await handleInspirationUpload(synth)
            }
          }}
        >
          {inspirationUrls.length === 0 ? (
            <p className={styles.dropZonePlaceholder}>
              {inspirationUploading ? 'Uploading...' : 'Drop images here or click to browse'}
            </p>
          ) : (
            <div className={styles.inspirationRow}>
              {inspirationUrls.map((url, i) => (
                <div key={url} className={styles.inspirationPreview}>
                  <img src={url} alt={`Inspiration ${i + 1}`} className={styles.inspirationImg} />
                  <button
                    type="button"
                    aria-label="Remove inspiration"
                    className={styles.inspirationRemove}
                    onClick={(e) => { e.stopPropagation(); setInspirationUrls((prev) => prev.filter((_, idx) => idx !== i)) }}
                  >×</button>
                </div>
              ))}
              {inspirationUrls.length < MAX_INSPIRATION && (
                <div className={styles.inspirationAddMore}>
                  {inspirationUploading ? '...' : '+'}
                </div>
              )}
            </div>
          )}
        </div>
        <input
          ref={inspInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleInspirationUpload}
        />
      </div>

      {/* Context note */}
      <div className={styles.noteSection}>
        <p className={styles.sectionLabel}>ANYTHING ELSE YOUR STYLIST SHOULD KNOW?</p>
        <textarea
          className={styles.noteTextarea}
          placeholder="We're doing brunch then walking around Palermo... or I have a presentation at 3pm..."
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value.slice(0, MAX_NOTE))}
          rows={3}
        />
        <p className={styles.noteCounter}>{contextNote.length} / {MAX_NOTE}</p>
      </div>

      {/* Vibe selector (social occasions only) */}
      <AnimatePresence>
        {showVibe && <VibeSelector value={vibe} onChange={setVibe} />}
      </AnimatePresence>

      <button
        type="button"
        className={styles.cta}
        disabled={!occasion}
        onClick={handleSubmit}
      >
        Style Me Today
      </button>

      {/* Wardrobe picker modal */}
      <AnimatePresence>
        {showPicker && (
          <WardrobePickerModal
            selectedIds={anchorItems.map((a) => a.item_id)}
            onConfirm={(items) => {
              setAnchorItems(items.map((i) => ({
                item_id: i.id || i._id || i.item_id,
                name: i.name,
                image_url: i.image_url || null,
              })))
              setShowPicker(false)
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
