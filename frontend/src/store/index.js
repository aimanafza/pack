import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Auth slice
  user: null,
  token: localStorage.getItem('pack_token'),
  setUser: (user) => set({ user }),
  updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : s.user })),
  updatePreferences: (preferences) => set((s) => ({ user: s.user ? { ...s.user, preferences } : s.user })),
  setToken: (token) => {
    localStorage.setItem('pack_token', token)
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('pack_token')
    set({ user: null, token: null })
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
}))

export default useStore
