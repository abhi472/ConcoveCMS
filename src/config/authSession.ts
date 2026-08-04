const REFRESH_TOKEN_STORAGE_KEY = 'concove.auth.refresh'

let currentAccessToken = ''
let currentRefreshToken = ''

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function getRefreshTokenStorageKey() {
  return REFRESH_TOKEN_STORAGE_KEY
}

export function getAccessToken() {
  return currentAccessToken
}

export function setAccessToken(token: string) {
  currentAccessToken = token.trim()
}

export function getRefreshToken() {
  return currentRefreshToken
}

export function setRefreshToken(token: string) {
  const normalized = token.trim()
  currentRefreshToken = normalized

  if (!canUseStorage()) return
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, normalized)
}

export function hydrateRefreshTokenFromStorage() {
  if (!canUseStorage()) return ''
  const token = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)?.trim() ?? ''
  currentRefreshToken = token
  return token
}

export function clearAuthSession() {
  currentAccessToken = ''
  currentRefreshToken = ''

  if (!canUseStorage()) return
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
}
