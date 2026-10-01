import { useState, useMemo, useCallback, useEffect } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { defaultMedicineInventory } from '../src/data/constants'
import { getCachedArray, hasCachedArray, setCachedArray } from '../src/utils/clinicDataCache'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import ConfirmDialog from '../src/components/ConfirmDialog'
import LoadingOverlay from '../src/components/LoadingOverlay'

const MEDICINE_CATEGORIES = [
  'Pain & Fever',
  'Respiratory',
  'Gastrointestinal',
  'Cardiovascular',
  'Allergy',
  'General',
]

const OLD_CATEGORY_MAP = {
  'Fever and pain relief': 'Pain & Fever',
  'Pain and fever': 'Pain & Fever',
  'Pain, fever, and inflammation': 'Pain & Fever',
  'Pain relief': 'Pain & Fever',

  'Colds and fever': 'Respiratory',
  'Flu and colds': 'Respiratory',

  'Stomach and acidity': 'Gastrointestinal',

  'Allergy': 'Allergy',

  'Wound care': 'General',
  'Disinfectant': 'General',
  'General medicine': 'General',
}

const emptyMedicineForm = {
  name: '',
  quantity: '',
  image: '',
  description: '',
  category: '',
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024

function normalizeCategory(category) {
  const value = String(category || '').trim()

  if (!value) return 'General'

  if (MEDICINE_CATEGORIES.includes(value)) {
    return value
  }

  return OLD_CATEGORY_MAP[value] || 'General'
}

function getStatus(quantity) {
  if (quantity <= 0) return 'out'
  if (quantity <= 10) return 'low'
  return 'in'
}

function getDefaultImage(name) {
  return (
    defaultMedicineInventory.find(
      (medicine) =>
        medicine.name.toLowerCase() === String(name).toLowerCase()
    )?.image ||
    defaultMedicineInventory[0]?.image ||
    ''
  )
}

function getDefaultDescription(name) {
  return (
    defaultMedicineInventory.find(
      (medicine) =>
        medicine.name.toLowerCase() === String(name).toLowerCase()
    )?.description || ''
  )
}

function getDefaultCategory(name) {
  const category =
    defaultMedicineInventory.find(
      (medicine) =>
        medicine.name.toLowerCase() === String(name).toLowerCase()
    )?.category || 'General'

  return normalizeCategory(category)
}

function normalizeMedicine(medicine) {
  const category =
    medicine.category ||
    getDefaultCategory(medicine.name)

  return {
    ...medicine,
    image: medicine.image || getDefaultImage(medicine.name),
    description:
      medicine.description || getDefaultDescription(medicine.name),
    category: normalizeCategory(category),
  }
}

function formatTransactionDate(value) {
  const date = new Date(String(value || '').replace(' ', 'T'))

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function MedicineTableSkeleton() {
  return (
    <div className="history-table-wrap table-skeleton" aria-label="Loading medicines">
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
          {Array.from({ length: 5 }, (_, index) => (
            <tr className="skeleton-table-row" key={index}>
              <td>
                <div className="history-student">
                  <span className="visit-avatar skeleton-block skeleton-avatar" />
                  <div>
                    <span className="skeleton-block skeleton-line wide" />
                    <span className="skeleton-block skeleton-line medium" />
                  </div>
                </div>
              </td>
              <td><span className="skeleton-block skeleton-pill" /></td>
              <td><span className="skeleton-block skeleton-line short" /></td>
              <td><span className="skeleton-block skeleton-pill" /></td>
              <td><span className="skeleton-block skeleton-line medium" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MedicineInventoryPage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [activeNav, setActiveNav] = useState('Medicine Inventory')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteMedicine, setDeleteMedicine] = useState(null)
  const [selectedMedicineName, setSelectedMedicineName] = useState('')
  const [medicineDetailLoading, setMedicineDetailLoading] = useState(false)
  const [isMedicineSaving, setIsMedicineSaving] = useState(false)
  const [isMedicineDeleting, setIsMedicineDeleting] = useState(false)
  const [form, setForm] = useState(emptyMedicineForm)

  const [medicines, setMedicines] = useState(() =>
    getCachedArray('medicines').map(normalizeMedicine)
  )
  const [transactions, setTransactions] = useState(() => getCachedArray('medicineTransactions'))
  const [inventoryLoaded, setInventoryLoaded] = useState(() => hasCachedArray('medicines'))
  const [inventoryLoading, setInventoryLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadInventory() {
      setInventoryLoading(true)
      try {
        const [
          { data: medicineData },
          transactionResult,
        ] = await Promise.all([
          clinicApi.getMedicines(),
          clinicApi
            .getMedicineTransactions()
            .catch(() => ({ data: [] })),
        ])

        if (!ignore) {
          setMedicines(setCachedArray('medicines', medicineData).map(normalizeMedicine))

          setTransactions(setCachedArray('medicineTransactions', transactionResult.data || []))
          setInventoryLoaded(true)
        }
      } catch (error) {
        if (!ignore) {
          setNotice(
            error.message || 'Unable to load medicines.'
          )
        }
      } finally {
        if (!ignore) {
          setInventoryLoaded(true)
          setInventoryLoading(false)
        }
      }
    }

    loadInventory()

    return () => {
      ignore = true
    }
  }, [])

  const refreshTransactions = useCallback(async () => {
    const { data } = await clinicApi.getMedicineTransactions()
    setTransactions(setCachedArray('medicineTransactions', data || []))
  }, [])

  /*
   * FIXED CATEGORY LIST
   *
   * This no longer creates a category button for every unique
   * database value. All medicines are normalized into the
   * six categories above.
   */
  const categoryCounts = useMemo(() => {
    return medicines.reduce((counts, medicine) => {
      const category = normalizeCategory(
        medicine.category || getDefaultCategory(medicine.name)
      )

      counts[category] = (counts[category] || 0) + 1

      return counts
    }, {})
  }, [medicines])

  const filteredMedicines = useMemo(() => {
    const q = query.trim().toLowerCase()

    return medicines.filter((medicine) => {
      const category = normalizeCategory(
        medicine.category || getDefaultCategory(medicine.name)
      )

      const matchesCategory =
        !selectedCategory ||
        category === selectedCategory

      const searchableText = [
        medicine.name,
        category,
        medicine.category,
        medicine.description,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')

      const matchesSearch =
        !q || searchableText.includes(q)

      return matchesCategory && matchesSearch
    })
  }, [medicines, query, selectedCategory])

  const stats = useMemo(() => {
    const totalUnits = medicines.reduce(
      (sum, medicine) =>
        sum + (Number(medicine.quantity) || 0),
      0
    )

    const outOfStock = medicines.filter(
      (medicine) =>
        (Number(medicine.quantity) || 0) <= 0
    ).length

    const lowStock = medicines.filter((medicine) => {
      const quantity = Number(medicine.quantity) || 0

      return quantity > 0 && quantity <= 10
    }).length

    return {
      total: medicines.length,
      totalUnits,
      outOfStock,
      lowStock,
    }
  }, [medicines])

  const selectedMedicine = useMemo(
    () =>
      medicines.find(
        (medicine) =>
          String(medicine.id) === String(selectedMedicineName) ||
          medicine.name === selectedMedicineName
      ),
    [medicines, selectedMedicineName]
  )

  const loadMedicineDetail = useCallback(async (medicine) => {
    if (!medicine?.id || medicine.imageLoaded || !medicine.hasImage) return medicine

    setMedicineDetailLoading(true)
    try {
      const { data } = await clinicApi.getMedicine(medicine.id)
      const nextMedicine = normalizeMedicine(data)
      setMedicines((previous) =>
        previous.map((item) =>
          item.id === nextMedicine.id ? nextMedicine : item
        )
      )
      return nextMedicine
    } catch (error) {
      setNotice(error.message || 'Unable to load medicine details.')
      return medicine
    } finally {
      setMedicineDetailLoading(false)
    }
  }, [])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)

      if (item !== 'Medicine Inventory') {
        onNavigate(item)
      }
    },
    [onNavigate]
  )

  const setNoticeSafe = useCallback(
    (message) => setNotice(message),
    []
  )

  const openAddModal = useCallback(() => {
    setForm(emptyMedicineForm)
    setEditing(null)
    setShowModal(true)
  }, [])

  const openEditModal = useCallback(async (medicine) => {
    const medicineDetails = await loadMedicineDetail(medicine)

    setForm({
      name: medicineDetails.name || '',
      quantity: String(medicineDetails.quantity ?? ''),
      image:
        medicineDetails.image ||
        getDefaultImage(medicineDetails.name),
      description:
        medicineDetails.description ||
        getDefaultDescription(medicineDetails.name),
      category: normalizeCategory(
        medicineDetails.category ||
          getDefaultCategory(medicineDetails.name)
      ),
    })

    setEditing(medicineDetails)
    setSelectedMedicineName('')
    setShowModal(true)
  }, [loadMedicineDetail])

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
      const quantity = Math.max(
        0,
        Number(form.quantity) || 0
      )
      const description = form.description.trim()

      const category = MEDICINE_CATEGORIES.includes(
        form.category
      )
        ? form.category
        : getDefaultCategory(name)

      const image =
        form.image || getDefaultImage(name)

      if (!name) {
        setNotice('Please enter a medicine name.')
        return
      }

      if (!MEDICINE_CATEGORIES.includes(category)) {
        setNotice('Please select a valid medicine category.')
        return
      }

      try {
        setIsMedicineSaving(true)
        const payload = {
          name,
          quantity,
          image,
          description,
          category,
        }

        if (editing) {
          const { data } =
            await clinicApi.updateMedicine(
              editing.id,
              payload
            )

          const nextMedicine =
            normalizeMedicine(data)

          setMedicines((previous) =>
            previous.map((medicine) =>
              medicine.id === nextMedicine.id
                ? nextMedicine
                : medicine
            )
          )

          setSelectedMedicineName((current) => {
            if (String(current) === String(editing.id)) return String(nextMedicine.id)
            return current
          })

          setNotice(
            `${nextMedicine.name}'s stock has been updated.`
          )

          await refreshTransactions()
        } else {
          const { data } =
            await clinicApi.createMedicine(payload)

          const nextMedicine =
            normalizeMedicine(data)

          setMedicines((previous) => [
            nextMedicine,
            ...previous,
          ])

          setNotice(
            `${nextMedicine.name} has been added to the inventory.`
          )

          await refreshTransactions()
        }

        closeModal()
      } catch (error) {
        setNotice(
          error.message || 'Unable to save medicine.'
        )
      } finally {
        setIsMedicineSaving(false)
      }
    },
    [
      closeModal,
      editing,
      form,
      refreshTransactions,
    ]
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
      setNotice(
        'Please choose an image smaller than 2 MB.'
      )
      e.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      setForm((current) => ({
        ...current,
        image: String(reader.result || ''),
      }))
    }

    reader.onerror = () =>
      setNotice('The image could not be loaded.')

    reader.readAsDataURL(file)
  }, [])

  const handleDelete = useCallback(
    async () => {
      if (!deleteMedicine) return

      try {
        setIsMedicineDeleting(true)
        await clinicApi.deleteMedicine(
          deleteMedicine.id
        )

        setMedicines((previous) =>
          previous.filter(
            (medicine) =>
              medicine.id !== deleteMedicine.id
          )
        )

        setSelectedMedicineName((current) =>
          String(current) === String(deleteMedicine.id)
            ? ''
            : current
        )

        setDeleteMedicine(null)

        setNotice(
          `${deleteMedicine.name} has been removed from the inventory.`
        )

        await refreshTransactions()
      } catch (error) {
        setNotice(
          error.message ||
            'Unable to remove medicine.'
        )
      } finally {
        setIsMedicineDeleting(false)
      }
    },
    [deleteMedicine, refreshTransactions]
  )

  const handleAdjust = useCallback(
    async (medicine, delta) => {
      try {
        const { data } =
          await clinicApi.adjustMedicine(
            medicine.id,
            delta
          )

        const nextMedicine =
          normalizeMedicine(data)

        setMedicines((previous) =>
          previous.map((item) =>
            item.id === nextMedicine.id
              ? nextMedicine
              : item
          )
        )

        await refreshTransactions()
      } catch (error) {
        setNotice(
          error.message ||
            'Unable to update stock.'
        )
      }
    },
    [refreshTransactions]
  )

  return (
    <div className="app-layout">
      {(medicineDetailLoading || isMedicineSaving || isMedicineDeleting) && (
        <LoadingOverlay
          message={
            medicineDetailLoading
              ? 'Loading medicine...'
              : isMedicineSaving
                ? 'Saving medicine...'
                : 'Deleting...'
          }
        />
      )}
      <Sidebar
        activeNav={activeNav}
        onNavSelect={handleNavSelect}
        onSignOut={onSignOut}
        isOpen={mobileSidebarOpen}
        onClose={onCloseMobileSidebar}
      />

      <main className="main-content">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          onNotification={setNoticeSafe}
          onProfile={onOpenAccountSettings}
          onNavigate={onNavigate}
          onMenuClick={onOpenMobileSidebar}
          searchPlaceholder="Search medicine"
        />

        <Toast
          message={notice}
          onClose={() => setNotice('')}
        />

        <section className="hero-row">
          <div>
            <p className="section-kicker">
              MEDICINE STOCKS
            </p>

            <h2>Medicine Inventory</h2>

            <p>
              Add and manage the available stock of
              clinic medicines.
            </p>
          </div>

          <button
            className="primary-action"
            onClick={openAddModal}
          >
            <Icon name="plus" /> Add medicine
          </button>
        </section>

        {medicines.length > 0 && (
          <section
            className="stats-grid"
            aria-label="Medicine inventory statistics"
          >
            <div className="stat-card blue">
              <span className="stat-icon">
                <Icon name="inventory" />
              </span>

              <div>
                <strong>{stats.total}</strong>
                <p>Total medicines</p>
                <small>
                  Listed in the inventory
                </small>
              </div>
            </div>

            <div className="stat-card green">
              <span className="stat-icon">
                <Icon name="clipboard" />
              </span>

              <div>
                <strong>{stats.totalUnits}</strong>
                <p>Total stock units</p>
                <small>
                  Available across all items
                </small>
              </div>
            </div>

            <div className="stat-card yellow">
              <span className="stat-icon">
                <Icon name="calendar" />
              </span>

              <div>
                <strong>{stats.lowStock}</strong>
                <p>Low stock</p>
                <small>
                  10 units or below
                </small>
              </div>
            </div>

            <div className="stat-card red">
              <span className="stat-icon">
                <Icon name="heart" />
              </span>

              <div>
                <strong>{stats.outOfStock}</strong>
                <p>Out of stock</p>
                <small>
                  Need restocking
                </small>
              </div>
            </div>
          </section>
        )}

        {medicines.length > 0 && (
          <div className="history-filters">
            <div className="segmented">
              <button
                type="button"
                className={
                  selectedCategory === ''
                    ? 'selected'
                    : ''
                }
                onClick={() =>
                  setSelectedCategory('')
                }
              >
                All ({medicines.length})
              </button>

              {MEDICINE_CATEGORIES.map(
                (category) => (
                  <button
                    type="button"
                    key={category}
                    className={
                      selectedCategory === category
                        ? 'selected'
                        : ''
                    }
                    onClick={() =>
                      setSelectedCategory(category)
                    }
                  >
                    {category} (
                    {categoryCounts[category] || 0}
                    )
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <section
          className="history-panel panel"
          style={{ marginTop: '18px' }}
        >
          <div className="panel-heading">
            <div>
              <p className="panel-label green-text">
                <Icon name="inventory" /> STOCK LEVELS
              </p>

              <h3>
                {query || selectedCategory
                  ? `Filtered medicines (${filteredMedicines.length})`
                  : `All medicines (${medicines.length})`}
              </h3>
            </div>
          </div>

          {inventoryLoading || (medicines.length === 0 && !inventoryLoaded) ? (
            <MedicineTableSkeleton />
          ) : medicines.length === 0 ? (
            <p
              className="empty-state"
              style={{ marginTop: '32px' }}
            >
              No medicines in the inventory yet. Click{' '}
              <strong>Add medicine</strong> to add the
              first one.
            </p>
          ) : filteredMedicines.length === 0 ? (
            <p
              className="empty-state"
              style={{ marginTop: '32px' }}
            >
              No medicines match the selected category
              or search.
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
                  {filteredMedicines.map(
                    (medicine) => {
                      const quantity =
                        Number(medicine.quantity) || 0

                      const status =
                        getStatus(quantity)

                      const category =
                        normalizeCategory(
                          medicine.category ||
                            getDefaultCategory(
                              medicine.name
                            )
                        )

                      return (
                        <tr
                          key={
                            medicine.id ||
                            medicine.name
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="history-student medicine-open-button"
                              onClick={async () => {
                                setSelectedMedicineName(medicine.name)
                                const medicineDetails = await loadMedicineDetail(medicine)
                                setSelectedMedicineName(String(medicineDetails.id || medicine.id || medicine.name))
                              }}
                              title={`View ${medicine.name}`}
                            >
                              <span className="visit-avatar blue">
                                <img
                                  src={
                                    medicine.image ||
                                    getDefaultImage(
                                      medicine.name
                                    )
                                  }
                                  alt=""
                                  className="medicine-thumb"
                                />
                              </span>

                              <div>
                                <strong>
                                  {medicine.name}
                                </strong>

                                <small>
                                  {medicine.description ||
                                    'No use description added yet.'}
                                </small>
                              </div>
                            </button>
                          </td>

                          <td>
                            <span className="medicine-category-pill">
                              {category}
                            </span>
                          </td>

                          <td>
                            <strong
                              style={{
                                color: '#294366',
                              }}
                            >
                              {quantity}
                            </strong>{' '}
                            <small
                              style={{
                                color: '#7d8aa0',
                              }}
                            >
                              unit
                              {quantity !== 1
                                ? 's'
                                : ''}
                            </small>
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
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdjust(
                                    medicine,
                                    -1
                                  )
                                }
                                title="Decrease stock"
                              >
                                <Icon name="minus" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleAdjust(
                                    medicine,
                                    1
                                  )
                                }
                                title="Increase stock"
                              >
                                <Icon name="plus" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    medicine
                                  )
                                }
                                title="Edit medicine"
                              >
                                <Icon name="clipboard" />{' '}
                                Edit
                              </button>

                              <button
                                type="button"
                                className="danger-text"
                                onClick={() =>
                                  setDeleteMedicine(
                                    medicine
                                  )
                                }
                                title="Remove medicine"
                              >
                                <Icon name="close" />{' '}
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="history-panel panel medicine-transactions-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label blue-text">
                <Icon name="calendar" /> MEDICINE
                TRANSACTIONS
              </p>

              <h3>Stock audit trail</h3>
            </div>
          </div>

          {transactions.length === 0 ? (
            <p
              className="empty-state"
              style={{ marginTop: '24px' }}
            >
              No medicine transactions have been
              recorded yet.
            </p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table medicine-transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Medicine</th>
                    <th>Action</th>
                    <th>Qty</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map(
                    (transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          {formatTransactionDate(
                            transaction.created_at
                          )}
                        </td>

                        <td>
                          <strong>
                            {transaction.medicine_name}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`transaction-action ${String(
                              transaction.action || ''
                            ).toLowerCase()}`}
                          >
                            {transaction.action}
                          </span>
                        </td>

                        <td>
                          <strong
                            className={`transaction-quantity ${
                              transaction.quantity > 0
                                ? 'positive'
                                : 'negative'
                            }`}
                          >
                            {transaction.quantity > 0
                              ? '+'
                              : ''}
                            {transaction.quantity}
                          </strong>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="visit-modal student-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={closeModal}
            >
              <Icon name="close" />
            </button>

            <p className="section-kicker">
              {editing
                ? 'EDIT MEDICINE'
                : 'NEW MEDICINE'}
            </p>

            <h2>
              {editing
                ? 'Update medicine stock'
                : 'Add medicine to inventory'}
            </h2>

            <form
              onSubmit={handleSubmit}
              className="modal-form-grid"
            >
              <label className="form-field-full">
                Medicine name *

                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Paracetamol"
                  required
                />
              </label>

              <label className="form-field-full">
                Available quantity

                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      quantity: e.target.value,
                    }))
                  }
                  placeholder="e.g. 10"
                />
              </label>

              <label className="form-field-full">
                Category *

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      category: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">
                    Select a category
                  </option>

                  {MEDICINE_CATEGORIES.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>

                <small
                  style={{
                    display: 'block',
                    marginTop: '6px',
                    color: '#7d8aa0',
                  }}
                >
                  Choose the general medicine category.
                </small>
              </label>

              <label className="form-field-full">
                Medicine picture

                <div className="medicine-image-upload">
                  <span className="medicine-preview">
                    {form.image ? (
                      <img
                        src={form.image}
                        alt=""
                      />
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
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      description:
                        e.target.value,
                    }))
                  }
                  placeholder="e.g. Used for fever, headache, or mild body pain"
                  rows="4"
                />
              </label>

              <div className="detail-actions form-field-full">
                <button
                  type="submit"
                  className="primary-action"
                  disabled={isMedicineSaving}
                >
                  <Icon name="plus" />{' '}
                  {isMedicineSaving
                    ? 'Saving medicine...'
                    : editing
                    ? 'Save changes'
                    : 'Add medicine'}
                </button>

                <button
                  type="button"
                  className="text-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedMedicine && (
        <div
          className="modal-backdrop"
          onClick={closeMedicineDetail}
        >
          <div
            className="visit-modal medicine-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={closeMedicineDetail}
            >
              <Icon name="close" />
            </button>

            <p className="section-kicker">
              MEDICINE DETAILS
            </p>

            <div className="medicine-detail-hero">
              <img
                src={
                  selectedMedicine.image ||
                  getDefaultImage(
                    selectedMedicine.name
                  )
                }
                alt=""
              />
            </div>

            <h2>{selectedMedicine.name}</h2>

            <span className="medicine-detail-category">
              {normalizeCategory(
                selectedMedicine.category ||
                  getDefaultCategory(
                    selectedMedicine.name
                  )
              )}
            </span>

            <div className="medicine-detail-stats">
              <span>
                <small>Available stock</small>

                <strong>
                  {Number(
                    selectedMedicine.quantity
                  ) || 0}
                </strong>
              </span>

              <span>
                <small>Status</small>

                <strong>
                  {getStatus(
                    Number(
                      selectedMedicine.quantity
                    ) || 0
                  ) === 'out'
                    ? 'Out of stock'
                    : getStatus(
                        Number(
                          selectedMedicine.quantity
                        ) || 0
                      ) === 'low'
                    ? 'Low stock'
                    : 'In stock'}
                </strong>
              </span>
            </div>

            <div className="medicine-detail-description">
              <small>Used for</small>

              <p>
                {selectedMedicine.description ||
                  'No use description added yet.'}
              </p>
            </div>

            <div className="detail-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() =>
                  openEditModal(
                    selectedMedicine
                  )
                }
              >
                <Icon name="clipboard" /> Edit
                medicine
              </button>

              <button
                type="button"
                className="text-button"
                onClick={closeMedicineDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteMedicine && (
        <ConfirmDialog
          title="Delete Medicine?"
          description={`Are you sure you want to remove ${deleteMedicine.name} from the inventory?`}
          onCancel={() =>
            setDeleteMedicine(null)
          }
          onConfirm={handleDelete}
          loading={isMedicineDeleting}
        />
      )}
    </div>
  )
}
