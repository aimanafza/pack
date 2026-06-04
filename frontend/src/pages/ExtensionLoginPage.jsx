import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'
import api from '../utils/api.js'
import styles from './ExtensionLoginPage.module.css'

export default function ExtensionLoginPage() {
  const { token, user } = useStore()
  const navigate = useNavigate()
  const [connected, setConnected] = useState(false)
  const [countdown, setCountdown] = useState(2)
  const [closeFailed, setCloseFailed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already logged in, push token to extension immediately
  useEffect(() => {
    if (token) {
      pushTokenToExtension(token)
    }
  }, [token])

  function pushTokenToExtension(authToken) {
    // Read the token directly from localStorage as the ground truth — Zustand
    // initialises from it, but reading it again here ensures we never send stale state.
    const lsToken = localStorage.getItem('pack_token')
    const finalToken = lsToken || authToken

    if (!finalToken) {
      console.warn('[PACK extension-login] No token found — user may not be logged in')
      return
    }

    console.log('[PACK extension-login] Token found, sending to extension:', finalToken.slice(0, 20) + '…')

    // postMessage is intercepted by the content script running on this tab.
    // The content script relays it to the background via chrome.runtime.sendMessage,
    // which writes it to chrome.storage.local, which the sidepanel listens to.
    window.postMessage({ type: 'PACK_EXTENSION_AUTH', token: finalToken }, '*')
    console.log('[PACK extension-login] postMessage sent')

    // Mark extension as connected on the backend (fire-and-forget)
    api.post('/api/v1/users/me/extension-connected').catch(() => {})

    setConnected(true)
  }

  // Auto-close countdown — starts once connected is true
  useEffect(() => {
    if (!connected) return

    const tick = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(tick)
          window.close()
          // Give Chrome 300ms to act; if the tab is still open, show fallback
          setTimeout(() => setCloseFailed(true), 300)
          return 0
        }
        return n - 1
      })
    }, 1000)

    return () => clearInterval(tick)
  }, [connected])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password })
      const authToken = data.data?.token || data.data?.access_token || data.access_token
      if (!authToken) throw new Error('No token returned')
      useStore.getState().setToken(authToken)
      pushTokenToExtension(authToken)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.logo}>pack</p>
          <h1 className={styles.headline}>Extension connected.</h1>
          <p className={styles.body}>
            Your PACK account is now linked to the browser extension.
          </p>
          {!closeFailed && countdown > 0 && (
            <p className={styles.countdown}>Closing in {countdown} second{countdown !== 1 ? 's' : ''}…</p>
          )}
          {closeFailed && (
            <div className={styles.fallback}>
              <button
                className={styles.btn}
                onClick={() => window.close()}
                type="button"
              >
                Close this tab
              </button>
              <button
                className={styles.link}
                onClick={() => navigate('/dashboard')}
                type="button"
              >
                Return to PACK
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Not logged in — show login form
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.logo}>pack</p>
        <h1 className={styles.headline}>Connect the extension.</h1>
        <p className={styles.body}>
          Sign in to link your PACK wardrobe to the browser extension.
        </p>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ext-email">Email</label>
            <input
              id="ext-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ext-password">Password</label>
            <input
              id="ext-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.btn}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in and connect'}
          </button>
        </form>

        <p className={styles.noAccount}>
          Don't have an account?{' '}
          <button className={styles.link} onClick={() => navigate('/register')}>
            Create one
          </button>
        </p>
      </div>
    </div>
  )
}
