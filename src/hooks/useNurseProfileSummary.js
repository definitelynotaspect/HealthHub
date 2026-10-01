import { useEffect, useState } from 'react'
import { clinicApi } from '../api/clinicApi'
import { getCachedValue, hasCachedValue, setCachedValue } from '../utils/clinicDataCache'

export const NURSE_PROFILE_UPDATED_EVENT = 'clinic:nurse-profile-updated'

const fallbackProfile = {
  fullName: 'Curt Cuvin Gamurot',
  role: 'Clinic Nurse',
  profileImage: '',
}

function toSummary(profile) {
  return {
    fullName: profile?.fullName || fallbackProfile.fullName,
    role: profile?.role || fallbackProfile.role,
    profileImage: profile?.profileImage || '',
  }
}

export default function useNurseProfileSummary() {
  const [profile, setProfile] = useState(() =>
    hasCachedValue('nurseProfile') ? toSummary(getCachedValue('nurseProfile')) : fallbackProfile
  )

  useEffect(() => {
    let ignore = false

    async function loadProfile() {
      try {
        const { data } = await clinicApi.getNurseProfile()
        if (!ignore) {
          setCachedValue('nurseProfile', {
            ...(getCachedValue('nurseProfile') || {}),
            ...data,
          })
          setProfile(toSummary(data))
        }
      } catch {
        if (!ignore) setProfile(fallbackProfile)
      }
    }

    function handleProfileUpdated(event) {
      setCachedValue('nurseProfile', {
        ...(getCachedValue('nurseProfile') || {}),
        ...event.detail,
      })
      setProfile(toSummary(event.detail))
    }

    loadProfile()
    window.addEventListener(NURSE_PROFILE_UPDATED_EVENT, handleProfileUpdated)

    return () => {
      ignore = true
      window.removeEventListener(NURSE_PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [])

  return profile
}
