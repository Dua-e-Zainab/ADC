const express = require("express");
const router = express.Router();
const db = require("../db");

function toSqlDate(v) {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }
  next();
}

// SAVE OR UPDATE LOGGED ORDER
// - If the placing user is an admin, the order is auto-approved.
// - Otherwise it's created/updated as PENDING and must be approved by an
//   admin before markReceived (below) will let it be marked received.
// - If this call is specifically a "mark received" update (o.received true),
//   we require the order to already be APPROVED — a pending order can't be
//   silently marked received by editing the same upsert endpoint.
router.post("/", requireAuth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const o = req.body;
    const username = req.session.user.username;
    const isAdmin = req.session.user.role === "admin";

    const placedAt = o.placedAt
      ? new Date(o.placedAt).toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " ");

    const receivedAt = o.receivedAt
      ? new Date(o.receivedAt).toISOString().slice(0, 19).replace("T", " ")
      : null;

    // Look up any existing row for this product_key first, since the same
    // endpoint is reused both to place a new order and later to mark it
    // received — we need to know the current approval_status either way.
    const [[existing]] = await conn.query(
      "SELECT approval_status FROM orders WHERE product_key = ?",
      [o.key]
    );

    if (o.received === true) {
      // This call is a "mark received" update, not a fresh order placement.
      const currentApproval = existing?.approval_status;
      if (currentApproval !== "APPROVED") {
        await conn.rollback();
        return res.status(400).json({ error: "Order must be approved by an admin before it can be marked received" });
      }
    }

    // Only (re)compute approval_status on a genuine new/edited order
    // placement, not on the received-marking call — otherwise marking
    // received would incorrectly flip an already-approved order's status.
    let approvalStatus, requestedBy, approvedBy, approvedAt;
    if (o.received === true && existing) {
      approvalStatus = existing.approval_status;
      requestedBy = undefined; // leave unchanged
      approvedBy = undefined;
      approvedAt = undefined;
    } else {
      approvalStatus = isAdmin ? "APPROVED" : "PENDING";
      requestedBy = isAdmin ? null : username;
      approvedBy = isAdmin ? username : null;
      approvedAt = isAdmin ? placedAt : null;
    }

    await conn.query(
      `INSERT INTO orders (
        id, product_key, inv_type, card_type, scheme, plastic_category,
        sub_product, segment, batch, site, quantity, order_date,
        placed_at, status, received, received_at, counted_in, created_at,
        approval_status, requested_by, approved_by, approved_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        inv_type = VALUES(inv_type),
        card_type = VALUES(card_type),
        scheme = VALUES(scheme),
        plastic_category = VALUES(plastic_category),
        sub_product = VALUES(sub_product),
        segment = VALUES(segment),
        batch = VALUES(batch),
        site = VALUES(site),
        quantity = VALUES(quantity),
        order_date = VALUES(order_date),
        placed_at = VALUES(placed_at),
        status = VALUES(status),
        received = VALUES(received),
        received_at = VALUES(received_at),
        approval_status = COALESCE(VALUES(approval_status), approval_status),
        requested_by = COALESCE(VALUES(requested_by), requested_by),
        approved_by = COALESCE(VALUES(approved_by), approved_by),
        approved_at = COALESCE(VALUES(approved_at), approved_at)`,
      [
        `ORD-${Date.now()}`, o.key, o.invType || null, o.cardType || null,
        o.scheme || null, o.plasticCategory || null, o.subProduct || null,
        o.segment || null, o.batch || null, o.site || null,
        Number(o.qty) || 0, toSqlDate(o.orderDate), placedAt,
        o.received ? "RECEIVED" : "ORDERED", o.received ? 1 : 0,
        receivedAt, 0, placedAt,
        approvalStatus, requestedBy, approvedBy, approvedAt,
      ]
    );

    await conn.commit();
    res.json({ success: true, message: "Order saved", approvalStatus });
  } catch (err) {
    await conn.rollback();
    console.error("POST /api/orders error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PENDING COUNT — for the admin alert bell
router.get("/pending-count", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[row]] = await db.query(
      "SELECT COUNT(*) AS count FROM orders WHERE approval_status = 'PENDING'"
    );
    res.json({ count: row.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIST PENDING ORDERS — full detail for the admin approval panel
router.get("/pending", requireAuth, requireAdmin, async (req, res) => {
  try {
    const cols = `*, DATE_FORMAT(order_date, '%Y-%m-%d') AS order_date_str`;
    const [rows] = await db.query(
      `SELECT ${cols} FROM orders WHERE approval_status = 'PENDING' ORDER BY placed_at ASC`
    );
    res.json(rows.map(o => ({
      key: o.product_key,
      invType: o.inv_type,
      cardType: o.card_type,
      scheme: o.scheme,
      plasticCategory: o.plastic_category,
      subProduct: o.sub_product,
      segment: o.segment,
      batch: o.batch,
      site: o.site,
      qty: o.quantity,
      orderDate: o.order_date,
      placedAt: o.placed_at,
      requestedBy: o.requested_by,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// APPROVE — admin only
router.put("/:key/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const [result] = await db.query(
      `UPDATE orders
       SET approval_status = 'APPROVED', approved_by = ?, approved_at = NOW()
       WHERE product_key = ? AND approval_status = 'PENDING'`,
      [req.session.user.username, key]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No pending order found for this key" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REJECT — admin only
router.put("/:key/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const [result] = await db.query(
      `UPDATE orders
       SET approval_status = 'REJECTED', approved_by = ?, approved_at = NOW()
       WHERE product_key = ? AND approval_status = 'PENDING'`,
      [req.session.user.username, key]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No pending order found for this key" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE / CLEAR ACTIVE ORDER
router.delete("/:key", requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const [result] = await db.query("DELETE FROM orders WHERE product_key = ?", [key]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No matching order item record found to clear" });
    }

    res.json({ success: true, message: `Order item ${key} cleared cleanly` });
  } catch (err) {
    console.error("DELETE /api/orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { site } = req.query;
    const cols = `*, DATE_FORMAT(order_date, '%Y-%m-%d') AS order_date_str`;

    let rows;

    if (site) {
      [rows] = await db.query(
        `SELECT ${cols} FROM orders WHERE site = ? ORDER BY id DESC`,
        [site]
      );
    } else {
      [rows] = await db.query(
        `SELECT ${cols} FROM orders ORDER BY id DESC`
      );
    }

    const asObject = {};

    rows.forEach(o => {
      asObject[o.product_key] = {
        key: o.product_key,
        invType: o.inv_type,
        cardType: o.card_type,
        scheme: o.scheme,
        plasticCategory: o.plastic_category,
        subProduct: o.sub_product,
        segment: o.segment,
        batch: o.batch,
        site: o.site,
        qty: o.quantity,
        orderDate: o.order_date_str,
        placedAt: o.placed_at,
        received: !!o.received,
        receivedAt: o.received_at,
        countedIn: !!o.counted_in,
        approvalStatus: o.approval_status,
        requestedBy: o.requested_by,
        approvedBy: o.approved_by,
        approvedAt: o.approved_at,
      };
    });

    res.json(asObject);
  } catch (err) {
    console.error("GET /api/orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;