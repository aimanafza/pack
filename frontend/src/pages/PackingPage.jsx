import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips.js'
import useStore from '../store/index.js'
import api from '../utils/api.js'
import { formatWeight, useWeightUnit } from '../utils/weight.js'
import styles from './PackingPage.module.css'
import BackLink from '../components/ui/BackLink.jsx'

const itemKey = (item) => item.wardrobe_item_id || item.name
const gramsOf = (item) => Math.round((item.estimated_weight_kg || 0) * 1000)

// Build flat deduplicated items from approved outfits only, tagging each with outfit name
function buildApprovedItems(trip) {
  if (!trip?.packing_list) return []
  const approvedSet = new Set(trip.approved_outfits ?? [])
  const seen = new Set()
  const items = []
  for (const outfit of trip.packing_list.outfits) {
    if (!approvedSet.has(outfit.name)) continue
    for (const item of outfit.items) {
      const key = itemKey(item)
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

// Keys the backend uses for non-clothing items reserved at trip creation
const reservedKey = (r) => `reserved:${r.name}`

// The saved bag plan only holds while the same items and bags are on the trip
function planIsCurrent(plan, items, reserved, bags) {
  if (!plan) return false
  const planned = new Set(plan.bags.flatMap((b) => b.item_keys))
  const current = [...items.map(itemKey), ...reserved.map(reservedKey)]
  if (planned.size !== current.length || current.some((k) => !planned.has(k))) return false
  const bagIds = bags.length ? bags.map((b) => b.bag_id) : ['bag_main']
  return plan.bags.length === bagIds.length && plan.bags.every((b, i) => b.bag_id === bagIds[i])
}

function PackingRow({ item, checked, onCheck, unit }) {
  return (
    <label className={`${styles.checkRow} ${checked ? styles.checkRowChecked : ''}`}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(e) => onCheck(item, e.target.checked)}
        aria-label={`Pack ${item.name}`}
      />
      <span className={styles.thumb}>
        {item.image_url ? (
          <img src={item.image_url} alt="" className={styles.thumbImg} loading="lazy" />
        ) : (
          <span className={styles.thumbInitial} aria-hidden="true">{item.name.charAt(0)}</span>
        )}
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemName}>{item.name}</span>
        {item.outfitLabel && <span className={styles.itemOutfit}>{item.outfitLabel}</span>}
      </span>
      <span className={styles.itemWeight}>{formatWeight(gramsOf(item), unit)}</span>
    </label>
  )
}

// Toiletries, chargers and the like: they count toward the weight but aren't on the checklist
function ReservedRow({ item, unit }) {
  return (
    <div className={styles.checkRow}>
      <span className={styles.checkboxSpacer} aria-hidden="true" />
      <span className={styles.thumb}>
        <span className={styles.thumbInitial} aria-hidden="true">{item.name.charAt(0)}</span>
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemName}>{item.name}</span>
        <span className={styles.itemOutfit}>Other items</span>
      </span>
      <span className={styles.itemWeight}>{formatWeight(item.weight_grams || 0, unit)}</span>
    </div>
  )
}

