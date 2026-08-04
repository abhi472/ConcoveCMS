import axiosClient from './axiosClient'
import type { UserRole } from '../types/rbac'

export type ManagedUser = {
  id: string
  tenant_id: string
  email: string
  display_name: string
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

type UsersResponse = {
  data: ManagedUser[]
  pagination: { page: number; page_size: number; total: number; has_next: boolean }
}

type UserResponse = { data: ManagedUser }

export async function fetchUsers(params: {
  tenantId: string
  role?: UserRole
  status?: 'active' | 'inactive' | 'all'
  search?: string
  page?: number
  pageSize?: number
}) {
  const response = await axiosClient.get<UsersResponse>('/users', {
    params: {
      tenant_id: params.tenantId,
      role: params.role,
      status: params.status,
      search: params.search,
      page: params.page,
      page_size: params.pageSize,
    },
  })
  return response.data
}

export async function createUser(input: {
  tenantId: string
  email: string
  password: string
  displayName: string
  role: UserRole
}) {
  const response = await axiosClient.post<UserResponse>('/users', {
    tenant_id: input.tenantId,
    email: input.email,
    password: input.password,
    display_name: input.displayName,
    role: input.role,
  })
  return response.data.data
}

export async function updateUser(input: {
  tenantId: string
  userId: string
  displayName?: string
  role?: UserRole
  isActive?: boolean
}) {
  const response = await axiosClient.patch<UserResponse>(`/users/${input.userId}`, {
    tenant_id: input.tenantId,
    display_name: input.displayName,
    role: input.role,
    is_active: input.isActive,
  })
  return response.data.data
}

export async function resetUserPassword(input: { tenantId: string; userId: string; temporaryPassword: string }) {
  await axiosClient.post(`/users/${input.userId}/reset-password`, {
    tenant_id: input.tenantId,
    temporary_password: input.temporaryPassword,
  })
}
