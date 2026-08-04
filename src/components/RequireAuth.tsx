import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthContext } from '../context/useAuthContext'

function RequireAuth() {
  const { isAuthenticated, isInitializing } = useAuthContext()
  const location = useLocation()

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Checking session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}

export default RequireAuth
