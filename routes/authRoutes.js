import { Router } from "express";
import { patientSignup, doctorSignup, loginUser } from "../controllers/authController.js";

const router = Router();

router.post("/patient-signup", patientSignup);
router.post("/doctor-signup", doctorSignup);
router.post("/login", loginUser);

export default router;
