import { useState } from 'react'
import styles from './TripForm.module.css'

const OCCASIONS = ['work', 'casual', 'formal', 'travel', 'dinner', 'beach', 'hiking', 'nightlife']
const CLIMATES = ['tropical', 'mild', 'cold', 'arid', 'rainy', 'variable']

export default function TripForm({ onSubmit, loading, error }) {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [occasions, setOccasions] = useState([])
  const [climate, setClimate] = useState('')
  const [notes, setNotes] = useState('')

  function toggleOccasion(occ) {
    setOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !destination.trim() || !startDate || !endDate) return
    await onSubmit({ name: name.trim(), destination: destination.trim(), start_date: startDate, end_date: endDate, occasions, climate, notes: notes.trim() })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.label}>Trip Name</label>
        <input
          className={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Paris for the weekend"
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Destination</label>
        <input
          className={styles.input}
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Paris, France"
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Departure</label>
          <input
            className={styles.input}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Return</label>
          <input
            className={styles.input}
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Occasions</label>
        <div className={styles.pillGroup}>
          {OCCASIONS.map((occ) => (
            <button
              key={occ}
              type="button"
              className={`${styles.pill} ${occasions.includes(occ) ? styles.pillActive : ''}`}
              onClick={() => toggleOccasion(occ)}
            >
              {occ}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Climate</label>
        <div className={styles.pillGroup}>
          {CLIMATES.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.pill} ${climate === c ? styles.pillActive : ''}`}
              onClick={() => setClimate((prev) => (prev === c ? '' : c))}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Notes</label>
        <textarea
          className={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the stylist should know — events, dress codes, vibes..."
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="submit"
        className={styles.btnSubmit}
        disabled={loading || !name.trim() || !destination.trim() || !startDate || !endDate}
      >
        {loading ? 'Creating...' : 'Create Trip'}
      </button>
    </form>
  )
}
