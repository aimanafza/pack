import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../utils/api'
import styles from './StyleThisItemModal.module.css'

const LOADING_LINES = [
  'Reading your wardrobe…',
  'Thinking through combinations…',
  'Writing styling notes…',
  'Almost there…',
]

function FlatLayCollage({ imageUrls = [] }) {
  const imgs = imageUrls.filter(Boolean).slice(0, 4)
  if (imgs.length === 0) return <div className={styles.collagePlaceholder} />
  return (
    <div className={styles[`collage${imgs.length}`] || styles.collage1}>
      {imgs.map((url, i) => (
        <div key={i} className={styles.collageCell}>
          <img src={url} alt="" className={styles.collageImg} />
        </div>
      ))}
    </div>
  )
}

function LoadingDots({ step }) {
  const [lineIndex, setLineIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex(i => (i + 1) % LOADING_LINES.length)
    }, 1600)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={styles.generatingWrap}>
      <AnimatePresence mode="wait">
        <motion.p
          key={lineIndex}
          className={styles.generatingLine}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
        >
          {LOADING_LINES[lineIndex]}
        </motion.p>
      </AnimatePresence>
      <div className={styles.pulseLine} />
    </div>
  )
}

export default function StyleThisItemModal({ item, onClose, onLooksApproved }) {
  const [step, setStep] = useState('context')
  const [occasionNote, setOccasionNote] = useState('')
  const [inspirationFiles, setInspirationFiles] = useState([])
  const [inspirationPreviews, setInspirationPreviews] = useState([])
  const [count, setCount] = useState(3)
  const [outfits, setOutfits] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [approvedLooks, setApprovedLooks] = useState([])
  const [isApprovingIndex, setIsApprovingIndex] = useState(null)
  const [generatingMore, setGeneratingMore] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef(null)
  const modalRef = useRef(null)
  const touchStartX = useRef(null)
  const [swipeHintSeen, setSwipeHintSeen] = useState(false)

  // Focus trap
  useEffect(() => {
    const prev = document.activeElement
    modalRef.current?.focus()
    return () => prev?.focus()
  }, [])

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => inspirationPreviews.forEach(URL.revokeObjectURL)
  }, [inspirationPreviews])

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    addFiles(files)
  }

  function addFiles(files) {
    const remaining = 3 - inspirationFiles.length
    const toAdd = files.slice(0, remaining)
    const newPreviews = toAdd.map(f => URL.createObjectURL(f))
    setInspirationFiles(prev => [...prev, ...toAdd])
    setInspirationPreviews(prev => [...prev, ...newPreviews])
  }

  function removeFile(index) {
    URL.revokeObjectURL(inspirationPreviews[index])
    setInspirationFiles(prev => prev.filter((_, i) => i !== index))
    setInspirationPreviews(prev => prev.filter((_, i) => i !== index))
  }

  function handleDrop(e) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    addFiles(files)
  }

  async function uploadInspirationImages() {
    const urls = []
    for (const file of inspirationFiles) {
      const formData = new FormData()
      formData.append('image', file)
      try {
        const { data } = await api.post('/api/v1/uploads/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        if (data.data?.url) urls.push(data.data.url)
      } catch {
        // skip failed uploads
      }
    }
    return urls
  }

  async function handleGenerate() {
    setError('')
    setStep('generating')
    try {
      const imageUrls = await uploadInspirationImages()
      const { data } = await api.post(`/api/v1/looks/wardrobe/${item.id}/suggest`, {
        occasion_note: occasionNote.trim(),
        inspiration_image_urls: imageUrls,
        count,
      })
      const fetched = data.data?.outfits || []
      if (fetched.length === 0) {
        setError('No outfits returned. Try adding more items to your wardrobe.')
        setStep('context')
        return
      }
      setOutfits(fetched)
      setCurrentIndex(0)
      setNotesExpanded(false)
      setStep('reviewing')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Try again.')
      setStep('context')
    }
  }

  async function handleGenerateMore() {
    setGeneratingMore(true)
    try {
      const imageUrls = inspirationFiles.length > 0 ? await uploadInspirationImages() : []
      const { data } = await api.post(`/api/v1/looks/wardrobe/${item.id}/suggest`, {
        occasion_note: occasionNote.trim(),
        inspiration_image_urls: imageUrls,
        count: 3,
      })
      const more = data.data?.outfits || []
      setOutfits(prev => [...prev, ...more])
    } catch {
      // silently ignore
    } finally {
      setGeneratingMore(false)
    }
  }

  async function handleApprove() {
    setIsApprovingIndex(currentIndex)
    try {
      const { data } = await api.post(`/api/v1/looks/wardrobe/${item.id}/approve`, {
        anchor_item_id: item.id,
        outfit_index: currentIndex,
        outfits_payload: { outfits },
      })
      const look = {
        ...outfits[currentIndex],
        look_id: data.data?.look_id,
        avatar_image_url: data.data?.avatar_image_url,
        name: data.data?.name || outfits[currentIndex]?.name,
        occasion: data.data?.occasion || outfits[currentIndex]?.occasion,
        styling_notes: data.data?.styling_notes || outfits[currentIndex]?.styling_notes,
      }
      setApprovedLooks(prev => [...prev, look])
      // Update the outfit in list to show it's approved
      setOutfits(prev => {
        const updated = [...prev]
        updated[currentIndex] = { ...updated[currentIndex], _approved: true, avatar_image_url: data.data?.avatar_image_url }
        return updated
      })
      // Advance to next un-approved outfit
      const nextIndex = findNextUnapproved(outfits, currentIndex)
      if (nextIndex !== null) {
        setCurrentIndex(nextIndex)
        setNotesExpanded(false)
      }
    } catch {
      // keep current state
    } finally {
      setIsApprovingIndex(null)
    }
  }

  function findNextUnapproved(list, from) {
    for (let i = from + 1; i < list.length; i++) {
      if (!list[i]._approved) return i
    }
    for (let i = 0; i < from; i++) {
      if (!list[i]._approved) return i
    }
    return null
  }

  function handlePass() {
    const next = (currentIndex + 1) % outfits.length
    setCurrentIndex(next)
    setNotesExpanded(false)
  }

  function handleBackdropClick(e) {
    if (step === 'context' && e.target === e.currentTarget) onClose()
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    setSwipeHintSeen(true)
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(deltaX) < 40) return
    if (deltaX < 0) {
      // swipe left = pass
      handlePass()
    } else {
      // swipe right = approve
      if (!currentOutfit?._approved && !isApproving) handleApprove()
    }
  }

  const allDone = outfits.length > 0 && outfits.every(o => o._approved)
  const currentOutfit = outfits[currentIndex]
  const isApproving = isApprovingIndex === currentIndex

  const modal = (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-label={`Style ${item.name}`}
    >
      <motion.div
        ref={modalRef}
        className={styles.sheet}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Close button */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {/* ── STEP: context ── */}
        {step === 'context' && (
          <div className={styles.contextPane}>
            <p className={styles.sheetLabel}>Style this item</p>
            <h2 className={styles.sheetTitle}>{item.name}</h2>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>What's the occasion or vibe?</label>
              <textarea
                className={styles.textarea}
                placeholder="Rooftop dinner, something edgy but polished…"
                value={occasionNote}
                onChange={e => setOccasionNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Drop inspiration images (up to 3)</label>
              <div
                className={`${styles.dropZone} ${inspirationFiles.length >= 3 ? styles.dropZoneFull : ''}`}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inspirationFiles.length < 3 && fileInputRef.current?.click()}
              >
                {inspirationPreviews.length === 0 ? (
                  <span className={styles.dropZoneHint}>Drop images here or click to browse</span>
                ) : (
                  <div className={styles.previewRow}>
                    {inspirationPreviews.map((src, i) => (
                      <div key={i} className={styles.previewThumb}>
                        <img src={src} alt="" className={styles.previewImg} />
                        <button
                          type="button"
                          className={styles.previewRemove}
                          onClick={e => { e.stopPropagation(); removeFile(i) }}
                        >×</button>
                      </div>
                    ))}
                    {inspirationFiles.length < 3 && (
                      <div className={styles.previewAdd}>+</div>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className={styles.hiddenInput}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>How many looks?</label>
              <div className={styles.countRow}>
                <button
                  type="button"
                  className={styles.countBtn}
                  onClick={() => setCount(c => Math.max(1, c - 1))}
                >−</button>
                <span className={styles.countVal}>{count}</span>
                <button
                  type="button"
                  className={styles.countBtn}
                  onClick={() => setCount(c => Math.min(6, c + 1))}
                >+</button>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="button"
              className={styles.ctaBtn}
              onClick={handleGenerate}
            >
              Generate looks →
            </button>
          </div>
        )}

        {/* ── STEP: generating ── */}
        {step === 'generating' && <LoadingDots />}

        {/* ── STEP: reviewing ── */}
        {step === 'reviewing' && currentOutfit && !allDone && (
          <div className={styles.reviewPane}>
            {/* Top bar */}
            <div className={styles.reviewTopBar}>
              <div className={styles.reviewMeta}>
                <span className={styles.reviewCounter}>{currentIndex + 1} / {outfits.length}</span>
                {currentOutfit._approved && (
                  <span className={styles.approvedBadge}>Approved</span>
                )}
              </div>
              <button
                type="button"
                className={styles.generateMoreBtn}
                onClick={handleGenerateMore}
                disabled={generatingMore}
              >
                {generatingMore ? (
                  <span className={styles.spinnerInline} />
                ) : 'Generate more'}
              </button>
            </div>

            {/* Outfit name + occasion */}
            <p className={styles.outfitOccasion}>{currentOutfit.occasion}</p>
            <h3 className={styles.outfitName}>{currentOutfit.name}</h3>

            {/* Image: avatar if approved and available, else flat-lay collage */}
            <div
              className={styles.outfitImageWrap}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {!swipeHintSeen && (
                <div className={styles.swipeHint}>
                  <span>← Pass</span>
                  <span>Approve →</span>
                </div>
              )}
              {currentOutfit._approved && currentOutfit.avatar_image_url ? (
                <img
                  src={currentOutfit.avatar_image_url}
                  alt={currentOutfit.name}
                  className={styles.avatarImg}
                />
              ) : (
                <FlatLayCollage imageUrls={currentOutfit.item_image_urls || []} />
              )}
              {isApproving && (
                <div className={styles.approvingOverlay}>
                  <div className={styles.spinner} />
                </div>
              )}
            </div>

            {/* Suggested additions */}
            {currentOutfit.suggested_additions?.length > 0 && (
              <div className={styles.suggestionsRow}>
                <span className={styles.suggestionsLabel}>Also consider:</span>
                {currentOutfit.suggested_additions.map((s, i) => (
                  <span key={i} className={styles.suggestionPill}>{s}</span>
                ))}
              </div>
            )}

            {/* Styling notes expandable */}
            {currentOutfit.styling_notes && (
              <div className={styles.notesSection}>
                <button
                  type="button"
                  className={styles.notesToggle}
                  onClick={() => setNotesExpanded(x => !x)}
                >
                  Styling notes {notesExpanded ? '↑' : '↓'}
                </button>
                <AnimatePresence>
                  {notesExpanded && (
                    <motion.p
                      className={styles.notesText}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {currentOutfit.styling_notes}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            {!currentOutfit._approved && (
              <div className={styles.reviewActions}>
                <button
                  type="button"
                  className={styles.passBtn}
                  onClick={handlePass}
                  disabled={isApproving}
                >
                  Pass →
                </button>
                <button
                  type="button"
                  className={styles.approveBtn}
                  onClick={handleApprove}
                  disabled={isApproving}
                >
                  {isApproving ? 'Saving…' : '✓ Approve'}
                </button>
              </div>
            )}
            {currentOutfit._approved && (
              <div className={styles.reviewActions}>
                <button
                  type="button"
                  className={styles.passBtn}
                  onClick={handlePass}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Summary: all reviewed or all done ── */}
        {(step === 'reviewing' && allDone) && (
          <div className={styles.summaryPane}>
            <p className={styles.sheetLabel}>Session complete</p>
            <h2 className={styles.sheetTitle}>
              {approvedLooks.length === 0
                ? 'Nothing approved this time.'
                : `${approvedLooks.length} look${approvedLooks.length > 1 ? 's' : ''} saved.`}
            </h2>

            {approvedLooks.length > 0 && (
              <div className={styles.summaryGrid}>
                {approvedLooks.map((look, i) => (
                  <div key={i} className={styles.summaryCard}>
                    {look.avatar_image_url ? (
                      <img src={look.avatar_image_url} alt={look.name} className={styles.summaryCardImg} />
                    ) : (
                      <FlatLayCollage imageUrls={look.item_image_urls || []} />
                    )}
                    <div className={styles.summaryCardFoot}>
                      <span className={styles.summaryCardName}>{look.name}</span>
                      <span className={styles.summaryCardOccasion}>{look.occasion}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className={styles.ctaBtn}
              onClick={() => {
                onLooksApproved?.(approvedLooks)
              }}
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )

  return ReactDOM.createPortal(
    <AnimatePresence>{modal}</AnimatePresence>,
    document.body
  )
}
