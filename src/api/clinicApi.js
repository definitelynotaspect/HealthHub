const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const TOKEN_KEY = 'clinicAuthToken'
export const USER_KEY = 'clinicUser'
const GET_CACHE_TTL = 1500
export const AUTH_EXPIRED_EVENT = 'clinic:auth-expired'
export const API_REQUEST_STARTED_EVENT = 'clinic:api-request-started'
export const API_REQUEST_FINISHED_EVENT = 'clinic:api-request-finished'

const pendingGetRequests = new Map()
const getResponseCache = new Map()

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  // Clear sessions created by earlier versions that kept users signed in after closing the site.
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  const token = getToken()
  const method = String(options.method || 'GET').toUpperCase()
  const isGetRequest = method === 'GET' && !options.body
  const cacheKey = isGetRequest ? `${token || 'guest'}:${path}` : ''

  if (isGetRequest) {
    const cached = getResponseCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < GET_CACHE_TTL) {
      return cached.payload
    }

    if (pendingGetRequests.has(cacheKey)) {
      return pendingGetRequests.get(cacheKey)
    }
  } else {
    getResponseCache.clear()
  }

  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  window.dispatchEvent(new CustomEvent(API_REQUEST_STARTED_EVENT, {
    detail: { method, path },
  }))

  const requestPromise = fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
  }).then(async (response) => {
    if (response.status === 204) return null

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401 && !['/auth/login', '/auth/forgot-password', '/auth/reset-password'].includes(path)) {
        clearSession()
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
          detail: payload.message || 'Your session expired. Please sign in again.',
        }))
      }
      throw new Error(payload.message || 'Request failed.')
    }

    if (isGetRequest) {
      getResponseCache.set(cacheKey, {
        payload,
        timestamp: Date.now(),
      })
    }

    return payload
  }).finally(() => {
    if (isGetRequest) pendingGetRequests.delete(cacheKey)
    window.dispatchEvent(new CustomEvent(API_REQUEST_FINISHED_EVENT, {
      detail: { method, path },
    }))
  })

  if (isGetRequest) pendingGetRequests.set(cacheKey, requestPromise)

  return requestPromise
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
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (data) => request('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  changeEmail: (data) => request('/auth/change-email', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  forgotPassword: (email) => request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  resetPassword: (data) => request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getDashboardStats: () => request('/dashboard/stats'),
  getNurseProfile: () => request('/nurse-profile'),
  updateNurseProfile: (data) => request('/nurse-profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
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
  importPatientRecordDocument: (files) => {
    const formData = new FormData()
    Array.from(files).slice(0, 2).forEach((file) => formData.append('files', file))
    return request('/patient-records/import/document', {
      method: 'POST',
      body: formData,
    })
  },
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
  getMedicine: (id) => request(`/medicines/${id}`),
  getMedicineTransactions: () => request('/medicines/transactions'),
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

  getNotifications: (params = {}) => {
    const search = new URLSearchParams({ _: String(Date.now()) })
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value)
    })
    return request(`/notifications?${search.toString()}`)
  },
  getUnreadNotificationCount: () => request(`/notifications/unread-count?_=${Date.now()}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
}
