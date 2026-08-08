import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import RequireRole from './components/RequireRole'
import AnalyticsPage from './pages/AnalyticsPage'
import Dashboard from './pages/Dashboard'
import EntitiesPage from './pages/EntitiesPage'
import EquipmentPage from './pages/EquipmentPage'
import LoginPage from './pages/LoginPage'
import MaterialsPage from './pages/MaterialsPage'
import OperationsPage from './pages/OperationsPage'
import SyncMonitorPage from './pages/SyncMonitorPage'
import SiteTransfersPage from './pages/SiteTransfersPage'
import UsersPage from './pages/UsersPage'
import type { EntityType } from './types/schema'

function LegacySiteMaterialsRedirect() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  query.delete('view')
  const suffix = query.toString()
  return <Navigate to={`/materials?view=assignments${suffix ? `&${suffix}` : ''}`} replace />
}

function entityRouteFromType(entityType: string | null) {
  const normalized = entityType?.toUpperCase()
  if (normalized === 'VENDOR') return '/vendors'
  if (normalized === 'EMPLOYEE') return '/employees'
  if (normalized === 'SUBCONTRACTOR') return '/subcontractors'
  return '/sites'
}

function LegacyEntitiesRedirect() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const targetPath = entityRouteFromType(query.get('entityType'))
  query.delete('entityType')
  const suffix = query.toString()
  return <Navigate to={`${targetPath}${suffix ? `?${suffix}` : ''}`} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="site-materials" element={<LegacySiteMaterialsRedirect />} />
          <Route path="entities" element={<LegacyEntitiesRedirect />} />
          <Route path="sites" element={<EntitiesPage forcedEntityType={'INTERNAL_SITE' satisfies EntityType} />} />
          <Route path="vendors" element={<EntitiesPage forcedEntityType={'VENDOR' satisfies EntityType} />} />
          <Route path="employees" element={<EntitiesPage forcedEntityType={'EMPLOYEE' satisfies EntityType} />} />
          <Route path="subcontractors" element={<EntitiesPage forcedEntityType={'SUBCONTRACTOR' satisfies EntityType} />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="site-transfers" element={<SiteTransfersPage />} />
          <Route path="sync-monitor" element={<SyncMonitorPage />} />
          <Route element={<RequireRole allowedRoles={['ADMIN']} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
