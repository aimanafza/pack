import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../utils/api.js'
import useStore from '../store/index.js'
import styles from './RegisterPage.module.css'

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser, setToken } = useStore()

  const token = searchParams.get('token')

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // No token in URL — this link is broken or was not issued
    if (!token) navigate('/', { replace: true })
  }, [token, navigate])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        invite_token: token,
      })
      setToken(data.data.token)
      setUser(data.data.user)
      navigate('/onboarding')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? 'Check your input and try again.' : detail || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.wordmark}>pack</span>
      </nav>

      <main className={styles.main}>
        <p className={styles.label}>YOU'RE INVITED</p>
        <h1 className={styles.headline}>Create your account.</h1>
        <p className={styles.subhead}>Welcome. Fill in your details to get started.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Your name"
              value={form.name}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              value={form.email}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </main>
    </div>
  )
}
