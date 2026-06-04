import api from '../utils/api'
import useStore from '../store'

export function useDailyStyling() {
  const { setTodayLook, setLookHistory, setDailyLoading, setDailyError } = useStore()

  const getLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    )
  })

  const checkToday = async () => {
    try {
      const res = await api.get('/api/v1/daily/today')
      if (res.data.data) setTodayLook(res.data.data)
    } catch (_) {}
  }

  const generateLook = async ({ occasion, mood, vibe, context_note, lat, lon, anchor_items, inspiration_image_urls }) => {
    setDailyLoading(true)
    setDailyError(null)
    try {
      const res = await api.post('/api/v1/daily/generate', {
        occasion,
        mood,
        vibe,
        context_note: context_note || null,
        lat,
        lon,
        anchor_items: anchor_items || [],
        inspiration_image_urls: inspiration_image_urls || [],
      })
      setTodayLook(res.data.data)
      return res.data.data
    } catch (err) {
      setDailyError(err.response?.data?.message || 'Something went wrong')
      throw err
    } finally {
      setDailyLoading(false)
    }
  }

  const chooseOutfit = async (lookId, outfitIndex) => {
    const res = await api.post(`/api/v1/daily/${lookId}/choose`, { outfit_index: outfitIndex })
    setTodayLook(res.data.data)
    return res.data.data
  }

  const fetchHistory = async (limit = 20, offset = 0) => {
    const res = await api.get(`/api/v1/daily/history?limit=${limit}&offset=${offset}`)
    setLookHistory(res.data.data)
  }

  return { checkToday, generateLook, chooseOutfit, fetchHistory, getLocation }
}
