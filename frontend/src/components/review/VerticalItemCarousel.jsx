import { useEffect, useRef, useState } from 'react'
import styles from './VerticalItemCarousel.module.css'

export default function VerticalItemCarousel({ items }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const swipeRef = useRef({ startX: 0, startY: 0, locked: null })
  const rowRef = useRef(null)
  const navRef = useRef({})

  if (!items?.length) return null

  const count = items.length
  const prevIdx = (activeIndex - 1 + count) % count
  const nextIdx = (activeIndex + 1) % count
  const activeItem = items[activeIndex]

  navRef.current.prev = () => setActiveIndex((i) => (i - 1 + count) % count)
  navRef.current.next = () => setActiveIndex((i) => (i + 1) % count)

  // ── Keyboard navigation ───────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navRef.current.prev()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navRef.current.next()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Mouse wheel (passive:false so preventDefault works) ───
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    function handleWheel(e) {
      e.preventDefault()
      if (e.deltaX > 30 || e.deltaY > 30) navRef.current.next()
      if (e.deltaX < -30 || e.deltaY < -30) navRef.current.prev()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // ── Touch handlers — stopPropagation prevents outfit swipe ──
  function handleTouchStart(e) {
    e.stopPropagation()
    const t = e.touches[0]
    swipeRef.current = { startX: t.clientX, startY: t.clientY, locked: null }
  }

  function handleTouchMove(e) {
    e.stopPropagation()
    const { startX, startY } = swipeRef.current
    const t = e.touches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (swipeRef.current.locked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      swipeRef.current.locked = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
    }
  }

  function handleTouchEnd(e) {
    e.stopPropagation()
    const { startX, locked } = swipeRef.current
    if (locked !== 'horizontal') return
    const dx = e.changedTouches[0].clientX - startX
    if (dx < -40) navRef.current.next()
    else if (dx > 40) navRef.current.prev()
  }

  // Build 3 visible slots
  const slots =
    count === 1
      ? [{ item: items[0], pos: 'active', idx: 0 }]
      : count === 2
      ? [
          { item: items[activeIndex], pos: 'active', idx: activeIndex },
          { item: items[nextIdx], pos: 'next', idx: nextIdx },
        ]
      : [
          { item: items[prevIdx], pos: 'prev', idx: prevIdx },
          { item: items[activeIndex], pos: 'active', idx: activeIndex },
          { item: items[nextIdx], pos: 'next', idx: nextIdx },
        ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.carouselArea}>
        {count > 1 && (
          <button
            className={`${styles.arrowBtn} ${styles.arrowLeft}`}
            onClick={() => navRef.current.prev()}
            type="button"
            aria-label="Previous item"
          >‹</button>
        )}

        <div
          ref={rowRef}
          className={styles.row}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {slots.map(({ item, pos, idx }) => {
            const isActive = pos === 'active'
            return (
              <button
                key={idx}
                className={`${styles.slot} ${isActive ? styles.slotActive : styles.slotInactive}`}
                onClick={() => setActiveIndex(idx)}
                type="button"
                aria-label={item.name}
              >
                <div className={`${styles.imageBox} ${isActive ? styles.imageBoxActive : styles.imageBoxInactive}`}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className={styles.image} />
                  ) : (
                    <div className={styles.placeholder}>
                      <span className={styles.placeholderLabel}>
                        {item.category?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                  {item.outfit_count > 1 && (
                    <span className={styles.versatilityBadge}>{item.outfit_count} looks</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {count > 1 && (
          <button
            className={`${styles.arrowBtn} ${styles.arrowRight}`}
            onClick={() => navRef.current.next()}
            type="button"
            aria-label="Next item"
          >›</button>
        )}
      </div>

      {activeItem && (
        <div className={styles.activeInfo}>
          <p className={styles.itemName}>{activeItem.name}</p>
          <div className={styles.itemMeta}>
            <span className={styles.itemCategory}>{activeItem.category?.toUpperCase()}</span>
            {activeItem.estimated_weight_kg > 0 && (
              <span className={styles.itemWeight}>{activeItem.estimated_weight_kg}kg</span>
            )}
          </div>
          {activeItem.design_rationale && (
            <p className={styles.itemNote}>"{activeItem.design_rationale}"</p>
          )}
        </div>
      )}
    </div>
  )
}
