import { useState } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import Icon from '../src/components/Icon.jsx'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function LoginPage({ onLogin, variant = 'page', onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Email is required.')
      return
    }
    if (!isValidEmail(cleanEmail)) {
      setError('Enter a valid email address.')
      return
    }

    if (forgotMode) {
      setLoading(true)
      try {
        const { message } = await clinicApi.forgotPassword(cleanEmail)
        setSuccess(message)
      } catch (error) {
        setError(error.message || 'Unable to send password reset instructions.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!password) {
      setError('Password is required.')
      return
    }

    setLoading(true)

    try {
      const { user } = await clinicApi.login(cleanEmail, password)
      onLogin(user)
    } catch (error) {
      setError(error.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  function toggleForgotMode() {
    setForgotMode((current) => !current)
    setPassword('')
    setError('')
    setSuccess('')
  }

  return (
    <main className={variant === 'modal' ? 'auth-shell auth-shell-modal' : 'auth-shell'}>
      <section className="auth-card" aria-labelledby="login-title">
        {variant === 'modal' && (
          <button
            className="auth-close"
            type="button"
            aria-label="Close login"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        )}
        <img className="institution-logo" src="/icf logo.png?v=transparent" alt="International Colleges Foundation logo" />
        <p className="eyebrow">Interworld Colleges Foundation</p>
        <h1 id="login-title">Health Hub</h1>
        <p className="auth-subtitle">Secure access to clinic operations and services</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          {!forgotMode && (
            <>
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </>
          )}
          {error && <p className="error-banner" role="alert">{error}</p>}
          {success && <p className="success-banner" role="status">{success}</p>}
          <button type="submit" disabled={loading}>
            {loading ? (forgotMode ? 'Sending...' : 'Signing in...') : (forgotMode ? 'Send reset link' : 'Log in')}
          </button>
        </form>
        <button type="button" className="auth-link-button" onClick={toggleForgotMode}>
          {forgotMode ? 'Back to log in' : 'Forgot Password?'}
        </button>
      </section>
    </main>
  )
}
