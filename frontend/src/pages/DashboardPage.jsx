import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/index.js'
import { useTrips } from '../hooks/useTrips.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import UploadModal from '../components/wardrobe/UploadModal.jsx'
import styles from './DashboardPage.module.css'

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

function NewTripCard() {
  const navigate = useNavigate()
  return (
    <div
      className={styles.newTripCard}
      onClick={() => navigate('/trips/new')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate('/trips/new')}
    >
      <span className={styles.newTripPlus}>+</span>
      <span className={styles.newTripLabel}>Plan a trip</span>
    </div>
  )
}

export default function DashboardPage() {
  const user = useStore((s) => s.user)
  const { trips, fetchTrips } = useTrips()
  const { wardrobe, fetchWardrobe } = useWardrobe()
  const navigate = useNavigate()
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchTrips()
    fetchWardrobe()
  }, [])

  const sorted = [...trips].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  const snapshotItems = [...wardrobe].slice(0, 6)
  // Fresh state only when: never logged in before AND nothing in the account yet.
  // Once pack_returning is set (set on every login), we always show the welcome-back hero.
  const isReturning = localStorage.getItem('pack_returning') === 'true'
  const isFreshUser = !isReturning && trips.length === 0 && wardrobe.length === 0
  const outfitsApproved = trips.reduce((n, t) => n + (t.approved_outfits?.length ?? 0), 0)

  // Hero background: most recently added wardrobe item
  const heroBgUrl = wardrobe[0]?.image_url

  return (
    <div className={styles.page}>

      {/* ── RETURNING USER STATE ── */}
      {!isFreshUser && (
        <div
          className={styles.heroSection}
          style={heroBgUrl ? { backgroundImage: `url(${heroBgUrl})` } : {}}
        >
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
                onClick={() => navigate('/trips/new')}
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

          <section className={styles.section}>
            <p className={styles.sectionLabel}>Upcoming Trips</p>
            <div className={styles.tripScroll}>
              {sorted.map((trip) => (
                <DashTripCard key={trip.id} trip={trip} />
              ))}
              <NewTripCard />
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.sectionLabel}>Your Wardrobe</p>
            {wardrobe.length === 0 ? (
              <p className={styles.emptySnap}>
                No items yet.{' '}
                <Link to="/wardrobe" className={styles.emptyLink}>Add your first piece →</Link>
              </p>
            ) : (
              <>
                <div className={styles.wardrobeRow}>
                  {snapshotItems.map((item) => (
                    <div key={item.id} className={styles.wardrobeThumb}>
                      <img src={item.image_url} alt={item.name} className={styles.wardrobeThumbImg} />
                    </div>
                  ))}
                </div>
                <Link to="/wardrobe" className={styles.viewAll}>
                  View all {wardrobe.length} items →
                </Link>
              </>
            )}
          </section>
        </>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}
