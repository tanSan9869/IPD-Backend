import crypto from "crypto";
import fs from "fs";
import path from "path";

/** 🔑 Generate AES-256 key */
export function generateAESKey() {
  return crypto.randomBytes(32); // 256 bits
}

/** 🔒 AES Encrypt File */
export function encryptFileAES(inputPath, aesKey, outputPath) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(16); // AES block size
    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    input.pipe(cipher).pipe(output);

    output.on("finish", () => resolve({ iv: iv.toString("hex") }));
    output.on("error", reject);
  });
}

/** 🔓 AES Decrypt File */
export function decryptFileAES(inputPath, aesKey, ivHex, outputPath) {
  return new Promise((resolve, reject) => {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    input.pipe(decipher).pipe(output);

    output.on("finish", resolve);
    output.on("error", reject);
  });
}

/** 🔒 RSA Encrypt AES key */
export function encryptAESKeyWithRSA(aesKey, publicKey) {
  try {
    return crypto.publicEncrypt(publicKey, aesKey).toString("base64");
  } catch (err) {
    if (!publicKey) {
      const e = new Error("RSA_PUBLIC_KEY is missing or empty. Set RSA_PUBLIC_KEY to a valid PEM public key in your environment.");
      e.code = "RSA_PUBLIC_KEY_MISSING";
      throw e;
    }

    const e = new Error(
      "Invalid RSA_PUBLIC_KEY format. Ensure it is a valid PEM public key and that newlines are preserved or encoded as \\n."
    );
    e.code = "RSA_PUBLIC_KEY_INVALID";
    e.opensslMessage = err.message;
    throw e;
  }
}

/** 🔓 RSA Decrypt AES key */
export function decryptAESKeyWithRSA(encryptedKey, privateKey) {
  return crypto.privateDecrypt(privateKey, Buffer.from(encryptedKey, "base64"));
}
