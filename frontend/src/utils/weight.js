import useStore from '../store/index.js'

// Weights are stored in grams everywhere. The user's kg or lb choice only
// changes how they're shown and typed.
const GRAMS_PER_LB = 453.592

export function useWeightUnit() {
  return useStore((s) => s.user?.weight_unit) === 'lb' ? 'lb' : 'kg'
}

// Number in the user's unit: two decimals for small amounts, one for large
export function toUnit(grams, unit) {
  const value = unit === 'lb' ? (grams || 0) / GRAMS_PER_LB : (grams || 0) / 1000
  return parseFloat(value.toFixed(Math.abs(value) < 1 ? 2 : 1))
}

export function toGrams(value, unit) {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(unit === 'lb' ? n * GRAMS_PER_LB : n * 1000)
}

// 630 -> "0.63 kg" or "1.4 lb"
export function formatWeight(grams, unit) {
  return `${toUnit(grams, unit)} ${unit}`
}
