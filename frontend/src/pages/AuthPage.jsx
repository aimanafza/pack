import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useStore from '../store/index.js'
import LoginForm from '../components/auth/LoginForm.jsx'
import SignupForm from '../components/auth/SignupForm.jsx'
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm.jsx'
import styles from './AuthPage.module.css'

export default function AuthPage() {
  const token = useStore((s) => s.token)
  const [mode, setMode] = useState('login')
  const [resetEmail, setResetEmail] = useState('')

  if (token) return <Navigate to="/dashboard" replace />

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <p className={styles.wordmark}>PACK</p>
        <p className={styles.tagline}>Your personal stylist, in your pocket.</p>
      </div>

      <div className={styles.right}>
        <div className={styles.formWrapper}>
          {(mode === 'login' || mode === 'signup') && (
            <div className={styles.toggle}>
              <button
                className={`${styles.toggleBtn} ${mode === 'login' ? styles.active : ''}`}
                onClick={() => setMode('login')}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`${styles.toggleBtn} ${mode === 'signup' ? styles.active : ''}`}
                onClick={() => setMode('signup')}
                type="button"
              >
                Create account
              </button>
            </div>
          )}

          {mode === 'login' && (
            <LoginForm onForgotPassword={() => setMode('forgot')} />
          )}
          {mode === 'signup' && <SignupForm />}
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
