import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateKeyPath = path.join(__dirname, "private.pem");
const publicKeyPath = path.join(__dirname, "public.pem");

const normalizeEnvKey = (value) => {
  if (!value) return value;
  // Render (and other providers) sometimes store PEM with literal \n sequences
  return String(value).replace(/\\n/g, "\n");
};

const envPrivateKey = normalizeEnvKey(process.env.RSA_PRIVATE_KEY);
const envPublicKey = normalizeEnvKey(process.env.RSA_PUBLIC_KEY);

const readKeysFromFiles = () => {
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    return {
      privateKey: fs.readFileSync(privateKeyPath, "utf8"),
      publicKey: fs.readFileSync(publicKeyPath, "utf8"),
    };
  }
  return null;
};

const generateAndPersistKeysForDev = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  return { privateKey, publicKey };
};

let resolved;

if (envPrivateKey && envPublicKey) {
  resolved = { privateKey: envPrivateKey, publicKey: envPublicKey };
} else {
  resolved = readKeysFromFiles();
}

if (!resolved) {
  const isProduction = process.env.NODE_ENV === "production";

  // In production, rotating keys will break decryption of existing stored data.
  // Require stable keys to be provided via env (recommended) or committed files.
  if (isProduction) {
    throw new Error(
      "RSA keys not found. Set RSA_PRIVATE_KEY and RSA_PUBLIC_KEY env vars on Render, " +
        "or ensure backend/keys/private.pem and backend/keys/public.pem exist in the build."
    );
  }

  console.log("🔑 RSA keys not found; generating new dev keys in backend/keys/");
  resolved = generateAndPersistKeysForDev();
}

export const privateKey = resolved.privateKey;
export const publicKey = resolved.publicKey;
