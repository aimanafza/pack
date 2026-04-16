import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'
import { useTrips } from '../hooks/useTrips.js'
import TripDetail from '../components/trips/TripDetail.jsx'
import api from '../utils/api.js'
import styles from './TripDetailPage.module.css'

export default function TripDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const activeTrip = useStore((s) => s.activeTrip)
  const packingLoading = useStore((s) => s.packingLoading)
  const packingError = useStore((s) => s.packingError)
  const setPackingLoading = useStore((s) => s.setPackingLoading)
  const setPackingError = useStore((s) => s.setPackingError)
  const updateTrip = useStore((s) => s.updateTrip)
  const setActiveTrip = useStore((s) => s.setActiveTrip)
  const { fetchTrip, editTrip, deleteTrip, loading } = useTrips()
  const pollRef = useRef(null)

  useEffect(() => {
    fetchTrip(id)
  }, [id])

  // Poll for vibe analysis if images uploaded but no vibe yet
  useEffect(() => {
    if (!activeTrip) return
    const needsPoll =
      activeTrip.inspiration_images?.length > 0 && !activeTrip.vibe_analysis

    if (needsPoll && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/api/v1/trips/${id}`)
          if (data.data.vibe_analysis) {
            updateTrip(data.data)
            setActiveTrip(data.data)
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        } catch {
          // silent — keep polling
        }
      }, 4000)
    }

    if (!needsPoll && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [activeTrip?.id, activeTrip?.vibe_analysis])

  async function handleGeneratePacking() {
    setPackingLoading(true)
    setPackingError(null)
    try {
      await api.post('/api/v1/pack/suggest', { trip_id: id })
      await fetchTrip(id)
      navigate(`/trips/${id}/review`)
    } catch (err) {
      console.error('Pack suggest error:', err?.response?.data || err)
      setPackingError(
        err?.response?.data?.detail || 'Could not generate packing list. Try again.'
      )
    } finally {
      setPackingLoading(false)
    }
  }

  async function handleUnapproveOutfits(outfitNames) {
    try {
      const { data } = await api.patch(`/api/v1/trips/${id}/unapprove-outfits`, { outfit_names: outfitNames })
      updateTrip(data.data)
      setActiveTrip(data.data)
      navigate(`/trips/${id}/review`)
    } catch (err) {
      console.error('Unapprove outfits error:', err?.response?.data || err)
    }
  }

  if (loading && !activeTrip) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Loading trip...</p>
      </div>
    )
  }

  if (!activeTrip) {
    return (
      <div className={styles.notFound}>
        <p className={styles.notFoundText}>Trip not found.</p>
        <button className={styles.back} onClick={() => navigate('/trips')}>Back to Trips</button>
      </div>
    )
  }

  return (
    <>
      <button className={styles.backLink} onClick={() => navigate('/trips')} type="button">
        ← Trips
      </button>
      <TripDetail
        trip={activeTrip}
        onGeneratePacking={handleGeneratePacking}
        onUnapproveOutfits={handleUnapproveOutfits}
        onEditTrip={editTrip}
        onDeleteTrip={async () => { await deleteTrip(id); navigate('/trips') }}
        packingLoading={packingLoading}
        packingError={packingError}
      />
    </>
  )
}
