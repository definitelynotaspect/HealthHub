import { useMemo } from 'react'

function toDateKey(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthDate(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

export default function VisitBarChart({ visits, monthValue, weekNumber }) {
  const chartData = useMemo(() => {
    const monthDate = getMonthDate(monthValue)
    const selectedWeek = Number(weekNumber) || 1
    const startDay = (selectedWeek - 1) * 7 + 1
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const endDay = Math.min(startDay + 6, lastDay)

    const days = []
    for (let day = startDay; day <= endDay; day++) {
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const year = d.getFullYear()
      const fullDate = d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      days.push({
        weekday,
        monthDay,
        year,
        fullDate,
        dateStr: toDateKey(d),
        count: 0,
      })
    }

    visits.forEach((v) => {
      const visitDate = toDateKey(v.visitDateTime || v.timestamp)
      const day = days.find((d) => d.dateStr === visitDate)
      if (day) day.count++
    })

    return days
  }, [monthValue, visits, weekNumber])

  const maxCount = Math.max(...chartData.map((d) => d.count), 1)
  const width = 520
  const height = 220
  const leftPad = 24
  const rightPad = 24
  const barWidth = 34
  const labelSpace = 54
  const plotHeight = 146
  const plotBottom = height
  const gap = (width - leftPad - rightPad - chartData.length * barWidth) / (chartData.length + 1)

  const barX = (index) => leftPad + gap + index * (barWidth + gap)
  const barHeight = (count) => (count / maxCount) * plotHeight
  const barY = (count) => plotBottom - barHeight(count)

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height + labelSpace}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Clinic visits per day for the selected week"
      >
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = plotBottom - frac * plotHeight
          return (
            <line
              key={frac}
              className="visit-bar-chart-grid"
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              strokeWidth="1"
            />
          )
        })}

        {chartData.map((day, index) => {
          const x = barX(index)
          const h = barHeight(day.count)
          const y = barY(day.count)
          return (
            <g key={day.dateStr}>
              <rect
                className="visit-bar-chart-bar"
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx="4"
                ry="4"
              >
                <title>{day.count} visit{day.count !== 1 ? 's' : ''} on {day.fullDate}</title>
              </rect>
              {day.count > 0 && (
                <text
                  className="visit-bar-chart-value"
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="DM Sans, Arial, sans-serif"
                >
                  {day.count}
                </text>
              )}
              <text
                className="visit-bar-chart-label"
                x={x + barWidth / 2}
                y={height + 14}
                textAnchor="middle"
                fontSize="10"
                fontFamily="DM Sans, Arial, sans-serif"
              >
                <tspan x={x + barWidth / 2}>{day.weekday}</tspan>
                <tspan x={x + barWidth / 2} dy="12">{day.monthDay}</tspan>
                <tspan x={x + barWidth / 2} dy="12">{day.year}</tspan>
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
