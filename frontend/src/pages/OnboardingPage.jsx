import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/index.js'
import UploadModal from '../components/wardrobe/UploadModal.jsx'
import styles from './OnboardingPage.module.css'

// Positions relative to the mockup layout (sidebar 240px, header ~72px)
const SPOTLIGHT = {
  2: { top: 76, right: 32, width: 120, height: 40, borderRadius: 4 },
  3: { top: 196, left: 20, width: 200, height: 44, borderRadius: 6 },
}

function MockApp({ step, onAddItem, onTripsClick }) {
  return (
    <div className={styles.mockApp} aria-hidden="true">
      <div className={styles.mockSidebar}>
        <span className={styles.mockWordmark}>PACK</span>
        <div className={styles.mockNav}>
          <div className={styles.mockNavItem}>Dashboard</div>
          <div className={styles.mockNavItem}>Wardrobe</div>
          <button
            type="button"
            className={`${styles.mockNavItem} ${styles.mockNavHighlight}`}
            onClick={step === 3 ? onTripsClick : undefined}
            style={step === 3 ? { cursor: 'pointer', zIndex: 205, position: 'relative', pointerEvents: 'auto' } : {}}
          >
            Trips
          </button>
          <div className={styles.mockNavItem}>Profile</div>
        </div>
      </div>
      <div className={styles.mockMain}>
        <div className={styles.mockTopBar}>
          <div className={styles.mockPageTitle} />
          <button
            type="button"
            className={styles.mockAddBtn}
            onClick={step === 2 ? onAddItem : undefined}
            style={step === 2 ? { cursor: 'pointer', zIndex: 205, position: 'relative', pointerEvents: 'auto' } : {}}
          >
            + Add Item
          </button>
        </div>
        <div className={styles.mockGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.mockCard} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StaticOutfitCard() {
  return (
    <div className={styles.outfitCard}>
      <div className={styles.outfitImgPlaceholder}>
        <div className={styles.outfitImgInner} />
      </div>
      <div className={styles.outfitMeta}>
        <p className={styles.outfitDay}>Day 1 — Arrival</p>
        <p className={styles.outfitItems}>Linen shirt, wide-leg trousers, leather loafers</p>
        <p className={styles.outfitNote}>Clean and effortless for a long travel day.</p>
      </div>
      <div className={styles.outfitActions}>
        <span className={styles.outfitPass}>Pass</span>
        <span className={styles.outfitApprove}>Add to Bag</span>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const wardrobe = useStore((s) => s.wardrobe)
  const [step, setStep] = useState(1)
  const [showUpload, setShowUpload] = useState(false)
  const wardrobeSizeRef = useRef(wardrobe.length)

  // Auto-advance when wardrobe grows after upload
  useEffect(() => {
    if (step === 2 && wardrobe.length > wardrobeSizeRef.current) {
      wardrobeSizeRef.current = wardrobe.length
      const t = setTimeout(() => setStep(3), 700)
      return () => clearTimeout(t)
    }
  }, [wardrobe.length, step])

  function handleSkip() {
    localStorage.setItem('pack_onboarded', 'true')
    navigate('/dashboard', { replace: true })
  }

  function handleModalClose() {
    setShowUpload(false)
    // wardrobe store already updated by UploadModal via uploadItem — useEffect picks it up
  }

  function handleTripsClick() {
    localStorage.setItem('pack_onboarding_step', '3')
    navigate('/trips/new')
  }

  function handleFinish() {
    localStorage.setItem('pack_onboarded', 'true')
    navigate('/dashboard', { replace: true })
  }

  const spot = SPOTLIGHT[step]
  const spotStyle = spot
    ? {
        top: spot.top,
        width: spot.width,
        height: spot.height,
        borderRadius: spot.borderRadius,
        ...(spot.left !== undefined ? { left: spot.left } : { right: spot.right }),
      }
    : null

  return (
    <div className={styles.root}>
      {/* Blurred app background */}
      <MockApp step={step} onAddItem={() => setShowUpload(true)} onTripsClick={handleTripsClick} />

      {/* Spotlight cutout (steps 2-3) or plain overlay (steps 1, 4) */}
      {spotStyle ? (
        <div className={styles.spotlight} style={spotStyle} />
      ) : (
        <div className={styles.overlay} />
      )}

      {/* Animated arrow for step 2 */}
      {step === 2 && (
        <div className={styles.arrowWrap}>
          <span className={styles.arrowIcon}>↑</span>
        </div>
      )}

      {/* Skip + step indicator — always on top */}
      <button className={styles.skipBtn} onClick={handleSkip} type="button">
        Skip intro →
      </button>

      <div className={styles.stepIndicator}>
        <p className={styles.stepIndicatorLabel}>GETTING STARTED</p>
        <div className={styles.dots}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`${styles.dot} ${s === step ? styles.dotActive : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            className={styles.centeredModal}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <h2 className={styles.modalHeadline}>Welcome to PACK.</h2>
            <p className={styles.modalBody}>
              Your AI personal stylist lives here. Let's set things up in 4 quick steps.
            </p>
            <button
              className={styles.btnPrimary}
              onClick={() => setStep(2)}
              type="button"
            >
              Let's go
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            className={styles.tooltip}
            style={{ top: 132, right: 164 }}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className={styles.tooltipHead}>Add your first piece</h3>
            <p className={styles.tooltipBody}>Click + Add Item above to upload your first piece</p>
            <div className={styles.tooltipActions}>
              <button
                className={styles.btnPrimarySmall}
                onClick={() => setShowUpload(true)}
                type="button"
              >
                Or click here
              </button>
              <button
                className={styles.btnTextLink}
                onClick={() => setStep(3)}
                type="button"
              >
                Do this later
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            className={styles.tooltip}
            style={{ top: 184, left: 260 }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className={styles.tooltipHead}>Plan your first trip</h3>
            <p className={styles.tooltipBody}>
              Click Trips in the sidebar to plan your first trip
            </p>
            <div className={styles.tooltipActions}>
              <button
                className={styles.btnPrimarySmall}
                onClick={() => {
                  localStorage.setItem('pack_onboarding_step', '3')
                  navigate('/trips/new')
                }}
                type="button"
              >
                Plan a Trip
              </button>
              <button
                className={styles.btnTextLink}
                onClick={() => setStep(4)}
                type="button"
              >
                Do this later
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            className={styles.centeredFinal}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className={styles.modalHeadline}>Your stylist is ready.</h2>
            <p className={styles.modalBody}>
              Generate a packing list and swipe through your AI-curated outfits.
            </p>
            <StaticOutfitCard />
            <button className={styles.btnPrimary} onClick={handleFinish} type="button">
              Start Exploring
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload modal — rendered above all onboarding layers */}
      {showUpload && <UploadModal onClose={handleModalClose} />}
    </div>
  )
}
