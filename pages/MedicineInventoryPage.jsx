import { useState, useMemo, useCallback, useEffect } from 'react'
import { defaultMedicineInventory } from '../src/data/constants'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'

const emptyMedicineForm = {
  name: '',
  quantity: '',
}

function getStatus(quantity) {
  if (quantity <= 0) return 'out'
  if (quantity <= 5) return 'low'
  return 'in'
}

export default function MedicineInventoryPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Medicine Inventory')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyMedicineForm)

  // Inventory from localStorage
  const [medicines, setMedicines] = useState(() => {
    try {
      const saved = localStorage.getItem('medicines')
      if (saved) return JSON.parse(saved)
      // Seed defaults on first run
      const seeded = defaultMedicineInventory
      localStorage.setItem('medicines', JSON.stringify(seeded))
      return seeded
    } catch {
      return defaultMedicineInventory
    }
  })

  // Save inventory to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('medicines', JSON.stringify(medicines))
  }, [medicines])

  const filteredMedicines = useMemo(() => {
    if (!query.trim()) return medicines
    const q = query.toLowerCase()
    return medicines.filter((m) => (m.name || '').toLowerCase().includes(q))
  }, [medicines, query])

  const stats = useMemo(() => {
    const totalUnits = medicines.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
    const outOfStock = medicines.filter((m) => (Number(m.quantity) || 0) <= 0).length
    const lowStock = medicines.filter((m) => {
      const q = Number(m.quantity) || 0
      return q > 0 && q <= 5
    }).length
    return { total: medicines.length, totalUnits, outOfStock, lowStock }
  }, [medicines])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Medicine Inventory') onNavigate(item)
    },
    [onNavigate]
  )

  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

  const openAddModal = useCallback(() => {
    setForm(emptyMedicineForm)
    setEditing(null)
    setShowModal(true)
  }, [])

  const openEditModal = useCallback((medicine) => {
    setForm({ name: medicine.name, quantity: String(medicine.quantity) })
    setEditing(medicine)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditing(null)
    setForm(emptyMedicineForm)
  }, [])

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const name = form.name.trim()
      const quantity = Math.max(0, Number(form.quantity) || 0)

      if (!name) {
        setNotice('Please enter a medicine name.')
        return
      }

      if (editing) {
        setMedicines((prev) =>
          prev.map((m) =>
            m.name === editing.name ? { name, quantity } : m
          )
        )
        setNotice(`${name}'s stock has been updated.`)
      } else {
        const exists = medicines.some(
          (m) => m.name.toLowerCase() === name.toLowerCase()
        )
        if (exists) {
          setNotice('That medicine is already in the inventory.')
          return
        }
        setMedicines((prev) => [{ name, quantity }, ...prev])
        setNotice(`${name} has been added to the inventory.`)
      }

      closeModal()
    },
    [closeModal, editing, form, medicines]
  )

  const handleDelete = useCallback(
    (medicine) => {
      const confirmed = window.confirm(
        `Are you sure you want to remove "${medicine.name}" from the inventory?`
      )
      if (!confirmed) return

      setMedicines((prev) => prev.filter((m) => m.name !== medicine.name))
      setNotice(`${medicine.name} has been removed from the inventory.`)
    },
    []
  )

  const handleAdjust = useCallback(
    (medicine, delta) => {
      setMedicines((prev) =>
        prev.map((m) =>
          m.name === medicine.name
            ? { ...m, quantity: Math.max(0, (Number(m.quantity) || 0) + delta) }
            : m
        )
      )
    },
    []
  )

  return (
    <div className="app-layout">
      <Sidebar activeNav={activeNav} onNavSelect={handleNavSelect} onSignOut={onSignOut} />

      <main className="main-content">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          onNotification={setNoticeSafe}
          onProfile={() => handleNavSelect('Nurse Profile')}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">MEDICINE STOCKS</p>
            <h2>Medicine Inventory</h2>
            <p>Add and manage the available stock of clinic medicines.</p>
          </div>
          <button className="primary-action" onClick={openAddModal}>
            <Icon name="plus" /> Add medicine
          </button>
        </section>

        {medicines.length > 0 && (
          <section className="stats-grid" aria-label="Medicine inventory statistics">
            <div className="stat-card blue">
              <span className="stat-icon"><Icon name="inventory" /></span>
              <div>
                <strong>{stats.total}</strong>
                <p>Total medicines</p>
                <small>Listed in the inventory</small>
              </div>
            </div>
            <div className="stat-card green">
              <span className="stat-icon"><Icon name="clipboard" /></span>
              <div>
                <strong>{stats.totalUnits}</strong>
                <p>Total stock units</p>
                <small>Available across all items</small>
              </div>
            </div>
            <div className="stat-card yellow">
              <span className="stat-icon"><Icon name="calendar" /></span>
              <div>
                <strong>{stats.lowStock}</strong>
                <p>Low stock</p>
                <small>5 units or below</small>
              </div>
            </div>
            <div className="stat-card red">
              <span className="stat-icon"><Icon name="heart" /></span>
              <div>
                <strong>{stats.outOfStock}</strong>
                <p>Out of stock</p>
                <small>Need restocking</small>
              </div>
            </div>
          </section>
        )}

        <section className="history-panel panel" style={{ marginTop: '18px' }}>
          <div className="panel-heading">
            <div>
              <p className="panel-label green-text"><Icon name="inventory" /> STOCK LEVELS</p>
              <h3>
                {query
                  ? `Search results (${filteredMedicines.length})`
                  : `All medicines (${medicines.length})`}
              </h3>
            </div>
          </div>

          {medicines.length === 0 ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
              No medicines in the inventory yet. Click <strong>Add medicine</strong> to add the first one.
            </p>
          ) : filteredMedicines.length === 0 ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
              No medicines match your search for "{query}".
            </p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Available stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => {
                    const quantity = Number(medicine.quantity) || 0
                    const status = getStatus(quantity)
                    return (
                      <tr key={medicine.name}>
                        <td>
                          <div className="history-student">
                            <span className="visit-avatar blue">
                              <Icon name="inventory" />
                            </span>
                            <div>
                              <strong>{medicine.name}</strong>
                              <small>Medicine stock</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#294366' }}>{quantity}</strong>{' '}
                          <small style={{ color: '#7d8aa0' }}>unit{quantity !== 1 ? 's' : ''}</small>
                        </td>
                        <td>
                          <span
                            className={
                              status === 'out'
                                ? 'status-pill active'
                                : status === 'low'
                                ? 'status-pill lowstock'
                                : 'status-pill done'
                            }
                          >
                            {status === 'out'
                              ? 'Out of stock'
                              : status === 'low'
                              ? `Low (${quantity})`
                              : 'In stock'}
                          </span>
                        </td>
<td>
                          <div className="table-actions">
                            <button onClick={() => handleAdjust(medicine, -1)} title="Decrease stock">
                              <Icon name="minus" />
                            </button>
                            <button onClick={() => handleAdjust(medicine, 1)} title="Increase stock">
                              <Icon name="plus" />
                            </button>
                            <button onClick={() => openEditModal(medicine)} title="Edit medicine">
                              <Icon name="clipboard" /> Edit
                            </button>
                            <button
                              className="danger-text"
                              onClick={() => handleDelete(medicine)}
                              title="Remove medicine"
                            >
                              <Icon name="close" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="visit-modal student-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">{editing ? 'EDIT MEDICINE' : 'NEW MEDICINE'}</p>
            <h2>{editing ? 'Update medicine stock' : 'Add medicine to inventory'}</h2>

            <form onSubmit={handleSubmit} className="modal-form-grid">
              <label className="form-field-full">
                Medicine name *
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Neozep"
                  required
                />
              </label>
              <label className="form-field-full">
                Available quantity
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="e.g. 10"
                />
              </label>
              <div className="detail-actions form-field-full">
                <button type="submit" className="primary-action">
                  <Icon name="plus" /> {editing ? 'Save changes' : 'Add medicine'}
                </button>
                <button type="button" className="text-button" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
