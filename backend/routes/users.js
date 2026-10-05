const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../db");

const SALT_ROUNDS = 12;

function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }
  next();
}

// LIST ALL USERS — never returns password_hash
router.get("/", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, site, role, created_at, last_login FROM users ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE USER
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { username, password, site, role = "user" } = req.body;

    if (!username || !password || !site) {
      return res.status(400).json({ error: "username, password, and site are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      `INSERT INTO users (username, password_hash, site, role)
       VALUES (?, ?, ?, ?)`,
      [username, passwordHash, site, role]
    );

    res.json({ success: true, userId: result.insertId, username, site, role });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error("POST /users error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE ROLE AND/OR SITE — the core of "assign roles to them"
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, site } = req.body;

    if (!role && !site) {
      return res.status(400).json({ error: "Nothing to update — provide role and/or site" });
    }

    // Guard against an admin locking themselves out by demoting their own
    // last remaining admin account.
    if (role && role !== "admin") {
      const [[targetUser]] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
      if (targetUser?.role === "admin") {
        const [[{ adminCount }]] = await db.query(
          "SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'"
        );
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot demote the last remaining admin" });
        }
      }
    }

    const fields = [];
    const params = [];
    if (role) { fields.push("role = ?"); params.push(role); }
    if (site) { fields.push("site = ?"); params.push(site); }
    params.push(id);

    const [result] = await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("PUT /users/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// RESET PASSWORD
router.put("/:id/password", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE USER
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [[targetUser]] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
    if (targetUser?.role === "admin") {
      const [[{ adminCount }]] = await db.query(
        "SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'"
      );
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last remaining admin" });
      }
    }

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;