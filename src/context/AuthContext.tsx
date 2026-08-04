import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import {
  fetchAuthenticatedUser,
  loginWithPassword,
  logoutSession,
  refreshSessionToken,
  type AuthenticatedUser,
} from '../api/authService'
import {
  clearAuthSession,
  getRefreshToken,
  hydrateRefreshTokenFromStorage,
  setAccessToken,
  setRefreshToken,
} from '../config/authSession'
import { AuthContext } from './useAuthContext'

function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const forceClearSession = useCallback(() => {
    clearAuthSession()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const initializeSession = useCallback(async () => {
    try {
      const storedRefreshToken = hydrateRefreshTokenFromStorage()
      if (!storedRefreshToken) {
        forceClearSession()
        return
      }

      const refreshed = await refreshSessionToken(storedRefreshToken)
      setAccessToken(refreshed.access_token)
      setRefreshToken(refreshed.refresh_token)
      const profile = await fetchAuthenticatedUser(refreshed.access_token)
      setUser(profile)
    } catch {
      forceClearSession()
    } finally {
      setIsInitializing(false)
    }
  }, [forceClearSession])

  useEffect(() => {
    void initializeSession()
  }, [initializeSession])

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          forceClearSession()
        }
        return Promise.reject(error)
      },
    )

    return () => {
      axios.interceptors.response.eject(interceptorId)
    }
  }, [forceClearSession])

  const login = useCallback(async (input: { email: string; password: string }) => {
    const response = await loginWithPassword(input)
    setAccessToken(response.access_token)
    setRefreshToken(response.refresh_token)
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    try {
      if (refreshToken) {
        await logoutSession(refreshToken)
      }
    } finally {
      forceClearSession()
    }
  }, [forceClearSession])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      logout,
    }),
    [isInitializing, login, logout, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
