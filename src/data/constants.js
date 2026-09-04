// Navigation icons using unicode characters
export const icons = {
  grid: '\u25A6',
  students: '\u2659',
  history: '\u25F7',
  calendar: '\u25A3',
  search: '\u2315',
  bell: '\u2667',
  plus: '+',
  arrow: '\u2192',
  close: '\u00D7',
  heart: '\u2665',
  clipboard: '\u25A4',
  chart: '\u2341',
  inventory: '\u25C6',
  download: '\u2B07',
  personal: '\u25A7',
}

// Sidebar navigation items
export const navItems = [
  ['Dashboard', 'grid'],
  ['Patients', 'students'],
  ['Personal Data', 'personal'],
  ['Concern Page', 'clipboard'],
  ['Visit history', 'history'],
  ['Medicine Inventory', 'inventory'],
]

const medicineColors = [
  ['#e9f0ff', '#1d4eb5'],
  ['#e2f7eb', '#168c4a'],
  ['#fff6d9', '#ad8100'],
  ['#fff0f0', '#d82e2a'],
]

function createMedicineImage(name, index) {
  const [background, foreground] = medicineColors[index % medicineColors.length]
  const initials = name
    .replace(/\([^)]*\)/g, '')
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="18" fill="${background}"/>
      <g transform="rotate(-24 48 48)">
        <rect x="22" y="37" width="52" height="22" rx="11" fill="#fff"/>
        <path d="M48 37h15a11 11 0 0 1 0 22H48z" fill="${foreground}"/>
        <path d="M48 37v22" stroke="${background}" stroke-width="3"/>
      </g>
      <text x="48" y="78" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="${foreground}">${initials || 'Rx'}</text>
    </svg>
  `

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const medicineDescriptions = {
  Neozep: 'Commonly used for cold symptoms such as stuffy nose, runny nose, sneezing, headache, and fever.',
  Alaxan: 'Commonly used for body pain, headache, muscle aches, toothache, and fever.',
  'Biogesic (Paracetamol)': 'Paracetamol/acetaminophen is commonly used to reduce fever and relieve mild to moderate pain.',
  'Medicol or Advil (Ibuprofen)': 'Ibuprofen is commonly used for pain, fever, and inflammation such as muscle aches or menstrual cramps.',
  'Dolfenal or Ponstan (Mefenamic Acid)': 'Mefenamic acid is commonly used for short-term pain relief, including menstrual cramps and other mild to moderate pain.',
  'Alnix or Zyrtec (Cetirizine)': 'Cetirizine is commonly used for allergy symptoms such as sneezing, runny nose, itchy eyes, and hives.',
  'Claritin (Loratadine)': 'Loratadine is commonly used for allergy symptoms such as sneezing, runny nose, itchy or watery eyes, and itching.',
  Benadryl: 'Diphenhydramine is commonly used for allergy symptoms and itching, and may cause drowsiness.',
  Bioflu: 'Commonly used for flu-like symptoms such as fever, headache, body aches, colds, and nasal congestion.',
  'Kremil-S': 'Commonly used for hyperacidity, heartburn, indigestion, and gas discomfort.',
  Betadine: 'Commonly used as an antiseptic for cleaning minor wounds and helping reduce germs on the skin.',
  'Green Cross Alcohol': 'Commonly used as a disinfectant for skin and surfaces, following product directions.',
}

const medicineCategories = {
  Neozep: 'Colds and fever',
  Alaxan: 'Pain and fever',
  'Biogesic (Paracetamol)': 'Fever and pain relief',
  'Medicol or Advil (Ibuprofen)': 'Pain, fever, and inflammation',
  'Dolfenal or Ponstan (Mefenamic Acid)': 'Pain relief',
  'Alnix or Zyrtec (Cetirizine)': 'Allergy',
  'Claritin (Loratadine)': 'Allergy',
  Benadryl: 'Allergy',
  Bioflu: 'Flu and colds',
  'Kremil-S': 'Stomach and acidity',
  Betadine: 'Wound care',
  'Green Cross Alcohol': 'Disinfectant',
}

// Default medicine inventory list (each starts with 0 stock until stocked)
export const defaultMedicineInventory = [
  'Neozep',
  'Alaxan',
  'Biogesic (Paracetamol)',
  'Medicol or Advil (Ibuprofen)',
  'Dolfenal or Ponstan (Mefenamic Acid)',
  'Alnix or Zyrtec (Cetirizine)',
  'Claritin (Loratadine)',
  'Benadryl',
  'Bioflu',
  'Kremil-S',
  'Betadine',
  'Green Cross Alcohol',
].map((name, index) => ({
  name,
  quantity: 0,
  image: createMedicineImage(name, index),
  description: medicineDescriptions[name] || '',
  category: medicineCategories[name] || 'General medicine',
}))

// Demo credentials
export const DEMO_EMAIL = 'interworldcolleges@clinic.com'
export const DEMO_PASSWORD = 'password123'

// Default form state for new visits
export const emptyVisitForm = {
  name: '',
  studentId: '',
  course: '',
  yearLevel: '',
  section: '',
  dateTime: '',
  concern: '',
}

// Year level options
export const yearLevelOptions = [
  { value: '', label: 'Select year' },
  { value: '1st Year', label: '1st Year' },
  { value: '2nd Year', label: '2nd Year' },
  { value: '3rd Year', label: '3rd Year' },
  { value: '4th Year', label: '4th Year' },
]

// Trend chart data (weekly)
export const trendSets = {
  week: [8, 12, 15, 10, 18, 14, 20],
  month: [45, 52, 48, 60, 55, 58, 62, 50, 47, 53, 59, 64, 48, 52, 55, 58, 62, 60, 57, 63, 58, 54, 50, 56, 61, 59, 55, 52, 48, 44],
}

// Day labels for chart x-axis
export const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Top complaints sample data
export const topComplaints = [
  { label: 'Headache', value: 35, color: '#e4342a' },
  { label: 'Fever', value: 25, color: '#f1bc10' },
  { label: 'Cough', value: 20, color: '#168c4a' },
  { label: 'Stomach ache', value: 12, color: '#1d4eb5' },
  { label: 'Other', value: 8, color: '#9b59b6' },
]
