import { useCallback, useEffect } from 'react'
import { SignInWithApple, type SignInWithAppleOptions } from '@capacitor-community/apple-sign-in'
import { Capacitor } from '@capacitor/core'
import { useAppStore } from '../stores/app'
import { api } from '../services/api'

export function useAuth() {
  const { user, isAuthenticated, setUser, setLoading, setError, reset } = useAppStore()

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      setLoading(true)
      try {
        const user = await api.auth.getCurrentUser()
        setUser(user)
      } catch {
        localStorage.removeItem('auth_token')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setLoading])

  const signIn = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const isNative = Capacitor.isNativePlatform()
      
      const options: SignInWithAppleOptions = isNative
        ? {
            clientId: 'com.crosswalk.app',
            redirectURI: '',
            scopes: 'email name',
          }
        : {
            clientId: import.meta.env.VITE_APPLE_CLIENT_ID || 'com.crosswalk.app.web',
            redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin + '/auth/callback',
            scopes: 'email name',
            state: crypto.randomUUID(),
            nonce: crypto.randomUUID(),
          }

      const response = await SignInWithApple.authorize(options)

      const user = await api.auth.signInWithApple(
        response.response.identityToken,
        response.response.authorizationCode
      )

      setUser(user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [setUser, setLoading, setError])

  const signOut = useCallback(() => {
    api.auth.signOut()
    reset()
  }, [reset])

  return {
    user,
    isAuthenticated,
    signIn,
    signOut,
  }
}
