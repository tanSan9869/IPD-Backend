import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import Request from "../models/Request.js";

export const getPatientById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ success: false, message: "Invalid patient ID" });

  try {
    const patient = await Patient.findById(id).select("-password -__v").lean();
    if (!patient)
      return res.status(404).json({ success: false, message: "Patient not found" });

    return res.json({ success: true, patient });
  } catch (error) {
    console.error("❌ Error fetching patient:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const sendRequestToDoctor = async (req, res) => {
  const { id } = req.params; // patientId
  const { doctorId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(doctorId))
    return res.status(400).json({ success: false, message: "Invalid patient or doctor ID" });

  try {
    const patient = await Patient.findById(id);
    const doctor = await Doctor.findById(doctorId);

    if (!patient || !doctor)
      return res.status(404).json({ success: false, message: "Patient or Doctor not found" });

    const newRequest = new Request({ patientId: id, doctorId, status: "pending" });
    await newRequest.save();

    return res.json({ success: true, message: "Request sent successfully", request: newRequest });
  } catch (error) {
    console.error("❌ Error creating request:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getPatientRequests = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ success: false, message: "Invalid patient ID" });

  try {
    const requests = await Request.find({ patientId: id })
      .populate("doctorId", "name specialization email")
      .lean();

    return res.json({ success: true, requests });
  } catch (error) {
    console.error("❌ Error fetching requests:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
