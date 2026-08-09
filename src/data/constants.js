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
}

// Sidebar navigation items
export const navItems = [
  ['Dashboard', 'grid'],
  ['Students', 'students'],
  ['Concern Page', 'clipboard'],
  ['Visit history', 'history'],
  ['Medicine Inventory', 'inventory'],
]

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
].map((name) => ({ name, quantity: 0 }))

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
