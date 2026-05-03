// controllers/otpController.js
import { createTransport } from "nodemailer";
import { randomInt } from "crypto";
import Patient from "../models/Patient.js";

const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 10 * 60 * 1000); // default: 10 minutes

// In-memory OTP store (resets on server restart / redeploy)
// Shape: { [email]: { otp: string, expiresAt: number } }
const storedOTP = Object.create(null);

let cachedTransporter = null;

const sanitizeEmailConfig = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  // Gmail app passwords are often displayed with spaces; tolerate either format.
  const pass = String(process.env.EMAIL_PASS || "").trim().replace(/\s+/g, "");
  return { user, pass };
};

const hasEmailConfig = () => {
  const { user, pass } = sanitizeEmailConfig();
  return Boolean(user && pass);
};

const getTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;
  if (!hasEmailConfig()) return null;

  const { user, pass } = sanitizeEmailConfig();
  const transporter = createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  // Verify once so configuration issues surface clearly.
  await transporter.verify();

  cachedTransporter = transporter;
  return cachedTransporter;
};

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const transporter = await getTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        code: "EMAIL_NOT_CONFIGURED",
        message: "Email service not configured on server",
      });
    }

    const otp = String(randomInt(100000, 1000000));
    storedOTP[normalizedEmail] = { otp, expiresAt: Date.now() + OTP_TTL_MS };

    await transporter.sendMail({
      from: sanitizeEmailConfig().user,
      to: normalizedEmail,
      subject: "Email Verification OTP",
      text: `Your OTP is: ${otp}`,
    });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP send error:", error);

    const message = String(error?.message || "");
    const code = String(error?.code || "");
    const command = String(error?.command || "");

    const isEmailConfigOrAuth =
      code === "EAUTH" ||
      /auth|login|invalid|credentials|Missing credentials|Username and Password not accepted/i.test(message) ||
      /AUTH/i.test(command);

    const status = isEmailConfigOrAuth ? 503 : 500;
    res.status(status).json({
      success: false,
      code: isEmailConfigOrAuth ? "EMAIL_AUTH_FAILED" : "OTP_SEND_FAILED",
      message: isEmailConfigOrAuth ? "Email service authentication failed" : "Failed to send OTP",
    });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: "Email and OTP required" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedOtp = String(otp).trim();
    if (!normalizedEmail || !normalizedOtp) {
      return res.status(400).json({ success: false, message: "Email and OTP required" });
    }

    const patient = await Patient.findOne({ email: normalizedEmail });
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found" });

    const entry = storedOTP[normalizedEmail];
    if (!entry) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (Date.now() > entry.expiresAt) {
      delete storedOTP[normalizedEmail];
      return res.json({ success: false, message: "OTP expired" });
    }

    if (entry.otp === normalizedOtp) {
      delete storedOTP[normalizedEmail];
      return res.json({ success: true, message: "OTP verified", patientId: patient._id });
    }

    res.json({ success: false, message: "Invalid OTP" });
  } catch (error) {
    console.error("OTP verify error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
