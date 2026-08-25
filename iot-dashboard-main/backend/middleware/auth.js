const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT sent in the Authorization header (Bearer token).
 * Attaches { id, name, email, role } to req.user on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Role-based access control.
 * Usage: requireRole('operator')  -> only operators pass
 *        requireRole('user','operator') -> both pass (any authenticated role)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. This action requires role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
