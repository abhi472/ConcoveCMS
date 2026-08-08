import { useEffect, useMemo, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { useAuthContext } from '../context/useAuthContext'
import { useTenantContext } from '../context/useTenantContext'

type SidebarProps = {
  onNavigate?: () => void
  variant?: 'desktop' | 'mobile'
}

function Sidebar({ onNavigate, variant = 'desktop' }: SidebarProps) {
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const { user, logout } = useAuthContext()
  const queryClient = useQueryClient()
  const fetchingCount = useIsFetching()
  const [isCollapsed, setIsCollapsed] = useState(() => window.localStorage.getItem('concove.nav.collapsed') === '1')
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(() => window.localStorage.getItem('concove.nav.directory.open') !== '0')

  useEffect(() => {
    window.localStorage.setItem('concove.nav.collapsed', isCollapsed ? '1' : '0')
  }, [isCollapsed])

  useEffect(() => {
    window.localStorage.setItem('concove.nav.directory.open', isDirectoryOpen ? '1' : '0')
  }, [isDirectoryOpen])

  const tenantQueries = queryClient.getQueryCache().findAll({
    predicate: (query) => selectedTenantId ? query.queryKey.includes(selectedTenantId) : false,
  })
  const hasQueryError = tenantQueries.some((query) => query.state.status === 'error')

  const navItems = useMemo(
    () => [
      { to: '/', label: 'Dashboard', short: 'DB', end: true },
      { to: '/analytics', label: 'Analytics', short: 'AN' },
      { to: '/materials', label: 'Materials', short: 'MT' },
      { to: '/equipment', label: 'Equipment', short: 'EQ' },
      { to: '/operations', label: 'Operations', short: 'OP' },
      { to: '/site-transfers', label: 'Site Transfers', short: 'ST' },
      { to: '/sync-monitor', label: 'Sync Monitor', short: 'SY' },
      { to: '/users', label: 'Users', short: 'US', visible: user?.role === 'ADMIN' },
    ],
    [user?.role],
  )

  const baseLinkStyles =
    'flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all'
  const canAccessDirectory = user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER'
  const directoryItems = [
    { to: '/sites', label: 'Sites', short: 'SI' },
    { to: '/vendors', label: 'Vendors', short: 'VE' },
    { to: '/employees', label: 'Employees', short: 'EM' },
    { to: '/subcontractors', label: 'Subcontractors', short: 'SC' },
  ]
  const isMobile = variant === 'mobile'

  return (
    <aside className={`flex h-full flex-col border-r border-slate-800 bg-slate-800 p-3 text-slate-100 transition-all duration-150 ${isCollapsed && !isMobile ? 'w-20' : 'w-72'}`}>
      <div className="mb-3 border-b border-slate-700 pb-3">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          {isCollapsed && !isMobile ? (
            <span className="text-sm font-semibold text-white">CC</span>
          ) : (
            <div>
              <h1 className="text-lg font-semibold text-white">ConCoveCMS</h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Project Badri Rai</p>
            </div>
          )}
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={() => setIsCollapsed((value) => !value)}
            className={`${isMobile ? 'rounded-md border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700' : 'rounded-md border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700'}`}
          >
            {isCollapsed && !isMobile ? '>' : '<'}
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-md border border-slate-700 bg-slate-700/50 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${hasQueryError ? 'bg-rose-400' : fetchingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {!isCollapsed ? (
            <span className="text-xs font-medium text-slate-200">
              {hasQueryError ? 'API attention needed' : fetchingCount > 0 ? 'Refreshing data' : 'API connected'}
            </span>
          ) : null}
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.filter((item) => item.visible !== false).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `${baseLinkStyles} ${
                isActive
                  ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-200 hover:bg-slate-700 hover:text-white'
              } ${isCollapsed ? 'justify-center px-2' : ''}`
            }
            title={item.label}
          >
            {isCollapsed ? item.short : item.label}
          </NavLink>
        ))}

        {canAccessDirectory ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsDirectoryOpen((value) => !value)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-700 ${isCollapsed ? 'text-center' : ''}`}
              title="Directory"
            >
              {isCollapsed ? 'DIR' : `Directory ${isDirectoryOpen ? '−' : '+'}`}
            </button>
            {(isDirectoryOpen || isCollapsed) ? (
              <div className="mt-1 space-y-1">
                {directoryItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `${baseLinkStyles} ${
                        isActive
                          ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                          : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                      } ${isCollapsed ? 'justify-center px-2 text-[11px]' : 'pl-5'}`
                    }
                    title={item.label}
                  >
                    {isCollapsed ? item.short : item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>

      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-700/60 p-2.5">
        {!isCollapsed ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Tenant
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">{selectedTenantName}</p>
            <p className="mt-1 truncate text-xs text-slate-300">{user?.display_name ?? 'User'}</p>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => { void logout() }}
          className={`mt-2 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-700 ${isCollapsed ? 'text-[11px]' : ''}`}
          title="Logout"
        >
          {isCollapsed ? 'Out' : 'Logout'}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar