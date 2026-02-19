import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Token usually comes like: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // Store user info (id, role) in request
    next(); // Continue to next middleware or controller
  } catch (error) {
    console.error("❌ JWT verification failed:", error.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
