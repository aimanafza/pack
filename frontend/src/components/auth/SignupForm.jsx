import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import styles from './SignupForm.module.css'

export default function SignupForm() {
  const { register, loading, error } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await register(name, email, password)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-name">Name</label>
        <input
          id="signup-name"
          className={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}
