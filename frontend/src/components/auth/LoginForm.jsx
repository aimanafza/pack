import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import styles from './LoginForm.module.css'

export default function LoginForm({ onForgotPassword }) {
  const { login, loading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await login(email, password)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.passwordHeader}>
          <label className={styles.label} htmlFor="login-password">Password</label>
          {onForgotPassword && (
            <button
              type="button"
              className={styles.forgotLink}
              onClick={onForgotPassword}
            >
              Forgot password?
            </button>
          )}
        </div>
        <input
          id="login-password"
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
