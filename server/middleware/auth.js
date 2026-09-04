import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' })
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
}
