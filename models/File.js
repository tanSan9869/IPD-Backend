import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  megaLink: { type: String, required: true },
  encryptedAESKey: { type: String, required: true }, // Base64 string
  iv: { type: String, required: true }, // Hex string
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model("File", FileSchema);
