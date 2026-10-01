import { useMemo, useState } from 'react'
import { clinicApi, getStoredUser } from '../api/clinicApi'
import Icon from './Icon'

const passwordHelp = 'Minimum 8 characters with uppercase, lowercase, and a number.'

function emptyPasswordForm() {
  return {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

function emptyEmailForm() {
  return {
    newEmail: '',
    currentPassword: '',
  }
}

export default function AccountSettingsModal({ onClose, onRequireLogin }) {
  const storedUser = useMemo(() => getStoredUser(), [])
  const [mode, setMode] = useState('overview')
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm)
  const [emailForm, setEmailForm] = useState(emptyEmailForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }))
    setError('')
    setMessage('')
  }

  function updateEmailField(field, value) {
    setEmailForm((current) => ({ ...current, [field]: value }))
    setError('')
    setMessage('')
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!passwordForm.currentPassword) return setError('Current password is required.')
    if (!passwordForm.newPassword) return setError('New password is required.')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setError('Confirm password must match.')

    setSaving(true)
    try {
      const { message: responseMessage } = await clinicApi.changePassword(passwordForm)
      setMessage(responseMessage)
      setPasswordForm(emptyPasswordForm())
      window.setTimeout(onRequireLogin, 1200)
    } catch (error) {
      setError(error.message || 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!emailForm.newEmail.trim()) return setError('New email is required.')
    if (!emailForm.currentPassword) return setError('Current password is required.')

    setSaving(true)
    try {
      const { message: responseMessage } = await clinicApi.changeEmail({
        newEmail: emailForm.newEmail.trim(),
        currentPassword: emailForm.currentPassword,
      })
      setMessage(responseMessage)
      setEmailForm(emptyEmailForm())
      window.setTimeout(onRequireLogin, 1200)
    } catch (error) {
      setError(error.message || 'Unable to change email.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop account-settings-backdrop" onMouseDown={onClose}>
      <section className="visit-modal account-settings-modal" onMouseDown={(event) => event.stopPropagation()} aria-labelledby="account-settings-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close account settings">
          <Icon name="close" />
        </button>

        <p className="section-kicker">ACCOUNT SETTINGS</p>
        <h2 id="account-settings-title">ICF School Clinic</h2>
        <p className="account-role">Clinic Administrator</p>

        {error && <p className="error-banner" role="alert">{error}</p>}
        {message && <p className="success-banner" role="status">{message}</p>}

        {mode === 'overview' && (
          <div className="account-overview">
            <div className="account-email-row">
              <span>Email</span>
              <strong>{storedUser?.email || 'Not available'}</strong>
            </div>
            <button type="button" className="primary-action" onClick={() => setMode('email')}>Change Email</button>
            <button type="button" className="primary-action" onClick={() => setMode('password')}>Change Password</button>
            <button type="button" className="text-button" onClick={onRequireLogin}>Log Out</button>
          </div>
        )}

        {mode === 'password' && (
          <form className="modal-form-grid account-form" onSubmit={handlePasswordSubmit} noValidate>
            <label>Current Password
              <input type="password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} autoComplete="current-password" />
            </label>
            <label>New Password
              <input type="password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} autoComplete="new-password" />
            </label>
            <label>Confirm New Password
              <input type="password" value={passwordForm.confirmPassword} onChange={(event) => updatePasswordField('confirmPassword', event.target.value)} autoComplete="new-password" />
            </label>
            <p className="form-help">{passwordHelp}</p>
            <div className="form-submit account-form-actions">
              <button type="button" className="text-button" onClick={() => setMode('overview')}>Back</button>
              <button type="submit" className="primary-action" disabled={saving}>{saving ? 'Saving...' : 'Save Password'}</button>
            </div>
          </form>
        )}

        {mode === 'email' && (
          <form className="modal-form-grid account-form" onSubmit={handleEmailSubmit} noValidate>
            <label>Current Email
              <input value={storedUser?.email || ''} readOnly />
            </label>
            <label>New Email
              <input type="email" value={emailForm.newEmail} onChange={(event) => updateEmailField('newEmail', event.target.value)} autoComplete="email" />
            </label>
            <label>Current Password
              <input type="password" value={emailForm.currentPassword} onChange={(event) => updateEmailField('currentPassword', event.target.value)} autoComplete="current-password" />
            </label>
            <div className="form-submit account-form-actions">
              <button type="button" className="text-button" onClick={() => setMode('overview')}>Back</button>
              <button type="submit" className="primary-action" disabled={saving}>{saving ? 'Saving...' : 'Save Email'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
