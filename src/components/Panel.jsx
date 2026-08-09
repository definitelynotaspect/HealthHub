export default function Panel({ className = '', heading, actions, children }) {
  return (
    <article className={`panel ${className}`}>
      {(heading || actions) && (
        <div className="panel-heading">
          <div>{heading}</div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </article>
  )
}