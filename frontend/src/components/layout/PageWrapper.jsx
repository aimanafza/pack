import Sidebar from './Sidebar.jsx'
import styles from './PageWrapper.module.css'

export default function PageWrapper({ children }) {
  return (
    <div className={styles.wrapper}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.inner}>
          {children}
        </div>
      </main>
    </div>
  )
}
