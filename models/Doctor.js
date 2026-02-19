// backend/models/Doctor.js
import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    uniqueId: { type: String, required: true, unique: true },
    specialization: { type: String, required: true },
  },
  { timestamps: true }
);

const Doctor = mongoose.model("Doctor", DoctorSchema);
export default Doctor; // default export
