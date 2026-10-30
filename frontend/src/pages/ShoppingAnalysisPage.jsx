import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../utils/api.js'
import styles from './ShoppingAnalysisPage.module.css'
import BackLink from '../components/ui/BackLink.jsx'

const SCORE_LABELS = {
  versatility:     'Versatility',
  style_alignment: 'Style fit',
  gap_fill:        'Gap fill',
  quality:         'Brand quality',
  cost_per_outfit: 'Cost / outfit',
  color_harmony:   'Colour harmony',
  overall:         'Overall',
}

export default function ShoppingAnalysisPage() {
  const { analysis_id } = useParams()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addingToWardrobe, setAddingToWardrobe] = useState(false)
  const [dressing, setDressing] = useState({})      // look position -> true while the avatar is dressed
  const [lookErrors, setLookErrors] = useState({})  // look position -> what went wrong

  useEffect(() => {
    fetchAnalysis()
  }, [analysis_id])

  async function fetchAnalysis() {
    setLoading(true)
    try {
      const { data } = await api.get(`/api/v1/purchase-analysis/${analysis_id}`)
      setAnalysis(data.data)
    } catch {
      // swallow
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToWardrobe() {
    setAddingToWardrobe(true)
    try {
      await api.patch(`/api/v1/purchase-analysis/${analysis_id}/bought`, { bought: true })
      setAnalysis((prev) => ({ ...prev, bought: true }))
    } catch {
      // swallow
    } finally {
      setAddingToWardrobe(false)
    }
  }

  // Picture the avatar in one look. Made once on the server, then kept on the analysis.
  async function dressLook(index) {
    setDressing((d) => ({ ...d, [index]: true }))
    setLookErrors((e) => ({ ...e, [index]: '' }))
    try {
      const { data } = await api.post(`/api/v1/purchase-analysis/${analysis_id}/looks/${index}/on-me`)
      setAnalysis((prev) => ({ ...prev, look_images: { ...(prev.look_images || {}), [index]: data.data.image_url } }))
    } catch (err) {
      const detail = err.response?.data?.detail
      setLookErrors((e) => ({ ...e, [index]: typeof detail === 'string' ? detail : "Couldn't dress your avatar this time. Try again." }))
    } finally {
      setDressing((d) => ({ ...d, [index]: false }))
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Loading analysis…</p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Analysis not found.</p>
      </div>
    )
  }

  const scores = analysis.scores || {}
  // Where the piece is sold, for the shop button: prada.com, not the full address
  const shopHost = (() => {
    try { return new URL(analysis.product_url).hostname.replace(/^www\./, '') } catch { return '' }
  })()
  const scoreEntries = Object.entries(SCORE_LABELS)
    .filter(([key]) => scores[key] != null)

  return (
    <>
      <div className={styles.header}>
        <BackLink to="/profile/shopping">Shopping history</BackLink>
      </div>

      <div className={styles.layout}>
        {/* Left — product image */}
        <div className={styles.imageCol}>
          {/* The piece itself opens the shop's page */}
          <a
            href={analysis.product_url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.productLink}
          >
            {analysis.product_image_url ? (
              <div className={styles.imageWrap}>
                <img
                  src={analysis.product_image_url}
                  alt={analysis.product_name}
                  className={styles.productImg}
                />
              </div>
            ) : (
              <div className={styles.imagePlaceholder} />
            )}
            {analysis.brand && <p className={styles.brand}>{analysis.brand}</p>}
            <p className={styles.productName}>{analysis.product_name || 'Product'}</p>
          </a>
          {analysis.price && (
            <p className={styles.price}>{analysis.currency} {analysis.price}</p>
          )}
          {analysis.product_url && (
            <a
              href={analysis.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.shopBtn}
            >
              {shopHost ? `Shop on ${shopHost}` : 'Shop this piece'}
            </a>
          )}
        </div>

        {/* Right — analysis */}
        <div className={styles.analysisCol}>

          {/* Scores */}
          <div className={styles.scoresBlock}>
            <p className={styles.sectionLabel}>Score breakdown</p>
            {scoreEntries.map(([key, label]) => {
              const val = Math.min(10, Math.max(0, Number(scores[key]) || 0))
              return (
                <div key={key} className={`${styles.scoreRow} ${key === 'overall' ? styles.overall : ''}`}>
                  <span className={styles.scoreLabel}>{label}</span>
                  <div className={styles.scoreTrack}>
                    <div className={styles.scoreFill} style={{ width: `${(val / 10) * 100}%` }} />
                  </div>
                  <span className={styles.scoreVal}>{val.toFixed(1)}</span>
                </div>
              )
            })}
          </div>

          {/* Verdict */}
          {analysis.verdict && (
            <div className={styles.block}>
              <p className={styles.sectionLabel}>Verdict</p>
              <p className={styles.verdict}>{analysis.verdict}</p>
            </div>
          )}

          {/* Archetype note */}
          {analysis.archetype_note && (
            <div className={styles.block}>
              <p className={styles.sectionLabel}>
                Your archetype{analysis.archetype ? `: ${analysis.archetype}` : ''}
              </p>
              <p className={styles.noteText}>{analysis.archetype_note}</p>
            </div>
          )}

          {/* Brand quality */}
          {analysis.brand_quality_note && (
            <div className={styles.block}>
              <p className={styles.sectionLabel}>Brand quality</p>
              <p className={styles.noteText}>{analysis.brand_quality_note}</p>
            </div>
          )}

          {/* Outfit collages */}
          {analysis.outfit_collages?.length > 0 && (
            <div className={styles.block}>
              <p className={styles.sectionLabel}>On you, with your wardrobe</p>
              <div className={styles.collages}>
                {analysis.outfit_collages.slice(0, 3).map((collage, i) => {
                  const combo = (analysis.outfit_combinations || [])[i] || {}
                  // Only real pieces: the new one first, then up to three of yours
                  const tiles = (collage || []).filter(Boolean).slice(0, 4)
                  return (
                    <div key={i} className={styles.outfitBlock}>
                      <div className={styles.lookFigure}>
                        {analysis.look_images?.[i] ? (
                          <img src={analysis.look_images[i]} alt={`Your avatar wearing ${combo.name || 'this look'}`} />
                        ) : (
                          <div className={styles.lookWait}>
                            {dressing[i] ? (
                              <p className={styles.lookWaitText}>Dressing your avatar…</p>
                            ) : (
                              <>
                                {lookErrors[i] && <p className={styles.lookError}>{lookErrors[i]}</p>}
                                <button type="button" className={styles.dressBtn} onClick={() => dressLook(i)}>
                                  {lookErrors[i] ? 'Try again' : 'See it on me'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={styles.collageGrid}>
                        {tiles.map((url, j) =>
                          url ? (
                            <div key={j} className={styles.collageTile}>
                              <img src={url} alt="" loading="lazy" />
                            </div>
                          ) : (
                            <div key={j} className={`${styles.collageTile} ${styles.collageTileEmpty}`} />
                          )
                        )}
                      </div>
                      {combo.name && <p className={styles.outfitName}>{combo.name}</p>}
                      {combo.occasion && (
                        <span className={styles.occasionTag}>{combo.occasion}</span>
                      )}
                      {combo.styling_note && (
                        <p className={styles.stylingNote}>{combo.styling_note}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add to wardrobe CTA — shown if bought=true but not yet added */}
          {analysis.bought === true && !analysis.wardrobe_item_id && (
            <div className={styles.block}>
              <button
                className={styles.addBtn}
                onClick={handleAddToWardrobe}
                disabled={addingToWardrobe}
                type="button"
              >
                {addingToWardrobe ? 'Adding to wardrobe…' : 'Add to my wardrobe'}
              </button>
            </div>
          )}

          {analysis.wardrobe_item_id && (
            <p className={styles.addedNote}>Added to your wardrobe.</p>
          )}
        </div>
      </div>
    </>
  )
}
