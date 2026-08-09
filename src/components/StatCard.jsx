import Icon from './Icon'

export default function StatCard({ icon, color, value, label, subtext }) {
  return (
    <article className={`stat-card ${color}`}>
      <span className="stat-icon">
        <Icon name={icon} />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
        <small>{subtext}</small>
      </div>
    </article>
  )
}