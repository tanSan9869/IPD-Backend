// server.js
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";

dotenv.config();

// Connect DB
connectDB();

app.get("/", (req, res) => {
  return res.send("Backend is Running");
});

const PORT = process.env.PORT || 5000;
// On Render (and most cloud hosts) the server must listen on 0.0.0.0.
// If you omit the host, Node listens on all interfaces.
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening on ${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 FRONTEND_URL: ${process.env.FRONTEND_URL || "(not set)"}`);
});
