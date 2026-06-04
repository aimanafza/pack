import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useTrips } from '../hooks/useTrips.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import { useNewTrip } from '../hooks/useNewTrip.js'
import TripCard from '../components/trips/TripCard.jsx'
import WardrobeGateModal from '../components/trips/WardrobeGateModal.jsx'
import styles from './TripsPage.module.css'

function isUpcoming(trip) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(trip.end_date + 'T00:00:00') >= today
}

export default function TripsPage() {
  const { trips, loading, fetchTrips, deleteTrip } = useTrips()
  const { fetchWardrobe } = useWardrobe()
  const navigate = useNavigate()
  const { goToNewTrip, gateOpen, missing, closeGate } = useNewTrip()
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchTrips()
    fetchWardrobe()
  }, [])

  async function handleDelete(id) {
    await deleteTrip(id)
  }

  const q = search.trim().toLowerCase()

  const filtered = q
    ? trips.filter((t) =>
        t.name?.toLowerCase().includes(q) ||
        t.destination?.toLowerCase().includes(q)
      )
    : trips

  const upcoming = filtered
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))

  const past = filtered
    .filter((t) => !isUpcoming(t))
    .sort((a, b) => new Date(b.end_date) - new Date(a.end_date))

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.pageLabel}>The Journeys</p>
          <h1 className={styles.headline}>My Trips</h1>
        </div>
        <div className={styles.headerRight}>
          {trips.length > 0 && (
            <span className={styles.tripCount}>
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
            </span>
          )}
          <button className={styles.btnAdd} onClick={goToNewTrip}>
            New Trip
          </button>
        </div>
      </div>

      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5l3 3" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search trips..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')} type="button" aria-label="Clear search">×</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <p className={styles.loadingText}>Loading your trips...</p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Upcoming</p>
            <div className={styles.list}>
              {upcoming.length === 0 ? (
                <p className={styles.emptyText}>No upcoming trips. Plan one.</p>
              ) : (
                upcoming.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onDelete={handleDelete} />
                ))
              )}
            </div>
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Past</p>
              <div className={`${styles.list} ${styles.pastList}`}>
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onDelete={handleDelete} past />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {gateOpen && (
          <WardrobeGateModal missing={missing} onClose={closeGate} />
        )}
      </AnimatePresence>
    </>
  )
}
