// backend/routes/doctorRoutes.js
import { Router } from 'express';
import { getAllDoctors, getDoctorById } from '../controllers/doctorController.js';

const router = Router();

// Public: list all doctors
router.get('/', getAllDoctors);

// Get doctor by ID
router.get('/:id', getDoctorById);

export default router;
