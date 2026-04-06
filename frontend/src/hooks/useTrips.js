import { useState } from 'react'
import api from '../utils/api.js'
import useStore from '../store/index.js'

export function useTrips() {
  const { trips, setTrips, addTrip, removeTrip, updateTrip, setActiveTrip } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchTrips() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/api/v1/trips/')
      setTrips(data.data)
    } catch {
      setError('Failed to load trips.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTrip(id) {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/api/v1/trips/${id}`)
      setActiveTrip(data.data)
      return data.data
    } catch {
      setError('Trip not found.')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function createTrip(body) {
    const { data } = await api.post('/api/v1/trips/', body)
    addTrip(data.data)
    return data.data
  }

  async function editTrip(id, body) {
    const { data } = await api.put(`/api/v1/trips/${id}`, body)
    updateTrip(data.data)
    return data.data
  }

  async function deleteTrip(id) {
    await api.delete(`/api/v1/trips/${id}`)
    removeTrip(id)
  }

  async function checkItem(tripId, itemId, checked) {
    const { data } = await api.patch(`/api/v1/trips/${tripId}/check-item`, {
      item_id: itemId,
      checked,
    })
    updateTrip(data.data)
    setActiveTrip(data.data)
    return data.data
  }

  async function approveOutfit(tripId, outfitName) {
    const { data } = await api.patch(`/api/v1/trips/${tripId}/approve-outfit`, { outfit_name: outfitName })
    updateTrip(data.data)
    setActiveTrip(data.data)
    return data.data
  }

  async function rejectOutfit(tripId, outfitName, keptItems = []) {
    const { data } = await api.patch(`/api/v1/trips/${tripId}/reject-outfit`, {
      outfit_name: outfitName,
      kept_items: keptItems,
    })
    updateTrip(data.data)
    setActiveTrip(data.data)
    return data.data
  }

  async function restyleOutfit(tripId, body) {
    const { data } = await api.post(`/api/v1/trips/${tripId}/outfits/restyle`, body)
    return data.data  // returns the new outfit object (not the full trip)
  }

  return { trips, loading, error, fetchTrips, fetchTrip, createTrip, editTrip, deleteTrip, checkItem, approveOutfit, rejectOutfit, restyleOutfit }
}