export default function PackingPage() {
  const { id } = useParams()
  const { fetchTrip, checkItem } = useTrips()
  const activeTrip = useStore((s) => s.activeTrip)
  const setActiveTrip = useStore((s) => s.setActiveTrip)
  const unit = useWeightUnit()
  const [trip, setTrip] = useState(activeTrip?.id === id ? activeTrip : null)
  const [loadError, setLoadError] = useState(false)
  // Optimistic checked state keyed by wardrobe_item_id or item.name
  const [localChecked, setLocalChecked] = useState({})
  const [initialized, setInitialized] = useState(false)
  // null until the user picks: then it follows whether a bag plan exists
  const [chosenView, setView] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')

  useEffect(() => {
    if (!trip || trip.id !== id) {
      fetchTrip(id).then((t) => (t ? setTrip(t) : setLoadError(true)))
    }
  }, [id]) // eslint-disable-line

  // Seed localChecked once when trip loads
  useEffect(() => {
    if (!trip || initialized) return
    const initial = {}
    for (const outfit of trip.packing_list?.outfits ?? []) {
      for (const item of outfit.items) {
        const key = itemKey(item)
        if (!(key in initial)) initial[key] = item.checked
      }
    }
    setLocalChecked(initial)
    setInitialized(true)
  }, [trip, initialized])

  const allItems = useMemo(() => buildApprovedItems(trip), [trip])
  const grouped = useMemo(() => groupByCategory(allItems), [allItems])
  const reserved = useMemo(() => trip?.reserved_items ?? [], [trip])
  const bags = trip?.bags ?? []

  const isChecked = (item) => localChecked[itemKey(item)] ?? item.checked
  const checkedCount = allItems.filter(isChecked).length
  const total = allItems.length
  const allPacked = total > 0 && checkedCount === total

  // What the scale at the airport sees: clothes, other items, and the bags themselves
  const clothesGrams = allItems.reduce((s, i) => s + gramsOf(i), 0)
  const reservedGrams = reserved.reduce((s, r) => s + (r.weight_grams || 0), 0)
  const emptyBagGrams = bags.reduce((s, b) => s + (b.empty_bag_weight_grams || 0), 0)
  const totalGrams = clothesGrams + reservedGrams + emptyBagGrams
  const limitGrams = bags.reduce((s, b) => s + (b.weight_limit_grams || 0), 0)
  const remainingGrams = limitGrams - totalGrams

  const plan = trip?.packing_plan
  const planCurrent = planIsCurrent(plan, allItems, reserved, bags)
  const itemsByKey = useMemo(() => {
    const map = new Map(allItems.map((i) => [itemKey(i), i]))
    for (const r of reserved) map.set(reservedKey(r), { ...r, reserved: true })
    return map
  }, [allItems, reserved])

  async function handleCheck(item, checked) {
    const key = itemKey(item)
    setLocalChecked((prev) => ({ ...prev, [key]: checked }))
    try {
      const updated = await checkItem(id, key, checked)
      if (updated) setTrip(updated)
    } catch {
      setLocalChecked((prev) => ({ ...prev, [key]: !checked }))
    }
  }

  async function handleOptimise() {
    setPlanning(true)
    setPlanError('')
    try {
      const { data } = await api.post(`/api/v1/trips/${id}/packing-plan`, {})
      setTrip(data.data)
      setActiveTrip(data.data)
      setView('bag')
    } catch (err) {
      setPlanError(err.response?.data?.detail || "We couldn't plan your bags just now. Try again in a moment.")
    } finally {
      setPlanning(false)
    }
  }

  if (!trip) {
    return (
      <div className={styles.loading}>
        {loadError ? (
          <>
            <p className={styles.emptyText}>We couldn&apos;t find this trip.</p>
            <Link to="/trips" className={styles.emptyLink}>Back to your trips →</Link>
          </>
        ) : (
          <p className={styles.loadingText}>Opening your packing list...</p>
        )}
      </div>
    )
  }

  const view = chosenView ?? (planCurrent ? 'bag' : 'category')
  const showBagView = view === 'bag' && planCurrent

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BackLink to={`/trips/${id}`} className={styles.backLink}>{trip.name}</BackLink>
        <p className={styles.modeLabel}>Packing mode</p>

        {allPacked ? (
          <h1 className={styles.doneHeadline}>You&apos;re ready.</h1>
        ) : (
          <div className={styles.progressDisplay}>
            <span className={styles.progressNums}>{checkedCount} / {total}</span>
            <span className={styles.progressLabel}>packed</span>
          </div>
        )}
      </header>

      {total === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No approved outfits yet.</p>
          <Link to={`/trips/${id}/review`} className={styles.emptyLink}>
            Review outfits →
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          {/* Weight */}
          <aside className={styles.weightPanel} aria-label="Packing weight">
            <p className={styles.sectionLabel}>Total weight</p>
            <p className={styles.weightTotal}>{formatWeight(totalGrams, unit)}</p>
            {limitGrams > 0 && (
              <>
                <p className={styles.weightOf}>of {formatWeight(limitGrams, unit)} allowed</p>
                <div className={styles.meter} aria-hidden="true">
                  <span
                    className={styles.meterFill}
                    style={{ width: `${Math.min(100, (totalGrams / limitGrams) * 100)}%` }}
                  />
                </div>
                <p className={`${styles.weightStatus} ${remainingGrams < 0 ? styles.weightStatusOver : ''}`}>
                  {remainingGrams > 0
                    ? `${formatWeight(remainingGrams, unit)} to spare`
                    : remainingGrams === 0
                      ? 'Right at your limit'
                      : `${formatWeight(-remainingGrams, unit)} over your limit`}
                </p>
              </>
            )}

            <dl className={styles.breakdown}>
              <div className={styles.breakdownRow}>
                <dt>Clothes</dt>
                <dd>{formatWeight(clothesGrams, unit)}</dd>
              </div>
              {reservedGrams > 0 && (
                <div className={styles.breakdownRow}>
                  <dt>Other items</dt>
                  <dd>{formatWeight(reservedGrams, unit)}</dd>
                </div>
              )}
              {emptyBagGrams > 0 && (
                <div className={styles.breakdownRow}>
                  <dt>{bags.length === 1 ? 'The bag itself' : 'The bags themselves'}</dt>
                  <dd>{formatWeight(emptyBagGrams, unit)}</dd>
                </div>
              )}
            </dl>

            {!planCurrent && (
              <div className={styles.optimise}>
                <p className={styles.optimiseText}>
                  {plan
                    ? 'Your list changed since your last plan.'
                    : bags.length > 1
                      ? 'See which bag each piece goes in, and how to pack it.'
                      : 'See how to pack it all so it fits.'}
                </p>
                <button type="button" className={styles.btnOptimise} onClick={handleOptimise} disabled={planning}>
                  {planning ? 'Planning your bags...' : plan ? 'Update plan' : 'Optimise space'}
                </button>
                {planError && <p className={styles.planError} role="alert">{planError}</p>}
              </div>
            )}
          </aside>

          {/* Checklist */}
          <div className={styles.listColumn}>
            {planCurrent && (
              <div className={styles.viewToggle} role="tablist" aria-label="Group items">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'category'}
                  className={`${styles.toggleBtn} ${view === 'category' ? styles.toggleActive : ''}`}
                  onClick={() => setView('category')}
                >
                  By category
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'bag'}
                  className={`${styles.toggleBtn} ${view === 'bag' ? styles.toggleActive : ''}`}
                  onClick={() => setView('bag')}
                >
                  By bag
                </button>
              </div>
            )}

            {showBagView ? (
              <div className={styles.checklist}>
                {plan.tips.length > 0 && (
                  <section className={styles.tips}>
                    <p className={styles.sectionLabel}>How to pack</p>
                    <ol className={styles.tipList}>
                      {plan.tips.map((tip, i) => (
                        <li key={i} className={styles.tip}>
                          <span className={styles.tipNum}>{String(i + 1).padStart(2, '0')}</span>
                          <span className={styles.tipText}>{tip}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {plan.bags.map((bag) => (
                  <section key={bag.bag_id} className={styles.categorySection}>
                    <div className={styles.bagHeader}>
                      <h2 className={styles.bagName}>{bag.label}</h2>
                      <span className={styles.bagWeight}>
                        {formatWeight(bag.weight_grams, unit)}
                        {bag.available_grams > 0 && ` of ${formatWeight(bag.available_grams, unit)}`}
                      </span>
                    </div>
                    {bag.note && <p className={styles.bagNote}>{bag.note}</p>}
                    <div className={styles.categoryItems}>
                      {bag.item_keys.length === 0 && <p className={styles.bagEmpty}>Nothing needs to go in here.</p>}
                      {bag.item_keys.map((key) => {
                        const item = itemsByKey.get(key)
                        if (!item) return null
                        return item.reserved ? (
                          <ReservedRow key={key} item={item} unit={unit} />
                        ) : (
                          <PackingRow key={key} item={item} checked={isChecked(item)} onCheck={handleCheck} unit={unit} />
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.checklist}>
                {[...grouped.entries()].map(([category, items]) => (
                  <section key={category} className={styles.categorySection}>
                    <div className={styles.categoryHeader}>
                      <p className={styles.categoryLabel}>{category}</p>
                      <span className={styles.categoryWeight}>
                        {formatWeight(items.reduce((s, i) => s + gramsOf(i), 0), unit)}
                      </span>
                    </div>
                    <div className={styles.categoryItems}>
                      {items.map((item) => (
                        <PackingRow key={itemKey(item)} item={item} checked={isChecked(item)} onCheck={handleCheck} unit={unit} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
