import { useMemo, useRef, useState } from 'react'
import Icon from './Icon'

function buildSummary(summary = {}) {
  const processed = (summary.imported || 0) + (summary.updated || 0)
  return {
    total: summary.total || 0,
    valid: summary.valid ?? processed,
    duplicates: summary.duplicates || summary.duplicatesSkipped || 0,
    failed: summary.failed || summary.invalid || 0,
  }
}

function getErrorMessage(error) {
  if (!error) return 'Invalid'
  if (typeof error === 'string') return error
  return error.message || 'Invalid'
}

export default function ImportModal({
  title = 'Import Records',
  description = 'Upload a .csv, .xlsx, or .xls file and review each row before importing.',
  onClose,
  onPreview,
  onConfirm,
  onImported,
}) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [summary, setSummary] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const previewRows = preview?.rows || []
  const stats = useMemo(() => buildSummary(summary || preview?.summary), [preview, summary])
  const hasImportableRows = previewRows.some((row) => ['Valid', 'Update'].includes(row.status))

  function handleFile(nextFile) {
    if (!nextFile) return
    setFile(nextFile)
    setPreview(null)
    setSummary(null)
    setMessage('')
  }

  async function handlePreview() {
    if (!file) {
      setMessage('Please choose a .csv, .xlsx, or .xls file first.')
      return
    }

    setLoading(true)
    setMessage('')
    setSummary(null)
    try {
      const { data } = await onPreview(file)
      setPreview(data)
      setMessage(data.rows?.length ? 'Preview is ready.' : 'No importable rows were found.')
    } catch (error) {
      setMessage(error.message || 'Unable to preview this file.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!previewRows.length) return

    setLoading(true)
    setMessage('')
    try {
      const { data } = await onConfirm(previewRows, file?.name || '')
      setSummary(data.summary)
      setPreview((current) => ({ ...(current || {}), rows: data.rows || [] }))
      setMessage('Import completed.')
      await onImported?.(data.summary)
    } catch (error) {
      setMessage(error.message || 'Unable to confirm this import.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="visit-modal student-form-modal import-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <Icon name="close" />
        </button>

        <p className="section-kicker">DATA IMPORT</p>
        <h2>{title}</h2>
        <p className="import-description">{description}</p>

        <div
          className={`import-dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="import-drop-icon"><Icon name="download" /></span>
          <strong>{file ? file.name : 'Drop spreadsheet here'}</strong>
          <small>.csv, .xlsx, and .xls files are supported</small>
          <button type="button" className="text-button" onClick={() => fileInputRef.current?.click()}>
            Choose file
          </button>
        </div>

        <div className="import-summary" aria-label="Import summary">
          <span><strong>{stats.total}</strong>Total</span>
          <span><strong>{stats.valid}</strong>{summary ? 'Imported' : 'Valid'}</span>
          <span><strong>{stats.duplicates}</strong>Duplicates</span>
          <span><strong>{stats.failed}</strong>Failed</span>
        </div>

        {message && <p className="import-message">{message}</p>}

        {previewRows.length > 0 && (
          <div className="history-table-wrap import-preview-wrap">
            <table className="history-table import-preview-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Student / Patient ID</th>
                  <th>Name</th>
                  <th>Role / Department</th>
                  <th>Medicine</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={`${row.row}-${row.studentId || row.name}`}>
                    <td>{row.row}</td>
                    <td>{row.studentId || row.employeeId || 'Missing ID'}</td>
                    <td>
                      <strong>{row.name || 'Missing name'}</strong>
                    </td>
                    <td>
                      {row.role || 'No role'}
                      {row.courseDepartment ? <small>{row.courseDepartment}</small> : null}
                    </td>
                    <td>{row.medicines?.length ? row.medicines.join(' / ') : 'No medicine'}</td>
                    <td>
                      <span className={['Valid', 'Update'].includes(row.status) ? 'status-pill done' : 'concern-chip'}>
                        {row.status === 'Valid' || row.status === 'Update'
                          ? row.status
                          : row.status === 'Duplicate'
                            ? 'Duplicate row skipped'
                            : getErrorMessage(row.errors?.[0])}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="detail-actions form-field-full import-actions">
          <button type="button" className="primary-action" onClick={handlePreview} disabled={loading}>
            <Icon name="clipboard" /> {loading ? 'Checking...' : 'Preview Import'}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={handleConfirm}
            disabled={loading || !hasImportableRows}
          >
            <Icon name="plus" /> {loading ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
