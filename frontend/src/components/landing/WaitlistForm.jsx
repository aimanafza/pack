import { useState } from 'react'
import api from '../../utils/api.js'
import styles from './WaitlistForm.module.css'

// Self-contained so it can move anywhere in the landing redesign.
export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await api.post('/waitlist', { email: email.trim() })
      setStatus('success')
    } catch (err) {
      const detail = err.response?.data?.detail
      setErrorMsg(typeof detail === 'string' ? detail : 'That didn\'t go through. Check your email and try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return <p className={styles.success}>You're on the list. We'll be in touch.</p>
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        type="email"
        required
        aria-label="Email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={styles.input}
        disabled={status === 'loading'}
      />
      <button type="submit" className={styles.button} disabled={status === 'loading'}>
        {status === 'loading' ? 'Joining...' : 'Join the waitlist'}
      </button>
      {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
    </form>
  )
}
