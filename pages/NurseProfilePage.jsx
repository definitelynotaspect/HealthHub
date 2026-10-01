import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { getCachedValue, hasCachedValue, setCachedValue } from '../src/utils/clinicDataCache'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import NurseAvatar from '../src/components/NurseAvatar'
import ConfirmDialog from '../src/components/ConfirmDialog'
import { NURSE_PROFILE_UPDATED_EVENT } from '../src/hooks/useNurseProfileSummary'

const MAX_GALLERY_IMAGE_SIZE = 2 * 1024 * 1024
const clinicDutyDefaults = [
  'Record student clinic visits and common concerns.',
  'Monitor active cases until students are timed out.',
  'Maintain accurate student health visit history.',
  'Provide basic first aid and immediate health assistance.',
  'Monitor students recovering inside the clinic.',
  'Coordinate referrals and follow-up care when needed.',
]
const emptyProfileStats = {
  students: 0,
  visits: 0,
  active: 0,
  discharged: 0,
}

const fallbackProfile = {
  fullName: 'Curt Cuvin Gamurot',
  role: 'Clinic Nurse',
  employeeId: '2026-0630',
  shift: '8:00 AM - 5:00 PM',
  department: 'School Clinic Department',
  status: 'On duty',
  gallery: [],
  duties: clinicDutyDefaults,
  stats: emptyProfileStats,
}

function normalizeDutyList(duties) {
  if (!Array.isArray(duties)) return null

  return Array.from(new Set(
    duties
      .map((duty) => String(duty || '').trim())
      .filter(Boolean)
  ))
}

function getProfileDuties(profile) {
  const savedDuties = normalizeDutyList(profile?.duties)
  return savedDuties ?? clinicDutyDefaults
}

function createProfileForm(profile) {
  const duties = getProfileDuties(profile)

  return {
    fullName: profile?.fullName || 'Curt Cuvin Gamurot',
    role: profile?.role || 'Clinic Nurse',
    email: profile?.email || '',
    contact: profile?.contact || '',
    employeeId: profile?.employeeId || '2026-0630',
    shift: getShiftEditorValue(profile?.shift || '8:00 AM - 5:00 PM'),
    department: profile?.department || 'School Clinic Department',
    assignedRoom: profile?.assignedRoom || '',
    license: profile?.license || '',
    profileImage: profile?.profileImage || '',
    status: profile?.status || 'On duty',
    dutiesText: duties.join('\n'),
  }
}

function getShiftLines(shift) {
  const value = String(shift || '').trim()

  if (value === '8:00 AM - 5:00 PM') {
    return ['8:00 AM - 12:00 PM', '1:00 PM - 5:00 PM']
  }

  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return lines.length ? lines.slice(0, 2) : ['N/A']
}

function getShiftEditorValue(shift) {
  return getShiftLines(shift).join('\n')
}

