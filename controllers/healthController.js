// controllers/healthController.js

export const checkHealth = async (req, res) => {
  res.json({ ok: true, message: "SmartCare API is healthy ✅" });
};
