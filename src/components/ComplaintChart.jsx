import { topComplaints } from '../data/constants'

export default function ComplaintChart() {
  const total = topComplaints.reduce((sum, c) => sum + c.value, 0)
  const stops = topComplaints
    .map((complaint, index) => {
      const from = topComplaints
        .slice(0, index)
        .reduce((total, item) => total + item.value, 0)
      return `${complaint.color} ${from}% ${from + complaint.value}%`
    })
    .join(', ')

  return (
    <>
      <div
        className="donut"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div>
          <strong>{total}</strong>
          <span>consultations</span>
        </div>
      </div>
      <div className="legend">
        {topComplaints.map((item) => (
          <div key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
            <b>{item.value}%</b>
          </div>
        ))}
      </div>
    </>
  )
}