import { useState, useCallback, useEffect, useRef } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import NurseAvatar from '../src/components/NurseAvatar'

const MAX_GALLERY_IMAGE_SIZE = 2 * 1024 * 1024
const clinicDutyDefaults = [
  'Record student clinic visits and common concerns.',
  'Monitor active cases until students are timed out.',
  'Maintain accurate student health visit history.',
  'Provide basic first aid and immediate health assistance.',
  'Monitor students recovering inside the clinic.',
  'Coordinate referrals and follow-up care when needed.',
]

export default function NurseProfilePage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Nurse Profile')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState(null)
  const [gallery, setGallery] = useState([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [fullscreenIndex, setFullscreenIndex] = useState(null)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const fileInputRef = useRef(null)
  const swipeStartX = useRef(null)

  useEffect(() => {
    let ignore = false

    async function loadProfile() {
      try {
        const { data } = await clinicApi.getNurseProfile()
        if (!ignore) {
          setProfile(data)
          setGallery(data.gallery || [])
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load nurse profile.')
      }
    }

    loadProfile()
    return () => {
      ignore = true
    }
  }, [])

  const stats = profile?.stats || {
    students: 0,
    visits: 0,
    active: 0,
    discharged: 0,
  }

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

        setGallery((current) => [...savedPhotos, ...current])
        setGalleryIndex(0)
        setNotice(savedPhotos.length === 1 ? 'Photo added to your clinic gallery.' : 'Photos added to your clinic gallery.')
      } catch (error) {
        setNotice(error.message || 'Unable to upload gallery photo.')
      } finally {
        setUploadingGallery(false)
        if (event.target) event.target.value = ''
      }
    },
    [readGalleryFile]
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
    async (photo) => {
      const confirmed = window.confirm('Remove this photo from your clinic gallery?')
      if (!confirmed) return

      try {
        await clinicApi.deleteNurseGalleryPhoto(photo.id)
        setGallery((current) => current.filter((item) => item.id !== photo.id))
        setFullscreenIndex(null)
        setNotice('Photo removed from your clinic gallery.')
      } catch (error) {
        setNotice(error.message || 'Unable to delete gallery photo.')
      }
    },
    []
  )

  const activeGalleryIndex = gallery.length ? Math.min(galleryIndex, gallery.length - 1) : 0
  const activeGalleryPhoto = gallery[activeGalleryIndex]
  const fullscreenPhoto = fullscreenIndex !== null ? gallery[fullscreenIndex] : null
  const clinicDuties = Array.from(new Set([
    ...(profile?.duties || []),
    ...clinicDutyDefaults,
  ]))

  return (
    <div className="app-layout">
      <Sidebar activeNav={activeNav} onNavSelect={handleNavSelect} onSignOut={onSignOut} />

      <main className="main-content">
        <Topbar
          query=""
          onQueryChange={() => {}}
          onNotification={setNotice}
          onProfile={() => setNotice('You are already viewing the nurse profile.')}
          showSearch={false}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">NURSE PROFILE</p>
            <h2>{profile?.fullName || 'Clinic Nurse'}</h2>
            <p>Clinic nurse account profile.</p>
          </div>
          <button className="primary-action" onClick={() => handleNavSelect('Dashboard')}>
            <Icon name="grid" /> Back to dashboard
          </button>
        </section>

        <section className="nurse-profile-grid">
          <div className="nurse-profile-sidebar">
            <div className="panel nurse-profile-card">
              <NurseAvatar alt={profile?.fullName || 'Clinic nurse'} />
              <span className="status-pill done">{profile?.status || 'On duty'}</span>
              <h3>{profile?.fullName || 'Clinic Nurse'}</h3>
              <p>{profile?.role || 'Clinic Nurse'}</p>
              <div className="nurse-contact-list">
                <span><Icon name="clipboard" /> Employee ID: {profile?.employeeId || 'N/A'}</span>
                <span><Icon name="calendar" /> Shift: {profile?.shift || 'N/A'}</span>
                <span><Icon name="heart" /> {profile?.department || 'School Clinic Department'}</span>
              </div>
            </div>

            <section className="panel nurse-gallery-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label blue-text"><Icon name="inventory" /> CLINIC GALLERY</p>
                  <h3>Clinic photos</h3>
                </div>
                <button
                  type="button"
                  className="gallery-upload-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingGallery}
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
                    <button
                      type="button"
                      className="gallery-delete-button"
                      onClick={() => handleDeleteGalleryPhoto(activeGalleryPhoto)}
                    >
                      <Icon name="close" /> Delete
                    </button>
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
                <button
                  type="button"
                  className="nurse-gallery-empty"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingGallery}
                >
                  <Icon name="plus" />
                  <span>{uploadingGallery ? 'Uploading photo...' : 'Upload clinic photos'}</span>
                </button>
              )}
            </section>
          </div>

          <div className="nurse-profile-main">
            <section className="stats-grid nurse-stats" aria-label="Nurse profile statistics">
              <div className="stat-card blue">
                <span className="stat-icon"><Icon name="students" /></span>
                <div>
                  <strong>{stats.students}</strong>
                  <p>Students handled</p>
                  <small>Registered student records</small>
                </div>
              </div>
              <div className="stat-card red">
                <span className="stat-icon"><Icon name="clipboard" /></span>
                <div>
                  <strong>{stats.visits}</strong>
                  <p>Total visits</p>
                  <small>Clinic visit records</small>
                </div>
              </div>
              <div className="stat-card yellow">
                <span className="stat-icon"><Icon name="calendar" /></span>
                <div>
                  <strong>{stats.active}</strong>
                  <p>Active cases</p>
                  <small>Currently in clinic</small>
                </div>
              </div>
              <div className="stat-card green">
                <span className="stat-icon"><Icon name="heart" /></span>
                <div>
                  <strong>{stats.discharged}</strong>
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
                  <span className="detail-value">{profile?.fullName || 'Clinic Nurse'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{profile?.role || 'Clinic Nurse'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{profile?.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Contact</span>
                  <span className="detail-value">{profile?.contact || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Assigned room</span>
                  <span className="detail-value">{profile?.assignedRoom || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">License</span>
                  <span className="detail-value">{profile?.license || 'N/A'}</span>
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
                {clinicDuties.map((duty) => (
                  <span key={duty}>{duty}</span>
                ))}
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
            <button type="button" className="gallery-delete-button" onClick={() => handleDeleteGalleryPhoto(fullscreenPhoto)}>
              <Icon name="close" /> Delete photo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
