import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'
import styles from './LandingPage.module.css'

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
    body: 'Swipe through AI-generated outfits. Approve what you love.',
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

      {/* Section 1 — Hero */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroLabel}>INTRODUCING PACK</p>
          <h1 className={styles.heroHeadline}>Pack like you mean it.</h1>
          <p className={styles.heroSubhead}>
            Your AI personal stylist. Every trip, perfectly packed.
          </p>
          <Link to="/auth" className={styles.ctaBtn}>Start Packing</Link>
          <p className={styles.ctaNote}>Free to use. No credit card required.</p>
        </div>
        <div className={styles.heroRight} aria-hidden="true">
          <div className={styles.heroPhotoPlaceholder} />
        </div>
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

      {/* Section 3 — Bottom CTA */}
      <section className={styles.bottomCta}>
        <h2 className={styles.bottomHeadline}>Every trip deserves the right wardrobe.</h2>
        <Link to="/auth" className={styles.ctaBtn}>Create Your Account</Link>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerText}>© 2026 PACK</p>
      </footer>
    </div>
  )
}
