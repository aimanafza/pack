import { useState } from 'react'
import api from '../../utils/api.js'
import styles from './LoginForm.module.css'

export default function ForgotPasswordForm({ initialMode, initialEmail, onEmailSet, onBack, onDone }) {
  const [step, setStep] = useState(initialMode === 'reset' ? 'reset' : 'email')
  const [email, setEmail] = useState(initialEmail || '')
  const [code, setCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleRequestCode(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/auth/forgot-password', { email })
      onEmailSet(email)
      // Dev mode: backend returns the code directly
      if (data.data?.code) {
        setGeneratedCode(data.data.code)
      }
      setStep('reset')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/v1/auth/reset-password', {
        email,
        code,
        new_password: newPassword,
      })
      setSuccess('Password updated. Signing you in...')
      setTimeout(onDone, 1500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'email') {
    return (
      <form className={styles.form} onSubmit={handleRequestCode} noValidate>
        <div className={styles.forgotHeader}>
          <button type="button" className={styles.backLink} onClick={onBack}>← Back to sign in</button>
          <h2 className={styles.forgotTitle}>Reset your password</h2>
          <p className={styles.forgotSub}>Enter your email and we'll send you a reset code.</p>
        </div>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Code'}
        </button>
      </form>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleReset} noValidate>
      <div className={styles.forgotHeader}>
        <button type="button" className={styles.backLink} onClick={() => setStep('email')}>← Back</button>
        <h2 className={styles.forgotTitle}>Enter your code</h2>
        <p className={styles.forgotSub}>Check your email for the 6-digit code.</p>
      </div>

      {/* Dev mode: show the code on screen */}
      {generatedCode && (
        <div className={styles.devCodeBox}>
          <p className={styles.devCodeLabel}>Your reset code</p>
          <p className={styles.devCode}>{generatedCode}</p>
          <p className={styles.devCodeNote}>In production this would be emailed.</p>
        </div>
      )}

      {error && <p className={styles.formError}>{error}</p>}
      {success && <p className={styles.formSuccess}>{success}</p>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reset-code">6-digit code</label>
        <input
          id="reset-code"
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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reset-new-pw">New password</label>
        <input
          id="reset-new-pw"
          className={styles.input}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reset-confirm-pw">Confirm password</label>
        <input
          id="reset-confirm-pw"
          className={styles.input}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Updating...' : 'Set New Password'}
      </button>
    </form>
  )
}
