import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import EntitiesPage from './pages/EntitiesPage'
import MaterialsPage from './pages/MaterialsPage'
import OperationsPage from './pages/OperationsPage'
import SyncMonitorPage from './pages/SyncMonitorPage'
import SiteMaterialsPage from './pages/SiteMaterialsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="site-materials" element={<SiteMaterialsPage />} />
        <Route path="entities" element={<EntitiesPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="sync-monitor" element={<SyncMonitorPage />} />
      </Route>
    </Routes>
  )
}

export default App
