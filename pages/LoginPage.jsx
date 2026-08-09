import { useState } from 'react'
import Icon from '../src/components/Icon.jsx'
import icfLogo from '../src/assets/images/ICF_logo.png'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    window.setTimeout(() => {
      if (email.trim() === 'interworldcolleges@clinic.com' && password === 'password123') {
        onLogin()
      } else {
        setError('Incorrect email or password. Try the demo credentials below.')
      }
      setLoading(false)
    }, 350)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <img className="institution-logo" src={icfLogo} alt="International Colleges Foundation logo" />
        <p className="eyebrow">Interworld Colleges Foundation</p>
        <h1 id="login-title">Health Hub</h1>
        <p className="auth-subtitle">Secure access to clinic operations and services</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
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
          {error && <p className="error-banner" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Log in'}</button>
        </form>
        <p className="hint">Demo: interworldcolleges@clinic.com / password123</p>
      </section>
    </main>
  )
}
