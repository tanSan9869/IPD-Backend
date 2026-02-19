// controllers/fileController.js
import fs from "fs";
import mongoose from "mongoose";
import multer from "multer";
import FileModel from "../models/File.js";
import { uploadEncryptedFileToMega, downloadDecryptedFileFromMega } from "../mega.js";

// Multer setup (temporary upload storage)
export const upload = multer({ dest: "uploads/" });

// 📤 Upload with encryption
export const uploadFile = async (req, res) => {
  const patientId = req.params.id;
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  try {
    const result = await uploadEncryptedFileToMega(
      req.file.path,
      req.file.originalname,
      patientId
    );

    // Remove local temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    res.json(result);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📂 List files
export const listFiles = async (req, res) => {
  try {
    const patientId = req.params.id;
    const docs = await FileModel.find({ patientId }).sort({ uploadedAt: -1 });

    const files = docs.map((f) => ({
      _id: f._id.toString(),
      name: f.originalName,
      size: f.size ?? null,
    }));

    res.json({ success: true, files });
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch files" });
  }
};

// �‍⚕️ Doctor view: return array directly with fields used by frontend
export const listFilesForDoctor = async (req, res) => {
  try {
    const patientId = req.params.patientId || req.params.id;
    const docs = await FileModel.find({ patientId }).sort({ uploadedAt: -1 });
    const files = docs.map((f) => ({
      _id: f._id.toString(),
      originalName: f.originalName,
      size: null,
      uploadedAt: f.uploadedAt,
    }));
    res.json(files);
  } catch (err) {
    console.error('Doctor list files error:', err);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
};

// �📥 Download with decryption
export const downloadDecryptedFile = async (req, res) => {
  try {
    const { id: patientId, fileId } = req.params;
    const result = await downloadDecryptedFileFromMega(fileId, patientId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const { filePath, fileName } = result;
    res.download(filePath, fileName, () => {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ success: false, message: "Download failed" });
  }
};

// 🗑️ Delete file
export const deleteFile = async (req, res) => {
  try {
    const { id: patientId, fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ success: false, message: "Invalid file ID" });
    }

    const fileDoc = await FileModel.findById(fileId);
    if (!fileDoc || fileDoc.patientId.toString() !== patientId) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    if (fileDoc.path && fs.existsSync(fileDoc.path)) {
      fs.unlinkSync(fileDoc.path);
    }

    await FileModel.findByIdAndDelete(fileId);

    res.json({ success: true, message: "File deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ success: false, message: "Delete failed", error: err.message });
  }
};
