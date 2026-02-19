// backend/routes/summarizeRoutes.js
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import requireRole from '../middleware/requireRole.js';
import canViewPatientFiles from '../middleware/canViewPatientFiles.js';
import { summarizeText, summarizeDoctorFile } from '../controllers/summarizeController.js';

const router = Router();

// Summarize arbitrary text (any authenticated user)
router.post('/text', requireAuth, summarizeText);

// Summarize a patient's file (doctor with approved access)
router.post('/doctor/patient/:patientId/file/:fileId', requireAuth, requireRole('doctor'), canViewPatientFiles, summarizeDoctorFile);

export default router;
