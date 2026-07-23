import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SyncRetryProvider from './context/SyncRetryContext'
import TenantProvider from './context/TenantContext'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <SyncRetryProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SyncRetryProvider>
      </TenantProvider>
    </QueryClientProvider>
  </StrictMode>,
)
