import { useState } from 'react'
import api from '../utils/api.js'
import useStore from '../store/index.js'

export function useWardrobe() {
  const { wardrobe, setWardrobe, addItem, removeItem, removeItems, updateItems } = useStore()
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

  // Bulk actions update the screen first and reload the wardrobe if the server says no.
  // They return true on success so the page can confirm what happened.
  async function deleteItems(ids) {
    removeItems(ids)
    try {
      await api.post('/api/v1/wardrobe/bulk-delete', { item_ids: ids })
      return true
    } catch {
      await fetchWardrobe()
      return false
    }
  }

  async function moveItems(ids, category) {
    updateItems(ids, { category })
    try {
      await api.patch('/api/v1/wardrobe/bulk-category', { item_ids: ids, category })
      return true
    } catch {
      await fetchWardrobe()
      return false
    }
  }

  async function uploadItem(formData) {
    const { data } = await api.post('/api/v1/wardrobe/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    addItem(data.data)
    return data.data
  }

  return { wardrobe, fetchWardrobe, deleteItem, deleteItems, moveItems, uploadItem, loading, error }
}
