import axios from 'axios'
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../config/authSession'
import { getCurrentTenantId } from '../config/tenant'

const axiosClient = axios.create({
  baseURL: '/api/v1',
})

let refreshPromise: Promise<string | null> | null = null

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access_token: string; refresh_token: string }>('/api/v1/auth/refresh', {
        refresh_token: refreshToken,
      })
      .then((response) => {
        setAccessToken(response.data.access_token)
        setRefreshToken(response.data.refresh_token)
        return response.data.access_token
      })
      .catch(() => {
        clearAuthSession()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  const tenantId = getCurrentTenantId()
  if (tenantId) {
    config.headers.set('X-Tenant-ID', tenantId)
  }

  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const originalRequest = error.config
    const status = error.response?.status
    const requestPath = originalRequest?.url ?? ''
    const isAuthEndpoint = requestPath.includes('/auth/login') || requestPath.includes('/auth/refresh')

    if (status !== 401 || !originalRequest || isAuthEndpoint || (originalRequest as { _retry?: boolean })._retry) {
      return Promise.reject(error)
    }

    ;(originalRequest as { _retry?: boolean })._retry = true

    const nextAccessToken = await refreshAccessToken()
    if (!nextAccessToken) {
      redirectToLogin()
      return Promise.reject(error)
    }

    originalRequest.headers = originalRequest.headers ?? {}
    if (originalRequest.headers && 'set' in originalRequest.headers && typeof originalRequest.headers.set === 'function') {
      originalRequest.headers.set('Authorization', `Bearer ${nextAccessToken}`)
    } else {
      ;(originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${nextAccessToken}`
    }

    return axiosClient.request(originalRequest)
  },
)

export default axiosClient