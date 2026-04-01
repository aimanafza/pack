import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips.js'
import useStore from '../store/index.js'
import styles from './PackingPage.module.css'

// Build flat deduplicated items from approved outfits only, tagging each with outfit name
function buildApprovedItems(trip) {
  if (!trip?.packing_list) return []
  const approvedSet = new Set(trip.approved_outfits ?? [])
  const seen = new Set()
  const items = []
  for (const outfit of trip.packing_list.outfits) {
    if (!approvedSet.has(outfit.name)) continue
    for (const item of outfit.items) {
      const key = item.wardrobe_item_id || item.name
      if (!seen.has(key)) {
        seen.add(key)
        items.push({ ...item, outfitLabel: outfit.name })
      }
    }
  }
  return items
}

function groupByCategory(items) {
  const map = new Map()
  for (const item of items) {
    const cat = item.category || 'other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(item)
  }
  return map
}

export default function PackingPage() {
  const { id } = useParams()
  const { fetchTrip, checkItem } = useTrips()
  const activeTrip = useStore((s) => s.activeTrip)
  const [trip, setTrip] = useState(activeTrip?.id === id ? activeTrip : null)
  // Optimistic checked state keyed by wardrobe_item_id or item.name
  const [localChecked, setLocalChecked] = useState({})
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!trip || trip.id !== id) {
      fetchTrip(id).then((t) => t && setTrip(t))
    }
  }, [id]) // eslint-disable-line

  // Seed localChecked once when trip loads
  useEffect(() => {
    if (!trip || initialized) return
    const initial = {}
    for (const outfit of trip.packing_list?.outfits ?? []) {
      for (const item of outfit.items) {
        const key = item.wardrobe_item_id || item.name
        if (!(key in initial)) initial[key] = item.checked
      }
    }
    setLocalChecked(initial)
    setInitialized(true)
  }, [trip, initialized])

  const allItems = useMemo(() => buildApprovedItems(trip), [trip])
  const grouped = useMemo(() => groupByCategory(allItems), [allItems])

  const checkedCount = useMemo(
    () => allItems.filter((i) => localChecked[i.wardrobe_item_id || i.name] ?? i.checked).length,
    [allItems, localChecked]
  )
  const total = allItems.length
  const allPacked = total > 0 && checkedCount === total

  async function handleCheck(item, checked) {
    const key = item.wardrobe_item_id || item.name
    setLocalChecked((prev) => ({ ...prev, [key]: checked }))
    try {
      const updated = await checkItem(id, key, checked)
      if (updated) setTrip(updated)
    } catch {
      setLocalChecked((prev) => ({ ...prev, [key]: !checked }))
    }
  }

  if (!trip) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Header */}
        <header className={styles.header}>
          <Link to={`/trips/${id}`} className={styles.backLink}>
            ← {trip.name}
          </Link>
          <p className={styles.modeLabel}>PACKING MODE</p>

          {allPacked ? (
            <h1 className={styles.doneHeadline}>You&apos;re ready.</h1>
          ) : (
            <div className={styles.progressDisplay}>
              <span className={styles.progressNums}>{checkedCount} / {total}</span>
              <span className={styles.progressLabel}>packed</span>
            </div>
          )}
        </header>

        <div className={styles.divider} />

        {/* Checklist */}
        {total === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No approved outfits yet.</p>
            <Link to={`/trips/${id}/review`} className={styles.emptyLink}>
              Review outfits →
            </Link>
          </div>
        ) : (
          <div className={styles.checklist}>
            {[...grouped.entries()].map(([category, items]) => (
              <div key={category} className={styles.categorySection}>
                <p className={styles.categoryLabel}>{category}</p>
                <div className={styles.categoryItems}>
                  {items.map((item) => {
                    const key = item.wardrobe_item_id || item.name
                    const checked = localChecked[key] ?? item.checked
                    return (
                      <label
                        key={key}
                        className={`${styles.checkRow} ${checked ? styles.checkRowChecked : ''}`}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={checked}
                          onChange={(e) => handleCheck(item, e.target.checked)}
                          aria-label={`Pack ${item.name}`}
                        />
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.outfitPill}>{item.outfitLabel}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
