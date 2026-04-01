import { useState } from 'react'
import api from '../utils/api.js'
import useStore from '../store/index.js'

export function useWardrobe() {
  const { wardrobe, setWardrobe, addItem, removeItem } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchWardrobe() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/v1/wardrobe/')
      setWardrobe(data.data)
    } catch {
      setError('Could not load your wardrobe. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteItem(id) {
    // Optimistic removal — put back on failure
    removeItem(id)
    try {
      await api.delete(`/api/v1/wardrobe/${id}`)
    } catch {
      // Re-fetch to restore correct state
      await fetchWardrobe()
      setError('Could not delete that item. Try again.')
    }
  }

  async function uploadItem(formData) {
    const { data } = await api.post('/api/v1/wardrobe/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    addItem(data.data)
    return data.data
  }

  return { wardrobe, fetchWardrobe, deleteItem, uploadItem, loading, error }
}
