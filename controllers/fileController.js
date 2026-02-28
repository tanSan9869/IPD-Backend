// controllers/fileController.js
import fs from "fs";
import mongoose from "mongoose";
import multer from "multer";
import FileModel from "../models/File.js";
import {
  uploadEncryptedFileToCloudinary,
  downloadDecryptedFileFromCloudinary,
  deleteCloudinaryAssetIfPresent,
} from "../cloudinaryStorage.js";
import { downloadDecryptedFileFromMega } from "../mega.js";

// Multer setup (temporary upload storage)
export const upload = multer({ dest: "uploads/" });

// 📤 Upload with encryption
export const uploadFile = async (req, res) => {
  const patientId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(patientId)) {
    return res.status(400).json({ success: false, message: "Invalid patient ID" });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  try {
    const result = await uploadEncryptedFileToCloudinary(
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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

// 📥 Download with decryption (supports both Cloudinary and legacy MEGA files)
export const downloadDecryptedFile = async (req, res) => {
  try {
    const { id: patientId, fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid file ID" });
    }

    const fileDoc = await FileModel.findById(fileId);
    if (!fileDoc || fileDoc.patientId.toString() !== patientId) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    let result;
    if (fileDoc.storageUrl) {
      // New Cloudinary-based storage
      result = await downloadDecryptedFileFromCloudinary(fileId, patientId);
    } else if (fileDoc.megaLink) {
      // Legacy MEGA-based storage
      result = await downloadDecryptedFileFromMega(fileId, patientId);
    } else {
      return res.status(400).json({
        success: false,
        message: "File has no storage location configured.",
      });
    }

    if (!result.success) {
      return res
        .status(400)
        .json({ success: false, message: result.message || "Download failed" });
    }

    const { filePath, fileName } = result;
    res.download(filePath, fileName, () => {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    });
  } catch (err) {
    console.error("Download error:", err);
    res
      .status(500)
      .json({ success: false, message: "Download failed", error: err.message });
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

    // Best-effort delete from Cloudinary
    try {
      await deleteCloudinaryAssetIfPresent(fileDoc);
    } catch {}

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
