const express = require("express");
const router = express.Router();
const db = require("../db");

// SAVE ENTRY — always writes to *_hot. New entries are always current-month,
// so they always belong in hot; archiving only ever moves things out later.
router.post("/", async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const e = req.body;

    console.log("inv_type:", e.invType);
    console.log("pageSize:", e.pageSize);
    console.log("subProduct:", e.subProduct);


    const savedAt = e.savedAt
      ? new Date(e.savedAt).toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " ");

    // Insert base entry
    const [result] = await conn.query(
  `INSERT INTO entries_hot
    (date, site, inv_type, card_type, scheme, plastic_category, segment,
     batch_number, opening_balance, received_from_vendor,
     batch_count, extra_count, damaged, moved_to_other_site,
     closing_balance, saved_at, source_excel)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [
    e.date, e.site, e.invType, e.cardType, e.scheme,
    e.plasticCategory, e.segment,
    e.batchNumber || null,          // ← single field now
    e.openingBalance     || 0,
    e.receivedFromVendor || 0,
    e.batchCount         || 0,
    e.extraCount         || 0,
    e.damaged            || 0,
    e.movedToOtherSite   || 0,
    e.closingBalance     || 0,
    savedAt,
    e.sourceExcel || null,
  ]
);

    const entryId = result.insertId;

  if (e.invType === "PLASTIC") {
  if (!e.subProduct) throw new Error("subProduct is required for PLASTIC entries");
  await conn.query(
    `INSERT INTO plastic_entries_hot (entry_id, sub_product)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE sub_product = VALUES(sub_product)`,
    [entryId, e.subProduct]
  );
} else if (e.invType === "MAILER" || e.invType === "ENVELOPE") {
  if (!e.pageSize) throw new Error("pageSize is required for MAILER/ENVELOPE entries");
  await conn.query(
    `INSERT INTO mailer_entries_hot (entry_id, page_size, scheme, plastic_category, sub_product)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE page_size = VALUES(page_size), scheme = VALUES(scheme), plastic_category = VALUES(plastic_category), sub_product = VALUES(sub_product)`,
    [entryId, e.pageSize, e.scheme || null, e.plasticCategory || null, e.subProduct || null]
  );
}

    // ── Vendors ──
    if (e.vendors && e.vendors.length > 0) {
      for (const v of e.vendors.filter(v => v.qty > 0 && v.name)) {
        await conn.query(
          `INSERT INTO vendors (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name`,
          [v.name]
        );
        const [[vendor]] = await conn.query(
          `SELECT id FROM vendors WHERE name = ?`, [v.name]
        );
        await conn.query(
          `INSERT INTO entry_vendors_hot (entry_id, vendor_id, quantity) VALUES (?, ?, ?)`,
          [entryId, vendor.id, Number(v.qty)]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, entryId });

  } catch (err) {
    await conn.rollback();
    console.error("POST /entries error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// UPDATE ENTRY (merge bulk-save duplicates)
// In practice this only ever targets entries created/edited within the
// current month (bulk-save reconciliation happens close to entry time), so
// it's expected to hit entries_hot. If a caller somehow tries to edit an
// already-archived entry, we fall back to entries_archive rather than
// silently failing.
router.put("/:id", async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const e = req.body;
    console.log("Received date:", e.date);

    const updateSql = `UPDATE %TABLE% SET
         received_from_vendor = ?,
         batch_count = ?,
         extra_count = ?,
         damaged = ?,
         moved_to_other_site = ?,
         closing_balance = ?
       WHERE id = ?`;
    const params = [
      e.receivedFromVendor || 0,
      e.batchCount || 0,
      e.extraCount || 0,
      e.damaged || 0,
      e.movedToOtherSite || 0,
      e.closingBalance || 0,
      id,
    ];

    let [result] = await conn.query(updateSql.replace("%TABLE%", "entries_hot"), params);

    if (result.affectedRows === 0) {
      // Not in hot — maybe already archived. Try archive before giving up.
      [result] = await conn.query(updateSql.replace("%TABLE%", "entries_archive"), params);
    }

    if (result.affectedRows === 0) {
      throw new Error(`No entry found with id ${id}`);
    }

    await conn.commit();
    res.json({ success: true, entryId: id });

  } catch (err) {
    await conn.rollback();
    console.error("PUT /entries/:id error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET ALL ENTRIES
// Reads through entries_all / plastic_entries_all / mailer_entries_all so
// this endpoint transparently covers both hot and archived history — the
// frontend (HistoryTab, ForecastTab analytics) doesn't need to change at all.
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        e.*,
        DATE_FORMAT(e.date, '%Y-%m-%d') AS date,
        pe.sub_product,
        me.page_size,
        me.scheme        AS mailer_scheme,
        me.plastic_category AS mailer_plastic_category
      FROM entries_all e
      LEFT JOIN plastic_entries_all pe ON pe.entry_id = e.id
      LEFT JOIN mailer_entries_all  me ON me.entry_id = e.id
      ORDER BY e.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SINGLE ENTRY
// Try hot first (the common case — most deletes target recent mistakes),
// fall back to archive if the row's already aged out of hot.
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [hotResult] = await db.query("DELETE FROM entries_hot WHERE id = ?", [id]);
    if (hotResult.affectedRows === 0) {
      await db.query("DELETE FROM entries_archive WHERE id = ?", [id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /entries/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE ALL ENTRIES FOR A SITE
// "Clear ledger history" is a full wipe, so it needs to hit both hot and
// archive — a site's history could span either or both.
router.delete("/", async (req, res) => {
  try {
    const site = req.session.user.site; // derived from session, never the client

    const [hotResult] = await db.query(
      "DELETE FROM entries_hot WHERE site = ?",
      [site]
    );
    const [archiveResult] = await db.query(
      "DELETE FROM entries_archive WHERE site = ?",
      [site]
    );

    res.json({
      success: true,
      deleted: hotResult.affectedRows + archiveResult.affectedRows,
      site,
    });
  } catch (err) {
    console.error("DELETE /entries error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;