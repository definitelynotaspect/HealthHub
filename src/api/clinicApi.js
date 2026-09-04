const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const TOKEN_KEY = 'clinicAuthToken'
const USER_KEY = 'clinicUser'
export const AUTH_EXPIRED_EVENT = 'clinic:auth-expired'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) return null

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      clearSession()
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
        detail: payload.message || 'Your session expired. Please sign in again.',
      }))
    }
    throw new Error(payload.message || 'Request failed.')
  }

  return payload
}

export const clinicApi = {
  async login(email, password) {
    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setSession(payload.token, payload.user)
    return payload
  },

  me: () => request('/auth/me'),
  getDashboardStats: () => request('/dashboard/stats'),
  getNurseProfile: () => request('/nurse-profile'),
  uploadNurseGalleryPhoto: (data) => request('/nurse-profile/gallery', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteNurseGalleryPhoto: (id) => request(`/nurse-profile/gallery/${id}`, { method: 'DELETE' }),

  getPatientRecords: (q = '') => request(`/patient-records${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  previewPatientRecordImport: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request('/patient-records/import/preview', {
      method: 'POST',
      body: formData,
    })
  },
  confirmPatientRecordImport: (rows, fileName = '') => request('/patient-records/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ rows, fileName }),
  }),
  createPatientRecord: (data) => request('/patient-records', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updatePatientRecord: (id, data) => request(`/patient-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deletePatientRecord: (id) => request(`/patient-records/${id}`, { method: 'DELETE' }),

  getVisits: (params = {}) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value)
    })
    const query = search.toString()
    return request(`/visits${query ? `?${query}` : ''}`)
  },
  createVisit: (data) => request('/visits', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateVisit: (id, data) => request(`/visits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  dischargeVisit: (id, data = {}) => request(`/visits/${id}/discharge`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteVisit: (id, { deleteOrphanPatient = false } = {}) => request(
    `/visits/${id}${deleteOrphanPatient ? '?deleteOrphanPatient=true' : ''}`,
    { method: 'DELETE' }
  ),

  getMedicines: (q = '') => request(`/medicines${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createMedicine: (data) => request('/medicines', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateMedicine: (id, data) => request(`/medicines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  adjustMedicine: (id, delta) => request(`/medicines/${id}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify({ delta }),
  }),
  deleteMedicine: (id) => request(`/medicines/${id}`, { method: 'DELETE' }),
}
