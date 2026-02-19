// backend/middleware/requireAuth.js
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export default function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    const id = payload.id;

    if (!id) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    req.user = { id, role: payload.role };
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
