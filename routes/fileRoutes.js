// routes/fileRoutes.js
import express from "express";
import {
  uploadFile,
  listFiles,
  downloadDecryptedFile,
  deleteFile,
  upload,
  listFilesForDoctor,
} from "../controllers/fileController.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import canViewPatientFiles from "../middleware/canViewPatientFiles.js";

const router = express.Router();

// File upload
router.post("/patient/:id/upload", upload.single("file"), uploadFile);

// List files
router.get("/patient/:id/files", listFiles);

// Download decrypted file
router.get("/patient/:id/download-decrypted/:fileId", downloadDecryptedFile);

// Delete file
router.delete("/patient/:id/file/:fileId", deleteFile);

// Doctor: list patient's files (approved access)
router.get(
  "/doctor/patient/:patientId",
  requireAuth,
  requireRole("doctor"),
  canViewPatientFiles,
  listFilesForDoctor
);

// Doctor: download decrypted file (approved access)
router.get(
  "/doctor/patient/:patientId/file/:fileId",
  requireAuth,
  requireRole("doctor"),
  canViewPatientFiles,
  (req, res, next) => {
    req.params.id = req.params.patientId;
    return downloadDecryptedFile(req, res, next);
  }
);

export default router;
