// backend/models/Request.js
import mongoose from "mongoose";

const RequestSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

const Request = mongoose.model("Request", RequestSchema);
export default Request;
