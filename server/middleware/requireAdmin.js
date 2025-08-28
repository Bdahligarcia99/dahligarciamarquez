// server/middleware/requireAdmin.js

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const admin = process.env.ADMIN_TOKEN;
  
  if (!admin) {
    return res.status(500).json({ error: "Server admin token not configured." });
  }
  
  if (token !== admin) {
    return res.status(401).json({ error: "Admin token invalid." });
  }
  
  req.role = "admin";
  next();
}
