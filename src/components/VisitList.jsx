import Icon from './Icon'
import { getVisitMajorComplaint } from '../utils/visitHelpers'

export default function VisitList({ visits, onSelect, onUpdate }) {
  if (!visits.length) {
    return <p className="empty-state">No matching students found.</p>
  }

  function handleUpdate(e, visit) {
    e.stopPropagation()
    onUpdate(visit)
  }

  return (
    <div className="visit-list">
      {visits.map((visit) => (
        <div
          className="visit"
          key={`${visit.name}-${visit.time || visit.timestamp}`}
          onClick={() => onSelect(`Opening record for ${visit.name}.`)}
        >
          <span className={`visit-avatar ${visit.tone}`}>{visit.initials}</span>
          <span className="visit-info">
            <strong>{visit.name}</strong>
            <small>{getVisitMajorComplaint(visit)}</small>
          </span>
          <button
            className="visit-delete"
            onClick={(e) => handleUpdate(e, visit)}
            title="Update this visit record"
          >
            <Icon name="clipboard" />
          </button>
        </div>
      ))}
    </div>
  )
}
