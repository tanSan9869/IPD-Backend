// app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import otpRoutes from "./routes/otpRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import summarizeRoutes from "./routes/summarizeRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// --- CORS setup ---
// Allow frontend URL from environment variable + local development URLs
const normalizeOrigin = (value) => {
    const s = String(value || "").trim();
    // Browser Origin header never includes a trailing slash
    return s.replace(/\/+$/g, "");
};

const envFrontendOrigins = String(process.env.FRONTEND_URL || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...envFrontendOrigins,
]);

app.use(
    cors({
        origin: (origin, cb) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) return cb(null, true);
            
            if (allowedOrigins.has(origin)) return cb(null, true);
            
            // In development, allow any localhost
            if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
                return cb(null, true);
            }
            
            return cb(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    })
);

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api", healthRoutes);
app.use("/api/summarize", summarizeRoutes);

export default app;
