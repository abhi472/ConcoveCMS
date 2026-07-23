import axios from 'axios'
import { getRequiredTenantId } from '../config/tenant'

const axiosClient = axios.create({
  baseURL: '/api/v1',
})

axiosClient.interceptors.request.use((config) => {
  config.headers.set('X-Tenant-ID', getRequiredTenantId())

  return config
})

export default axiosClient