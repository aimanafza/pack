import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/index.js'

/**
 * Wardrobe gate before planning a trip.
 *
 * Rules:
 *   - At least 1 pair of shoes
 *   - At least 1 bag
 *   - At least 1 clothing layer: either a dress OR (a top + a bottom)
 *
 * Returns: { goToNewTrip, gateOpen, missing, closeGate }
 */
export function useNewTrip() {
  const navigate = useNavigate()
  const wardrobe = useStore((s) => s.wardrobe)
  const [gateOpen, setGateOpen] = useState(false)
  const [missing, setMissing] = useState([])

  function goToNewTrip() {
    const missingItems = []

    const hasShoes = wardrobe.some((item) => item.category === 'shoes')
    const hasBag   = wardrobe.some((item) => item.category === 'bag')
    const hasDress = wardrobe.some((item) => item.category === 'dress')
    const hasTop   = wardrobe.some((item) => item.category === 'top')
    const hasBottom = wardrobe.some((item) => item.category === 'bottom')

    if (!hasShoes) missingItems.push('at least one pair of shoes')
    if (!hasBag)   missingItems.push('at least one bag')
    // Clothing: dress alone is fine, or top + bottom together
    if (!hasDress && !(hasTop && hasBottom)) {
      if (!hasTop && !hasBottom) {
        missingItems.push('at least one top and bottom (or a dress)')
      } else if (!hasTop) {
        missingItems.push('at least one top (or swap in a dress)')
      } else {
        missingItems.push('at least one bottom (or swap in a dress)')
      }
    }

    if (missingItems.length > 0) {
      setMissing(missingItems)
      setGateOpen(true)
      return
    }

    navigate('/trips/new')
  }

  function closeGate() {
    setGateOpen(false)
  }

  return { goToNewTrip, gateOpen, missing, closeGate }
}
