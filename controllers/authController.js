import { hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";

// 🧠 Patient Signup
export const patientSignup = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !username || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters long." });

    const existingPatient = await Patient.findOne({ username });
    if (existingPatient)
      return res.status(400).json({ message: "Username already exists." });

    const hashedPassword = await hash(password, 10);
    const newPatient = new Patient({ name, email, username, password: hashedPassword });
    await newPatient.save();

    res.status(201).json({ message: "Patient registered successfully." });
  } catch (error) {
    console.error("❌ Patient Signup Error:", error);
    res.status(500).json({ message: "Error registering patient." });
  }
};

// 🧠 Doctor Signup
export const doctorSignup = async (req, res) => {
  try {
    const { name, username, email, password, uniqueId, specialization } = req.body;

    const doctorExists = await Doctor.findOne({ uniqueId });
    if (doctorExists)
      return res.status(400).json({ message: "Doctor ID already exists!" });

    const hashedPassword = await hash(password, 10);
    const newDoctor = new Doctor({
      name,
      username,
      email,
      password: hashedPassword,
      uniqueId,
      specialization,
    });

    await newDoctor.save();
    res.status(201).json({ message: "Doctor registered successfully." });
  } catch (error) {
    console.error("❌ Doctor Signup Error:", error);
    res.status(500).json({ message: "Error registering doctor." });
  }
};

// 🧠 Login (Patient or Doctor)
export const loginUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const Model = role === "doctor" ? Doctor : Patient;

    const user = await Model.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const isMatch = await compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    // Token expiry configurable via env (default 1 hour)
    const expiresIn = process.env.JWT_EXPIRES_IN || "1h";
    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn });

    res.json({ message: "Login successful", token, id: user._id, role });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
