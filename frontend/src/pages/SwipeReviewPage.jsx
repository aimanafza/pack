import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTrips } from '../hooks/useTrips.js'
import api from '../utils/api.js'
import VerticalItemCarousel from '../components/review/VerticalItemCarousel.jsx'
import PassSheet from '../components/review/PassSheet.jsx'
import RestyleSelectionSheet from '../components/review/RestyleSelectionSheet.jsx'
import styles from './SwipeReviewPage.module.css'

// ── Static outfits for layout/animation testing ────────────────────────────
const STATIC_OUTFITS = [
  {
    name: 'Day 1',
    day_label: 'Arrival',
    occasion_tag: 'Casual',
    generated_image_url: null,
    styling_notes: 'Wool over denim with a loafer, effortless but intentional. The argyle does the visual heavy lifting.',
    design_rationale: { silhouette: 'Volume on top, slim base', color_story: 'Earthy tones with a warm accent', occasion_fit: 'Smart enough for dinner', the_detail: 'Argyle does the work' },
    style_gaps: ['No outerwear for cold arrivals'],
    total_weight: 1.8,
    weight_note: '1.8kg — a balanced travel day outfit',
    items: [
      { name: 'Argyle wool sweater', category: 'Top', estimated_weight_kg: 0.4, design_rationale: 'The anchor of the look', outfit_count: 1, image_url: null },
      { name: 'Straight-leg dark jeans', category: 'Bottom', estimated_weight_kg: 0.6, design_rationale: 'Slim base to balance the volume', outfit_count: 3, image_url: null },
      { name: 'Leather loafers', category: 'Shoes', estimated_weight_kg: 0.8, design_rationale: 'Smart finish, walkable all day', outfit_count: 3, image_url: null },
    ],
  },
  {
    name: 'Day 2',
    day_label: 'Explore',
    occasion_tag: 'Smart Casual',
    generated_image_url: null,
    styling_notes: 'Linen over denim — the shirt does the light lifting while the jeans anchor the silhouette. Easy and considered.',
    design_rationale: { silhouette: 'Relaxed top, tapered base', color_story: 'Cool whites against dark indigo', occasion_fit: 'Day-to-evening without a change', the_detail: 'The natural linen crease' },
    style_gaps: [],
    total_weight: 1.6,
    weight_note: '1.6kg — your lightest day',
    items: [
      { name: 'White linen shirt', category: 'Top', estimated_weight_kg: 0.25, design_rationale: 'Breathes in the heat', outfit_count: 1, image_url: null },
      { name: 'Straight-leg dark jeans', category: 'Bottom', estimated_weight_kg: 0.6, design_rationale: 'The repeated anchor piece', outfit_count: 3, image_url: null },
      { name: 'Leather loafers', category: 'Shoes', estimated_weight_kg: 0.8, design_rationale: 'Consistent, reliable', outfit_count: 3, image_url: null },
    ],
  },
  {
    name: 'Day 3',
    day_label: 'Dinner',
    occasion_tag: 'Evening',
    generated_image_url: null,
    styling_notes: 'The blazer is doing all the work here. Jeans and loafers give it somewhere to land without competing.',
    design_rationale: { silhouette: 'Structured top, slim base', color_story: 'Tonal darks, elevated by cut', occasion_fit: 'Dinner-ready, no effort visible', the_detail: 'The blazer shoulder line' },
    style_gaps: ['A white dress shirt would sharpen this further'],
    total_weight: 2.0,
    weight_note: '2.0kg — heaviest, but worth it',
    items: [
      { name: 'Tailored blazer', category: 'Outerwear', estimated_weight_kg: 0.75, design_rationale: 'Instant formality', outfit_count: 1, image_url: null },
      { name: 'Straight-leg dark jeans', category: 'Bottom', estimated_weight_kg: 0.6, design_rationale: 'Dressed-down base', outfit_count: 3, image_url: null },
      { name: 'Leather loafers', category: 'Shoes', estimated_weight_kg: 0.8, design_rationale: 'The quiet luxury move', outfit_count: 3, image_url: null },
    ],
  },
]

