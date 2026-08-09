import { trendSets, dayLabels } from '../data/constants'

export default function TrendChart({ period }) {
  const values = trendSets[period]
  const width = 760
  const height = 250
  const inset = 24
  const max = 22

  const points = values.map((value, index) => ({
    x: inset + index * ((width - inset * 2) / (values.length - 1)),
    y: height - inset - (value / max) * (height - inset * 2),
  }))

  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${inset},${height - inset} ${line} ${width - inset},${height - inset}`

  const labels = period === 'week'
    ? dayLabels
    : values.map((_, i) => `${i + 1} Jul`)

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Clinic visits over the past ${period}`}
      >
        {[0, 1, 2, 3].map((row) => (
          <line
            key={row}
            x1={inset}
            x2={width - inset}
            y1={inset + row * 64}
            y2={inset + row * 64}
            className="chart-grid"
          />
        ))}
        <polygon points={area} className="chart-area" />
        <polyline points={line} className="chart-line" />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="4" className="chart-dot">
            <title>{values[index]} visits</title>
          </circle>
        ))}
      </svg>
      <div className="chart-labels">
        {labels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
    </div>
  )
}