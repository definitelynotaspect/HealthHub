import { useEffect } from 'react'
import Icon from './Icon'

export default function ConfirmDialog({
  title,
  description,
  warning = 'This action cannot be easily undone.',
  confirmLabel = 'Delete',
  loadingLabel = 'Processing...',
  loading = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [loading, onCancel])

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div
        className="visit-modal confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onCancel} disabled={loading} aria-label="Close">
          <Icon name="close" />
        </button>
        <p className="section-kicker">CONFIRM ACTION</p>
        <h2 id="confirmation-dialog-title">{title}</h2>
        <p className="confirmation-description">{description}</p>
        <p className="confirmation-warning">{warning}</p>
        <div className="confirmation-actions">
          <button type="button" className="text-button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="primary-action danger-action" onClick={onConfirm} disabled={loading}>
            <Icon name="close" /> {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
