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
    const exactLocal = String(dateString).match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
    )
    if (exactLocal && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(String(dateString))) {
      const [, year, month, day, hour, minute, second = '00'] = exactLocal
      const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }

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

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

export function toLocalDateTimeInputValue(value) {
  if (!value) return ''
  const exactLocal = String(value).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  if (exactLocal && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(String(value))) {
    return `${exactLocal[1]}T${exactLocal[2]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + 'T' + [
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
  ].join(':')
}

export function toLocalDateKey(value) {
  if (!value) return ''
  const exactLocal = String(value).match(/^(\d{4}-\d{2}-\d{2})[T ]/)
  if (exactLocal && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(String(value))) {
    return exactLocal[1]
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')
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
