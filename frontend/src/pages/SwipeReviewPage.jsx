import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import useStore from '../store/index.js'
import { useTrips } from '../hooks/useTrips.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import SwipeCard from '../components/review/SwipeCard.jsx'
import BagCounter from '../components/review/BagCounter.jsx'
import RejectionModal from '../components/review/RejectionModal.jsx'
import styles from './SwipeReviewPage.module.css'

// Direction-aware card variants
const cardVariants = {
  initial: { x: 60, opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: (dir) => ({
    x: dir === 'approve' ? 0 : -40,
    y: dir === 'approve' ? -40 : 0,
    opacity: 0,
    transition: { duration: dir === 'approve' ? 0.4 : 0.3, ease: 'easeIn' },
  }),
}

export default function SwipeReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchTrip, approveOutfit, rejectOutfit } = useTrips()
  const { fetchWardrobe } = useWardrobe()
  const wardrobe = useStore((s) => s.wardrobe)

  const [trip, setTrip] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [approvedNames, setApprovedNames] = useState(new Set())
  const [rejectedNames, setRejectedNames] = useState(new Set())
  const [exitDir, setExitDir] = useState('approve')
  const [bagPulse, setBagPulse] = useState(false)
  const [toast, setToast] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalOutfit, setModalOutfit] = useState(null)
  const toastTimer = useRef(null)

  // Fetch trip + wardrobe on mount
  useEffect(() => {
    fetchTrip(id).then((t) => setTrip(t))
    if (wardrobe.length === 0) fetchWardrobe()
  }, [id]) // eslint-disable-line

  // Initialize state from persisted trip data (once)
  useEffect(() => {
    if (trip && !initialized) {
      const approved = new Set(trip.approved_outfits ?? [])
      const rejected = new Set(trip.rejected_outfits ?? [])
      setApprovedNames(approved)
      setRejectedNames(rejected)
      const outfits = trip.packing_list?.outfits ?? []
      const reviewed = new Set([...approved, ...rejected])
      const firstPending = outfits.findIndex((o) => !reviewed.has(o.name))
      setCurrentIndex(firstPending >= 0 ? firstPending : outfits.length)
      setInitialized(true)
    }
  }, [trip, initialized])

  const wardrobeById = useMemo(
    () => Object.fromEntries(wardrobe.map((item) => [item.id, item])),
    [wardrobe]
  )

  const allOutfits = trip?.packing_list?.outfits ?? []
  const currentOutfit = allOutfits[currentIndex]
  const isComplete = initialized && currentIndex >= allOutfits.length

  const totalItems = useMemo(
    () =>
      allOutfits
        .filter((o) => approvedNames.has(o.name))
        .flatMap((o) => o.items).length,
    [allOutfits, approvedNames]
  )

  function showToastMessage(msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }

  function handleApprove() {
    if (!currentOutfit) return
    setExitDir('approve')
    const name = currentOutfit.name
    setApprovedNames((prev) => new Set([...prev, name]))
    setCurrentIndex((i) => i + 1)
    setBagPulse(true)
    showToastMessage(`${name} added`)
    setTimeout(() => setBagPulse(false), 600)
    // Fire-and-forget API call
    approveOutfit(id, name).then((updated) => updated && setTrip(updated)).catch(() => {})
  }

  function handleReject() {
    if (!currentOutfit) return
    setExitDir('reject')
    setModalOutfit(currentOutfit)
    setCurrentIndex((i) => i + 1)
    setShowModal(true)
  }

  function handleKeepPieces(keptItems) {
    const name = modalOutfit?.name
    if (!name) return
    setRejectedNames((prev) => new Set([...prev, name]))
    setShowModal(false)
    setModalOutfit(null)
    const kept = keptItems.length
    if (kept > 0) showToastMessage(`${kept} piece${kept > 1 ? 's' : ''} saved for restyling`)
    rejectOutfit(id, name, keptItems).then((updated) => updated && setTrip(updated)).catch(() => {})
  }

  function handleSkip() {
    const name = modalOutfit?.name
    if (!name) return
    setRejectedNames((prev) => new Set([...prev, name]))
    setShowModal(false)
    setModalOutfit(null)
    rejectOutfit(id, name, []).then((updated) => updated && setTrip(updated)).catch(() => {})
  }

  if (!trip || !initialized) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading your outfits...</div>
      </div>
    )
  }

  const reviewedCount = approvedNames.size + rejectedNames.size
  const progressPct = allOutfits.length > 0 ? (reviewedCount / allOutfits.length) * 100 : 0

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to={`/trips/${id}`} className={styles.backLink}>
            ← {trip.name}
          </Link>
          <div className={styles.headerMeta}>
            <span className={styles.reviewLabel}>REVIEW YOUR OUTFITS</span>
            <span className={styles.progress}>
              {Math.min(currentIndex + 1, allOutfits.length)} of {allOutfits.length} outfits
            </span>
          </div>
        </div>
        <BagCounter count={approvedNames.size} isPulsing={bagPulse} />
      </header>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <motion.div
          className={styles.progressFill}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Main content */}
      <main className={styles.main}>
        {isComplete ? (
          <CompletionState
            approvedCount={approvedNames.size}
            totalItems={totalItems}
            tripId={id}
            packingList={trip.packing_list}
          />
        ) : (
          <div className={styles.cardColumn}>
            {/* Packing summary — editorial intro, shown once above the card stack */}
            {trip.packing_list?.packing_summary && (
              <p className={styles.packingSummary}>
                {trip.packing_list.packing_summary}
              </p>
            )}
            <AnimatePresence custom={exitDir} mode="wait">
              <motion.div
                key={currentIndex}
                custom={exitDir}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={styles.cardWrapper}
              >
                <SwipeCard
                  outfit={currentOutfit}
                  wardrobeById={wardrobeById}
                  packingList={trip.packing_list}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={styles.toast}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <RejectionModal
              outfit={modalOutfit}
              onKeepPieces={handleKeepPieces}
              onSkip={handleSkip}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CompletionState({ approvedCount, totalItems, tripId, packingList }) {
  const navigate = useNavigate()
  const hasWeight = packingList?.weight_budget > 0 && packingList?.packing_weight_total != null
  const weightStatus = packingList?.weight_status
  return (
    <div className={styles.completion}>
      {hasWeight && (
        <div className={styles.completionWeight}>
          <p className={styles.completionWeightLabel}>TOTAL PACKED WEIGHT</p>
          <p className={styles.completionWeightValue}>
            {packingList.packing_weight_total?.toFixed(1)}
            <span className={styles.completionWeightBudget}> / {packingList.weight_budget}kg</span>
          </p>
          <p className={styles.completionWeightNote}>
            {weightStatus === 'over'
              ? 'Over limit — review your bag'
              : `${packingList.weight_remaining?.toFixed(1)}kg remaining`}
          </p>
        </div>
      )}
      <h1 className={styles.completionHeadline}>Your bag is packed.</h1>
      <p className={styles.completionSummary}>
        You approved {approvedCount} outfit{approvedCount !== 1 ? 's' : ''},{' '}
        {totalItems} item{totalItems !== 1 ? 's' : ''} total.
      </p>
      <div className={styles.completionActions}>
        <button
          className={styles.reviewBagBtn}
          onClick={() => navigate(`/trips/${tripId}`)}
        >
          Review Bag
        </button>
        <button
          className={styles.startPackingBtn}
          onClick={() => navigate(`/trips/${tripId}/pack`)}
        >
          Start Packing
        </button>
      </div>
    </div>
  )
}