const STATIC_PACKING_LIST = {
  packing_weight_total: 2.6,
  weight_budget: 7,
  weight_remaining: 4.4,
  weight_status: 'under',
  unique_item_count: 5,
  versatility_note: "Your dark jeans work across 3 outfits, so you're packing 5 items that create 3 complete looks.",
}

const GENERATION_MESSAGES = [
  'Reviewing your wardrobe.',
  'Reading the destination.',
  'Balancing the weight.',
  'Building your looks.',
  'Almost ready.',
]

const IMAGE_GENERATION_MESSAGES = [
  'Styling your looks.',
  'Putting the outfits together.',
  'Almost ready.',
]

const RESTYLE_LOADING_MESSAGES = [
  'Revisiting your wardrobe...',
  'Finding the perfect combination...',
  'Styling your new look...',
  'Almost ready...',
]

// ── Slide animation variants ────────────────────────────────────────────────
// slideDir: 'right' = add to bag, 'left' = skip, 'bottom' = restyle arrives
const slideVariants = {
  enter: (dir) => ({
    x: dir === 'right' ? '-40%' : dir === 'left' ? '40%' : 0,
    y: dir === 'bottom' ? '30%' : 0,
    opacity: 0,
  }),
  center: { x: 0, y: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: (dir) => ({
    x: dir === 'right' ? '40%' : dir === 'left' ? '-40%' : 0,
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeIn' },
  }),
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SwipeReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchTrip, approveOutfit, rejectOutfit, restyleOutfit } = useTrips()

  const [trip, setTrip] = useState(null)
  const [localOutfits, setLocalOutfits] = useState(null)   // local mutable copy
  const [currentIndex, setCurrentIndex] = useState(0)
  const [bagCount, setBagCount] = useState(0)
  const [slideDir, setSlideDir] = useState('right')
  const [showPassSheet, setShowPassSheet] = useState(false)
  const [restylePhase, setRestylePhase] = useState(null)   // null | 'selecting' | 'loading'
  const [keptItems, setKeptItems] = useState([])
  const [generationPhase, setGenerationPhase] = useState('loading-trip')  // 'loading-trip' | 'generating' | 'error' | null
  const [generationError, setGenerationError] = useState(null)

  // Swipe gesture refs — updated imperatively to avoid re-render on each pixel
  const swipeRef = useRef({ startX: 0, startY: 0, locked: null })
  const tintRef = useRef(null)
  const frameRef = useRef(null)

  function triggerImageGeneration(outfits) {
    const needsImages = outfits.some((o) => !o.generated_image_url)
    if (!needsImages) {
      setGenerationPhase(null)
      return
    }
    setGenerationPhase('generating-images')
    api.post(`/api/v1/trips/${id}/generate-outfit-images`)
      .then(({ data: imgData }) => {
        const updatedOutfits = imgData.data?.packing_list?.outfits
        if (updatedOutfits) setLocalOutfits(updatedOutfits)
      })
      .catch(() => {})
      .finally(() => setGenerationPhase(null))
  }

  useEffect(() => {
    fetchTrip(id).then((t) => {
      if (!t) {
        setGenerationPhase('error')
        setGenerationError('Trip not found.')
        return
      }
      setTrip(t)

      if (t.packing_list?.outfits?.length > 0) {
        // Packing list already exists — show it, then check if images need generating
        setLocalOutfits(t.packing_list.outfits)
        triggerImageGeneration(t.packing_list.outfits)
      } else {
        // No packing list yet — trigger generation, show loading screen
        setGenerationPhase('generating')
        api.post('/api/v1/pack/suggest', { trip_id: id })
          .then(({ data }) => {
            const generated = data.data
            const outfits = generated?.packing_list?.outfits ?? []
            setLocalOutfits(outfits.length > 0 ? outfits : null)
            setTrip(generated)
            triggerImageGeneration(outfits)
          })
          .catch(() => {
            setGenerationPhase('error')
            setGenerationError('Your stylist ran into a snag. Try again.')
          })
      }
    })
  }, [id]) // eslint-disable-line

  const allOutfits = localOutfits ?? STATIC_OUTFITS
  const packingList = trip?.packing_list ?? STATIC_PACKING_LIST
  const outfit = allOutfits[currentIndex]
  const isComplete = currentIndex >= allOutfits.length

  // ── Swipe gesture handlers ────────────────────────────────
  function handleTouchStart(e) {
    if (restylePhase === 'loading') return
    const touch = e.touches[0]
    // Only trigger outfit swipe from the LEFT column (avatar area).
    // Right column touch events are owned by the carousel (stopPropagation).
    const frameEl = frameRef.current
    if (frameEl) {
      const rect = frameEl.getBoundingClientRect()
      const relX = touch.clientX - rect.left
      if (relX > rect.width * 0.5) return   // right column — ignore
    }
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, locked: null }
  }

  function handleTouchMove(e) {
    const { startX, startY, locked } = swipeRef.current
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    // Determine axis lock on first 8px of movement
    if (locked === null) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      swipeRef.current.locked = Math.abs(deltaX) >= Math.abs(deltaY) ? 'horizontal' : 'vertical'
    }

    if (swipeRef.current.locked !== 'horizontal') return

    // Subtle frame nudge (12% of drag distance, max 24px)
    if (frameRef.current) {
      const nudge = Math.max(-24, Math.min(24, deltaX * 0.12))
      frameRef.current.style.transform = `translateX(${nudge}px)`
    }

    // Tint overlay: green right (add to bag), warm red left (pass)
    if (tintRef.current) {
      const intensity = Math.min(Math.abs(deltaX) / 120, 1)
      tintRef.current.style.background = deltaX > 0
        ? `rgba(34, 197, 94, ${intensity * 0.14})`
        : `rgba(200, 70, 50, ${intensity * 0.14})`
    }
  }

  function handleTouchEnd(e) {
    const { startX, locked } = swipeRef.current
    const lastTouch = e.changedTouches[0]
    const deltaX = lastTouch.clientX - startX

    // Snap frame back
    if (frameRef.current) {
      frameRef.current.style.transition = 'transform 0.2s ease-out'
      frameRef.current.style.transform = 'translateX(0)'
      const el = frameRef.current
      setTimeout(() => { if (el) el.style.transition = '' }, 200)
    }

    // Fade tint out
    if (tintRef.current) {
      tintRef.current.style.transition = 'background 0.2s ease-out'
      tintRef.current.style.background = 'transparent'
      const el = tintRef.current
      setTimeout(() => { if (el) el.style.transition = '' }, 200)
    }

    if (locked !== 'horizontal') return

    if (deltaX > 80) handleAddToBag()
    else if (deltaX < -80) handlePass()
  }

  // ── Actions ───────────────────────────────────────────────
  function handleAddToBag() {
    if (!outfit) return
    setSlideDir('right')
    setBagCount((c) => c + 1)
    setCurrentIndex((i) => i + 1)
    approveOutfit(id, outfit.name || outfit.outfit_id).catch(() => {})
  }

  function handlePass() {
    setShowPassSheet(true)
  }

  function handleSkip() {
    setShowPassSheet(false)
    setSlideDir('left')
    setCurrentIndex((i) => i + 1)
    rejectOutfit(id, outfit.name || outfit.outfit_id, []).catch(() => {})
  }

  function handleDone() {
    setShowPassSheet(false)
    setCurrentIndex(allOutfits.length)
  }

  function handleOpenRestyle() {
    setShowPassSheet(false)
    setRestylePhase('selecting')
  }

  function handleRestyleConfirm(keptIds) {
    const kept = outfit.items.filter((item) =>
      keptIds.includes(item.wardrobe_item_id || item.name)
    )
    setKeptItems(kept)
    setRestylePhase('loading')

    restyleOutfit(id, {
      kept_item_ids: keptIds,
      rejected_outfit_id: outfit.outfit_id || outfit.name,
    })
      .then((newOutfit) => {
        if (newOutfit) {
          setLocalOutfits((prev) => {
            const next = [...(prev ?? STATIC_OUTFITS)]
            next[currentIndex] = newOutfit
            return next
          })
        }
        setSlideDir('bottom')
        setRestylePhase(null)
      })
      .catch(() => {
        setRestylePhase(null)
      })
  }

  // ── Generation loading / error state ─────────────────────
  if (generationPhase === 'loading-trip' || generationPhase === 'generating' || generationPhase === 'generating-images' || generationPhase === 'error') {
    return (
      <GenerationView
        trip={trip}
        phase={generationPhase}
        error={generationError}
        onRetry={() => {
          setGenerationPhase('generating')
          setGenerationError(null)
          api.post('/api/v1/pack/suggest', { trip_id: id })
            .then(({ data }) => {
              const generated = data.data
              const outfits = generated?.packing_list?.outfits ?? []
              setLocalOutfits(outfits.length > 0 ? outfits : null)
              setTrip(generated)
              triggerImageGeneration(outfits)
            })
            .catch(() => {
              setGenerationPhase('error')
              setGenerationError('Your stylist ran into a snag. Try again.')
            })
        }}
      />
    )
  }

  // ── Completion state ──────────────────────────────────────
  if (isComplete) {
    return (
      <CompletionState
        bagCount={bagCount}
        packingList={packingList}
        tripId={id}
        navigate={navigate}
      />
    )
  }

  const dayNumber = currentIndex + 1
  const dayLabel = outfit.day_label || outfit.name || ''
  const occasion = outfit.occasion_tag || outfit.occasion || ''
  const rationale = outfit.design_rationale
  const gaps = outfit.style_gaps || []
  const packedWeight = packingList.packing_weight_total ?? 0
  const budget = packingList.weight_budget ?? 0
  const uniqueItemCount = packingList.unique_item_count ?? 0
  const weightNote = outfit.weight_note || ''

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header className={styles.header}>
        <Link to={`/trips/${id}`} className={styles.backLink}>
          ← {trip?.name ?? 'Back'}
        </Link>
        <div className={styles.headerCenter}>
          <span className={styles.dayLabel}>
            DAY {dayNumber}{dayLabel ? ` · ${dayLabel.toUpperCase()}` : ''}
          </span>
          {occasion && (
            <span className={styles.occasionLabel}>{occasion.toUpperCase()}</span>
          )}
        </div>
        <div className={styles.bagCount}>Bag ({bagCount})</div>
      </header>

      {/* ── Main content area ────────────────────────────────── */}
      <main className={styles.main}>
        {restylePhase === 'loading' ? (
          // Restyle loading state — kept items left, cycling text right
          <RestyleLoadingView keptItems={keptItems} />
        ) : (
          <AnimatePresence custom={slideDir} mode="wait">
            <motion.div
              key={`${currentIndex}-${restylePhase}`}
              ref={frameRef}
              className={styles.outfitFrame}
              custom={slideDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Swipe tint — green on right-swipe, warm red on left-swipe */}
              <div ref={tintRef} className={styles.swipeTint} aria-hidden="true" />

              {/* LEFT — avatar image or item fallback */}
              <div className={styles.leftCol}>
                <AnimatePresence mode="wait">
                  {outfit.generated_image_url ? (
                    <motion.img
                      key={outfit.generated_image_url}
                      src={outfit.generated_image_url}
                      alt="Outfit"
                      className={styles.avatarImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.2 } }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    />
                  ) : (
                    <motion.div
                      key={`fallback-${currentIndex}`}
                      className={styles.fallbackWrapper}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.2 } }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    >
                      <AvatarFallback items={outfit.items} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT — carousel + stylist notes */}
              <div className={styles.rightCol}>
                <div className={styles.carouselSection}>
                  <VerticalItemCarousel items={outfit.items} />
                </div>

                <div className={styles.divider} />

                <div className={styles.stylistSection}>
                  {outfit.styling_notes && (
                    <div className={styles.stylistBlock}>
                      <p className={styles.stylistLabel}>STYLIST'S NOTES</p>
                      <p className={styles.stylistNote}>{outfit.styling_notes}</p>
                    </div>
                  )}

                  {rationale && (
                    <div className={styles.rationaleBlock}>
                      {rationale.silhouette && (
                        <div className={styles.rationaleRow}>
                          <span className={styles.rationaleKey}>Silhouette</span>
                          <span className={styles.rationaleVal}>{rationale.silhouette}</span>
                        </div>
                      )}
                      {rationale.color_story && (
                        <div className={styles.rationaleRow}>
                          <span className={styles.rationaleKey}>Color story</span>
                          <span className={styles.rationaleVal}>{rationale.color_story}</span>
                        </div>
                      )}
                      {rationale.occasion_fit && (
                        <div className={styles.rationaleRow}>
                          <span className={styles.rationaleKey}>Occasion</span>
                          <span className={styles.rationaleVal}>{rationale.occasion_fit}</span>
                        </div>
                      )}
                      {rationale.the_detail && (
                        <div className={styles.rationaleRow}>
                          <span className={styles.rationaleKey}>The detail</span>
                          <span className={styles.rationaleVal}>{rationale.the_detail}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {packedWeight > 0 && budget > 0 && (
                    <div className={styles.weightBlock}>
                      <p className={styles.weightLabel}>WEIGHT</p>
                      <div className={styles.weightBarTrack}>
                        <div
                          className={`${styles.weightBarFill} ${
                            packingList.weight_status === 'over' ? styles.weightBarFillRed
                            : packingList.weight_status === 'at_limit' ? styles.weightBarFillAmber
                            : ''
                          }`}
                          style={{ width: `${Math.min((packedWeight / budget) * 100, 100)}%` }}
                        />
                      </div>
                      <p className={styles.weightText}>
                        {packedWeight}kg of {budget}kg
                        {uniqueItemCount > 0 && (
                          <span className={styles.weightItemCount}> · {uniqueItemCount} items packed</span>
                        )}
                      </p>
                      {weightNote && <p className={styles.weightNote}>"{weightNote}"</p>}
                    </div>
                  )}

                  {gaps.length > 0 && (
                    <div className={styles.gapsBlock}>
                      <p className={styles.gapsLabel}>STYLE GAPS</p>
                      {gaps.map((gap, i) => (
                        <p key={i} className={styles.gapItem}>{gap}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* ── Footer buttons ───────────────────────────────────── */}
      <footer className={styles.footer}>
        <button
          className={styles.passBtn}
          onClick={handlePass}
          disabled={restylePhase === 'loading'}
        >
          PASS
        </button>
        <button
          className={styles.addBtn}
          onClick={handleAddToBag}
          disabled={restylePhase === 'loading'}
        >
          ADD TO BAG
        </button>
      </footer>

      {/* ── PASS bottom sheet ─────────────────────────────────── */}
      <AnimatePresence>
        {showPassSheet && (
          <PassSheet
            onRestyle={handleOpenRestyle}
            onSkip={handleSkip}
            onDone={handleDone}
            onDismiss={() => setShowPassSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Restyle item selection overlay ───────────────────── */}
      <AnimatePresence>
        {restylePhase === 'selecting' && (
          <RestyleSelectionSheet
            items={outfit.items}
            onConfirm={handleRestyleConfirm}
            onCancel={() => setRestylePhase(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Generation loading / error view ────────────────────────────────────────
function GenerationView({ trip, phase, error, onRetry }) {
  const [msgIdx, setMsgIdx] = useState(0)

  const isImagePhase = phase === 'generating-images'
  const messages = isImagePhase ? IMAGE_GENERATION_MESSAGES : GENERATION_MESSAGES
  const cycling = phase === 'generating' || isImagePhase

  useEffect(() => {
    if (!cycling) return
    setMsgIdx(0)
    const t = setInterval(
      () => setMsgIdx((i) => (i + 1) % messages.length),
      2800
    )
    return () => clearInterval(t)
  }, [phase]) // eslint-disable-line

  return (
    <div className={styles.generationPage}>
      <div className={styles.generationInner}>
        {/* Eyebrow — trip context */}
        <p className={styles.generationEyebrow}>
          {trip?.destination
            ? `${trip.destination.toUpperCase()}`
            : 'YOUR TRIP'}
        </p>

        {phase === 'error' ? (
          <>
            <h1 className={styles.generationHeadline}>
              Something went wrong.
            </h1>
            <p className={styles.generationSub}>{error}</p>
            <button className={styles.generationRetryBtn} onClick={onRetry}>
              Try again
            </button>
          </>
        ) : (
          <>
            <p className={styles.generationLabel}>
              {isImagePhase ? 'YOUR LOOKS' : 'YOUR STYLIST'}
            </p>

            {phase === 'loading-trip' ? (
              <h1 className={styles.generationHeadline}>
                Is getting ready.
              </h1>
            ) : (
              <AnimatePresence mode="wait">
                <motion.h1
                  key={msgIdx}
                  className={styles.generationHeadline}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.25, ease: 'easeIn' } }}
                >
                  {messages[msgIdx]}
                </motion.h1>
              </AnimatePresence>
            )}

            {/* Thin animated progress bar */}
            <div className={styles.generationBarTrack}>
              <div className={styles.generationBarFill} />
            </div>

            {trip && (
              <p className={styles.generationMeta}>
                {trip.duration_days} night{trip.duration_days !== 1 ? 's' : ''}
                {trip.occasions?.length > 0 && ` · ${trip.occasions.join(', ')}`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Restyle loading view ────────────────────────────────────────────────────
function RestyleLoadingView({ keptItems }) {
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(
      () => setMsgIdx((i) => (i + 1) % RESTYLE_LOADING_MESSAGES.length),
      2500
    )
    return () => clearInterval(t)
  }, [])

  return (
    <div className={styles.outfitFrame}>
      {/* Left — kept item thumbnails */}
      <div className={`${styles.leftCol} ${styles.restyleLoadingLeft}`}>
        <div className={styles.restyleKeptStack}>
          {keptItems.map((item, i) => (
            <div key={i} className={styles.restyleKeptThumb}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className={styles.restyleKeptImg} />
              ) : (
                <div className={styles.restyleKeptPlaceholder}>
                  <span className={styles.restyleKeptInitial}>
                    {item.category?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className={styles.restyleKeptLabel}>Building around these</p>
      </div>

      {/* Right — cycling loading text */}
      <div className={`${styles.rightCol} ${styles.restyleLoadingRight}`}>
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            className={styles.restyleLoadingMsg}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {RESTYLE_LOADING_MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Avatar fallback ─────────────────────────────────────────────────────────
function AvatarFallback({ items }) {
  const navigate = useNavigate()
  return (
    <div className={styles.fallback}>
      <div className={styles.fallbackGrid}>
        {items.map((item, i) => (
          <div key={i} className={styles.fallbackThumb}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className={styles.fallbackThumbImg} />
            ) : (
              <div className={styles.fallbackThumbPlaceholder}>
                <span className={styles.fallbackThumbCategory}>
                  {item.category?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className={styles.avatarPrompt}
        onClick={() => navigate('/profile/build-avatar')}
        type="button"
      >
        Build your avatar to see styled photos
      </button>
    </div>
  )
}

// ── Completion state ─────────────────────────────────────────────────────────
function CompletionState({ bagCount, packingList, tripId, navigate }) {
  return (
    <div className={styles.completionPage}>
      <div className={styles.completion}>
        <p className={styles.completionEyebrow}>YOUR BAG IS PACKED</p>
        <h1 className={styles.completionHeadline}>
          {bagCount} look{bagCount !== 1 ? 's' : ''} selected.
        </h1>
        {packingList.versatility_note && (
          <p className={styles.completionVersatility}>{packingList.versatility_note}</p>
        )}
        {packingList.unique_item_count > 0 && (
          <p className={styles.completionItems}>
            {packingList.unique_item_count} items · {packingList.packing_weight_total}kg packed
          </p>
        )}
        <div className={styles.completionActions}>
          <button
            className={styles.completionSecondaryBtn}
            onClick={() => navigate(`/trips/${tripId}`)}
          >
            Review Bag
          </button>
          <button
            className={styles.completionPrimaryBtn}
            onClick={() => navigate(`/trips/${tripId}/pack`)}
          >
            Start Packing
          </button>
        </div>
      </div>
    </div>
  )
}
