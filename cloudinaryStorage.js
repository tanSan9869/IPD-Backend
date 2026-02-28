import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

import {
  generateAESKey,
  encryptFileAES,
  decryptFileAES,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA,
} from "./utils/cryptoUtils.js";
import { publicKey, privateKey } from "./keys/rsaKeys.js";
import FileModel from "./models/File.js";

let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    const e = new Error(
      "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.",
    );
    e.statusCode = 500;
    e.code = "SUPABASE_MISSING_CREDS";
    throw e;
  }

  supabase = createClient(url, key);
  return supabase;
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function supabaseBucket() {
  return process.env.SUPABASE_BUCKET || "smartcare-encrypted";
}

async function downloadUrlToFile(url, outputPath) {
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(
      `Failed to download encrypted file (HTTP ${res.status}) ${text}`,
    );
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
 * Upload flow (same encryption as before, now using Supabase Storage):
 * 1) AES key generated
 * 2) File encrypted locally (AES-256-CBC)
 * 3) AES key encrypted with RSA public key
 * 4) Encrypted file uploaded to Supabase Storage as a blob
 * 5) Metadata stored in Mongo
 */
export async function uploadEncryptedFileToCloudinary(
  filePath,
  fileName,
  patientId,
) {
  const client = getSupabaseClient();
  const bucket = supabaseBucket();

  const originalName = fileName;

  // 1) Encrypt locally
  const aesKey = generateAESKey();
  const encryptedAESKey = encryptAESKeyWithRSA(aesKey, publicKey);

  const safeName = sanitizeFilename(fileName);
  const encryptedFilePath = path.join(
    path.dirname(filePath),
    `enc_${Date.now()}_${safeName}`,
  );
  const { iv } = await encryptFileAES(filePath, aesKey, encryptedFilePath);

  try {
    const stats = fs.statSync(encryptedFilePath);
    const fileBuffer = await fs.promises.readFile(encryptedFilePath);

    // 2) Upload encrypted file to Supabase Storage
    const objectPath = `${patientId}/${Date.now()}_${safeName}.enc`;
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(objectPath, fileBuffer, {
        contentType: "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      const e = new Error(`Supabase upload failed: ${uploadError.message}`);
      e.statusCode = 500;
      throw e;
    }

    // 3) Get a public URL (bucket can be public; file is still encrypted)
    const { data: publicData, error: publicErr } = client.storage
      .from(bucket)
      .getPublicUrl(objectPath);

    if (publicErr) {
      const e = new Error(`Supabase getPublicUrl failed: ${publicErr.message}`);
      e.statusCode = 500;
      throw e;
    }

    const publicUrl = publicData.publicUrl;

    // 4) Persist metadata
    await FileModel.create({
      originalName,
      storageProvider: "supabase",
      storageUrl: publicUrl,
      storagePublicId: objectPath,
      encryptedAESKey,
      iv,
      patientId,
      size: stats.size,
    });

    return {
      success: true,
      message: "File encrypted & uploaded successfully!",
      fileName: originalName,
      link: publicUrl,
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
 * Download flow:
 * 1) Download encrypted .enc from Supabase URL
 * 2) Decrypt AES key with RSA private key
 * 3) Decrypt file locally (AES-256-CBC)
 */
export async function downloadDecryptedFileFromCloudinary(fileId, patientId) {
  getSupabaseClient();

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
    console.error("❌ Supabase download error:", error);
    return {
      success: false,
      message: "Supabase download failed.",
      error: error.message,
    };
  }
}

export async function deleteCloudinaryAssetIfPresent(fileDoc) {
  const client = getSupabaseClient();
  const bucket = supabaseBucket();

  const objectPath = fileDoc?.storagePublicId;
  if (!objectPath) return;

  try {
    const { error } = await client.storage.from(bucket).remove([objectPath]);
    if (error) {
      console.error("❌ Supabase delete failed:", error);
    }
  } catch (err) {
    console.error("❌ Supabase delete failed:", err);
  }
}
