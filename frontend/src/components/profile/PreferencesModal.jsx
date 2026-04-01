import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../../utils/api.js'
import useStore from '../../store/index.js'
import styles from './PreferencesModal.module.css'

const AESTHETICS = [
  'Boho', 'Editorial', 'Minimal', 'Quiet Luxury', 'Streetwear',
  'Cottagecore', 'Business Casual', 'Y2K', 'Classic', 'Coastal',
  'Dark Academia', 'Sporty',
]
const FITS = ['Oversized', 'Relaxed', 'Tailored', 'Fitted', 'Mixed']
const DRESSES_FOR = ['Travel', 'Work', 'Casual', 'Events', 'Outdoors', 'Nights out']
const CLIMATES = [
  { value: 'cold', label: 'Always cold' },
  { value: 'depends', label: 'Depends' },
  { value: 'warm', label: 'Always warm' },
]

export default function PreferencesModal({ onClose }) {
  const user = useStore((s) => s.user)
  const updatePreferences = useStore((s) => s.updatePreferences)

  const existing = user?.preferences || {}

  const [aesthetics, setAesthetics] = useState(existing.style_aesthetics || [])
  const [fit, setFit] = useState(existing.fit_preference || '')
  const [colorsToAvoid, setColorsToAvoid] = useState(existing.colors_to_avoid || [])
  const [colorInput, setColorInput] = useState('')
  const [dressesFor, setDressesFor] = useState(existing.dresses_for || [])
  const [climate, setClimate] = useState(existing.climate_preference || '')
  const [stylistNotes, setStylistNotes] = useState(existing.stylist_notes || '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const autoCloseRef = useRef(null)

  // Close on Escape + cleanup auto-close timer on unmount
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(autoCloseRef.current)
    }
  }, [])

  function toggleAesthetic(a) {
    setAesthetics((prev) => {
      if (prev.includes(a)) return prev.filter((x) => x !== a)
      if (prev.length >= 3) return prev
      return [...prev, a]
    })
  }

  function toggleDressesFor(d) {
    setDressesFor((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  function handleColorKeyDown(e) {
    if (e.key === 'Enter' && colorInput.trim()) {
      e.preventDefault()
      const val = colorInput.trim().toLowerCase()
      if (!colorsToAvoid.includes(val)) setColorsToAvoid((prev) => [...prev, val])
      setColorInput('')
    }
  }

  function removeColor(c) {
    setColorsToAvoid((prev) => prev.filter((x) => x !== c))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        style_aesthetics: aesthetics,
        fit_preference: fit,
        colors_to_avoid: colorsToAvoid,
        dresses_for: dressesFor,
        climate_preference: climate,
        stylist_notes: stylistNotes,
      }
      const { data } = await api.patch('/api/v1/auth/me/preferences', payload)
      updatePreferences(data.data.preferences)
      setSaved(true)
      clearTimeout(autoCloseRef.current)
      autoCloseRef.current = setTimeout(() => onClose(), 5000)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    clearTimeout(autoCloseRef.current)
    onClose()
  }

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Preferences">
        <div className={styles.header}>
          <h2 className={styles.title}>Your Preferences</h2>
          <button className={styles.btnClose} onClick={onClose} type="button" aria-label="Close">×</button>
        </div>

        <div className={styles.body}>
          {/* 1. Aesthetic */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Your aesthetic <span className={styles.sectionHint}>(pick up to 3)</span></p>
            <div className={styles.pillGroup}>
              {AESTHETICS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`${styles.pill} ${aesthetics.includes(a) ? styles.pillActive : ''} ${!aesthetics.includes(a) && aesthetics.length >= 3 ? styles.pillDisabled : ''}`}
                  onClick={() => toggleAesthetic(a)}
                  disabled={!aesthetics.includes(a) && aesthetics.length >= 3}
                >
                  {a}
                </button>
              ))}
            </div>
          </section>

          {/* 2. Fit */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Fit</p>
            <div className={styles.pillGroup}>
              {FITS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.pill} ${fit === f ? styles.pillActive : ''}`}
                  onClick={() => setFit(fit === f ? '' : f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </section>

          {/* 3. Colors to avoid */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Colors I never wear</p>
            <div
              className={styles.tagInputWrap}
              onClick={() => document.getElementById('color-avoid-input')?.focus()}
            >
              {colorsToAvoid.map((c) => (
                <span key={c} className={styles.tag}>
                  {c}
                  <button type="button" className={styles.tagRemove} onClick={() => removeColor(c)}>×</button>
                </span>
              ))}
              <input
                id="color-avoid-input"
                className={styles.tagInput}
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={handleColorKeyDown}
                placeholder={colorsToAvoid.length === 0 ? 'Type a color, press Enter' : ''}
              />
            </div>
          </section>

          {/* 4. Dresses for */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>I dress for</p>
            <div className={styles.pillGroup}>
              {DRESSES_FOR.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.pill} ${dressesFor.includes(d) ? styles.pillActive : ''}`}
                  onClick={() => toggleDressesFor(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </section>

          {/* 5. Climate */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Climate</p>
            <div className={styles.climateToggle}>
              {CLIMATES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.climateBtn} ${climate === value ? styles.climateBtnActive : ''}`}
                  onClick={() => setClimate(climate === value ? '' : value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* 6. Stylist notes */}
          <section className={styles.section}>
            <p className={styles.sectionLabel}>Tell your stylist</p>
            <textarea
              className={styles.textarea}
              value={stylistNotes}
              onChange={(e) => setStylistNotes(e.target.value)}
              placeholder="Things Claude should always know about how you dress..."
            />
          </section>
        </div>

        <div className={styles.footer}>
          {saved ? (
            <>
              <span className={styles.savedMsg}>Saved</span>
              <button className={styles.btnClose2} onClick={handleClose} type="button">
                Close
              </button>
            </>
          ) : (
            <button
              className={styles.btnSave}
              onClick={handleSave}
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
