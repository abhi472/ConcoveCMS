import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthContext } from '../context/useAuthContext'
import type { UserRole } from '../types/rbac'

type RequireRoleProps = {
  allowedRoles: UserRole[]
}

function RequireRole({ allowedRoles }: RequireRoleProps) {
  const location = useLocation()
  const { user, isInitializing, isAuthenticated } = useAuthContext()

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Checking permissions...
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
        <div className="max-w-md rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          You do not have permission to access this workspace.
        </div>
      </div>
    )
  }

  return <Outlet />
}

export default RequireRole
