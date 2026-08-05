import { NavLink } from 'react-router-dom'
import { useTenantContext } from '../context/useTenantContext'

function Sidebar() {
  const { selectedTenantId, selectedTenantName } = useTenantContext()

  const baseLinkStyles =
    'block rounded-md px-3 py-1.5 text-sm font-medium transition-all'

  return (
    <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-800 p-4 text-slate-100">
      <div className="mb-6 border-b border-slate-700 pb-4">
        <h1 className="text-xl font-semibold text-white">ConCoveCMS</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-300">Project Badri Rai</p>
      </div>
      <nav className="space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/materials"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Materials
        </NavLink>
        <NavLink
          to="/site-materials"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Site Materials
        </NavLink>
        <NavLink
          to="/entities"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Entities
        </NavLink>
        <NavLink
          to="/equipment"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Equipment
        </NavLink>
        <NavLink
          to="/operations"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Operations
        </NavLink>
        <NavLink
          to="/site-transfers"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Site Transfers
        </NavLink>
        <NavLink
          to="/sync-monitor"
          className={({ isActive }) =>
            `${baseLinkStyles} ${
              isActive
                ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          Sync Monitor
        </NavLink>
      </nav>
      <div className="mt-auto rounded-lg bg-slate-700/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          Tenant Scope
        </p>
        <p className="mt-1 text-sm font-medium text-white">{selectedTenantName}</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-300">{selectedTenantId}</p>
      </div>
    </aside>
  )
}

export default Sidebar