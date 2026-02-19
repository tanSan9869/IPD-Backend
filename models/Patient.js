import { Schema, model } from "mongoose";

const patientSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicKey: { type: String }, // PEM public key
  privateKeyEncrypted: { type: String }, // private key encrypted with MASTER
});

const Patient = model("Patient", patientSchema);
export default Patient;
