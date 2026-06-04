import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/index.js'
import { useTrips } from '../hooks/useTrips.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import { useNewTrip } from '../hooks/useNewTrip.js'
import { useDailyStyling } from '../hooks/useDailyStyling.js'
import api from '../utils/api.js'
import styles from './ProfilePage.module.css'
import PreferencesModal from '../components/profile/PreferencesModal.jsx'
import WardrobeGateModal from '../components/trips/WardrobeGateModal.jsx'
import LookHistoryCard from '../components/daily/LookHistoryCard.jsx'

function IconArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h8M6 2l4 4-4 4" />
    </svg>
  )
}

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconSpinner() {
  return (
    <svg className={styles.spinner} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

function IconMapPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5Z" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function isUpcoming(trip) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(trip.end_date + 'T00:00:00') >= today
}

export default function ProfilePage() {
  const user = useStore((s) => s.user)
  const updateUser = useStore((s) => s.updateUser)
  const lookHistory = useStore((s) => s.lookHistory)
  const { trips, fetchTrips } = useTrips()
  const { wardrobe, fetchWardrobe } = useWardrobe()
  const navigate = useNavigate()
  const { goToNewTrip, gateOpen, missing, closeGate } = useNewTrip()
  const { fetchHistory } = useDailyStyling()
  const [styleDNA, setStyleDNA] = useState(null)
  const [dnaLoading, setDnaLoading] = useState(false)
  const [dnaError, setDnaError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const avatarInputRef = useRef(null)
  const tripsScrollRef = useRef(null)
  const looksScrollRef = useRef(null)
  const analyzedRef = useRef(false)
  const [styledLooks, setStyledLooks] = useState([])

  useEffect(() => {
    fetchTrips()
    fetchWardrobe()
    fetchHistory(50, 0)
    // Fetch full user to get persisted style_dna
    api.get('/api/v1/auth/me').then(({ data }) => {
      updateUser(data.data)
      if (data.data.style_dna) {
        setStyleDNA(data.data.style_dna)
        analyzedRef.current = true
      }
    }).catch(() => {})
    // Fetch styled looks archive
    api.get('/api/v1/looks/me').then(({ data }) => {
      const all = data.data || []
      setStyledLooks(all.filter(l => l.source === 'styled'))
    }).catch(() => {})
  }, [])

  // TODO: auto-analyze when wardrobe reaches 3+ items (re-enable later)
  // useEffect(() => {
  //   if (wardrobe.length >= 3 && !styleDNA && !analyzedRef.current) {
  //     analyzedRef.current = true
  //     runAnalysis()
  //   }
  // }, [wardrobe.length, styleDNA])

  async function runAnalysis() {
    setDnaLoading(true)
    setDnaError('')
    try {
      const res = await api.post('/api/v1/profile/analyze-style')
      setStyleDNA(res.data.data)
      updateUser({ style_dna: res.data.data })
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error
      setDnaError(detail || 'Could not reach the server. Is the backend running?')
    } finally {
      setDnaLoading(false)
    }
  }

  function reanalyze() {
    runAnalysis()
  }

  // Derived stats
  const tripsPlanned = trips.length
  const wardrobeItems = wardrobe.length
  const outfitsApproved = trips.reduce((n, t) => n + (t.approved_outfits?.length ?? 0), 0)
  const looksGenerated = trips.filter((t) => t.packing_list).length

  // Date-filtered trip lists
  const upcomingTrips = trips
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))

  const pastTrips = trips
    .filter((t) => !isUpcoming(t))
    .sort((a, b) => new Date(b.end_date) - new Date(a.end_date))

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const { data } = await api.patch('/api/v1/auth/me/profile-picture', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser({ profile_picture: data.data.profile_picture_url })
    } catch {
      setAvatarPreview(null)
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  // Avatar — prefer built avatar, then profile picture, then initials
  const avatarImg = user?.avatar?.base_url || user?.profile_picture || avatarPreview
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'P'

  // Approved looks from all trips
  const approvedLooks = trips.flatMap((t) =>
    (t.approved_outfits ?? []).map((o) => ({
      ...o,
      tripName: t.name,
      tripId: t.id,
    }))
  )

  // All approved outfits across all trips, each tagged with trip name + look index
  const allLookbookCards = trips
    .filter((t) => t.approved_outfits?.length > 0 && t.packing_list?.outfits?.length > 0)
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .flatMap((t) => {
      const approved = t.packing_list.outfits.filter((o) =>
        t.approved_outfits.includes(o.name)
      )
      return approved.map((outfit, i) => ({
        outfit,
        tripName: t.destination || t.name,
        tripId: t.id,
        lookIndex: i,
      }))
    })

  function scrollRef(ref, dir) {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button
          className={styles.avatarWrap}
          onClick={() => avatarInputRef.current?.click()}
          type="button"
          aria-label="Change profile picture"
          disabled={avatarUploading}
        >
          <div className={styles.avatar}>
            {avatarUploading ? (
              <IconSpinner />
            ) : avatarPreview || avatarImg ? (
              <img src={avatarPreview || avatarImg} alt={user?.name} className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitials}>{initials}</span>
            )}
          </div>
          <div className={styles.avatarOverlay}>
            <IconCamera />
          </div>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className={styles.avatarInput}
          onChange={handleAvatarChange}
        />
        <h1 className={styles.name}>{user?.name}</h1>

        {/* Avatar builder prompt / update link */}
        {!user?.avatar?.base_url ? (
          <Link to="/profile/build-avatar" className={styles.avatarBuilderLink}>
            Build your avatar to unlock trip planning →
          </Link>
        ) : (
          <Link to="/profile/build-avatar" className={styles.avatarUpdateLink}>
            Update avatar
          </Link>
        )}

        <div className={styles.pillRow}>
          <button className={styles.pillBtn} type="button" onClick={() => setShowPreferences(true)}>Preferences</button>
          <button className={styles.pillBtn} type="button">Settings</button>
        </div>

        {showPreferences && <PreferencesModal onClose={() => setShowPreferences(false)} />}
      </div>

      {/* Activity Stats */}
      <div className={styles.statsRow}>
        {[
          { n: tripsPlanned, label: 'Trips Planned' },
          { n: wardrobeItems, label: 'Wardrobe Items' },
          { n: outfitsApproved, label: 'Outfits Approved' },
          { n: looksGenerated, label: 'Looks Generated' },
          { n: lookHistory.length, label: 'Looks Styled' },
        ].map(({ n, label }, i) => (
          <div key={label} className={styles.statCell}>
            {i > 0 && <div className={styles.statDivider} />}
            <div className={styles.statInner}>
              <span className={styles.statNum}>{n}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Trips */}
      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <p className={styles.sectionLabel}>UPCOMING TRIPS</p>
          <div className={styles.scrollControls}>
            <Link to="/trips" className={styles.seeAll}>See all</Link>
            <button
              className={styles.arrowBtn}
              onClick={() => scrollRef(tripsScrollRef, -1)}
              type="button"
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              className={styles.arrowBtn}
              onClick={() => scrollRef(tripsScrollRef, 1)}
              type="button"
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </div>
        <div className={styles.hScroll} ref={tripsScrollRef}>
          {/* New Trip card always first */}
          <button
            type="button"
            className={styles.newTripCard}
            onClick={goToNewTrip}
            aria-label="Plan a new trip"
          >
            <span className={styles.newTripPlus}>+</span>
            <span className={styles.newTripLabel}>New Trip</span>
          </button>

          {upcomingTrips.map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`} className={styles.tripCard}>
              <div className={styles.tripCardImg}>
                {trip.inspiration_images?.[0] ? (
                  <img
                    src={trip.inspiration_images[0].url}
                    alt={trip.destination}
                    className={styles.tripCardPhoto}
                  />
                ) : (
                  <span className={styles.tripCardInitial}>
                    {trip.destination.charAt(0)}
                  </span>
                )}
              </div>
              <div className={styles.tripCardBody}>
                <p className={styles.tripCardName}>{trip.name}</p>
                <p className={styles.tripCardDest}>
                  <IconMapPin /> {trip.destination}
                </p>
                <p className={styles.tripCardDates}>
                  {formatDateRange(trip.start_date, trip.end_date)}
                </p>
              </div>
            </Link>
          ))}

          {upcomingTrips.length === 0 && (
            <p className={styles.emptyState} style={{ alignSelf: 'center', paddingLeft: 'var(--space-2)' }}>
              No upcoming trips.
            </p>
          )}
        </div>
      </section>

      {/* Past Trips */}
      {pastTrips.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <p className={styles.sectionLabel}>PAST TRIPS</p>
          </div>
          <div className={`${styles.hScroll} ${styles.pastRow}`}>
            {pastTrips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`} className={`${styles.tripCard} ${styles.tripCardPast}`}>
                <div className={styles.tripCardImg}>
                  {trip.inspiration_images?.[0] ? (
                    <img
                      src={trip.inspiration_images[0].url}
                      alt={trip.destination}
                      className={styles.tripCardPhoto}
                    />
                  ) : (
                    <span className={styles.tripCardInitial}>
                      {trip.destination.charAt(0)}
                    </span>
                  )}
                </div>
                <div className={styles.tripCardBody}>
                  <p className={styles.tripCardName}>{trip.name}</p>
                  <p className={styles.tripCardDest}>
                    <IconMapPin /> {trip.destination}
                  </p>
                  <p className={styles.tripCardDates}>
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Style DNA */}
      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <p className={styles.sectionLabel}>YOUR STYLE DNA</p>
        </div>
        {wardrobeItems < 3 ? (
          <p className={styles.emptyState}>
            Add at least 3 items to unlock your Style DNA.{' '}
            <Link to="/wardrobe" className={styles.emptyLink}>Go to wardrobe →</Link>
          </p>
        ) : dnaError && !styleDNA ? (
          <div className={styles.dnaCard}>
            <p className={styles.emptyState}>{dnaError}</p>
            <button className={styles.reanalyzeLink} onClick={reanalyze} type="button">
              Try again →
            </button>
          </div>
        ) : styleDNA ? (
          <motion.div
            className={`${styles.dnaCard} ${dnaLoading ? styles.dnaCardPulse : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {styleDNA.color_palette?.length > 0 && (
              <div className={styles.swatchRow}>
                {styleDNA.color_palette.map((hex) => (
                  <span
                    key={hex}
                    className={styles.swatch}
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
              </div>
            )}
            {styleDNA.style_keywords?.length > 0 && (
              <div className={styles.keywordRow}>
                {styleDNA.style_keywords.slice(0, 3).map((kw) => (
                  <span key={kw} className={styles.keyword}>{kw}</span>
                ))}
              </div>
            )}
            {styleDNA.stylist_paragraph && (
              <p className={styles.stylistParagraph}>{styleDNA.stylist_paragraph}</p>
            )}
            <div className={styles.dnaFooter}>
              <button
                className={styles.reanalyzeLink}
                onClick={reanalyze}
                type="button"
                disabled={dnaLoading}
              >
                {dnaLoading ? 'Regenerating...' : 'Regenerate'}
              </button>
              <Link to="/profile/style-dna" className={styles.seeFullLink}>
                See full analysis <IconArrowRight />
              </Link>
            </div>

          </motion.div>
        ) : dnaLoading ? (
          <div className={`${styles.dnaCard} ${styles.dnaCardPulse}`}>
            <p className={styles.dnaLoading}>Analyzing your wardrobe...</p>
          </div>
        ) : (
          <div className={styles.dnaCard}>
            <p className={styles.emptyState}>Generate your Style DNA to see your palette, aesthetic, and a stylist's read on your wardrobe.</p>
            <button className={styles.reanalyzeLink} onClick={reanalyze} type="button" disabled={dnaLoading}>
              Generate →
            </button>
          </div>
        )}
      </section>

      {/* Lookbook grid */}
      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <p className={styles.sectionLabel}>APPROVED LOOKS</p>
        </div>
        {allLookbookCards.length === 0 ? (
          <p className={styles.emptyState}>
            Approve outfits from a trip to see your lookbook here.
          </p>
        ) : (
          <div className={styles.lookbookGrid}>
            {allLookbookCards.map(({ outfit, tripName, tripId, lookIndex }) => (
              <Link
                key={`${tripId}-${outfit.outfit_id}`}
                to={`/trips/${tripId}`}
                state={{ initialLook: lookIndex }}
                className={styles.lookbookCard}
              >
                <div className={styles.lookbookCardImg}>
                  {(outfit.generated_image_url || outfit.lookbook_image_url) ? (
                    <img
                      src={outfit.generated_image_url || outfit.lookbook_image_url}
                      alt={outfit.day_label || outfit.name}
                      className={styles.lookbookCardPhoto}
                    />
                  ) : (
                    <div className={styles.lookbookCardPlaceholder}>
                      <span className={styles.lookbookCardPlaceholderText}>
                        {outfit.day_label || outfit.name || 'Look'}
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.lookbookCardFoot}>
                  <span className={styles.lookbookCardNum}>
                    Look {String(lookIndex + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.lookbookCardTrip}>{tripName}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Your Looks (daily styling archive) */}
      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <p className={styles.sectionLabel}>YOUR LOOKS</p>
        </div>
        {styledLooks.length === 0 ? (
          <p className={styles.emptyState}>Style an item from your wardrobe to start building your look archive.</p>
        ) : (
          <>
            <p className={styles.sectionSub}>Your personal style archive.</p>
            <div className={styles.lookbookGrid}>
              {styledLooks.map((look) => (
                <div key={look.id || look._id} className={styles.lookbookCard}>
                  <div className={styles.lookbookCardImg}>
                    {look.avatar_image_url ? (
                      <img
                        src={look.avatar_image_url}
                        alt={look.name}
                        className={styles.lookbookCardPhoto}
                      />
                    ) : (
                      <div className={styles.lookbookCardPlaceholder}>
                        <span className={styles.lookbookCardPlaceholderText}>{look.name || 'Look'}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.lookbookCardFoot}>
                    <span className={styles.lookbookCardNum}>{look.name}</span>
                    <span className={styles.lookbookCardTrip}>{look.occasion}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Shopping history link */}
      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <p className={styles.sectionLabel}>SHOPPING HISTORY</p>
        </div>
        <p className={styles.sectionSub}>
          Analyses, purchase decisions, and items added from the PACK extension.
        </p>
        <Link to="/profile/shopping" className={styles.seeFullLink}>
          View shopping history →
        </Link>
      </section>

      <AnimatePresence>
        {gateOpen && (
          <WardrobeGateModal missing={missing} onClose={closeGate} />
        )}
      </AnimatePresence>
    </div>
  )
}
