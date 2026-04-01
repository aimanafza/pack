import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/index.js'
import { useWardrobe } from '../hooks/useWardrobe.js'
import api from '../utils/api.js'
import styles from './StyleDNAPage.module.css'

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  )
}

export default function StyleDNAPage() {
  const user = useStore((s) => s.user)
  const updateUser = useStore((s) => s.updateUser)
  const { wardrobe, fetchWardrobe } = useWardrobe()
  const navigate = useNavigate()

  const [styleDNA, setStyleDNA] = useState(user?.style_dna || null)
  const [loading, setLoading] = useState(!styleDNA)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWardrobe()
    if (!styleDNA) {
      api.get('/api/v1/auth/me').then(({ data }) => {
        updateUser(data.data)
        if (data.data.style_dna) {
          setStyleDNA(data.data.style_dna)
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function regenerate() {
    setRegenerating(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/profile/analyze-style')
      setStyleDNA(data.data)
      updateUser({ style_dna: data.data })
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not regenerate right now.')
    } finally {
      setRegenerating(false)
    }
  }

  // Signature pieces from wardrobe store
  const signaturePieces = (styleDNA?.signature_piece_ids || [])
    .map((id) => wardrobe.find((item) => String(item.id) === String(id)))
    .filter(Boolean)

  // Category breakdown totals for bar widths
  const breakdown = styleDNA?.category_breakdown || {}
  const breakdownTotal = Object.values(breakdown).reduce((s, n) => s + n, 0)

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>Loading your style analysis...</p>
        </div>
      </div>
    )
  }

  if (!styleDNA) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No style analysis yet.</p>
          <Link to="/profile" className={styles.backLink}>← Back to profile</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Back nav */}
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/profile')}
        >
          <IconBack /> Profile
        </button>
      </div>

      {/* Page headline */}
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className={styles.heroLabel}>YOUR STYLE DNA</p>
        {styleDNA.headline && (
          <h1 className={styles.heroHeadline}>{styleDNA.headline}</h1>
        )}
      </motion.div>

      {/* 1 — YOUR PALETTE */}
      {styleDNA.color_palette?.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>YOUR PALETTE</p>
          <div className={styles.paletteRow}>
            {styleDNA.color_palette.map((hex) => (
              <div key={hex} className={styles.paletteItem}>
                <span
                  className={styles.paletteCircle}
                  style={{ background: hex }}
                  aria-label={hex}
                />
                <span className={styles.paletteHex}>{hex}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2 — YOUR AESTHETIC */}
      {styleDNA.style_keywords?.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>YOUR AESTHETIC</p>
          <div className={styles.aestheticRow}>
            {styleDNA.style_keywords.map((kw) => (
              <span key={kw} className={styles.aestheticPill}>{kw}</span>
            ))}
          </div>
        </section>
      )}

      {/* 3 — YOUR WARDROBE BREAKDOWN */}
      {breakdownTotal > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>YOUR WARDROBE BREAKDOWN</p>
          <div className={styles.breakdownList}>
            {Object.entries(breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <div key={cat} className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>{cat}</span>
                  <div className={styles.breakdownTrack}>
                    <motion.div
                      className={styles.breakdownBar}
                      initial={{ width: 0 }}
                      animate={{ width: `${((count / breakdownTotal) * 100).toFixed(1)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className={styles.breakdownCount}>{count}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 4 — SIGNATURE PIECES */}
      {signaturePieces.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>SIGNATURE PIECES</p>
          <div className={styles.signatureRow}>
            {signaturePieces.map((item) => (
              <Link
                key={item.id}
                to={`/wardrobe/${item.id}`}
                className={styles.signatureCard}
              >
                <div className={styles.signatureImg}>
                  <img src={item.image_url} alt={item.name} className={styles.signaturePhoto} />
                </div>
                <p className={styles.signatureName}>{item.name}</p>
                <p className={styles.signatureCategory}>{item.category}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5 — STYLE GAPS */}
      {styleDNA.style_gaps?.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>STYLE GAPS</p>
          <ul className={styles.gapList}>
            {styleDNA.style_gaps.map((gap, i) => (
              <li key={i} className={styles.gapItem}>
                <span className={styles.gapArrow}>→</span>
                {gap}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6 — THE STYLIST'S TAKE */}
      {styleDNA.stylist_paragraph && (
        <section className={`${styles.section} ${styles.stylistSection}`}>
          <p className={styles.sectionLabel}>THE STYLIST'S TAKE</p>
          <p className={styles.stylistParagraph}>{styleDNA.stylist_paragraph}</p>
        </section>
      )}

      {/* Regenerate */}
      <div className={styles.regenWrap}>
        {error && <p className={styles.errorText}>{error}</p>}
        <button
          type="button"
          className={styles.regenBtn}
          onClick={regenerate}
          disabled={regenerating}
        >
          {regenerating ? 'Regenerating analysis...' : 'Regenerate analysis'}
        </button>
      </div>
    </div>
  )
}