export default function NurseProfilePage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [activeNav, setActiveNav] = useState('Nurse Profile')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState(() => getCachedValue('nurseProfile'))
  const [profileLoaded, setProfileLoaded] = useState(() => hasCachedValue('nurseProfile'))
  const [gallery, setGallery] = useState(() => getCachedValue('nurseProfile')?.gallery || [])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [fullscreenIndex, setFullscreenIndex] = useState(null)
  const [deletePhoto, setDeletePhoto] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState(() => createProfileForm(getCachedValue('nurseProfile')))
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const fileInputRef = useRef(null)
  const profilePhotoInputRef = useRef(null)
  const swipeStartX = useRef(null)

  useEffect(() => {
    let ignore = false

    async function loadProfile() {
      try {
        const { data } = await clinicApi.getNurseProfile()
        if (!ignore) {
          setProfile(setCachedValue('nurseProfile', data))
          setProfileForm(createProfileForm(data))
          setGallery(data.gallery || [])
          setProfileLoaded(true)
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load nurse profile.')
      } finally {
        if (!ignore) setProfileLoaded(true)
      }
    }

    loadProfile()
    return () => {
      ignore = true
    }
  }, [])

  const stats = useMemo(() => profile?.stats || emptyProfileStats, [profile?.stats])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Nurse Profile') onNavigate(item)
    },
    [onNavigate]
  )

  const readGalleryFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please choose image files only.'))
        return
      }

      if (file.size > MAX_GALLERY_IMAGE_SIZE) {
        reject(new Error('Please choose photos smaller than 2 MB.'))
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('A photo could not be loaded.'))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleGalleryUpload = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || [])
      if (!files.length) return

      try {
        setUploadingGallery(true)
        const images = await Promise.all(files.map(readGalleryFile))
        const savedPhotos = []

        for (const image of images) {
          const { data } = await clinicApi.uploadNurseGalleryPhoto({ image })
          savedPhotos.push(data)
        }

        setGallery((current) => {
          const nextGallery = [...savedPhotos, ...current]
          setCachedValue('nurseProfile', {
            ...(profile || fallbackProfile),
            gallery: nextGallery,
          })
          return nextGallery
        })
        setGalleryIndex(0)
        setNotice(savedPhotos.length === 1 ? 'Photo added to your clinic gallery.' : 'Photos added to your clinic gallery.')
      } catch (error) {
        setNotice(error.message || 'Unable to upload gallery photo.')
      } finally {
        setUploadingGallery(false)
        if (event.target) event.target.value = ''
      }
    },
    [profile, readGalleryFile]
  )

  const showPreviousPhoto = useCallback(() => {
    setGalleryIndex((current) => (gallery.length ? (current - 1 + gallery.length) % gallery.length : 0))
  }, [gallery.length])

  const showNextPhoto = useCallback(() => {
    setGalleryIndex((current) => (gallery.length ? (current + 1) % gallery.length : 0))
  }, [gallery.length])

  const showPreviousFullscreenPhoto = useCallback(() => {
    setFullscreenIndex((current) => {
      if (!gallery.length || current === null) return current
      return (current - 1 + gallery.length) % gallery.length
    })
  }, [gallery.length])

  const showNextFullscreenPhoto = useCallback(() => {
    setFullscreenIndex((current) => {
      if (!gallery.length || current === null) return current
      return (current + 1) % gallery.length
    })
  }, [gallery.length])

  const handleSwipeStart = useCallback((event) => {
    swipeStartX.current = event.touches?.[0]?.clientX ?? null
  }, [])

  const handleSwipeEnd = useCallback(
    (event, onPrevious, onNext) => {
      if (swipeStartX.current === null) return
      const endX = event.changedTouches?.[0]?.clientX
      const delta = Number(endX) - swipeStartX.current
      swipeStartX.current = null

      if (Math.abs(delta) < 45) return
      if (delta > 0) onPrevious()
      else onNext()
    },
    []
  )

  const handleDeleteGalleryPhoto = useCallback(
    async () => {
      if (!deletePhoto) return
      try {
        await clinicApi.deleteNurseGalleryPhoto(deletePhoto.id)
        setGallery((current) => {
          const nextGallery = current.filter((item) => item.id !== deletePhoto.id)
          setCachedValue('nurseProfile', {
            ...(profile || fallbackProfile),
            gallery: nextGallery,
          })
          return nextGallery
        })
        setFullscreenIndex(null)
        setDeletePhoto(null)
        setNotice('Photo removed from your clinic gallery.')
      } catch (error) {
        setNotice(error.message || 'Unable to delete gallery photo.')
      }
    },
    [deletePhoto, profile]
  )

  const activeGalleryIndex = gallery.length ? Math.min(galleryIndex, gallery.length - 1) : 0
  const activeGalleryPhoto = gallery[activeGalleryIndex]
  const fullscreenPhoto = fullscreenIndex !== null ? gallery[fullscreenIndex] : null
  const clinicDuties = getProfileDuties(profile)

  const openProfileEditor = useCallback(() => {
    setProfileForm(createProfileForm(profile))
    setProfileError('')
    setEditingProfile(true)
  }, [profile])

  const updateProfileField = useCallback((field, value) => {
    setProfileForm((current) => ({ ...current, [field]: value }))
    setProfileError('')
  }, [])

  const handleProfilePhotoSelect = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const image = await readGalleryFile(file)
        updateProfileField('profileImage', image)
      } catch (error) {
        setProfileError(error.message || 'Unable to load profile photo.')
      } finally {
        if (event.target) event.target.value = ''
      }
    },
    [readGalleryFile, updateProfileField]
  )

  const handleProfileSave = useCallback(
    async (event) => {
      event.preventDefault()

      const fullName = profileForm.fullName.trim()
      if (!fullName) {
        setProfileError('Full name is required.')
        return
      }

      const duties = profileForm.dutiesText
        .split('\n')
        .map((duty) => duty.trim())
        .filter(Boolean)

      setSavingProfile(true)
      try {
        const { data } = await clinicApi.updateNurseProfile({
          fullName,
          role: profileForm.role.trim(),
          email: profileForm.email.trim(),
          contact: profileForm.contact.trim(),
          employeeId: profileForm.employeeId.trim(),
          shift: profileForm.shift.trim(),
          department: profileForm.department.trim(),
          assignedRoom: profileForm.assignedRoom.trim(),
          license: profileForm.license.trim(),
          profileImage: profileForm.profileImage,
          status: profileForm.status.trim(),
          duties,
        })

        const nextProfile = {
          ...(profile || fallbackProfile),
          ...data,
          gallery,
          stats,
        }
        setCachedValue('nurseProfile', nextProfile)
        setProfile((current) => ({
          ...current,
          ...data,
          gallery: current?.gallery || gallery,
          stats: current?.stats || stats,
        }))
        setProfileForm(createProfileForm(data))
        window.dispatchEvent(new CustomEvent(NURSE_PROFILE_UPDATED_EVENT, { detail: data }))
        setEditingProfile(false)
        setNotice('Nurse profile updated.')
      } catch (error) {
        setProfileError(error.message || 'Unable to save nurse profile.')
      } finally {
        setSavingProfile(false)
      }
    },
    [gallery, profile, profileForm, stats]
  )

  const displayProfile = profile || fallbackProfile
  const profileHeading = profileLoaded ? displayProfile.fullName : 'Loading profile...'

  return (
    <div className="app-layout">
      <Sidebar
        activeNav={activeNav}
        onNavSelect={handleNavSelect}
        onSignOut={onSignOut}
        isOpen={mobileSidebarOpen}
        onClose={onCloseMobileSidebar}
      />

      <main className="main-content">
        <Topbar
          query=""
          onQueryChange={() => {}}
          onNotification={setNotice}
          onProfile={onOpenAccountSettings}
          onNavigate={onNavigate}
          onMenuClick={onOpenMobileSidebar}
          showSearch={false}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">NURSE PROFILE</p>
            <h2>{profileHeading}</h2>
            <p>Clinic nurse account profile.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-action" onClick={openProfileEditor}>
              <Icon name="clipboard" /> Edit profile
            </button>
            <button className="primary-action" onClick={() => handleNavSelect('Dashboard')}>
              <Icon name="grid" /> Back to dashboard
            </button>
          </div>
        </section>

        <section className="nurse-profile-grid">
          <div className="nurse-profile-sidebar">
            <div className="panel nurse-profile-card">
              <NurseAvatar src={displayProfile.profileImage} alt={displayProfile.fullName || 'Clinic nurse'} />
              <span className="status-pill done">{profileLoaded ? displayProfile.status || 'On duty' : 'Loading'}</span>
              <h3>{profileHeading}</h3>
              <p>{profileLoaded ? displayProfile.role || 'Clinic Nurse' : 'Please wait'}</p>
              <div className="nurse-contact-list">
                <span><Icon name="clipboard" /> Employee ID: {profileLoaded ? displayProfile.employeeId || 'N/A' : 'Loading...'}</span>
                <div className="nurse-shift">
                  <div className="nurse-shift-heading">
                    <Icon name="calendar" />
                    <span className="nurse-shift-label">Shift:</span>
                  </div>
                  <div className="nurse-shift-times">
                    {profileLoaded
                      ? getShiftLines(displayProfile.shift).map((time) => (
                        <div key={time}>{time}</div>
                      ))
                      : <div>Loading...</div>}
                  </div>
                </div>
                <span><Icon name="heart" /> {profileLoaded ? displayProfile.department || 'School Clinic Department' : 'Loading...'}</span>
              </div>
            </div>

            <section className="panel nurse-gallery-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label blue-text"><Icon name="inventory" /> CLINIC GALLERY</p>
                  <h3>Clinic photos</h3>
                </div>
              </div>

              {activeGalleryPhoto ? (
                <>
                  <div
                    className="nurse-gallery-viewer"
                    onTouchStart={handleSwipeStart}
                    onTouchEnd={(event) => handleSwipeEnd(event, showPreviousPhoto, showNextPhoto)}
                  >
                    <button
                      type="button"
                      className="gallery-photo-button"
                      onClick={() => setFullscreenIndex(activeGalleryIndex)}
                      title="View photo full screen"
                    >
                      <img src={activeGalleryPhoto.image} alt="Clinic gallery" />
                    </button>
                    {gallery.length > 1 && (
                      <>
                        <button type="button" className="gallery-nav previous" onClick={showPreviousPhoto} title="Previous photo">
                          <span aria-hidden="true">{'<'}</span>
                        </button>
                        <button type="button" className="gallery-nav next" onClick={showNextPhoto} title="Next photo">
                          <span aria-hidden="true">{'>'}</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="gallery-meta-row">
                    <span>{activeGalleryIndex + 1} of {gallery.length}</span>
                  </div>
                  {gallery.length > 1 && (
                    <div className="gallery-dots" aria-label="Clinic gallery photo selector">
                      {gallery.map((photo, index) => (
                        <button
                          type="button"
                          key={photo.id}
                          className={index === activeGalleryIndex ? 'selected' : ''}
                          onClick={() => setGalleryIndex(index)}
                          title={`Show photo ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="nurse-gallery-empty">
                  <Icon name="inventory" />
                  <span>No clinic photos yet</span>
                </div>
              )}
            </section>
          </div>

          <div className="nurse-profile-main">
            <section className="stats-grid nurse-stats" aria-label="Nurse profile statistics">
              <div className="stat-card blue">
                <span className="stat-icon"><Icon name="students" /></span>
                <div>
                  <strong>{profileLoaded ? stats.students : '...'}</strong>
                  <p>Students handled</p>
                  <small>Registered student records</small>
                </div>
              </div>
              <div className="stat-card red">
                <span className="stat-icon"><Icon name="clipboard" /></span>
                <div>
                  <strong>{profileLoaded ? stats.visits : '...'}</strong>
                  <p>Total visits</p>
                  <small>Clinic visit records</small>
                </div>
              </div>
              <div className="stat-card yellow">
                <span className="stat-icon"><Icon name="calendar" /></span>
                <div>
                  <strong>{profileLoaded ? stats.active : '...'}</strong>
                  <p>Active cases</p>
                  <small>Currently in clinic</small>
                </div>
              </div>
              <div className="stat-card green">
                <span className="stat-icon"><Icon name="heart" /></span>
                <div>
                  <strong>{profileLoaded ? stats.discharged : '...'}</strong>
                  <p>Timed out</p>
                  <small>Completed visits</small>
                </div>
              </div>
            </section>

            <section className="panel nurse-info-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label blue-text"><Icon name="clipboard" /> PROFILE DETAILS</p>
                  <h3>Nurse information</h3>
                </div>
              </div>

              <div className="nurse-detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Full name</span>
                  <span className="detail-value">{profileLoaded ? displayProfile.fullName || 'Clinic Nurse' : 'Loading...'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{profileLoaded ? displayProfile.role || 'Clinic Nurse' : 'Loading...'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{profileLoaded ? displayProfile.email || 'N/A' : 'Loading...'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Contact</span>
                  <span className="detail-value">{profileLoaded ? displayProfile.contact || 'N/A' : 'Loading...'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Assigned room</span>
                  <span className="detail-value">{profileLoaded ? displayProfile.assignedRoom || 'N/A' : 'Loading...'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">License</span>
                  <span className="detail-value">{profileLoaded ? displayProfile.license || 'N/A' : 'Loading...'}</span>
                </div>
              </div>
            </section>

            <section className="panel nurse-info-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label green-text"><Icon name="heart" /> RESPONSIBILITIES</p>
                  <h3>Clinic duties</h3>
                </div>
              </div>
              <div className="nurse-duty-list">
                {clinicDuties.length ? (
                  clinicDuties.map((duty) => (
                    <span key={duty}>{duty}</span>
                  ))
                ) : (
                  <p className="empty-state">No clinic duties listed.</p>
                )}
              </div>
            </section>
          </div>
        </section>
      </main>

      {fullscreenPhoto && (
        <div className="gallery-fullscreen" onClick={() => setFullscreenIndex(null)}>
          <button type="button" className="modal-close gallery-fullscreen-close" onClick={() => setFullscreenIndex(null)}>
            <Icon name="close" />
          </button>
          <div
            className="gallery-fullscreen-stage"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleSwipeStart}
            onTouchEnd={(event) => handleSwipeEnd(event, showPreviousFullscreenPhoto, showNextFullscreenPhoto)}
          >
            {gallery.length > 1 && (
              <button type="button" className="gallery-fullscreen-nav previous" onClick={showPreviousFullscreenPhoto} title="Previous photo">
                <span aria-hidden="true">{'<'}</span>
              </button>
            )}
            <img src={fullscreenPhoto.image} alt="Clinic gallery full screen" />
            {gallery.length > 1 && (
              <button type="button" className="gallery-fullscreen-nav next" onClick={showNextFullscreenPhoto} title="Next photo">
                <span aria-hidden="true">{'>'}</span>
              </button>
            )}
          </div>
          <div className="gallery-fullscreen-footer" onClick={(event) => event.stopPropagation()}>
            <span>{(fullscreenIndex || 0) + 1} of {gallery.length}</span>
          </div>
        </div>
      )}
      {editingProfile && (
        <div className="modal-backdrop" onMouseDown={() => !savingProfile && setEditingProfile(false)}>
          <form
            className="visit-modal nurse-profile-modal"
            onSubmit={handleProfileSave}
            onMouseDown={(event) => event.stopPropagation()}
            noValidate
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEditingProfile(false)}
              disabled={savingProfile}
              aria-label="Close edit profile"
            >
              <Icon name="close" />
            </button>
            <p className="section-kicker">EDIT PROFILE</p>
            <h2>Nurse information</h2>

            {profileError && <p className="error-banner" role="alert">{profileError}</p>}

            <div className="profile-photo-editor">
              <NurseAvatar src={profileForm.profileImage} alt={profileForm.fullName || 'Clinic nurse'} />
              <div>
                <strong>Profile photo</strong>
                <button
                  type="button"
                  className="gallery-upload-button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  disabled={savingProfile}
                  title="Upload profile photo"
                >
                  <Icon name="plus" />
                </button>
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="gallery-file-input"
                  onChange={handleProfilePhotoSelect}
                />
              </div>
            </div>

            <div className="modal-form-grid">
              <label className="form-field-full">
                Full name
                <input value={profileForm.fullName} onChange={(event) => updateProfileField('fullName', event.target.value)} required />
              </label>
              <label>
                Role
                <input value={profileForm.role} onChange={(event) => updateProfileField('role', event.target.value)} />
              </label>
              <label>
                Employee ID
                <input value={profileForm.employeeId} onChange={(event) => updateProfileField('employeeId', event.target.value)} />
              </label>
              <label>
                Shift
                <textarea className="nurse-shift-input" rows="2" value={profileForm.shift} onChange={(event) => updateProfileField('shift', event.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={profileForm.email} onChange={(event) => updateProfileField('email', event.target.value)} />
              </label>
              <label>
                Contact
                <input value={profileForm.contact} onChange={(event) => updateProfileField('contact', event.target.value)} />
              </label>
              <label className="form-field-full">
                License
                <input value={profileForm.license} onChange={(event) => updateProfileField('license', event.target.value)} />
              </label>
              <label className="form-field-full">
                Clinic duties
                <textarea
                  value={profileForm.dutiesText}
                  onChange={(event) => updateProfileField('dutiesText', event.target.value)}
                  rows={7}
                />
              </label>
            </div>

            <section className="profile-gallery-editor">
              <div className="panel-heading">
                <div>
                  <p className="panel-label blue-text"><Icon name="inventory" /> CLINIC GALLERY</p>
                  <h3>Gallery photos</h3>
                </div>
                <button
                  type="button"
                  className="gallery-upload-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingGallery || savingProfile}
                  title="Upload clinic photos"
                >
                  <Icon name="plus" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="gallery-file-input"
                  onChange={handleGalleryUpload}
                />
              </div>

              {gallery.length ? (
                <div className="profile-gallery-editor-grid">
                  {gallery.map((photo) => (
                    <div className="profile-gallery-editor-item" key={photo.id}>
                      <img src={photo.image} alt="Clinic gallery" />
                      <button
                        type="button"
                        className="gallery-photo-remove"
                        onClick={() => setDeletePhoto(photo)}
                        aria-label="Delete gallery photo"
                        title="Delete gallery photo"
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="nurse-gallery-empty"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingGallery || savingProfile}
                >
                  <Icon name="plus" />
                  <span>{uploadingGallery ? 'Uploading photo...' : 'Upload clinic photos'}</span>
                </button>
              )}
            </section>

            <div className="form-submit nurse-profile-modal-actions">
              <button type="button" className="text-button" onClick={() => setEditingProfile(false)} disabled={savingProfile}>
                Cancel
              </button>
              <button type="submit" className="primary-action" disabled={savingProfile}>
                <Icon name="clipboard" /> {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deletePhoto && (
        <ConfirmDialog
          title="Delete Photo?"
          description="Are you sure you want to remove this photo from your clinic gallery?"
          onCancel={() => setDeletePhoto(null)}
          onConfirm={handleDeleteGalleryPhoto}
        />
      )}
    </div>
  )
}
