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

const storage = new Storage({
  email: process.env.MEGA_EMAIL,
  password: process.env.MEGA_PASSWORD,
  autologin: true
});

/** 📤 Upload + Encrypt File to MEGA */
export async function uploadEncryptedFileToMega(filePath, fileName, patientId) {
  try {
    await storage.ready;

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
    const uploadStream = storage.upload({
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
        reject({ success: false, message: "Upload failed!", error: err.message });
      });
    });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    throw error;
  }
}

/** 📥 Download + Decrypt File from MEGA */
export async function downloadDecryptedFileFromMega(fileId, patientId) {
  try {
    await storage.ready;

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
    console.error("❌ Mega download error:", error);
    return { success: false, message: "Mega download failed.", error: error.message };
  }
}

export { storage,File };
