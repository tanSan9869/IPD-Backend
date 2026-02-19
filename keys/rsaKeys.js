import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateKeyPath = path.join(__dirname, "private.pem");
const publicKeyPath = path.join(__dirname, "public.pem");

// Generate RSA keys if they don't exist
if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
  console.log("🔑 Generating RSA keys...");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  console.log("✅ RSA keys generated successfully");
}

export const privateKey = fs.readFileSync(privateKeyPath, "utf8");
export const publicKey = fs.readFileSync(publicKeyPath, "utf8");
