import { useCallback, useEffect, useRef } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { useAppStore } from '../stores/app'
import type { Location } from '../types'

export function useLocation() {
  const { currentLocation, setLocation, setError } = useAppStore()
  const watchIdRef = useRef<string | null>(null)

  const requestPermissions = useCallback(async () => {
    try {
      const status = await Geolocation.requestPermissions()
      return status.location === 'granted'
    } catch {
      return false
    }
  }, [])

  const getCurrentPosition = useCallback(async (): Promise<Location | null> => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      })
      const location: Location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      }
      setLocation(location)
      return location
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get location'
      setError(message)
      return null
    }
  }, [setLocation, setError])

  const startWatching = useCallback(async () => {
    if (watchIdRef.current) return

    const hasPermission = await requestPermissions()
    if (!hasPermission) {
      setError('Location permission required')
      return
    }

    try {
      watchIdRef.current = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
        (position, err) => {
          if (err) {
            console.error('Location watch error:', err)
            return
          }
          if (position) {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            })
          }
        }
      )
    } catch (err) {
      console.error('Failed to start watching:', err)
    }
  }, [requestPermissions, setLocation, setError])

  const stopWatching = useCallback(async () => {
    if (watchIdRef.current) {
      await Geolocation.clearWatch({ id: watchIdRef.current })
      watchIdRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current })
      }
    }
  }, [])

  return {
    currentLocation,
    requestPermissions,
    getCurrentPosition,
    startWatching,
    stopWatching,
  }
}
