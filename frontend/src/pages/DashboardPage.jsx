import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/index.js'
import { useTrips } from '../hooks/useTrips.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import { useNewTrip } from '../hooks/useNewTrip.js'
import { useDailyStyling } from '../hooks/useDailyStyling.js'
import UploadModal from '../components/wardrobe/UploadModal.jsx'
import WardrobeGateModal from '../components/trips/WardrobeGateModal.jsx'
import TodayCard from '../components/daily/TodayCard.jsx'
import api from '../utils/api.js'
import styles from './DashboardPage.module.css'

const CARPET_CACHE_KEY = 'pack_carpet_url'
const CARPET_MAX_CHECKS = 18 // every 10s, so about 3 minutes

// localStorage can throw (private mode, blocked storage); the cache is only a speed-up.
function readCachedCarpet() {
  try { return localStorage.getItem(CARPET_CACHE_KEY) } catch { return null }
}
function writeCachedCarpet(url) {
  try { localStorage.setItem(CARPET_CACHE_KEY, url) } catch { /* ignore */ }
}
function clearCachedCarpet() {
  try { localStorage.removeItem(CARPET_CACHE_KEY) } catch { /* ignore */ }
}

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const first = name ? name.split(' ')[0] : ''
  return `${time}${first ? `, ${first}` : ''}.`
}

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

function IconTrip() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5Z" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconWardrobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3V2a1 1 0 0 0-2 0v1L1 7h14L9 3Z" strokeLinejoin="round" />
      <path d="M2 7v7h12V7" />
    </svg>
  )
}

function IconExtension() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="5" rx="0.5" />
      <rect x="9" y="2" width="5" height="5" rx="0.5" />
      <rect x="2" y="9" width="5" height="5" rx="0.5" />
      <path d="M9 11.5h5M11.5 9v5" strokeLinecap="round" />
    </svg>
  )
}

function IconShop() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2L3 6v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-3-4z" strokeLinejoin="round" />
      <path d="M3 6h10" />
      <path d="M10 9a2 2 0 0 1-4 0" />
    </svg>
  )
}

