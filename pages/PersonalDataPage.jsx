import { useCallback, useEffect, useMemo, useState } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import { formatVisitDate, getInitials, toLocalDateTimeInputValue } from '../src/utils/visitHelpers'

const conditionOptions = [
  'Heart Problem',
  'Diabetic',
  'Skin',
  'Depression',
  'Hypertension',
  'Cancer',
  'AIDS/HIV',
  'Seizures',
  'Asthma',
  'Anxiety',
]

const personalDefaults = {
  name: '',
  studentId: '',
  employeeId: '',
  position: 'Student',
  department: '',
  course: '',
  yearLevel: '',
  section: '',
  birthdate: '',
  gender: '',
  placeOfBirth: '',
  fatherName: '',
  fatherOccupation: '',
  motherName: '',
  motherOccupation: '',
  address: '',
  contact: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactName2: '',
  emergencyContactPhone2: '',
  bloodType: '',
  completeImmunization: '',
  missedImmunization: '',
  medicalCondition: '',
  medicalConditionDetails: '',
  hospitalized: '',
  hospitalizationDetails: '',
  allergy: '',
  allergyDetails: '',
  covidVaccination: '',
  covidFirstDose: '',
  covidSecondDose: '',
  covidBooster1: '',
  covidBooster2: '',
  healthConditions: [],
  surgery: '',
  surgeryDetails: '',
  maintenanceMedication: '',
  maintenanceMedications: '',
  signatureName: '',
}

const visitDefaults = {
  id: '',
  visitDateTime: '',
  concern: '',
  temperature: '',
  height: '',
  weight: '',
  bloodPressure: '',
  respiratoryRate: '',
  pulseRate: '',
  oxygenSaturation: '',
  signsSymptoms: '',
  visitRemarks: '',
  medicationFirstAid: '',
  medicationRemarks: '',
  dischargedAt: '',
  sentHome: false,
  sentHomeDate: '',
  sentHomeTime: '',
  attendingPhysician: '',
  medicines: [],
}

