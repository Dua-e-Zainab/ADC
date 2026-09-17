const express = require("express");
const router = express.Router();
const db = require("../db");

// SAVE OR UPDATE LOGGED ORDER
router.post("/", async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const o = req.body;

    const placedAt = o.placedAt
      ? new Date(o.placedAt).toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " ");

    const receivedAt = o.receivedAt
      ? new Date(o.receivedAt).toISOString().slice(0, 19).replace("T", " ")
      : null;

    await conn.query(
      `INSERT INTO orders (
        id, product_key, inv_type, card_type, scheme, plastic_category,
        sub_product, segment, batch, site, quantity, order_date,
        placed_at, status, received, received_at, counted_in, created_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        received_at = VALUES(received_at)`,
      [
        `ORD-${Date.now()}`, o.key, o.invType || null, o.cardType || null,
        o.scheme || null, o.plasticCategory || null, o.subProduct || null,
        o.segment || null, o.batch || null, o.site || null,
        Number(o.qty) || 0, o.orderDate || null, placedAt,
        o.received ? "RECEIVED" : "ORDERED", o.received ? 1 : 0,
        receivedAt, 0, placedAt,
      ]
    );

    await conn.commit();
    res.json({ success: true, message: "Order saved" });
  } catch (err) {
    await conn.rollback();
    console.error("POST /api/orders error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE / CLEAR ACTIVE ORDER
router.delete("/:key", async (req, res) => {
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

router.get("/", async (req, res) => {
  try {
    const { site } = req.query;

    let rows;

    if (site) {
      [rows] = await db.query(
        "SELECT * FROM orders WHERE site = ? ORDER BY id DESC",
        [site]
      );
    } else {
      [rows] = await db.query(
        "SELECT * FROM orders ORDER BY id DESC"
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
        orderDate: o.order_date,
        placedAt: o.placed_at,
        received: !!o.received,
        receivedAt: o.received_at,
        countedIn: !!o.counted_in,
      };
    });

    res.json(asObject);
  } catch (err) {
    console.error("GET /api/orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;