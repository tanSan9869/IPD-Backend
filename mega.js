import { Storage, File } from "megajs";
import { statSync, createReadStream, createWriteStream, unlinkSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  generateAESKey,
  encryptFileAES,
  decryptFileAES,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA
} from "./utils/cryptoUtils.js";
import { publicKey, privateKey } from "./keys/rsaKeys.js";
import FileModel from "./models/File.js";

dotenv.config();

let storage;

function classifyMegaError(err) {
  const code = err?.code;
  const message = String(err?.message || err || "");

  if (code === "EBLOCKED" || /User blocked/i.test(message)) {
    const e = new Error(
      "MEGA blocked this login (EBLOCKED: User blocked). " +
        "This commonly happens on cloud hosts (Render) due to MEGA security checks. " +
        "Unblock/verify the account in MEGA web, or switch to another storage provider."
    );
    e.statusCode = 503;
    e.code = "MEGA_EBLOCKED";
    return e;
  }

  // Common megajs auth failures
  if (/Wrong password/i.test(message) || /Incorrect/i.test(message)) {
    const e = new Error("MEGA authentication failed. Check MEGA_EMAIL/MEGA_PASSWORD.");
    e.statusCode = 401;
    e.code = "MEGA_AUTH";
    return e;
  }

  return err instanceof Error ? err : new Error(message || "MEGA error");
}

async function getStorageReady() {
  if (storage) return storage;

  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;
  if (!email || !password) {
    const e = new Error("MEGA credentials missing. Set MEGA_EMAIL and MEGA_PASSWORD.");
    e.statusCode = 500;
    e.code = "MEGA_MISSING_CREDS";
    throw e;
  }

  storage = new Storage({ email, password, autologin: true });

  // Prevent the process from crashing when megajs emits an 'error' event.
  try {
    if (typeof storage.on === "function") {
      storage.on("error", (err) => {
        console.error("❌ MEGA Storage error event:", err);
      });
    }
    if (storage.api && typeof storage.api.on === "function") {
      storage.api.on("error", (err) => {
        console.error("❌ MEGA API error event:", err);
      });
    }
  } catch {
    // best effort
  }

  try {
    await storage.ready;
    return storage;
  } catch (err) {
    // Reset so next request can retry after creds/account are fixed.
    storage = undefined;
    throw classifyMegaError(err);
  }
}

/** 📤 Upload + Encrypt File to MEGA */
export async function uploadEncryptedFileToMega(filePath, fileName, patientId) {
  try {
    const readyStorage = await getStorageReady();

    // 1️⃣ Generate AES key and encrypt file locally
    const aesKey = generateAESKey();
    const encryptedAESKey = encryptAESKeyWithRSA(aesKey, publicKey);

    const encryptedFilePath = path.join(
      path.dirname(filePath),
      `enc_${Date.now()}_${fileName}`
    );
    const { iv } = await encryptFileAES(filePath, aesKey, encryptedFilePath);

    // 2️⃣ Upload encrypted file to MEGA
    const stats = statSync(encryptedFilePath);
    const uploadStream = readyStorage.upload({
      name: `${patientId}_${fileName}.enc`,
      size: stats.size
    });

    createReadStream(encryptedFilePath).pipe(uploadStream);

    return new Promise((resolve, reject) => {
      uploadStream.on("complete", async file => {
        const link = await file.link();

        // 3️⃣ Save file metadata in MongoDB
        await FileModel.create({
          originalName: fileName,
          megaLink: link,
          encryptedAESKey,
          iv,
          patientId
        });

        // 4️⃣ Cleanup temp encrypted file
        unlinkSync(encryptedFilePath);

        resolve({
          success: true,
          message: "File encrypted & uploaded successfully!",
          fileName: file.name,
          link
        });
      });

      uploadStream.on("error", err => {
        console.error("❌ MEGA Upload Error:", err);
        const e = classifyMegaError(err);
        reject({ success: false, message: e.message || "Upload failed!", error: e.message });
      });
    });
  } catch (error) {
    const e = classifyMegaError(error);
    console.error("❌ Upload Error:", e);
    throw e;
  }
}

/** 📥 Download + Decrypt File from MEGA */
export async function downloadDecryptedFileFromMega(fileId, patientId) {
  try {
    await getStorageReady();

    // 1️⃣ Find file metadata in MongoDB
    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord || fileRecord.patientId.toString() !== patientId) {
      return { success: false, message: "Access denied to this file." };
    }

    const file = File.fromURL(fileRecord.megaLink);
    await file.loadAttributes();

    // 2️⃣ Download encrypted file from MEGA to temp path
    const tempEncPath = path.join("uploads", `download_${Date.now()}.enc`);
    const writeStream = createWriteStream(tempEncPath);

    for await (const chunk of file.download()) {
      writeStream.write(chunk);
    }
    writeStream.end();

    // 3️⃣ Decrypt AES key with RSA
    const aesKey = decryptAESKeyWithRSA(fileRecord.encryptedAESKey, privateKey);

    // 4️⃣ Decrypt file to final temp path
    const tempDecPath = path.join("uploads", fileRecord.originalName);
    await decryptFileAES(tempEncPath, aesKey, fileRecord.iv, tempDecPath);

    // 5️⃣ Cleanup encrypted temp file
    unlinkSync(tempEncPath);

    return {
      success: true,
      filePath: tempDecPath,
      fileName: fileRecord.originalName
    };
  } catch (error) {
    const e = classifyMegaError(error);
    console.error("❌ Mega download error:", e);
    return { success: false, message: e.message || "Mega download failed.", error: e.message };
  }
}

export { storage, File };
