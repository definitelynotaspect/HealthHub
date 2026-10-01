export default function LoadingOverlay({ message = 'Loading...', blocking = true }) {
  return (
    <div
      className={blocking ? 'loading-overlay' : 'loading-overlay non-blocking'}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="loading-card">
        <span className="loading-spinner" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  )
}
