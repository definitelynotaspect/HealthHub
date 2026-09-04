import { useState, useMemo, useCallback, useEffect } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { defaultMedicineInventory } from '../src/data/constants'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'

const emptyMedicineForm = {
  name: '',
  quantity: '',
  image: '',
  description: '',
  category: '',
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const medicineCategoryOptions = [
  'Fever and pain relief',
  'Colds and fever',
  'Flu and colds',
  'Pain and fever',
  'Pain, fever, and inflammation',
  'Pain relief',
  'Allergy',
  'Stomach and acidity',
  'Wound care',
  'Disinfectant',
  'General medicine',
]

function getStatus(quantity) {
  if (quantity <= 0) return 'out'
  if (quantity <= 5) return 'low'
  return 'in'
}

function getDefaultImage(name) {
  return defaultMedicineInventory.find(
    (medicine) => medicine.name.toLowerCase() === String(name).toLowerCase()
  )?.image || defaultMedicineInventory[0]?.image || ''
}

function getDefaultDescription(name) {
  return defaultMedicineInventory.find(
    (medicine) => medicine.name.toLowerCase() === String(name).toLowerCase()
  )?.description || ''
}

function getDefaultCategory(name) {
  return defaultMedicineInventory.find(
    (medicine) => medicine.name.toLowerCase() === String(name).toLowerCase()
  )?.category || 'General medicine'
}

function normalizeMedicine(medicine) {
  return {
    ...medicine,
    image: medicine.image || getDefaultImage(medicine.name),
    description: medicine.description || getDefaultDescription(medicine.name),
    category: medicine.category || getDefaultCategory(medicine.name),
  }
}

export default function MedicineInventoryPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Medicine Inventory')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedMedicineName, setSelectedMedicineName] = useState('')
  const [form, setForm] = useState(emptyMedicineForm)

  const [medicines, setMedicines] = useState([])

  useEffect(() => {
    let ignore = false

    async function loadMedicines() {
      try {
        const { data } = await clinicApi.getMedicines()
        if (!ignore) setMedicines(data.map(normalizeMedicine))
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load medicines.')
      }
    }

    loadMedicines()
    return () => {
      ignore = true
    }
  }, [])

  const categories = useMemo(() => {
    return [...new Set(medicines.map((medicine) => medicine.category || getDefaultCategory(medicine.name)))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [medicines])

  const categoryCounts = useMemo(() => {
    return medicines.reduce((counts, medicine) => {
      const category = medicine.category || getDefaultCategory(medicine.name)
      counts[category] = (counts[category] || 0) + 1
      return counts
    }, {})
  }, [medicines])

  const filteredMedicines = useMemo(() => {
    const q = query.toLowerCase()
    return medicines.filter((m) =>
      (!selectedCategory || (m.category || getDefaultCategory(m.name)) === selectedCategory) &&
      (!q.trim() ||
        [m.name, m.category, m.description].some((value) =>
          String(value || '').toLowerCase().includes(q)
        )
      )
    )
  }, [medicines, query, selectedCategory])

  const stats = useMemo(() => {
    const totalUnits = medicines.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
    const outOfStock = medicines.filter((m) => (Number(m.quantity) || 0) <= 0).length
    const lowStock = medicines.filter((m) => {
      const q = Number(m.quantity) || 0
      return q > 0 && q <= 5
    }).length
    return { total: medicines.length, totalUnits, outOfStock, lowStock }
  }, [medicines])

  const selectedMedicine = useMemo(
    () => medicines.find((medicine) => medicine.name === selectedMedicineName),
    [medicines, selectedMedicineName]
  )

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
    setForm({
      name: medicine.name,
      quantity: String(medicine.quantity),
      image: medicine.image || getDefaultImage(medicine.name),
      description: medicine.description || getDefaultDescription(medicine.name),
      category: medicine.category || getDefaultCategory(medicine.name),
    })
    setEditing(medicine)
    setSelectedMedicineName('')
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditing(null)
    setForm(emptyMedicineForm)
  }, [])

  const closeMedicineDetail = useCallback(() => {
    setSelectedMedicineName('')
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const name = form.name.trim()
      const quantity = Math.max(0, Number(form.quantity) || 0)
      const description = form.description.trim()
      const category = form.category.trim() || getDefaultCategory(name)
      const image = form.image || getDefaultImage(name)

      if (!name) {
        setNotice('Please enter a medicine name.')
        return
      }

      try {
        const payload = { name, quantity, image, description, category }

        if (editing) {
          const { data } = await clinicApi.updateMedicine(editing.id, payload)
          const nextMedicine = normalizeMedicine(data)
          setMedicines((prev) =>
            prev.map((m) => (m.id === nextMedicine.id ? nextMedicine : m))
          )
          setSelectedMedicineName((current) => (current === editing.name ? nextMedicine.name : current))
          setNotice(`${nextMedicine.name}'s stock has been updated.`)
        } else {
          const { data } = await clinicApi.createMedicine(payload)
          const nextMedicine = normalizeMedicine(data)
          setMedicines((prev) => [nextMedicine, ...prev])
          setNotice(`${nextMedicine.name} has been added to the inventory.`)
        }

        closeModal()
      } catch (error) {
        setNotice(error.message || 'Unable to save medicine.')
      }
    },
    [closeModal, editing, form]
  )

  const handleImageChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setNotice('Please choose an image file.')
      e.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setNotice('Please choose an image smaller than 2 MB.')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setForm((current) => ({ ...current, image: String(reader.result || '') }))
    }
    reader.onerror = () => setNotice('The image could not be loaded.')
    reader.readAsDataURL(file)
  }, [])

  const handleDelete = useCallback(
    async (medicine) => {
      const confirmed = window.confirm(
        `Are you sure you want to remove "${medicine.name}" from the inventory?`
      )
      if (!confirmed) return

      try {
        await clinicApi.deleteMedicine(medicine.id)
        setMedicines((prev) => prev.filter((m) => m.id !== medicine.id))
        setSelectedMedicineName((current) => (current === medicine.name ? '' : current))
        setNotice(`${medicine.name} has been removed from the inventory.`)
      } catch (error) {
        setNotice(error.message || 'Unable to remove medicine.')
      }
    },
    []
  )

  const handleAdjust = useCallback(
    async (medicine, delta) => {
      try {
        const { data } = await clinicApi.adjustMedicine(medicine.id, delta)
        const nextMedicine = normalizeMedicine(data)
        setMedicines((prev) =>
          prev.map((m) => (m.id === nextMedicine.id ? nextMedicine : m))
        )
      } catch (error) {
        setNotice(error.message || 'Unable to update stock.')
      }
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
          searchPlaceholder="Search medicine"
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

        {medicines.length > 0 && (
          <div className="history-filters">
            <div className="segmented">
              <button
                className={selectedCategory === '' ? 'selected' : ''}
                onClick={() => setSelectedCategory('')}
              >
                All ({medicines.length})
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  className={selectedCategory === category ? 'selected' : ''}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category} ({categoryCounts[category] || 0})
                </button>
              ))}
            </div>
          </div>
        )}

        <section className="history-panel panel" style={{ marginTop: '18px' }}>
          <div className="panel-heading">
            <div>
              <p className="panel-label green-text"><Icon name="inventory" /> STOCK LEVELS</p>
              <h3>
                {query || selectedCategory
                  ? `Filtered medicines (${filteredMedicines.length})`
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
              No medicines match the selected category or search.
            </p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
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
                          <button
                            type="button"
                            className="history-student medicine-open-button"
                            onClick={() => setSelectedMedicineName(medicine.name)}
                            title={`View ${medicine.name}`}
                          >
                            <span className="visit-avatar blue">
                              <img
                                src={medicine.image || getDefaultImage(medicine.name)}
                                alt=""
                                className="medicine-thumb"
                              />
                            </span>
                            <div>
                              <strong>{medicine.name}</strong>
                              <small>{medicine.description || 'No use description added yet.'}</small>
                            </div>
                          </button>
                        </td>
                        <td>
                          <span className="medicine-category-pill">
                            {medicine.category || getDefaultCategory(medicine.name)}
                          </span>
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
              <label className="form-field-full">
                Category
                <input
                  list="medicine-category-options"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Fever and pain relief"
                />
                <datalist id="medicine-category-options">
                  {medicineCategoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>
              <label className="form-field-full">
                Medicine picture
                <div className="medicine-image-upload">
                  <span className="medicine-preview">
                    {form.image ? (
                      <img src={form.image} alt="" />
                    ) : (
                      <Icon name="inventory" />
                    )}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </div>
              </label>
              <label className="form-field-full">
                What it is used for
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Used for fever, headache, or mild body pain"
                  rows="4"
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

      {selectedMedicine && (
        <div className="modal-backdrop" onClick={closeMedicineDetail}>
          <div className="visit-modal medicine-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeMedicineDetail}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">MEDICINE DETAILS</p>
            <div className="medicine-detail-hero">
              <img
                src={selectedMedicine.image || getDefaultImage(selectedMedicine.name)}
                alt=""
              />
            </div>
            <h2>{selectedMedicine.name}</h2>
            <span className="medicine-detail-category">
              {selectedMedicine.category || getDefaultCategory(selectedMedicine.name)}
            </span>
            <div className="medicine-detail-stats">
              <span>
                <small>Available stock</small>
                <strong>{Number(selectedMedicine.quantity) || 0}</strong>
              </span>
              <span>
                <small>Status</small>
                <strong>
                  {getStatus(Number(selectedMedicine.quantity) || 0) === 'out'
                    ? 'Out of stock'
                    : getStatus(Number(selectedMedicine.quantity) || 0) === 'low'
                    ? 'Low stock'
                    : 'In stock'}
                </strong>
              </span>
            </div>
            <div className="medicine-detail-description">
              <small>Used for</small>
              <p>{selectedMedicine.description || 'No use description added yet.'}</p>
            </div>
            <div className="detail-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => openEditModal(selectedMedicine)}
              >
                <Icon name="clipboard" /> Edit medicine
              </button>
              <button type="button" className="text-button" onClick={closeMedicineDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
