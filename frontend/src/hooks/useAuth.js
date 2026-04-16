import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api.js'
import useStore from '../store/index.js'

export function useAuth() {
  const { setUser, setToken, logout: storeLogout } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function login(email, password) {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/auth/login', { email, password })
      setToken(data.data.token)
      setUser(data.data.user)
      // Mark as returning so dashboard shows the welcome-back hero on every login
      localStorage.setItem('pack_returning', 'true')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? 'Check your input and try again.' : detail || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function register(name, email, password) {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/v1/auth/register', { name, email, password })
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

  function logout() {
    storeLogout()
    navigate('/auth')
  }

  return { login, register, logout, loading, error, setError }
}
