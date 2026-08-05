import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
  type ManagedUser,
} from '../api/usersService'
import { useTenantContext } from '../context/useTenantContext'
import { USER_ROLES, type UserRole } from '../types/rbac'

const initialCreateForm = {
  email: '',
  password: '',
  displayName: '',
  role: 'VIEWER' as UserRole,
}

function UsersPage() {
  const queryClient = useQueryClient()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const deferredSearch = useDeferredValue(search)
  const queryKey = useMemo(
    () => ['users', selectedTenantId, roleFilter || 'all', status, deferredSearch] as const,
    [deferredSearch, roleFilter, selectedTenantId, status],
  )

  const usersQuery = useQuery({
    queryKey,
    queryFn: () => fetchUsers({
      tenantId: selectedTenantId,
      role: roleFilter || undefined,
      status,
      search: deferredSearch,
      pageSize: 100,
    }),
    placeholderData: (prev) => prev,
  })

  const invalidateUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ['users', selectedTenantId] })
  }

  const createMutation = useMutation({
    mutationFn: () => createUser({
      tenantId: selectedTenantId,
      email: createForm.email,
      password: createForm.password,
      displayName: createForm.displayName,
      role: createForm.role,
    }),
    onSuccess: async (created) => {
      setFeedback({ kind: 'success', message: `${created.email} created.` })
      setCreateForm(initialCreateForm)
      await invalidateUsers()
    },
    onError: (error) => {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Failed to create user.' })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (user: ManagedUser) => updateUser({
      tenantId: selectedTenantId,
      userId: user.id,
      isActive: !user.is_active,
    }),
    onSuccess: async (updated) => {
      setFeedback({ kind: 'success', message: `${updated.email} ${updated.is_active ? 'activated' : 'deactivated'}.` })
      await invalidateUsers()
    },
    onError: (error) => {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Failed to update user status.' })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => {
      if (!resetTarget) throw new Error('No user selected for reset.')
      return resetUserPassword({
        tenantId: selectedTenantId,
        userId: resetTarget.id,
        temporaryPassword,
      })
    },
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Temporary password set and existing sessions revoked.' })
      setResetTarget(null)
      setTemporaryPassword('')
      await invalidateUsers()
    },
    onError: (error) => {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Failed to reset password.' })
    },
  })

  const users = usersQuery.data?.data ?? []

  return (
    <section className="space-y-4">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Users & Roles</h2>
          <p className="mt-1 text-sm text-slate-600">Admin-controlled tenant user access and role assignment.</p>
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{selectedTenantName}</span>
      </header>

      {feedback ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Create User</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <input
            type="email"
            placeholder="email"
            value={createForm.email}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="display name"
            value={createForm.displayName}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="password"
            placeholder="temporary password"
            value={createForm.password}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <select
            value={createForm.role}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Create
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-y border-slate-200 bg-white px-4 py-3 md:grid-cols-[minmax(14rem,1fr)_10rem_10rem]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email or name"
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as 'active' | 'inactive' | 'all')}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersQuery.isLoading ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>No users found.</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{user.display_name}</div>
                  <div className="font-mono text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{user.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate(user)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setResetTarget(user); setTemporaryPassword('') }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTarget ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-800">Reset Password</h3>
            <p className="mt-1 text-xs text-slate-600">Set a temporary password for {resetTarget.email}.</p>
            <input
              type="password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              placeholder="Temporary password"
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resetPasswordMutation.mutate()}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default UsersPage
