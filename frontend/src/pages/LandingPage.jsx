import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'
import WaitlistForm from '../components/landing/WaitlistForm.jsx'
import MonthInReview from '../components/landing/MonthInReview.jsx'
import styles from './LandingPage.module.css'

// Set once the extension is live on the Chrome Web Store (Vercel env var)
const CHROME_STORE_URL = import.meta.env.VITE_CHROME_STORE_URL

const STEPS = [
  {
    num: '01',
    head: 'Build Your Wardrobe',
    body: 'Upload your clothes once. PACK learns your style.',
  },
  {
    num: '02',
    head: 'Set the Vibe',
    body: 'Drop your Pinterest inspo. Your stylist reads the aesthetic.',
  },
  {
    num: '03',
    head: 'Pack Smarter',
    body: 'Swipe through outfits styled for your trip. Approve what you love.',
  },
]

export default function LandingPage() {
  const token = useStore((s) => s.token)
  const navigate = useNavigate()

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true })
  }, [token, navigate])

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <span className={styles.wordmark}>pack</span>
        <Link to="/auth" className={styles.navSignIn}>Sign in</Link>
      </nav>

      {/* Section 1, Hero: the month in review sheet */}
      <section className={styles.hero}>
        <MonthInReview />
      </section>

      {/* Section 2 — How It Works */}
      <section className={styles.howSection}>
        <p className={styles.sectionLabel}>HOW IT WORKS</p>
        <div className={styles.stepsGrid}>
          {STEPS.map(({ num, head, body }) => (
            <div key={num} className={styles.step}>
              <span className={styles.stepNum}>{num}</span>
              <h3 className={styles.stepHead}>{head}</h3>
              <p className={styles.stepBody}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Extension */}
      <section className={styles.extensionSection}>
        <p className={styles.sectionLabel}>THE PACK EXTENSION</p>
        <h2 className={styles.extensionHeadline}>Your wardrobe, everywhere you shop.</h2>
        <p className={styles.extensionSubtext}>
          See how any item fits with what you already own, before you buy it.
        </p>

        {CHROME_STORE_URL ? (
          <a href={CHROME_STORE_URL} className={styles.chromeBtn} target="_blank" rel="noreferrer">
            {/* Chrome logo: coloured circle mark */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="9" cy="9" r="9" fill="#fff" fillOpacity="0.12"/>
              <path d="M9 5.4a3.6 3.6 0 1 1 0 7.2A3.6 3.6 0 0 1 9 5.4Z" fill="#fff"/>
              <path d="M9 5.4H15.54A8.1 8.1 0 0 0 1.8 7.2L5.07 12.96A3.6 3.6 0 0 1 9 5.4Z" fill="#EA4335"/>
              <path d="M9 5.4H15.54A8.1 8.1 0 0 1 16.2 9a8.1 8.1 0 0 1-4.14 7.02L8.82 10.08A3.6 3.6 0 0 0 12.6 9a3.6 3.6 0 0 0-.06-.6H9Z" fill="#FBBC05"/>
              <path d="M9 12.6a3.6 3.6 0 0 1-3.93-4.04L1.8 7.2A8.1 8.1 0 0 0 9 17.1a8.1 8.1 0 0 0 3.06-.6L8.82 10.08A3.59 3.59 0 0 1 9 12.6Z" fill="#34A853"/>
              <path d="M9 5.4H15.54A8.1 8.1 0 0 0 1.8 7.2L5.07 12.96A3.6 3.6 0 0 1 5.4 9a3.6 3.6 0 0 1 3.6-3.6Z" fill="#4285F4"/>
            </svg>
            Add to Chrome, free
          </a>
        ) : (
          <span className={`${styles.chromeBtn} ${styles.chromeBtnSoon}`}>Coming soon to Chrome</span>
        )}

        <div className={styles.extensionFlows}>
          <div className={styles.extensionFlow}>
            <p className={styles.flowLabel}>NEW TO PACK</p>
            <p className={styles.flowText}>
              Join the waitlist. Once you're in, build your wardrobe, then add the extension.
              Any piece you're about to buy gets checked against what you already own.
            </p>
          </div>
          <div className={styles.extensionFlow}>
            <p className={styles.flowLabel}>ALREADY A MEMBER</p>
            <p className={styles.flowText}>
              Add the extension to Chrome, click Connect to PACK, and sign in.
              Your wardrobe and style profile load automatically, no setup needed.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4 — Bottom CTA */}
      <section className={styles.bottomCta}>
        <h2 className={styles.bottomHeadline}>Every trip deserves the right wardrobe.</h2>
        <WaitlistForm />
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          © 2026 PACK · <Link to="/privacy" className={styles.footerLink}>Privacy</Link>
        </p>
      </footer>
    </div>
  )
}
