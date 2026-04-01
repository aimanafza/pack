import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips.js'
import TripCard from '../components/trips/TripCard.jsx'
import styles from './TripsPage.module.css'

function isUpcoming(trip) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(trip.end_date + 'T00:00:00') >= today
}

export default function TripsPage() {
  const { trips, loading, fetchTrips, deleteTrip } = useTrips()
  const navigate = useNavigate()

  useEffect(() => {
    fetchTrips()
  }, [])

  async function handleDelete(id) {
    await deleteTrip(id)
  }

  const upcoming = trips
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))

  const past = trips
    .filter((t) => !isUpcoming(t))
    .sort((a, b) => new Date(b.end_date) - new Date(a.end_date))

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.pageLabel}>The Journeys</p>
          <h1 className={styles.headline}>Your Trips</h1>
        </div>
        <div className={styles.headerRight}>
          {trips.length > 0 && (
            <span className={styles.tripCount}>
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
            </span>
          )}
          <button className={styles.btnAdd} onClick={() => navigate('/trips/new')}>
            New Trip
          </button>
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
    </>
  )
}
