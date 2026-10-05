const express = require("express");
const router = express.Router();
const db = require("../db");

// GET ALL TRANSIT RECORDS — reads through the _all views so this covers
// both current-month and archived transit history, joined against the
// matching _all views for entries/plastic_entries/mailer_entries.
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT
        t.id, t.entry_id, t.from_site, t.to_site,
        DATE_FORMAT(t.date, '%Y-%m-%d') AS date,
        t.quantity, t.note, t.status, t.created_at, t.delivered_at,
        e.inv_type, e.card_type, e.scheme, e.plastic_category, e.segment, e.batch_number,
        pe.sub_product AS plastic_sub_product,
        me.sub_product AS mailer_sub_product,
        me.page_size
      FROM transit_records_all t
      JOIN entries_all e ON e.id = t.entry_id
      LEFT JOIN plastic_entries_all pe ON pe.entry_id = e.id
      LEFT JOIN mailer_entries_all  me ON me.entry_id = e.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE TRANSIT RECORD — always writes to _hot. A transit record is always
// created at the moment of dispatch, which is always current, so it always
// belongs in hot; archiving only ever moves it out later alongside its
// parent entry.
router.post("/", async (req, res) => {
  try {
    const { entryId, fromSite, toSite, date, quantity, note, status } = req.body;
    if (!entryId) return res.status(400).json({ error: "entryId is required" });

    const id = `TR-${entryId}-${Date.now()}`;
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    await db.query(
      `INSERT INTO transit_records_hot
        (id, entry_id, from_site, to_site, date, quantity, note, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entryId, fromSite, toSite, date, quantity || 0, note || null, status || "IN_TRANSIT", createdAt]
    );

    res.json({ success: true, id, createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MARK DELIVERED — try hot first (the common case, since delivery
// confirmation usually happens close to dispatch time), fall back to
// archive if the record has since aged out of hot.
router.put("/:id/deliver", async (req, res) => {
  try {
    const { id } = req.params;
    const deliveredAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    let [result] = await db.query(
      `UPDATE transit_records_hot SET status = 'DELIVERED', delivered_at = ? WHERE id = ?`,
      [deliveredAt, id]
    );

    if (result.affectedRows === 0) {
      [result] = await db.query(
        `UPDATE transit_records_archive SET status = 'DELIVERED', delivered_at = ? WHERE id = ?`,
        [deliveredAt, id]
      );
    }

    if (result.affectedRows === 0) return res.status(404).json({ error: "Transit record not found" });
    res.json({ success: true, deliveredAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;