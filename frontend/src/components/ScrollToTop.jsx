import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname, state } = useLocation()
  useEffect(() => {
    // Skip scroll-to-top when navigating to a trip's lookbook section directly
    if (state?.initialLook != null) return
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