function DashTripCard({ trip }) {
  const navigate = useNavigate()
  return (
    <motion.div
      className={styles.tripCard}
      onClick={() => navigate(`/trips/${trip.id}`)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className={styles.tripCardImage}>
        {trip.inspiration_images?.[0] ? (
          <img
            src={trip.inspiration_images[0].url}
            alt={trip.destination}
            className={styles.tripCardImg}
          />
        ) : (
          <span className={styles.tripCardDestInitial}>
            {trip.destination.charAt(0)}
          </span>
        )}
      </div>
      <div className={styles.tripCardBody}>
        <p className={styles.tripCardName}>{trip.name}</p>
        <p className={styles.tripCardDest}>{trip.destination}</p>
        <p className={styles.tripCardDates}>{formatDateRange(trip.start_date, trip.end_date)}</p>
        <span className={`${styles.tripCardStatus} ${styles[`status_${trip.status}`]}`}>
          {trip.status}
        </span>
      </div>
    </motion.div>
  )
}

function NewTripCard({ onClick }) {
  return (
    <div
      className={styles.newTripCard}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className={styles.newTripPlus}>+</span>
      <span className={styles.newTripLabel}>Plan a trip</span>
    </div>
  )
}

export default function DashboardPage() {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const updateUser = useStore((s) => s.updateUser)
  const todayLook = useStore((s) => s.todayLook)
  const { trips, fetchTrips } = useTrips()
  const { wardrobe, fetchWardrobe } = useWardrobe()
  const navigate = useNavigate()
  const { goToNewTrip, gateOpen, missing, closeGate } = useNewTrip()
  const { checkToday } = useDailyStyling()
  const [showUpload, setShowUpload] = useState(false)
  const [pendingAnalysesCount, setPendingAnalysesCount] = useState(0)

  useEffect(() => {
    fetchTrips()
    fetchWardrobe()
    checkToday()
    // Fetch pending shopping analyses count
    api.get('/api/v1/purchase-analysis/me')
      .then(({ data }) => {
        const pending = (data.data || []).filter(
          (a) => a.bought === null || a.bought === undefined
        )
        setPendingAnalysesCount(pending.length)
      })
      .catch(() => {})
  }, [])

  const sorted = [...trips].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  const snapshotItems = [...wardrobe].slice(0, 7)
  const isReturning = localStorage.getItem('pack_returning') === 'true'
  const isFreshUser = !isReturning && trips.length === 0 && wardrobe.length === 0
  const outfitsApproved = trips.reduce((n, t) => n + (t.approved_outfits?.length ?? 0), 0)

  // Login and /auth/me both return dashboard_carpet_url. If the stored user
  // lacks it (older partial profile), load it once instead of guessing.
  const profileLoaded = !!user && 'dashboard_carpet_url' in user
  useEffect(() => {
    if (user && !profileLoaded) {
      api.get('/api/v1/auth/me').then(({ data }) => setUser(data.data)).catch(() => {})
    }
  }, [user, profileLoaded, setUser])

  // Remember the carpet on this device so a refresh shows it instantly,
  // before the profile request comes back.
  useEffect(() => {
    if (!profileLoaded) return
    if (user.dashboard_carpet_url) writeCachedCarpet(user.dashboard_carpet_url)
    else clearCachedCarpet()
  }, [profileLoaded, user?.dashboard_carpet_url])

  // Ask the server once per visit whether a carpet can be made. Only wait for it
  // when generation actually started, and stop checking after about 3 minutes.
  useEffect(() => {
    if (!profileLoaded || user.dashboard_carpet_url) return
    let cancelled = false
    let timer
    api.post('/api/v1/profile/generate-carpet').then(({ data }) => {
      const result = data.data || {}
      if (cancelled) return
      if (result.status === 'ready' && result.dashboard_carpet_url) {
        updateUser({ dashboard_carpet_url: result.dashboard_carpet_url })
      } else if (result.status === 'generating') {
        let checks = 0
        timer = setInterval(() => {
          checks += 1
          if (checks > CARPET_MAX_CHECKS) return clearInterval(timer)
          api.get('/api/v1/auth/me').then(({ data }) => {
            if (!cancelled && data.data?.dashboard_carpet_url) {
              setUser(data.data)
              clearInterval(timer)
            }
          }).catch(() => {})
        }, 10000)
      }
    }).catch(() => {})
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [profileLoaded, user?.dashboard_carpet_url])

  // Hero background: carpet image if there is one, otherwise the first wardrobe item.
  // Until the profile is known, use the carpet cached on this device (or nothing),
  // so a user with a carpet never sees the wardrobe photo first and then a swap.
  const carpetUrl = profileLoaded ? user.dashboard_carpet_url : readCachedCarpet()
  const heroBgUrl = carpetUrl || (profileLoaded ? wardrobe[0]?.image_url : null)

  return (
    <div className={styles.page}>

      {/* ── RETURNING USER STATE ── */}
      {!isFreshUser && (
        <div
          className={`${styles.heroSection}${carpetUrl ? ` ${styles.hasCarpet}` : ''}`}
        >
          {heroBgUrl && (
            <img src={heroBgUrl} alt="" className={styles.heroBgImg} aria-hidden="true" />
          )}
          <div className={styles.frostCard}>
            <h2 className={styles.welcomeBack}>
              Welcome back, {user?.name?.split(' ')[0]}.
            </h2>
            <p className={styles.welcomeStats}>
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'} planned
              {' · '}
              {wardrobe.length} wardrobe {wardrobe.length === 1 ? 'item' : 'items'}
              {' · '}
              {outfitsApproved} {outfitsApproved === 1 ? 'outfit' : 'outfits'} approved
            </p>
            <div className={styles.actionCards}>
              <button
                className={styles.actionCard}
                onClick={goToNewTrip}
                type="button"
              >
                <span className={styles.actionIcon}><IconTrip /></span>
                <span className={styles.actionLabel}>NEW TRIP</span>
              </button>
              <button
                className={styles.actionCard}
                onClick={() => navigate('/wardrobe')}
                type="button"
              >
                <span className={styles.actionIcon}><IconWardrobe /></span>
                <span className={styles.actionLabel}>MY WARDROBE</span>
              </button>

              {user?.extension_connected ? (
                <button
                  className={styles.actionCard}
                  onClick={() => navigate('/profile/shopping')}
                  type="button"
                >
                  <span className={styles.actionIcon}>
                    <IconShop />
                    {pendingAnalysesCount > 0 && (
                      <span className={styles.actionBadge}>{pendingAnalysesCount}</span>
                    )}
                  </span>
                  <span className={styles.actionLabel}>SHOP ANALYSIS</span>
                </button>
              ) : (
                <a
                  className={styles.actionCard}
                  href="#"
                  onClick={(e) => { e.preventDefault(); navigate('/auth/extension-login') }}
                >
                  <span className={styles.actionIcon}><IconExtension /></span>
                  <span className={styles.actionLabel}>GET EXTENSION</span>
                </a>
              )}
            </div>
            <button
              className={styles.continueBtn}
              onClick={() => navigate('/trips')}
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── FRESH USER STATE ── */}
      {isFreshUser && (
        <div className={styles.freshState}>
          <h2 className={styles.freshHeadline}>Let's build your wardrobe.</h2>
          <p className={styles.freshSubhead}>Add your first piece to get started.</p>
          <button
            className={styles.freshCta}
            onClick={() => setShowUpload(true)}
            type="button"
          >
            Add First Item
          </button>
          <Link to="/onboarding" className={styles.tourLink}>
            Or take the guided tour →
          </Link>
        </div>
      )}

      {/* ── UPCOMING TRIPS (returning users) ── */}
      {!isFreshUser && (
        <>
          <div className={styles.header}>
            <p className={styles.pageLabel}>Dashboard</p>
            <h1 className={styles.headline}>{greeting(user?.name)}</h1>
            <p className={styles.subhead}>
              You have {trips.length} {trips.length === 1 ? 'trip' : 'trips'} planned and{' '}
              {wardrobe.length} {wardrobe.length === 1 ? 'item' : 'items'} in your wardrobe.
            </p>
          </div>

          <section className={styles.todaySection}>
            <p className={styles.sectionLabel}>TODAY</p>
            <TodayCard
              todayLook={todayLook}
              onStyleMe={() => navigate('/daily')}
            />
          </section>

          <section className={styles.section}>
            <p className={styles.sectionLabel}>Upcoming Trips</p>
            <div className={styles.tripScroll}>
              <NewTripCard onClick={goToNewTrip} />
              {sorted.map((trip) => (
                <DashTripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Your Wardrobe</p>
              {wardrobe.length > 0 && (
                <Link to="/wardrobe" className={styles.viewAll}>
                  View all {wardrobe.length} items →
                </Link>
              )}
            </div>
            {wardrobe.length === 0 ? (
              <p className={styles.emptySnap}>
                No items yet.{' '}
                <Link to="/wardrobe" className={styles.emptyLink}>Add your first piece →</Link>
              </p>
            ) : (
              <>
                <div className={styles.wardrobeRow}>
                  {snapshotItems.map((item) => (
                    <Link key={item.id} to={`/wardrobe/${item.id}`} className={styles.wardrobeThumb}>
                      <img src={item.image_url} alt={item.name} className={styles.wardrobeThumbImg} />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      <AnimatePresence>
        {gateOpen && (
          <WardrobeGateModal missing={missing} onClose={closeGate} />
        )}
      </AnimatePresence>
    </div>
  )
}
