import { Link } from 'react-router-dom'
import BackLink from '../components/ui/BackLink.jsx'
import styles from './PrivacyPage.module.css'

// Plain-language privacy policy for textpack.co and the PACK Chrome extension.
// The Chrome Web Store listing links here, so the extension section must stay
// in step with what pack-extension/ actually does.
const CONTACT = 'hey@textpack.co'
const UPDATED = '29 October 2026'

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.wordmark}>pack</Link>
      </nav>

      <article className={styles.article}>
        <BackLink to="/">Home</BackLink>
        <p className={styles.label}>Privacy</p>
        <h1 className={styles.title}>What PACK keeps, and why.</h1>
        <p className={styles.updated}>Last updated {UPDATED}</p>

        <p className={styles.lead}>
          PACK is a personal stylist for the clothes you already own, at textpack.co and as a
          Chrome extension. It's built and run by Aiman Afzal Arain. This page explains what we
          collect, what we do with it, and how to have it deleted. Questions go
          to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>What we collect</h2>
          <ul className={styles.list}>
            <li><strong>Your account.</strong> Your name, email address and password. Passwords are stored hashed, never as plain text.</li>
            <li><strong>Your wardrobe.</strong> Photos of your clothes and the details you or PACK add to them: category, colour, fabric, occasions, weight.</li>
            <li><strong>Your avatar.</strong> The photos of yourself you upload, and the appearance and fit details you choose to share (such as hair, skin tone, body shape, sizes, and whether you wear a hijab), used to show outfits on you.</li>
            <li><strong>Your style and trips.</strong> Style preferences, trips (destination, dates, bags, notes), inspiration images you upload, and the outfits and packing lists PACK makes for you.</li>
            <li><strong>Daily styling.</strong> The occasion and mood you pick. If you share your location, we use it once to look up the day's weather. We don't store your location.</li>
            <li><strong>Shopping checks.</strong> The products you ask PACK to look at, and the results.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>The Chrome extension</h2>
          <ul className={styles.list}>
            <li>On each page you visit, the extension checks inside your browser whether it's a product page, by reading the page's product details, title and buttons. That check never leaves your browser.</li>
            <li>Only when you press <em>Analyse this purchase</em> or <em>Generate looks</em> does it send that product's page address, name, image, price, currency and brand to PACK.</li>
            <li>It keeps your PACK sign-in in Chrome's storage on your device, and the product found on each open tab until you close the tab.</li>
            <li>It doesn't read your browsing history, passwords, form fields or payment details, and it doesn't follow you across sites.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>How we use it</h2>
          <p className={styles.text}>
            Only to run PACK for you: styling outfits, picturing them on your avatar, planning and
            weighing what you pack, checking purchases against your wardrobe, and emailing you about
            your account and the waitlist. We don't sell your data, we don't use it for advertising,
            and we don't share it with data brokers. Nobody reads your wardrobe or photos except to
            fix a problem you've reported.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Who helps us run PACK</h2>
          <p className={styles.text}>
            These services store or process data on our behalf, only to provide PACK:
          </p>
          <ul className={styles.list}>
            <li>MongoDB Atlas, our database.</li>
            <li>Cloudinary, which stores clothing photos and removes their backgrounds.</li>
            <li>Anthropic and fal.ai, which power styling, item details and outfit images.</li>
            <li>OpenWeather, for the daily forecast.</li>
            <li>Resend, which sends our emails.</li>
            <li>Railway and Vercel, which host the app.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Keeping and deleting it</h2>
          <p className={styles.text}>
            We keep your data while your account is open. You can delete pieces, trips and looks in
            the app at any time. To delete your whole account and everything in it, email{' '}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you signed up with, and
            we'll do it within 30 days. Removing the extension from Chrome clears what it stored on
            your device.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Everything else</h2>
          <p className={styles.text}>
            All traffic to PACK is encrypted. PACK isn't meant for anyone under 16. If this policy
            changes, we'll update the date above, and email you about anything significant.
          </p>
        </section>
      </article>
    </main>
  )
}
