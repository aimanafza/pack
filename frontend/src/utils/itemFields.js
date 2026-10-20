// Wardrobe item fields shared by the add-item form and the bulk upload review.
// The option lists match the backend (app/services/draft_service.py).

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory']
export const FABRICS = ['linen', 'cotton', 'silk', 'wool', 'synthetic', 'denim', 'leather', 'other']
export const FORMALITIES = ['casual', 'smart-casual', 'elevated casual', 'business casual', 'business', 'formal']
export const OCCASIONS = ['work', 'casual', 'formal', 'travel', 'dinner', 'beach', 'hiking', 'nightlife']
export const SEASONS = ['spring', 'summer', 'fall', 'winter', 'all']

// "Smart-Casual", "smart casual" and "smart-casual" all compare equal
export function normalise(val) {
  return String(val ?? '').toLowerCase().replace(/-/g, ' ').trim()
}

// The option from `list` that matches `val`, spelled the way the list spells it
export function matchOption(val, list) {
  const wanted = normalise(val)
  return list.find((option) => normalise(option) === wanted) ?? ''
}

export function filterToList(arr, list) {
  if (!Array.isArray(arr)) return []
  return [...new Set(arr.map((v) => matchOption(v, list)).filter(Boolean))]
}

export const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Short version for a card tag: what's missing, in two or three words
export function missingLabel(fields) {
  if (!fields.name?.trim()) return 'Needs a name'
  if (!fields.category) return 'Needs a category'
  if (!fields.color?.length) return 'Needs a color'
  if (!fields.fabric) return 'Needs a fabric'
  if (!fields.formality?.length) return 'Needs a dress code'
  if (!fields.occasions?.length) return 'Needs an occasion'
  if (!fields.season?.length) return 'Needs a season'
  return ''
}

// The first thing missing before an item can be saved, or '' when it's complete
export function missingField(fields) {
  if (!fields.name?.trim()) return 'Give this item a name.'
  if (!fields.category) return 'Select a category.'
  if (!fields.color?.length) return 'Add at least one color.'
  if (!fields.fabric) return 'Select a fabric.'
  if (!fields.formality?.length) return 'Select at least one formality level.'
  if (!fields.occasions?.length) return 'Select at least one occasion.'
  if (!fields.season?.length) return 'Select at least one season.'
  return ''
}
