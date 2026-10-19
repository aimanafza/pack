import { create } from 'zustand'

// The weight unit is remembered on this device too, so it shows correctly
// before the profile request finishes, or if that request fails.
function readCachedUnit() {
  try {
    return localStorage.getItem('pack_weight_unit') === 'lb' ? 'lb' : 'kg'
  } catch {
    return 'kg'
  }
}

function cacheUnit(unit) {
  try {
    localStorage.setItem('pack_weight_unit', unit)
  } catch {
    // Private mode or blocked storage: the in-memory value still works
  }
}

function unitFrom(user, fallback) {
  const unit = user?.weight_unit
  if (unit !== 'kg' && unit !== 'lb') return fallback
  cacheUnit(unit)
  return unit
}

const useStore = create((set, get) => ({
  // Auth slice
  user: null,
  token: localStorage.getItem('pack_token'),
  weightUnit: readCachedUnit(),
  setUser: (user) => set((s) => ({ user, weightUnit: unitFrom(user, s.weightUnit) })),
  updateUser: (updates) => set((s) => ({
    user: s.user ? { ...s.user, ...updates } : s.user,
    weightUnit: unitFrom(updates, s.weightUnit),
  })),
  setWeightUnit: (unit) => {
    cacheUnit(unit)
    set((s) => ({ weightUnit: unit, user: s.user ? { ...s.user, weight_unit: unit } : s.user }))
  },
  updatePreferences: (preferences) => set((s) => ({ user: s.user ? { ...s.user, preferences } : s.user })),
  setToken: (token) => {
    localStorage.setItem('pack_token', token)
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('pack_token')
    // The dashboard caches the carpet image URL per device; the next person shouldn't see it.
    localStorage.removeItem('pack_carpet_url')
    localStorage.removeItem('pack_weight_unit')
    set({ user: null, token: null, weightUnit: 'kg' })
  },

  // Wardrobe slice
  wardrobe: [],
  wardrobeLoading: false,
  setWardrobe: (wardrobe) => set({ wardrobe }),
  addItem: (item) => set((s) => ({ wardrobe: [item, ...s.wardrobe] })),
  removeItem: (id) => set((s) => ({ wardrobe: s.wardrobe.filter(i => i.id !== id) })),

  // Trips slice
  trips: [],
  activeTrip: null,
  tripsLoading: false,
  setTrips: (trips) => set({ trips }),
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  addTrip: (trip) => set((s) => ({ trips: [trip, ...s.trips] })),
  removeTrip: (id) => set((s) => ({ trips: s.trips.filter(t => t.id !== id) })),
  updateTrip: (updated) => set((s) => ({
    trips: s.trips.map(t => t.id === updated.id ? updated : t),
    activeTrip: s.activeTrip?.id === updated.id ? updated : s.activeTrip
  })),

  // Packing slice
  packingLoading: false,
  packingError: null,
  setPackingLoading: (v) => set({ packingLoading: v }),
  setPackingError: (e) => set({ packingError: e }),

  // Daily styling slice
  todayLook: null,
  lookHistory: [],
  dailyLoading: false,
  dailyError: null,
  setTodayLook: (look) => set({ todayLook: look }),
  setLookHistory: (history) => set({ lookHistory: history }),
  setDailyLoading: (v) => set({ dailyLoading: v }),
  setDailyError: (e) => set({ dailyError: e }),
  chooseDailyOutfit: (outfitIndex) => set((s) => ({
    todayLook: s.todayLook
      ? { ...s.todayLook, chosen_outfit_index: outfitIndex, status: 'chosen' }
      : null
  })),
}))

export default useStore
