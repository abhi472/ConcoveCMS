import axios from 'axios'
import type { UserRole } from '../types/rbac'

const authClient = axios.create({
  baseURL: '/api/v1',
})

export type AuthenticatedUser = {
  user_id: string
  tenant_id: string
  tenant_name: string
  role: UserRole
  email: string
  display_name: string
}

type LoginResponse = {
  access_token: string
  refresh_token: string
  user: AuthenticatedUser
}

type RefreshResponse = {
  access_token: string
  refresh_token: string
}

export async function loginWithPassword(input: { email: string; password: string }) {
  const response = await authClient.post<LoginResponse>('/auth/login', {
    email: input.email,
    password: input.password,
  })
  return response.data
}

export async function refreshSessionToken(refreshToken: string) {
  const response = await authClient.post<RefreshResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  return response.data
}

export async function logoutSession(refreshToken: string) {
  await authClient.post('/auth/logout', {
    refresh_token: refreshToken,
  })
}

export async function fetchAuthenticatedUser(accessToken: string) {
  const response = await authClient.get<AuthenticatedUser>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return response.data
}
