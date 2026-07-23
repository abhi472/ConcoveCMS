import axios from 'axios'
import { getRequiredTenantId } from '../config/tenant'

const axiosClient = axios.create({
  baseURL: import.meta.env.DEV
    ? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
    : '/api/v1',
})

axiosClient.interceptors.request.use((config) => {
  config.headers.set('X-Tenant-ID', getRequiredTenantId())

  return config
})

export default axiosClient