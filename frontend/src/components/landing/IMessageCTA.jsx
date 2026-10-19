import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import styles from './IMessageCTA.module.css'

// Placeholder component — self-contained on purpose so it can be dropped
// anywhere on the landing page during the redesign without untangling it
// from surrounding markup.

const PACK_PHONE = import.meta.env.VITE_PACK_PHONE_NUMBER
const SMS_BODY = 'hey Pack'

// iOS/macOS accept "&body=" for the prefilled message (documented, if
// unofficial, behavior); the RFC/Android-standard separator is "?body=".
// Since this button only ever targets iPhone/Mac (everything else gets the
// QR fallback below, itself meant to be scanned by an iPhone), "&body=" is
// the one that matters here.
function buildSmsLink() {
  if (!PACK_PHONE) return null
  return `sms:${PACK_PHONE}&body=${encodeURIComponent(SMS_BODY)}`
}

function detectApplePlatform() {
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  // Check Android explicitly (highest-confidence signal) before the iPad
  // heuristic below — some environments spoof userAgent for device emulation
  // without also spoofing navigator.platform, which would otherwise still
  // read "MacIntel" and false-trigger the iPad check on a non-Apple device.
  if (/Android/i.test(ua)) return 'other'
  // iPadOS reports itself as "MacIntel" in Safari; multi-touch is the tell.
  const isIOSFamily = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOSFamily) return 'ios'
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac'
  return 'other'
}

export default function IMessageCTA() {
  const [platform] = useState(detectApplePlatform)
  const smsLink = buildSmsLink()

  if (!smsLink) return null // VITE_PACK_PHONE_NUMBER not configured yet

  const opensDirectly = platform === 'ios' || platform === 'mac'

  return (
    <div className={styles.wrap}>
      {opensDirectly ? (
        <a href={smsLink} className={styles.textBtn}>Text Pack</a>
      ) : (
        <div className={styles.qrBlock}>
          <QRCodeSVG value={smsLink} size={140} bgColor="#FFFFFF" fgColor="#1A1A18" level="M" />
          <p className={styles.qrCaption}>Scan to text Pack from your iPhone.</p>
        </div>
      )}
      <p className={styles.consent}>
        By texting Pack you agree to receive messages. Reply STOP anytime.
      </p>
    </div>
  )
}
