import { useState } from 'react'
import api from '../../utils/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import styles from './LoginForm.module.css'

export default function EmailCodeLoginForm({ onBack }) {
  const { loginWithCode, loading, error, setError } = useAuth()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [requesting, setRequesting] = useState(false)

  async function handleRequestCode(e) {
    e.preventDefault()
    setError('')
    setRequesting(true)
    try {
      await api.post('/api/v1/auth/request-login-code', { email })
      setStep('code')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong.')
    } finally {
      setRequesting(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    await loginWithCode(email, code)
  }

  if (step === 'email') {
    return (
      <form className={styles.form} onSubmit={handleRequestCode} noValidate>
        <div className={styles.forgotHeader}>
          <button type="button" className={styles.backLink} onClick={onBack}>← Back to sign in</button>
          <h2 className={styles.forgotTitle}>Sign in with a code</h2>
          <p className={styles.forgotSub}>Enter your email and we'll send you a 6-digit code.</p>
        </div>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="code-login-email">Email</label>
          <input
            id="code-login-email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <button className={styles.submit} type="submit" disabled={requesting}>
          {requesting ? 'Sending...' : 'Send Code'}
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleVerify} noValidate>
      <div className={styles.forgotHeader}>
        <button type="button" className={styles.backLink} onClick={() => setStep('email')}>← Back</button>
        <h2 className={styles.forgotTitle}>Enter your code</h2>
        <p className={styles.forgotSub}>Check your email for the 6-digit code.</p>
      </div>

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="code-login-code">6-digit code</label>
        <input
          id="code-login-code"
          className={styles.input}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
          placeholder="123456"
          autoComplete="one-time-code"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
