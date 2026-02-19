import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getPatientById,
  sendRequestToDoctor,
  getPatientRequests,
} from "../controllers/patientController.js";

const router = express.Router();

// All patient routes require authentication
router.get("/:id", verifyToken, getPatientById);
router.post("/:id/request", verifyToken, sendRequestToDoctor);
router.get("/:id/requests", verifyToken, getPatientRequests);

export default router;
