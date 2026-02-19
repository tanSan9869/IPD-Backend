// backend/middleware/canViewPatientFiles.js
import Request from '../models/Request.js';

export default async function canViewPatientFiles(req, res, next) {
  try {
    const doctorId = req.user?.id;
    const { patientId } = req.params;
    if (!doctorId || !patientId) {
      return res.status(400).json({ message: 'Missing doctorId or patientId' });
    }
    const ok = await Request.exists({ doctorId, patientId, status: 'approved' });
    if (!ok) return res.status(403).json({ message: 'Access denied' });
    next();
  } catch (err) {
    next(err);
  }
}
