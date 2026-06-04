import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api.js'
import styles from './ShoppingAnalysisPage.module.css'

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
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addingToWardrobe, setAddingToWardrobe] = useState(false)

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
  const scoreEntries = Object.entries(SCORE_LABELS)
    .filter(([key]) => scores[key] != null)

  return (
    <>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/profile/shopping')} type="button">
          ← Shopping history
        </button>
      </div>

      <div className={styles.layout}>
        {/* Left — product image */}
        <div className={styles.imageCol}>
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
          {analysis.price && (
            <p className={styles.price}>{analysis.currency} {analysis.price}</p>
          )}
          {analysis.product_url && (
            <a
              href={analysis.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
            >
              View original →
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
                Your archetype{analysis.archetype ? ` — ${analysis.archetype}` : ''}
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
              <p className={styles.sectionLabel}>Outfits with your wardrobe</p>
              <div className={styles.collages}>
                {analysis.outfit_collages.slice(0, 3).map((collage, i) => {
                  const combo = (analysis.outfit_combinations || [])[i] || {}
                  const tiles = [...(collage || [])].slice(0, 4)
                  while (tiles.length < 4) tiles.push(null)
                  return (
                    <div key={i} className={styles.outfitBlock}>
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
