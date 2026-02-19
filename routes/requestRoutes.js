// backend/routes/requestRoutes.js
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import requireRole from '../middleware/requireRole.js';
import * as ctrl from '../controllers/requestController.js';

const router = Router();

// Patient creates/updates request
router.post('/', requireAuth, requireRole('patient'), ctrl.apply);

// Doctor reads incoming requests
router.get('/doctor', requireAuth, requireRole('doctor'), ctrl.forDoctor);

// Patient reads own requests
router.get('/patient', requireAuth, requireRole('patient'), ctrl.forPatient);

// Patient revokes a request (supports PATCH or POST for compatibility)
router.patch('/:id/revoke', requireAuth, requireRole('patient'), ctrl.revoke);
router.post('/:id/revoke', requireAuth, requireRole('patient'), ctrl.revoke);

// Doctor updates status
router.patch('/:id', requireAuth, requireRole('doctor'), ctrl.update);

// Doctor views patient files (approved requests only)
router.get('/:id/patient-files', requireAuth, requireRole('doctor'), ctrl.getPatientFiles);

export default router;
