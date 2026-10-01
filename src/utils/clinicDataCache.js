const clinicDataCache = {
  visits: null,
  patientRecords: null,
  medicines: null,
  medicineTransactions: null,
  nurseProfile: null,
}

export function getCachedArray(key) {
  return Array.isArray(clinicDataCache[key]) ? clinicDataCache[key] : []
}

export function hasCachedArray(key) {
  return Array.isArray(clinicDataCache[key])
}

export function setCachedArray(key, value) {
  clinicDataCache[key] = Array.isArray(value) ? value : []
  return clinicDataCache[key]
}

export function getCachedValue(key) {
  return clinicDataCache[key] ?? null
}

export function hasCachedValue(key) {
  return clinicDataCache[key] !== null && clinicDataCache[key] !== undefined
}

export function setCachedValue(key, value) {
  clinicDataCache[key] = value ?? null
  return clinicDataCache[key]
}
