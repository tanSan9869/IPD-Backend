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
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Allowed origins: ${process.env.FRONTEND_URL || 'localhost only'}`);
});
