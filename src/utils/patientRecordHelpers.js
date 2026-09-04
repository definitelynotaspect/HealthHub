export const positionOptions = [
  { value: '', label: 'Select position' },
  { value: 'Student', label: 'Student' },
  { value: 'Instructor', label: 'Instructor' },
  { value: 'Guard', label: 'Guard' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Admin', label: 'Admin' },
]

export const departmentCourseOptions = {
  'College of Information and Computer Studies': [
    { value: 'ACT', label: 'ACT' },
    { value: 'BSCS', label: 'BSCS' },
  ],
  'College of Education': [
    { value: 'BEEd', label: 'BEEd' },
    { value: 'BSEd', label: 'BSEd' },
  ],
  'College of Business and Accountancy': [
    { value: 'BSA', label: 'BSA' },
    { value: 'BSBA', label: 'BSBA' },
  ],
  'College of Criminal Justice Education': [
    { value: 'BSCRIM', label: 'BSCRIM' },
  ],
  'College of Public Administration': [
    { value: 'BSPA', label: 'BSPA' },
  ],
  'College of Hospitality and Tourism Management': [
    { value: 'BSTM', label: 'BSTM' },
  ],
}

export const departmentOptions = [
  { value: '', label: 'Select department' },
  ...Object.keys(departmentCourseOptions).map((department) => ({
    value: department,
    label: department,
  })),
]

export const staffDepartmentOptions = [
  ...departmentOptions,
  { value: 'Security', label: 'Security' },
  { value: 'Facilities and Maintenance', label: 'Facilities and Maintenance' },
  { value: 'Administration', label: 'Administration' },
]

export const yearLevelOptions = [
  { value: '', label: 'Select year' },
  { value: '1st Year', label: '1st Year' },
  { value: '2nd Year', label: '2nd Year' },
  { value: '3rd Year', label: '3rd Year' },
  { value: '4th Year', label: '4th Year' },
]

export const twoYearCourseOptions = yearLevelOptions.filter(
  (option) => !['3rd Year', '4th Year'].includes(option.value)
)

export function getYearLevelOptions(course) {
  return course === 'ACT' ? twoYearCourseOptions : yearLevelOptions
}

export function getCourseOptions(department) {
  return [
    { value: '', label: 'Select course' },
    ...(departmentCourseOptions[department] || []),
  ]
}

export function isStudentPosition(position) {
  return !position || position === 'Student'
}

export function isStaffPosition(position) {
  return ['Instructor', 'Guard', 'Maintenance', 'Admin'].includes(position)
}

export function getRecordId(record) {
  return record.studentId || record.employeeId || ''
}

export function getRecordLabel(record) {
  return record.position === 'Student' || !record.position ? 'Student' : record.position
}

export function normalizePatientForm(form, fallbackId) {
  const position = form.position || ''
  const isStudent = isStudentPosition(position)

  return {
    studentId: isStudent ? form.studentId.trim() || fallbackId : '',
    employeeId: isStaffPosition(position) ? form.employeeId.trim() || fallbackId : '',
    name: form.name.trim(),
    position,
    department: form.department || '',
    course: isStudent ? form.course || '' : '',
    yearLevel: isStudent ? form.yearLevel || '' : '',
    section: isStudent ? form.section.trim() : '',
    contact: form.contact.trim(),
    address: form.address.trim(),
  }
}
