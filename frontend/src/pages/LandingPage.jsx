import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'
import api from '../utils/api.js'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const token = useStore((s) => s.token)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true })
  }, [token, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await api.post('/waitlist', { email: email.trim() })
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.wordmark}>pack</span>
        <a href="/auth" className={styles.navSignIn}>Sign in</a>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroLabel}>INTRODUCING PACK</p>
          <h1 className={styles.heroHeadline}>Pack like you mean it.</h1>
          <p className={styles.heroSubhead}>
            Your AI personal stylist. Every trip, perfectly packed.
          </p>

          {status === 'success' ? (
            <div className={styles.successState}>
              <p className={styles.successText}>You're on the list. We'll be in touch.</p>
            </div>
          ) : (
            <form className={styles.waitlistForm} onSubmit={handleSubmit}>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.emailInput}
                disabled={status === 'loading'}
              />
              <button
                type="submit"
                className={styles.ctaBtn}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Joining...' : 'Join the waitlist'}
              </button>
              {status === 'error' && (
                <p className={styles.errorMsg}>{errorMsg}</p>
              )}
            </form>
          )}
        </div>
        <div className={styles.heroRight} aria-hidden="true">
          <div className={styles.heroPhotoPlaceholder} />
        </div>
      </section>

      <section className={styles.howSection}>
        <p className={styles.sectionLabel}>HOW IT WORKS</p>
        <div className={styles.stepsGrid}>
          {[
            { num: '01', head: 'Build Your Wardrobe', body: 'Upload your clothes once. PACK learns your style.' },
            { num: '02', head: 'Set the Vibe', body: 'Drop your Pinterest inspo. Your stylist reads the aesthetic.' },
            { num: '03', head: 'Pack Smarter', body: 'Swipe through AI-generated outfits. Approve what you love.' },
          ].map(({ num, head, body }) => (
            <div key={num} className={styles.step}>
              <span className={styles.stepNum}>{num}</span>
              <h3 className={styles.stepHead}>{head}</h3>
              <p className={styles.stepBody}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerText}>© 2026 PACK</p>
      </footer>
    </div>
  )
}
