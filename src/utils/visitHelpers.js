/**
 * Generate initials from a full name (max 2 characters)
 */
export function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Build a detail string from course, year level, and section
 */
export function buildDetail(course, yearLevel, section) {
  const courseInfo = course || ''
  const yearSection = [yearLevel, section].filter(Boolean).join(' · ')
  return [courseInfo, yearSection].filter(Boolean).join(' · ') || 'Walk-in consultation'
}

/**
 * Format a date for display
 */
export function formatVisitDate(dateString) {
  if (dateString) {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Generate a tone color for an avatar based on a course.
 * Mirrors the Students page behavior: hashes the course string
 * into one of the available avatar tone classes.
 */
export function getCourseTone(course) {
  if (!course) return 'blue'
  const tones = ['blue', 'yellow', 'green', 'red']
  const hash = String(course)
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return tones[hash % tones.length]
}

/**
 * Generate a tone color for an avatar based on clinic status.
 * Active (still in the clinic) -> red, timed out -> green.
 */
export function getStatusTone(visit) {
  return visit && visit.dischargedAt ? 'green' : 'red'
}
