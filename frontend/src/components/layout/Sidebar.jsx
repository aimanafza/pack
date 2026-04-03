import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import useStore from '../../store/index.js'
import { useAuth } from '../../hooks/useAuth.js'
import api from '../../utils/api.js'
import styles from './Sidebar.module.css'

function IconDashboard() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function IconWardrobe() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3V2a1 1 0 0 0-2 0v1L1 7h14L9 3Z" strokeLinejoin="round" />
      <path d="M2 7v7h12V7" />
    </svg>
  )
}

function IconTrips() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5Z" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconProfile() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar() {
  const { user, token, setUser } = useStore()
  const { logout } = useAuth()

  // Restore user on refresh if token exists but user state was cleared
  useEffect(() => {
    if (token && !user) {
      api.get('/api/v1/auth/me').then(({ data }) => {
        setUser(data.data)
      }).catch(() => {})
    }
  }, [token, user, setUser])

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
    { to: '/wardrobe', label: 'Wardrobe', Icon: IconWardrobe },
    { to: '/trips', label: 'Trips', Icon: IconTrips },
    { to: '/profile', label: 'Profile', Icon: IconProfile },
  ]

  return (
    <aside className={styles.sidebar}>
      <p className={styles.wordmark}>pack</p>

      <nav className={styles.nav}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.bottom}>
        {user && (
          <>
            <p className={styles.userName}>{user.name}</p>
            <p className={styles.userEmail}>{user.email}</p>
          </>
        )}
        <button className={styles.logoutBtn} onClick={logout} type="button">
          Log out
        </button>
      </div>
    </aside>
  )
}
