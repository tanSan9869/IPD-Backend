import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

import {
  generateAESKey,
  encryptFileAES,
  decryptFileAES,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA,
} from "./utils/cryptoUtils.js";
import { publicKey, privateKey } from "./keys/rsaKeys.js";
import FileModel from "./models/File.js";

function ensureCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const e = new Error(
      "Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
    e.statusCode = 500;
    e.code = "CLOUDINARY_MISSING_CREDS";
    throw e;
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function cloudinaryFolder() {
  return process.env.CLOUDINARY_FOLDER || "smartcare";
}

async function downloadUrlToFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(`Failed to download encrypted file (HTTP ${res.status}) ${text}`);
    e.statusCode = 502;
    throw e;
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const fileStream = fs.createWriteStream(outputPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });
}

/**
 * Upload flow (same encryption as MEGA):
 * 1) AES key generated
 * 2) File encrypted locally (AES-256-CBC)
 * 3) AES key encrypted with RSA public key
 * 4) Encrypted file uploaded to Cloudinary as raw
 * 5) Metadata stored in Mongo
 */
export async function uploadEncryptedFileToCloudinary(filePath, fileName, patientId) {
  ensureCloudinaryConfigured();

  const originalName = fileName;

  // 1) Encrypt locally
  const aesKey = generateAESKey();
  const encryptedAESKey = encryptAESKeyWithRSA(aesKey, publicKey);

  const safeName = sanitizeFilename(fileName);
  const encryptedFilePath = path.join(path.dirname(filePath), `enc_${Date.now()}_${safeName}`);
  const { iv } = await encryptFileAES(filePath, aesKey, encryptedFilePath);

  try {
    const stats = fs.statSync(encryptedFilePath);

    // 2) Upload encrypted file to Cloudinary (resource_type: raw)
    const publicIdBase = `${patientId}_${Date.now()}_${safeName}.enc`;

    const uploadResult = await cloudinary.uploader.upload(encryptedFilePath, {
      resource_type: "raw",
      folder: cloudinaryFolder(),
      public_id: publicIdBase,
      overwrite: false,
    });

    // 3) Persist metadata
    await FileModel.create({
      originalName,
      storageProvider: "cloudinary",
      storageUrl: uploadResult.secure_url,
      storagePublicId: uploadResult.public_id,
      encryptedAESKey,
      iv,
      patientId,
      size: stats.size,
    });

    return {
      success: true,
      message: "File encrypted & uploaded successfully!",
      fileName: originalName,
      link: uploadResult.secure_url,
    };
  } finally {
    // Cleanup temp encrypted file
    try {
      fs.unlinkSync(encryptedFilePath);
    } catch {
      // ignore
    }
  }
}

/**
 * Download flow (same decryption as MEGA):
 * 1) Download encrypted .enc from Cloudinary URL
 * 2) Decrypt AES key with RSA private key
 * 3) Decrypt file locally (AES-256-CBC)
 */
export async function downloadDecryptedFileFromCloudinary(fileId, patientId) {
  ensureCloudinaryConfigured();

  try {
    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord || fileRecord.patientId.toString() !== patientId) {
      return { success: false, message: "Access denied to this file." };
    }

    const url = fileRecord.storageUrl;
    if (!url) {
      return { success: false, message: "Stored file URL missing." };
    }

    // 1) Download encrypted
    const tempEncPath = path.join("uploads", `download_${Date.now()}.enc`);
    await downloadUrlToFile(url, tempEncPath);

    // 2) Decrypt AES key
    const aesKey = decryptAESKeyWithRSA(fileRecord.encryptedAESKey, privateKey);

    // 3) Decrypt file
    const tempDecPath = path.join("uploads", fileRecord.originalName);
    await decryptFileAES(tempEncPath, aesKey, fileRecord.iv, tempDecPath);

    // 4) Cleanup encrypted temp file
    try {
      fs.unlinkSync(tempEncPath);
    } catch {
      // ignore
    }

    return {
      success: true,
      filePath: tempDecPath,
      fileName: fileRecord.originalName,
    };
  } catch (error) {
    console.error("❌ Cloudinary download error:", error);
    return {
      success: false,
      message: "Cloudinary download failed.",
      error: error.message,
    };
  }
}

export async function deleteCloudinaryAssetIfPresent(fileDoc) {
  ensureCloudinaryConfigured();

  const publicId = fileDoc?.storagePublicId;
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    // Don't block delete if Cloudinary delete fails
    console.error("❌ Cloudinary delete failed:", err);
  }
}
