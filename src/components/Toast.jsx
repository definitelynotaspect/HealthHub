export default function Toast({ message, onClose }) {
  if (!message) return null

  return (
    <div className="toast" role="status">
      {message}
      <button aria-label="Close" onClick={onClose}>
        ×
      </button>
    </div>
  )
}