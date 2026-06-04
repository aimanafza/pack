import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/index.js'
import { useDailyStyling } from '../hooks/useDailyStyling'
import ContextCard from '../components/daily/ContextCard'
import DailyOutfitSwipe from '../components/daily/DailyOutfitSwipe'
import OutfitCollage from '../components/daily/OutfitCollage'
import styles from './DailyStylingPage.module.css'

function formatTodayFull() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function DailyStylingPage() {
  const navigate = useNavigate()
  const wardrobe = useStore((s) => s.wardrobe)
  const { generateLook, chooseOutfit } = useDailyStyling()

  const [step, setStep] = useState('context') // 'context' | 'generating' | 'outfits' | 'confirmed'
  const [generatedLook, setGeneratedLook] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [genError, setGenError] = useState(null)
  const [choosing, setChoosing] = useState(false)

  async function handleGenerate(params) {
    setGenError(null)
    setStep('generating')
    try {
      const look = await generateLook(params)
      setGeneratedLook(look)
      setCurrentIndex(0)
      setStep('outfits')
    } catch (err) {
      setGenError(err.response?.data?.message || 'Something went wrong. Try again.')
      setStep('context')
    }
  }

  async function handleChoose() {
    if (!generatedLook) return
    setChoosing(true)
    try {
      await chooseOutfit(generatedLook.look_id, currentIndex)
      setStep('confirmed')
    } catch {
      setChoosing(false)
    }
  }

  function handleNext() {
    const total = generatedLook?.outfits?.length || 3
    setCurrentIndex((i) => (i + 1) % total)
  }

  const outfit = generatedLook?.outfits?.[currentIndex]
  const confirmedOutfit = step === 'confirmed' && generatedLook
    ? generatedLook.outfits?.[currentIndex]
    : null

  return (
    <>
      <div className={styles.header}>
        <p className={styles.pageLabel}>Daily</p>
        <h1 className={styles.headline}>{formatTodayFull()}</h1>
      </div>

      <div className={styles.content}>
        <AnimatePresence mode="wait">

          {/* STEP: context */}
          {step === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ContextCard onGenerate={handleGenerate} />
              {genError && (
                <p className={styles.error}>{genError}</p>
              )}
            </motion.div>
          )}

          {/* STEP: generating */}
          {step === 'generating' && (
            <motion.div
              key="generating"
              className={styles.generatingState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className={styles.generatingHeadline}>Your stylist is working...</p>
              <p className={styles.generatingSubhead}>Checking your wardrobe and today's weather.</p>
              <div className={styles.pulseLine} />
            </motion.div>
          )}

          {/* STEP: outfits */}
          {step === 'outfits' && outfit && (
            <motion.div
              key="outfits"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <DailyOutfitSwipe
                    outfit={outfit}
                    wardrobeItems={wardrobe}
                    index={currentIndex}
                    total={generatedLook.outfits.length}
                    onChoose={handleChoose}
                    onNext={handleNext}
                    weatherSummary={generatedLook.weather_summary}
                    occasion={generatedLook.occasion}
                    choosing={choosing}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* STEP: confirmed */}
          {step === 'confirmed' && (
            <motion.div
              key="confirmed"
              className={styles.confirmedState}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className={styles.confirmedHeadline}>Looking good.</h2>
              {confirmedOutfit?.item_image_urls?.length > 0 && (
                <div className={styles.collageWrap}>
                  <OutfitCollage imageUrls={confirmedOutfit.item_image_urls} size="md" />
                </div>
              )}
              <p className={styles.confirmedSub}>
                Your look for {formatTodayFull()} is saved.
              </p>
              <div className={styles.confirmedActions}>
                <Link to="/wardrobe" className={styles.wardrobeLink}>
                  View your wardrobe →
                </Link>
                <button
                  type="button"
                  className={styles.dashBtn}
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  )
}