function getRecordId(record) {
  return record.studentId || record.employeeId || ''
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function visitBelongsToRecord(record, visit) {
  if (record.id && visit.patientRecordId) return String(record.id) === String(visit.patientRecordId)
  const recordId = getRecordId(record)
  const visitId = getRecordId(visit)
  if (recordId && visitId) return normalizeValue(recordId) === normalizeValue(visitId)
  return normalizeValue(record.name) === normalizeValue(visit.name)
}

function mergeRecord(record = {}) {
  return {
    ...personalDefaults,
    ...record,
    healthConditions: Array.isArray(record.healthConditions) ? record.healthConditions : [],
  }
}

function escapeDoc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitNameParts(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { lastName: '', firstName: '', middleName: '' }
  if (parts.length === 1) return { lastName: parts[0], firstName: '', middleName: '' }
  if (parts.length === 2) return { lastName: parts[1], firstName: parts[0], middleName: '' }
  return {
    lastName: parts[parts.length - 1],
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
  }
}

function formatDateOnly(value) {
  if (!value) return ''
  const exact = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (exact) return `${exact[2]}/${exact[3]}/${exact[1]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US')
}

function formatTimeOnly(value) {
  if (!value) return ''
  const exact = String(value).match(/[T ](\d{2}):(\d{2})/)
  if (exact) {
    const date = new Date(2000, 0, 1, Number(exact[1]), Number(exact[2]))
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  return String(value)
}

function checked(answer, target) {
  return answer === target ? '&#10003;' : ''
}

function YesNoGroup({ label, value, onChange }) {
  return (
    <div className="yes-no-field">
      <span>{label}</span>
      <div className="segmented">
        <button type="button" className={value === 'yes' ? 'selected' : ''} onClick={() => onChange('yes')}>
          Yes
        </button>
        <button type="button" className={value === 'no' ? 'selected' : ''} onClick={() => onChange('no')}>
          No
        </button>
      </div>
    </div>
  )
}

export default function PersonalDataPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Personal Data')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState([])
  const [visits, setVisits] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(personalDefaults)
  const [editingVisit, setEditingVisit] = useState(null)

  const selectedRecord = useMemo(
    () => records.find((record) => String(record.id) === String(selectedId)) || null,
    [records, selectedId]
  )

  const filteredRecords = useMemo(() => {
    if (!query.trim()) return records
    const q = query.toLowerCase()
    return records.filter((record) =>
      [record.name, record.studentId, record.employeeId, record.course, record.department, record.section]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    )
  }, [query, records])

  const recordVisits = useMemo(() => {
    if (!selectedRecord) return []
    return visits
      .filter((visit) => visitBelongsToRecord(selectedRecord, visit))
      .sort((a, b) => new Date(b.visitDateTime || 0) - new Date(a.visitDateTime || 0))
  }, [selectedRecord, visits])

  const refreshData = useCallback(async () => {
    const [recordsResponse, visitsResponse] = await Promise.all([
      clinicApi.getPatientRecords(),
      clinicApi.getVisits(),
    ])
    setRecords(recordsResponse.data)
    setVisits(visitsResponse.data)
    const nextSelected = recordsResponse.data.find((record) => String(record.id) === String(selectedId)) || recordsResponse.data[0]
    if (nextSelected) {
      setSelectedId(String(nextSelected.id))
      setForm(mergeRecord(nextSelected))
    }
  }, [selectedId])

  useEffect(() => {
    let ignore = false
    async function loadData() {
      try {
        const [recordsResponse, visitsResponse] = await Promise.all([
          clinicApi.getPatientRecords(),
          clinicApi.getVisits(),
        ])
        if (ignore) return
        setRecords(recordsResponse.data)
        setVisits(visitsResponse.data)
        if (recordsResponse.data[0]) {
          setSelectedId(String(recordsResponse.data[0].id))
          setForm(mergeRecord(recordsResponse.data[0]))
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load personal data.')
      }
    }
    loadData()
    return () => {
      ignore = true
    }
  }, [])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Personal Data') onNavigate(item)
    },
    [onNavigate]
  )

  function selectRecord(record) {
    setSelectedId(String(record.id))
    setForm(mergeRecord(record))
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openVisitEditor(visit) {
    setEditingVisit({
      ...visitDefaults,
      ...visit,
      visitDateTime: toLocalDateTimeInputValue(visit.visitDateTime),
      dischargedAt: toLocalDateTimeInputValue(visit.dischargedAt),
      medicines: Array.isArray(visit.medicines) ? visit.medicines : [],
    })
  }

  function updateVisitField(field, value) {
    setEditingVisit((current) => ({ ...current, [field]: value }))
  }

  function toggleCondition(condition) {
    setForm((current) => {
      const selected = current.healthConditions.includes(condition)
      return {
        ...current,
        healthConditions: selected
          ? current.healthConditions.filter((item) => item !== condition)
          : [...current.healthConditions, condition],
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedRecord) return
    if (!form.name.trim()) {
      setNotice('Please enter a full name.')
      return
    }

    try {
      const { data } = await clinicApi.updatePatientRecord(selectedRecord.id, form)
      setRecords((current) => current.map((record) => (record.id === data.id ? data : record)))
      setForm(mergeRecord(data))
      await refreshData()
      setNotice(`${data.name}'s personal data has been saved.`)
    } catch (error) {
      setNotice(error.message || 'Unable to save personal data.')
    }
  }

  async function handleVisitSubmit(e) {
    e.preventDefault()
    if (!selectedRecord || !editingVisit) return

    try {
      const payload = {
        ...selectedRecord,
        ...editingVisit,
        patientRecordId: selectedRecord.id,
        name: form.name || selectedRecord.name,
        position: form.position || selectedRecord.position || 'Student',
        department: form.department || selectedRecord.department || '',
        studentId: form.studentId || selectedRecord.studentId || '',
        employeeId: form.employeeId || selectedRecord.employeeId || '',
        course: form.course || selectedRecord.course || '',
        yearLevel: form.yearLevel || selectedRecord.yearLevel || '',
        section: form.section || selectedRecord.section || '',
        contact: form.contact || selectedRecord.contact || '',
        address: form.address || selectedRecord.address || '',
      }
      const { data } = await clinicApi.updateVisit(editingVisit.id, payload)
      setVisits((current) => current.map((visit) => (visit.id === data.id ? data : visit)))
      setEditingVisit(null)
      setNotice('Clinic visit has been updated.')
    } catch (error) {
      setNotice(error.message || 'Unable to update clinic visit.')
    }
  }

  function handleExportDocument() {
    if (!selectedRecord) {
      setNotice('Please select a personal record to export.')
      return
    }

    const data = { ...selectedRecord, ...form }
    const nameParts = splitNameParts(data.name)
    const courseYearGrade = [data.course, data.yearLevel].filter(Boolean).join(' / ')
    const latestSentHomeVisit = recordVisits.find((visit) => visit.sentHome) || recordVisits[0] || {}
    const clinicRows = Array.from({ length: 9 }, (_, index) => {
      const visit = recordVisits[index] || {}
      return `<tr>
        <td>${escapeDoc(formatDateOnly(visit.visitDateTime))}</td>
        <td>${escapeDoc(visit.temperature)}</td>
        <td>${escapeDoc(visit.height)}</td>
        <td>${escapeDoc(visit.weight)}</td>
        <td>${escapeDoc(visit.bloodPressure)}</td>
        <td>${escapeDoc(visit.respiratoryRate)}</td>
        <td>${escapeDoc(visit.pulseRate)}</td>
        <td>${escapeDoc(visit.oxygenSaturation)}</td>
        <td>${escapeDoc(visit.visitRemarks || visit.concern)}</td>
      </tr>`
    }).join('')
    const noteBlocks = Array.from({ length: 3 }, (_, index) => {
      const visit = recordVisits[index] || {}
      return `<table class="notes-block">
        <tr><th class="date-col">DATE</th><th>SIGNS AND SYMPTOMS/MAJOR COMPLAIN</th><th class="remarks-col">REMARKS</th></tr>
        <tr><td>${escapeDoc(formatDateOnly(visit.visitDateTime))}</td><td>${escapeDoc(visit.signsSymptoms || visit.concern)}</td><td>${escapeDoc(visit.visitRemarks)}</td></tr>
        <tr><th colspan="2">MEDICATION/FIRST AID PROVIDED</th><th>REMARKS</th></tr>
        <tr><td colspan="2">${escapeDoc(visit.medicationFirstAid || (visit.medicines || []).join(', '))}</td><td>${escapeDoc(visit.medicationRemarks)}</td></tr>
      </table>`
    }).join('')

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 8.5in 13in; margin: .45in; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 13pt; }
    .page { page-break-after: always; }
    .header { text-align: center; text-transform: uppercase; margin-bottom: 18px; }
    .header-table, .line-row, .questions, .clinic-table, .footer-lines { width: 100%; border-collapse: collapse; }
    .header-logo { width: 92px; text-align: right; }
    .seal { width: 58px; height: 58px; border: 2px solid #333; border-radius: 50%; display: inline-block; text-align: center; line-height: 58px; font-size: 9pt; font-weight: bold; }
    h1 { margin: 0; font-size: 20pt; letter-spacing: 1px; }
    h2 { display: inline-block; margin: 3px 0 0; border-bottom: 2px solid #111; font-size: 16pt; }
    h3 { margin: 0 0 18px; font-size: 15pt; }
    .line-row { margin: 6px 0; }
    .label { white-space: nowrap; font-weight: bold; }
    .line { border-bottom: 1.4px solid #333; height: 24px; padding: 0 5px; }
    .sub { display: block; text-align: center; font-size: 8.5pt; font-style: italic; font-weight: normal; margin-top: 1px; }
    .question-title { margin: 22px 0 10px; font-size: 14pt; }
    .questions td { vertical-align: top; padding: 3px 4px; }
    .qnum { width: 30px; }
    .check { width: 70px; text-align: center; border-bottom: 1px solid #333; font-weight: bold; }
    .yn { text-align: center; font-weight: bold; padding-bottom: 8px; }
    .inline-line { display: inline-block; min-width: 300px; border-bottom: 1px solid #333; padding: 0 5px; }
    .condition { display: inline-block; min-width: 128px; line-height: 1.6; }
    .sig { margin-top: 32px; text-align: right; }
    .sig span { display: inline-block; min-width: 330px; border-bottom: 1px solid #333; text-align: center; }
    .sig small { display: block; margin-right: 82px; font-size: 10pt; }
    .clinic-title { margin: 28px 0 4px; font-weight: bold; }
    .clinic-table { table-layout: fixed; }
    .clinic-table th, .clinic-table td { border: 1.2px solid #222; height: 30px; padding: 3px; vertical-align: top; }
    .clinic-table th { text-align: center; font-weight: bold; }
    .clinic-table td { font-size: 10pt; }
    .name-line { margin-bottom: 10px; }
    .name-line span { display: inline-block; min-width: 760px; border-bottom: 1px solid #333; padding: 0 6px; }
    .notes-block { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 0; }
    .notes-block th, .notes-block td { border: 1.2px solid #222; padding: 4px; vertical-align: top; }
    .notes-block th { height: 22px; text-align: center; font-weight: bold; }
    .notes-block td { height: 118px; font-size: 11pt; }
    .date-col { width: 88px; }
    .remarks-col { width: 275px; }
    .footer-lines td { padding-top: 12px; }
    .short-line { display: inline-block; min-width: 112px; border-bottom: 1px solid #333; padding: 0 5px; }
    .physician-line { display: inline-block; min-width: 390px; border-bottom: 1px solid #333; text-align: center; }
    .physician-label { display: block; text-align: center; font-size: 10pt; color: #555; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <table class="header-table"><tr><td class="header-logo"><span class="seal">ICF</span></td><td><h1>Interworld Colleges Foundation Inc</h1><h2>Health Record</h2></td></tr></table>
    </div>
    <h3>PERSONAL DATA:</h3>
    <table class="line-row"><tr><td class="label">NAME:</td><td class="line">${escapeDoc(nameParts.lastName)}<span class="sub">Last Name</span></td><td class="line">${escapeDoc(nameParts.firstName)}<span class="sub">First Name</span></td><td class="line">${escapeDoc(nameParts.middleName)}<span class="sub">Middle Name</span></td></tr></table>
    <table class="line-row"><tr><td class="label">COURSE/YR/ GRADE:</td><td class="line">${escapeDoc(courseYearGrade)}</td><td class="label">SECTION:</td><td class="line">${escapeDoc(data.section)}</td><td class="label">GENDER:</td><td class="line">${escapeDoc(data.gender)}</td></tr></table>
    <table class="line-row"><tr><td class="label">DATE OF BIRTH:</td><td class="line">${escapeDoc(formatDateOnly(data.birthdate))}</td><td class="label">PLACE OF BIRTH:</td><td class="line">${escapeDoc(data.placeOfBirth)}</td></tr></table>
    <table class="line-row"><tr><td class="label">FATHER'S NAME:</td><td class="line">${escapeDoc(data.fatherName)}</td><td class="label">OCCUPATION:</td><td class="line">${escapeDoc(data.fatherOccupation)}</td></tr></table>
    <table class="line-row"><tr><td class="label">MOTHER'S NAME:</td><td class="line">${escapeDoc(data.motherName)}</td><td class="label">OCCUPATION:</td><td class="line">${escapeDoc(data.motherOccupation)}</td></tr></table>
    <table class="line-row"><tr><td class="label">HOME ADDRESS:</td><td class="line">${escapeDoc(data.address)}</td></tr></table>
    <table class="line-row"><tr><td class="label">EMERGENCY CONTACT PERSON:</td><td class="line">${escapeDoc(data.emergencyContactName)}</td><td class="label">TEL/CP NO:</td><td class="line">${escapeDoc(data.emergencyContactPhone)}</td></tr></table>
    <table class="line-row"><tr><td class="label">EMERGENCY CONTACT PERSON:</td><td class="line">${escapeDoc(data.emergencyContactName2)}</td><td class="label">TEL/CP NO:</td><td class="line">${escapeDoc(data.emergencyContactPhone2)}</td></tr></table>
    <table class="line-row"><tr><td class="label">BLOOD TYPE:</td><td class="line">${escapeDoc(data.bloodType)}</td><td class="label">MOBILE NO:</td><td class="line">${escapeDoc(data.contact)}</td><td></td></tr></table>
    <div class="question-title">Please put a check (&#10003;) mark that corresponds to your answer</div>
    <table class="questions">
      <tr><td></td><td></td><td class="yn">YES</td><td class="yn">NO</td></tr>
      <tr><td class="qnum">1.</td><td>Do you have a complete immunization?<br>If NO, please specify what immunization did you miss? <span class="inline-line">${escapeDoc(data.missedImmunization)}</span></td><td class="check">${checked(data.completeImmunization, 'yes')}</td><td class="check">${checked(data.completeImmunization, 'no')}</td></tr>
      <tr><td class="qnum">2.</td><td>Do you have medical condition that may affect your treatment in medical emergency?<br>if YES, please specify: <span class="inline-line">${escapeDoc(data.medicalConditionDetails)}</span></td><td class="check">${checked(data.medicalCondition, 'yes')}</td><td class="check">${checked(data.medicalCondition, 'no')}</td></tr>
      <tr><td class="qnum">3.</td><td>Have you been hospitalzied?<br>If YES, please specify: <span class="inline-line">${escapeDoc(data.hospitalizationDetails)}</span></td><td class="check">${checked(data.hospitalized, 'yes')}</td><td class="check">${checked(data.hospitalized, 'no')}</td></tr>
      <tr><td class="qnum">4.</td><td>Do you have allergy? If YES, please specify what cause/s: <span class="inline-line">${escapeDoc(data.allergyDetails)}</span></td><td class="check">${checked(data.allergy, 'yes')}</td><td class="check">${checked(data.allergy, 'no')}</td></tr>
      <tr><td class="qnum">5.</td><td>Do you have covide vaccination?<br>1st Dose <span class="inline-line">${escapeDoc(formatDateOnly(data.covidFirstDose))}</span> 2nd Dose <span class="inline-line">${escapeDoc(formatDateOnly(data.covidSecondDose))}</span> Booster <span class="inline-line">${escapeDoc(formatDateOnly(data.covidBooster1))}</span> 1 <span class="inline-line">${escapeDoc(formatDateOnly(data.covidBooster2))}</span> 2</td><td class="check">${checked(data.covidVaccination, 'yes')}</td><td class="check">${checked(data.covidVaccination, 'no')}</td></tr>
      <tr><td class="qnum">6.</td><td>Any pre-existing health conditions?<br>${conditionOptions.map((condition) => `<span class="condition">${data.healthConditions?.includes(condition) ? '&#10003;' : '____'} ${escapeDoc(condition)}</span>`).join('')}</td><td class="check"></td><td class="check"></td></tr>
      <tr><td class="qnum">7.</td><td>Any surgery? If YES, please specify: <span class="inline-line">${escapeDoc(data.surgeryDetails)}</span></td><td class="check">${checked(data.surgery, 'yes')}</td><td class="check">${checked(data.surgery, 'no')}</td></tr>
      <tr><td class="qnum">8.</td><td>Are you taking any medication/maintenance for your illness/illnesses?<br>If YES, please specify all medications: <span class="inline-line">${escapeDoc(data.maintenanceMedications)}</span></td><td class="check">${checked(data.maintenanceMedication, 'yes')}</td><td class="check">${checked(data.maintenanceMedication, 'no')}</td></tr>
    </table>
    <p>This information given above was voluntarily and was based according to the best of my knowledge about my health history.</p>
    <div class="sig"><span>${escapeDoc(data.signatureName)}</span><small>Signature over printed name</small></div>
    <div class="clinic-title">CLINIC VISITS</div>
    <table class="clinic-table"><tr><th>DATE</th><th>TEMP</th><th>HT</th><th>WT</th><th>BP</th><th>RR</th><th>PR</th><th>O2 Sat (%)</th><th>REMARKS</th></tr>${clinicRows}</table>
  </div>
  <div class="page">
    <div class="name-line"><b>NAME:</b> <span>${escapeDoc(data.name)}</span></div>
    ${noteBlocks}
    <table class="footer-lines"><tr>
      <td><b>Sent Home:</b> <span class="short-line">${latestSentHomeVisit.sentHome ? 'Yes' : 'No'}</span> <b>Date:</b> <span class="short-line">${escapeDoc(formatDateOnly(latestSentHomeVisit.sentHomeDate))}</span> <b>Time:</b> <span class="short-line">${escapeDoc(formatTimeOnly(latestSentHomeVisit.sentHomeTime))}</span></td>
      <td style="text-align:right;"><span class="physician-line">${escapeDoc(latestSentHomeVisit.attendingPhysician)}</span><span class="physician-label">Attending Physician</span></td>
    </tr></table>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const safeName = (data.name || 'personal-data').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    anchor.href = url
    anchor.download = `${safeName || 'personal-data'}-health-record.doc`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setNotice('Personal data document exported.')
  }

  return (
    <div className="app-layout">
      <Sidebar activeNav={activeNav} onNavSelect={handleNavSelect} onSignOut={onSignOut} />

      <main className="main-content">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          onNotification={setNotice}
          onProfile={() => handleNavSelect('Nurse Profile')}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">HEALTH RECORD</p>
            <h2>Personal Data</h2>
            <p>Maintain personal health records and review clinic visit entries.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-action" onClick={handleExportDocument}>
              <Icon name="download" /> Export Document
            </button>
            <button className="primary-action" onClick={() => onNavigate('Patients')}>
              <Icon name="plus" /> Register visit
            </button>
          </div>
        </section>

        <section className="personal-data-layout">
          <div className="panel personal-roster-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-label blue-text"><Icon name="students" /> RECORDS</p>
                <h3>{filteredRecords.length} profiles</h3>
              </div>
            </div>
            <div className="student-list">
              {filteredRecords.map((record) => (
                <button
                  key={record.id}
                  className={String(record.id) === String(selectedId) ? 'student-row active' : 'student-row'}
                  onClick={() => selectRecord(record)}
                >
                  <span className="visit-avatar green">{getInitials(record.name)}</span>
                  <span className="student-info">
                    <strong>{record.name}</strong>
                    <small>{getRecordId(record) || 'No ID'}{record.course ? ` - ${record.course}` : ''}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form className="panel health-record-form" onSubmit={handleSubmit}>
            {!selectedRecord ? (
              <p className="empty-state">No personal records yet. Register a visit first to create one.</p>
            ) : (
              <>
                <div className="health-form-header">
                  <img src="/icf logo.png" alt="Interworld Colleges Foundation" />
                  <div>
                    <h3>Interworld Colleges Foundation Inc</h3>
                    <strong>Health Record</strong>
                  </div>
                </div>

                <div className="health-summary">
                  <span className="visit-avatar green">{getInitials(form.name)}</span>
                  <div>
                    <strong>{form.name || 'Selected profile'}</strong>
                    <small>
                      {getRecordId(form) || 'No ID'}{form.position ? ` - ${form.position}` : ''}
                      {form.course ? ` - ${form.course}` : ''}{form.yearLevel ? ` - ${form.yearLevel}` : ''}
                    </small>
                  </div>
                </div>

                <section className="health-form-section">
                  <h4>School Information</h4>
                  <div className="health-form-grid">
                    <label className="wide-field">Name
                      <input value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
                    </label>
                    <label>Position
                      <select value={form.position} onChange={(e) => updateField('position', e.target.value)}>
                        <option value="Student">Student</option>
                        <option value="Staff">Staff</option>
                        <option value="Instructor">Instructor</option>
                        <option value="Guard">Guard</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </label>
                    <label>Student ID
                      <input value={form.studentId} onChange={(e) => updateField('studentId', e.target.value)} />
                    </label>
                    <label>Employee ID
                      <input value={form.employeeId} onChange={(e) => updateField('employeeId', e.target.value)} />
                    </label>
                    <label>Department
                      <input value={form.department} onChange={(e) => updateField('department', e.target.value)} />
                    </label>
                    <label>Course / Grade
                      <input value={form.course} onChange={(e) => updateField('course', e.target.value)} />
                    </label>
                    <label>Year Level
                      <input value={form.yearLevel} onChange={(e) => updateField('yearLevel', e.target.value)} />
                    </label>
                    <label>Section
                      <input value={form.section} onChange={(e) => updateField('section', e.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Personal Details</h4>
                  <div className="health-form-grid">
                    <label>Date of Birth
                      <input type="date" value={form.birthdate} onChange={(e) => updateField('birthdate', e.target.value)} />
                    </label>
                    <label>Place of Birth
                      <input value={form.placeOfBirth} onChange={(e) => updateField('placeOfBirth', e.target.value)} />
                    </label>
                    <label>Gender
                      <select value={form.gender} onChange={(e) => updateField('gender', e.target.value)}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>
                    <label>Blood Type
                      <input value={form.bloodType} onChange={(e) => updateField('bloodType', e.target.value)} />
                    </label>
                    <label className="wide-field">Home Address
                      <input value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                    </label>
                    <label>Mobile No.
                      <input value={form.contact} onChange={(e) => updateField('contact', e.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Family and Emergency Contacts</h4>
                  <div className="health-form-grid">
                    <label>Father's Name
                      <input value={form.fatherName} onChange={(e) => updateField('fatherName', e.target.value)} />
                    </label>
                    <label>Father's Occupation
                      <input value={form.fatherOccupation} onChange={(e) => updateField('fatherOccupation', e.target.value)} />
                    </label>
                    <label>Mother's Name
                      <input value={form.motherName} onChange={(e) => updateField('motherName', e.target.value)} />
                    </label>
                    <label>Mother's Occupation
                      <input value={form.motherOccupation} onChange={(e) => updateField('motherOccupation', e.target.value)} />
                    </label>
                    <label>Emergency Contact Person
                      <input value={form.emergencyContactName} onChange={(e) => updateField('emergencyContactName', e.target.value)} />
                    </label>
                    <label>Tel / CP No.
                      <input value={form.emergencyContactPhone} onChange={(e) => updateField('emergencyContactPhone', e.target.value)} />
                    </label>
                    <label>Emergency Contact Person 2
                      <input value={form.emergencyContactName2} onChange={(e) => updateField('emergencyContactName2', e.target.value)} />
                    </label>
                    <label>Tel / CP No. 2
                      <input value={form.emergencyContactPhone2} onChange={(e) => updateField('emergencyContactPhone2', e.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Health History</h4>
                  <div className="health-question-grid">
                  <YesNoGroup label="Complete immunization" value={form.completeImmunization} onChange={(value) => updateField('completeImmunization', value)} />
                  <label>If no, specify missed immunization
                    <input value={form.missedImmunization} onChange={(e) => updateField('missedImmunization', e.target.value)} />
                  </label>
                  <YesNoGroup label="Medical condition affecting emergency treatment" value={form.medicalCondition} onChange={(value) => updateField('medicalCondition', value)} />
                  <label>If yes, specify
                    <input value={form.medicalConditionDetails} onChange={(e) => updateField('medicalConditionDetails', e.target.value)} />
                  </label>
                  <YesNoGroup label="Hospitalized" value={form.hospitalized} onChange={(value) => updateField('hospitalized', value)} />
                  <label>If yes, specify
                    <input value={form.hospitalizationDetails} onChange={(e) => updateField('hospitalizationDetails', e.target.value)} />
                  </label>
                  <YesNoGroup label="Allergy" value={form.allergy} onChange={(value) => updateField('allergy', value)} />
                  <label>Cause/s
                    <input value={form.allergyDetails} onChange={(e) => updateField('allergyDetails', e.target.value)} />
                  </label>
                  <YesNoGroup label="Covid vaccination" value={form.covidVaccination} onChange={(value) => updateField('covidVaccination', value)} />
                  <div className="dose-grid">
                    <input type="date" value={form.covidFirstDose} onChange={(e) => updateField('covidFirstDose', e.target.value)} title="1st dose" />
                    <input type="date" value={form.covidSecondDose} onChange={(e) => updateField('covidSecondDose', e.target.value)} title="2nd dose" />
                    <input type="date" value={form.covidBooster1} onChange={(e) => updateField('covidBooster1', e.target.value)} title="Booster 1" />
                    <input type="date" value={form.covidBooster2} onChange={(e) => updateField('covidBooster2', e.target.value)} title="Booster 2" />
                  </div>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Pre-existing Conditions</h4>
                  <fieldset className="medicine-field">
                    <legend>Conditions</legend>
                    <div className="condition-options">
                      {conditionOptions.map((condition) => (
                        <label key={condition} className="medicine-option">
                          <input
                            type="checkbox"
                            checked={form.healthConditions.includes(condition)}
                            onChange={() => toggleCondition(condition)}
                          />
                          <span>{condition}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </section>

                <section className="health-form-section">
                  <h4>Surgery and Medication</h4>
                  <div className="health-question-grid">
                    <YesNoGroup label="Any surgery" value={form.surgery} onChange={(value) => updateField('surgery', value)} />
                    <label>If yes, specify
                      <input value={form.surgeryDetails} onChange={(e) => updateField('surgeryDetails', e.target.value)} />
                    </label>
                    <YesNoGroup label="Taking medication / maintenance" value={form.maintenanceMedication} onChange={(value) => updateField('maintenanceMedication', value)} />
                    <label>All medications
                      <input value={form.maintenanceMedications} onChange={(e) => updateField('maintenanceMedications', e.target.value)} />
                    </label>
                    <label className="wide-field">Signature over printed name
                      <input value={form.signatureName} onChange={(e) => updateField('signatureName', e.target.value)} />
                    </label>
                  </div>
                </section>

                <div className="detail-actions">
                  <button className="primary-action" type="submit">
                    <Icon name="clipboard" /> Save personal data
                  </button>
                </div>

                <div className="clinic-visit-table-block">
                  <div className="clinic-visit-heading">
                    <p className="panel-label yellow-text">CLINIC VISITS</p>
                    <small>{recordVisits.length} saved visit{recordVisits.length !== 1 ? 's' : ''}</small>
                  </div>
                  <div className="history-table-wrap">
                    <table className="history-table personal-visit-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Temp</th>
                          <th>HT</th>
                          <th>WT</th>
                          <th>BP</th>
                          <th>RR</th>
                          <th>PR</th>
                          <th>O2 Sat (%)</th>
                          <th>Signs / Major Complaint</th>
                          <th>Remarks</th>
                          <th>Medication / First Aid</th>
                          <th>Medication Remarks</th>
                          <th>Sent Home</th>
                          <th>Attending Physician</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordVisits.length === 0 ? (
                          <tr><td colSpan="15">No clinic visits recorded yet.</td></tr>
                        ) : recordVisits.map((visit) => (
                          <tr key={visit.id}>
                            <td>{formatVisitDate(visit.visitDateTime)}</td>
                            <td>{visit.temperature}</td>
                            <td>{visit.height}</td>
                            <td>{visit.weight}</td>
                            <td>{visit.bloodPressure}</td>
                            <td>{visit.respiratoryRate}</td>
                            <td>{visit.pulseRate}</td>
                            <td>{visit.oxygenSaturation}</td>
                            <td>{visit.signsSymptoms || visit.concern}</td>
                            <td>{visit.visitRemarks || visit.concern}</td>
                            <td>{visit.medicationFirstAid || (visit.medicines || []).join(', ')}</td>
                            <td>{visit.medicationRemarks}</td>
                            <td>
                              {visit.sentHome
                                ? [visit.sentHomeDate, visit.sentHomeTime].filter(Boolean).join(' ')
                                : 'No'}
                            </td>
                            <td>{visit.attendingPhysician}</td>
                            <td>
                              <button type="button" className="history-delete" onClick={() => openVisitEditor(visit)}>
                                <Icon name="clipboard" /> Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </form>
        </section>
      </main>

      {editingVisit && (
        <div className="modal-backdrop" onMouseDown={() => setEditingVisit(null)}>
          <form className="visit-modal student-form-modal update-visit-modal" onSubmit={handleVisitSubmit} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setEditingVisit(null)}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">CLINIC VISIT</p>
            <h2>Edit clinic visit</h2>

            <div className="modal-form-grid">
              <label>
                Date and time
                <input type="datetime-local" value={editingVisit.visitDateTime} onChange={(e) => updateVisitField('visitDateTime', e.target.value)} />
              </label>
              <label>
                Concern / reason
                <input value={editingVisit.concern} onChange={(e) => updateVisitField('concern', e.target.value)} />
              </label>
              <label>
                Temperature
                <input value={editingVisit.temperature} onChange={(e) => updateVisitField('temperature', e.target.value)} />
              </label>
              <label>
                Height
                <input value={editingVisit.height} onChange={(e) => updateVisitField('height', e.target.value)} />
              </label>
              <label>
                Weight
                <input value={editingVisit.weight} onChange={(e) => updateVisitField('weight', e.target.value)} />
              </label>
              <label>
                BP
                <input value={editingVisit.bloodPressure} onChange={(e) => updateVisitField('bloodPressure', e.target.value)} />
              </label>
              <label>
                RR
                <input value={editingVisit.respiratoryRate} onChange={(e) => updateVisitField('respiratoryRate', e.target.value)} />
              </label>
              <label>
                PR
                <input value={editingVisit.pulseRate} onChange={(e) => updateVisitField('pulseRate', e.target.value)} />
              </label>
              <label>
                O2 Sat (%)
                <input value={editingVisit.oxygenSaturation} onChange={(e) => updateVisitField('oxygenSaturation', e.target.value)} />
              </label>
              <label className="form-field-full">
                Signs and symptoms / major complaint
                <textarea value={editingVisit.signsSymptoms} onChange={(e) => updateVisitField('signsSymptoms', e.target.value)} />
              </label>
              <label className="form-field-full">
                Remarks
                <textarea value={editingVisit.visitRemarks} onChange={(e) => updateVisitField('visitRemarks', e.target.value)} />
              </label>
              <label className="form-field-full">
                Medication / first aid provided
                <textarea value={editingVisit.medicationFirstAid} onChange={(e) => updateVisitField('medicationFirstAid', e.target.value)} />
              </label>
              <label className="form-field-full">
                Medication remarks
                <textarea value={editingVisit.medicationRemarks} onChange={(e) => updateVisitField('medicationRemarks', e.target.value)} />
              </label>
              <label>
                Time out
                <input type="datetime-local" value={editingVisit.dischargedAt} onChange={(e) => updateVisitField('dischargedAt', e.target.value)} />
              </label>
              <label className="checkbox-line">
                <input type="checkbox" checked={editingVisit.sentHome} onChange={(e) => updateVisitField('sentHome', e.target.checked)} />
                Sent home
              </label>
              <label>
                Sent home date
                <input type="date" value={editingVisit.sentHomeDate} onChange={(e) => updateVisitField('sentHomeDate', e.target.value)} />
              </label>
              <label>
                Sent home time
                <input type="time" value={editingVisit.sentHomeTime} onChange={(e) => updateVisitField('sentHomeTime', e.target.value)} />
              </label>
              <label className="form-field-full">
                Attending physician
                <input value={editingVisit.attendingPhysician} onChange={(e) => updateVisitField('attendingPhysician', e.target.value)} />
              </label>
            </div>

            <button type="submit" className="primary-action form-submit">
              <Icon name="clipboard" /> Save clinic visit
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
