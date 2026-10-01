import { useState } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import Icon from '../src/components/Icon.jsx'

export default function ResetPasswordPage({ token, onComplete }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!newPassword) return setError('New password is required.')
    if (newPassword !== confirmPassword) return setError('Confirm password must match.')

    setLoading(true)
    try {
      const { message: responseMessage } = await clinicApi.resetPassword({
        token,
        newPassword,
        confirmPassword,
      })
      setMessage(responseMessage)
      window.history.replaceState(null, '', window.location.pathname)
      window.setTimeout(onComplete, 1200)
    } catch (error) {
      setError(error.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="reset-title">
        <img className="institution-logo" src="/icf logo.png?v=transparent" alt="International Colleges Foundation logo" />
        <p className="eyebrow">Interworld Colleges Foundation</p>
        <h1 id="reset-title">Health Hub</h1>
        <p className="auth-subtitle">Create a new clinic account password</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="new-password">New Password</label>
          <div className="password-wrapper">
            <input id="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} />
            </button>
          </div>
          <label htmlFor="confirm-password">Confirm New Password</label>
          <input id="confirm-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" />
          <p className="form-help">Minimum 8 characters with uppercase, lowercase, and a number.</p>
          {error && <p className="error-banner" role="alert">{error}</p>}
          {message && <p className="success-banner" role="status">{message}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Reset Password'}</button>
        </form>
      </section>
    </main>
  )
}
