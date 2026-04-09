import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './LookbookSection.module.css'

/* ─── Item Drawer ─────────────────────────────────────────────────── */
function ItemDrawer({ item, onClose }) {
  const navigate = useNavigate()

  // Close on overlay click
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.drawerOverlay} onClick={handleOverlayClick}>
      <div className={styles.drawer}>
        <button className={styles.drawerClose} onClick={onClose} aria-label="Close">✕</button>

        {item.image_url && (
          <div className={styles.drawerImgWrap}>
            <img src={item.image_url} alt={item.name} className={styles.drawerImg} />
          </div>
        )}

        <div className={styles.drawerBody}>
          <h2 className={styles.drawerName}>{item.name}</h2>

          <div className={styles.drawerMeta}>
            <span className={styles.drawerMetaRow}>
              {item.category}{item.estimated_weight_kg ? ` · ${item.estimated_weight_kg}kg` : ''}
            </span>
          </div>

          {item.color && item.color.length > 0 && (
            <div className={styles.drawerDetail}>
              <span className={styles.drawerDetailLabel}>Color</span>
              <span className={styles.drawerDetailVal}>{Array.isArray(item.color) ? item.color.join(', ') : item.color}</span>
            </div>
          )}
          {item.fabric && (
            <div className={styles.drawerDetail}>
              <span className={styles.drawerDetailLabel}>Fabric</span>
              <span className={styles.drawerDetailVal}>{item.fabric}</span>
            </div>
          )}
          {item.formality && item.formality.length > 0 && (
            <div className={styles.drawerDetail}>
              <span className={styles.drawerDetailLabel}>Formality</span>
              <span className={styles.drawerDetailVal}>{Array.isArray(item.formality) ? item.formality.join(', ') : item.formality}</span>
            </div>
          )}
        </div>

        {item.wardrobe_item_id && (
          <button
            className={styles.drawerCta}
            onClick={() => navigate(`/wardrobe/${item.wardrobe_item_id}`)}
            type="button"
          >
            View in Wardrobe →
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── LookbookSection ─────────────────────────────────────────────── */
export default function LookbookSection({ trip, outfits }) {
  const location = useLocation()
  const initialLook = location.state?.initialLook ?? 0
  const [current, setCurrent] = useState(0)
  const sectionRef = useRef(null)
  const [drawerItem, setDrawerItem] = useState(null)

  // Apply initialLook once outfits are loaded and scroll section into view
  useEffect(() => {
    if (outfits.length > 0 && initialLook > 0) {
      setCurrent(Math.min(initialLook, outfits.length - 1))
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [outfits.length])

  // Keyboard navigation
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') setCurrent((c) => (c - 1 + outfits.length) % outfits.length)
      if (e.key === 'ArrowRight') setCurrent((c) => (c + 1) % outfits.length)
    },
    [outfits.length]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!outfits.length) return null

  const outfit = outfits[current]
  if (!outfit) return null

  // Use the same editorial image generated during swipe review
  const lookbookUrl = outfit.generated_image_url || outfit.lookbook_image_url

  // Parse occasion tags from occasion_tag string
  const tags = outfit.occasion_tag
    ? outfit.occasion_tag.split('/').map((t) => t.trim()).filter(Boolean)
    : outfit.occasion
    ? [outfit.occasion]
    : []

  // Look number (1-indexed position in approved list)
  const lookNum = String(current + 1).padStart(2, '0')

  const toTitleCase = (str) =>
    str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className={styles.section} ref={sectionRef}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>APPROVED LOOKS</span>
        <div className={styles.navBtns}>
          <button
            className={styles.navBtn}
            onClick={() => setCurrent((c) => (c - 1 + outfits.length) % outfits.length)}
            aria-label="Previous look"
            type="button"
          >
            ←
          </button>
          <button
            className={styles.navBtn}
            onClick={() => setCurrent((c) => (c + 1) % outfits.length)}
            aria-label="Next look"
            type="button"
          >
            →
          </button>
        </div>
      </div>

      <div className={styles.card}>
        {/* LEFT — figure */}
        <div className={styles.figSide}>
          {lookbookUrl ? (
            <img
              src={lookbookUrl}
              alt={outfit.name || outfit.day_label}
              className={styles.figImg}
            />
          ) : (
            <div className={styles.figPlaceholder} />
          )}

          <div className={styles.lookLabel}>
            <span className={styles.lookNum}>{toTitleCase(`Look ${lookNum}`)}</span>
            <span className={styles.lookName}>{toTitleCase(outfit.day_label || outfit.name || '')}</span>
          </div>
        </div>

        {/* RIGHT — items */}
        <div className={styles.itemsSide}>
          {tags.length > 0 && (
            <div className={styles.tagRow}>
              {tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className={styles.itemGrid}>
            {outfit.items.map((item, i) => (
              <button
                key={item.wardrobe_item_id || i}
                className={styles.itemCard}
                onClick={() => setDrawerItem(item)}
                type="button"
                title={item.name}
              >
                <div className={styles.itemThumb}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className={styles.itemImg} />
                  ) : (
                    <div className={styles.itemImgPlaceholder} />
                  )}
                </div>
                <div className={styles.itemFoot}>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemCat}>{item.category}</p>
                </div>
                <span className={styles.itemArrow}>↗</span>
              </button>
            ))}
          </div>

          {(outfit.styling_notes || outfit.styling_note) && (
            <p className={styles.stylingNote}>
              &ldquo;{outfit.styling_notes || outfit.styling_note}&rdquo;
            </p>
          )}
        </div>
      </div>

      <p className={styles.lookCounter}>Look {current + 1} of {outfits.length}</p>

      {drawerItem && (
        <ItemDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
      )}
    </div>
  )
}
