import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useStore from '../store/index.js'
import LoginForm from '../components/auth/LoginForm.jsx'
import SignupForm from '../components/auth/SignupForm.jsx'
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm.jsx'
import styles from './AuthPage.module.css'

export default function AuthPage() {
  const token = useStore((s) => s.token)
  const [mode, setMode] = useState('login') // signup removed — invite-only via /register?token=
  const [resetEmail, setResetEmail] = useState('')

  if (token) return <Navigate to="/dashboard" replace />

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <p className={styles.wordmark}>pack</p>
        <p className={styles.tagline}>Your personal stylist, in your pocket.</p>
      </div>

      <div className={styles.right}>
        <div className={styles.formWrapper}>
          {mode === 'login' && (
            <LoginForm onForgotPassword={() => setMode('forgot')} />
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <ForgotPasswordForm
              initialMode={mode}
              initialEmail={resetEmail}
              onEmailSet={setResetEmail}
              onBack={() => setMode('login')}
              onDone={() => setMode('login')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
