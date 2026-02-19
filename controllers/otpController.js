// controllers/otpController.js
import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import Patient from "../models/Patient.js";

dotenv.config();

const transporter = createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const storedOTP = {};

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    storedOTP[email] = otp;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification OTP",
      text: `Your OTP is: ${otp}`,
    });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP send error:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: "Email and OTP required" });

    const patient = await Patient.findOne({ email });
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found" });

    if (storedOTP[email] === otp) {
      delete storedOTP[email];
      return res.json({ success: true, message: "OTP verified", patientId: patient._id });
    }

    res.json({ success: false, message: "Invalid OTP" });
  } catch (error) {
    console.error("OTP verify error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};
