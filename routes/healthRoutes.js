// routes/healthRoutes.js
import express from "express";
import { checkHealth } from "../controllers/healthController.js";

const router = express.Router();

// Simple health check endpoint
router.get("/health", checkHealth);

export default router;
