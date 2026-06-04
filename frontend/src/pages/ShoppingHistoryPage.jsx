import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api.js'
import styles from './ShoppingHistoryPage.module.css'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'bought',  label: 'Bought' },
  { key: 'passed',  label: 'Passed' },
]

export default function ShoppingHistoryPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pending')
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [passingId, setPassingId] = useState(null)   // analysis id showing pass form
  const [passedNote, setPassedNote] = useState('')

  useEffect(() => {
    fetchAnalyses()
  }, [])

  async function fetchAnalyses() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/v1/purchase-analysis/me')
      setAnalyses(data.data || [])
    } catch {
      // swallow
    } finally {
      setLoading(false)
    }
  }

  async function handleBought(id) {
    await api.patch(`/api/v1/purchase-analysis/${id}/bought`, { bought: true })
    setAnalyses((prev) =>
      prev.map((a) => (a.id === id || a._id === id ? { ...a, bought: true } : a))
    )
  }

  async function handlePassed(id) {
    await api.patch(`/api/v1/purchase-analysis/${id}/bought`, {
      bought: false,
      passed_note: passedNote,
    })
    setAnalyses((prev) =>
      prev.map((a) =>
        a.id === id || a._id === id
          ? { ...a, bought: false, passed_note: passedNote }
          : a
      )
    )
    setPassingId(null)
    setPassedNote('')
  }

  const pending = analyses.filter((a) => a.bought === null || a.bought === undefined)
  const bought  = analyses.filter((a) => a.bought === true)
  const passed  = analyses.filter((a) => a.bought === false)

  const tabData = { pending, bought, passed }
  const current = tabData[activeTab] || []

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.pageLabel}>The Wardrobe Edit</p>
          <h1 className={styles.headline}>Shopping history</h1>
        </div>
        <div className={styles.headerRight}>
          {analyses.length > 0 && (
            <span className={styles.count}>{analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'}</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
            <span className={styles.tabCount}>{tabData[tab.key].length}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : current.length === 0 ? (
        <p className={styles.empty}>
          {activeTab === 'pending'
            ? 'No pending analyses. Browse a fashion product and click the PACK extension.'
            : activeTab === 'bought'
            ? 'No purchased items tracked yet.'
            : 'No passed items yet.'}
        </p>
      ) : (
        <div className={styles.list}>
          {current.map((analysis) => {
            const id = analysis.id || analysis._id
            const isPassing = passingId === id
            return (
              <div key={id} className={styles.card}>
                <div className={styles.cardTop}>
                  {analysis.product_image_url ? (
                    <img
                      src={analysis.product_image_url}
                      alt={analysis.product_name}
                      className={styles.productImg}
                    />
                  ) : (
                    <div className={styles.productImgPlaceholder} />
                  )}
                  <div className={styles.cardMeta}>
                    {analysis.brand && (
                      <p className={styles.brand}>{analysis.brand}</p>
                    )}
                    <p className={styles.productName}>{analysis.product_name || 'Product'}</p>
                    {analysis.price && (
                      <p className={styles.price}>{analysis.currency} {analysis.price}</p>
                    )}
                    {analysis.scores?.overall != null && (
                      <div className={styles.overallRow}>
                        <div className={styles.overallTrack}>
                          <div
                            className={styles.overallFill}
                            style={{ width: `${(analysis.scores.overall / 10) * 100}%` }}
                          />
                        </div>
                        <span className={styles.overallVal}>{Number(analysis.scores.overall).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <button
                    className={styles.viewBtn}
                    onClick={() => navigate(`/profile/shopping/${id}`)}
                    type="button"
                    aria-label="View full analysis"
                  >
                    →
                  </button>
                </div>

                {/* Pending: did you buy this? */}
                {activeTab === 'pending' && !isPassing && (
                  <div className={styles.buyBanner}>
                    <span className={styles.buyQuestion}>Did you buy this?</span>
                    <div className={styles.buyBtns}>
                      <button
                        className={styles.buyBtn}
                        onClick={() => handleBought(id)}
                        type="button"
                      >
                        Yes
                      </button>
                      <button
                        className={`${styles.buyBtn} ${styles.buyBtnNo}`}
                        onClick={() => setPassingId(id)}
                        type="button"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}

                {/* Pass form */}
                {isPassing && (
                  <div className={styles.passForm}>
                    <input
                      type="text"
                      className={styles.passInput}
                      placeholder="Why didn't you buy it? (optional)"
                      value={passedNote}
                      onChange={(e) => setPassedNote(e.target.value)}
                    />
                    <div className={styles.passBtns}>
                      <button
                        className={styles.buyBtn}
                        onClick={() => handlePassed(id)}
                        type="button"
                      >
                        Confirm
                      </button>
                      <button
                        className={`${styles.buyBtn} ${styles.buyBtnNo}`}
                        onClick={() => { setPassingId(null); setPassedNote('') }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Passed: show note */}
                {activeTab === 'passed' && analysis.passed_note && (
                  <p className={styles.passedNote}>"{analysis.passed_note}"</p>
                )}

                {/* Bought: verdict snippet */}
                {activeTab === 'bought' && analysis.verdict && (
                  <p className={styles.verdictSnippet}>{analysis.verdict.slice(0, 120)}…</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
