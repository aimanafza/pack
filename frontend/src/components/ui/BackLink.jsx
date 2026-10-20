import { Link } from 'react-router-dom'
import styles from './BackLink.module.css'

// The one back link used across PACK: a thin chevron and a sentence-case label.
// Pass `to` for a page link or `onClick` for a step back inside a flow; `className`
// is for the page's own spacing only.
export default function BackLink({ to, onClick, children, className = '' }) {
  const content = (
    <>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </>
  )
  const classes = `${styles.backLink} ${className}`
  return to ? (
    <Link to={to} className={classes}>{content}</Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>{content}</button>
  )
}
