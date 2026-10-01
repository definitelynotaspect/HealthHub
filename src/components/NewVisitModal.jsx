import { yearLevelOptions } from '../data/constants'
import Icon from './Icon'

export default function NewVisitModal({ form, onFormChange, onClose, onSubmit }) {
  function handleChange(field, value) {
    onFormChange({ ...form, [field]: value })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="visit-modal"
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>

        <p className="section-kicker">NEW VISIT</p>
        <h2>Record clinic visit</h2>

        <div className="modal-form-grid">
          <label>
            Student Name
            <input
              autoFocus
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
            />
          </label>
          <label>
            Student ID
            <input
              value={form.studentId}
              onChange={(e) => handleChange('studentId', e.target.value)}
              placeholder="e.g. 2024-0001"
            />
          </label>
          <label>
            Course
            <input
              value={form.course}
              onChange={(e) => handleChange('course', e.target.value)}
              placeholder="e.g. BS Computer Science"
            />
          </label>
          <label>
            Year Level
            <select
              value={form.yearLevel}
              onChange={(e) => handleChange('yearLevel', e.target.value)}
            >
              {yearLevelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Section/Block
            <input
              value={form.section}
              onChange={(e) => handleChange('section', e.target.value)}
              placeholder="e.g. Block A"
            />
          </label>
          <label>
            Date and Time of Visit
            <input
              type="datetime-local"
              value={form.dateTime}
              onChange={(e) => handleChange('dateTime', e.target.value)}
            />
          </label>
        </div>

        <label>
          Signs and symptoms / major complaint
          <input
            value={form.signsSymptoms || ''}
            onChange={(e) => handleChange('signsSymptoms', e.target.value)}
            placeholder="e.g. Headache, fever, stomach pain"
          />
        </label>

        <button className="primary-action" type="submit">
          <Icon name="plus" /> Save visit
        </button>
      </form>
    </div>
  )
}
