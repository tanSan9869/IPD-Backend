import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  // Legacy MEGA link (kept for backward compatibility)
  megaLink: { type: String, required: false },

  // New storage fields (Supabase or other providers)
  storageProvider: { type: String, default: "supabase" },
  storageUrl: { type: String },
  storagePublicId: { type: String },

  // Optional size (bytes)
  size: { type: Number },
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
