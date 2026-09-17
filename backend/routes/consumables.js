const express = require("express");
const router = express.Router();
const db = require("../db");

// ============================================================
// GET CURRENT STOCK FOR A SITE
// GET /api/consumables-stock?siteId=1
// ============================================================
router.get("/", async (req, res) => {
  try {
    const { siteId } = req.query;

    if (!siteId) {
      return res.status(400).json({
        error: "siteId is required"
      });
    }

    const [rows] = await db.query(
      `
      SELECT *
      FROM consumables_stock
      WHERE site_id = ?
      ORDER BY item_id
      `,
      [siteId]
    );

    const asObject = {};

    rows.forEach(r => {
      asObject[r.item_id] = {
        value: Number(r.opening_value),
        closingValue: Number(r.closing_value),
        baseDate: r.base_date,
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
      };
    });

    res.json(asObject);

  } catch (err) {
    console.error(
      "GET /consumables-stock error:",
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
});


// ============================================================
// UPSERT CURRENT STOCK
// POST /api/consumables-stock
// ============================================================
router.post("/", async (req, res) => {
  try {
    const {
      siteId,
      itemId,
      value,
      closingValue,
      baseDate,
      updatedBy
    } = req.body;

    if (!siteId || !itemId) {
      return res.status(400).json({
        error: "siteId and itemId are required"
      });
    }

    const updatedAt = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await db.query(
      `
      INSERT INTO consumables_stock
      (
        site_id,
        item_id,
        opening_value,
        closing_value,
        base_date,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE
        opening_value = VALUES(opening_value),
        closing_value = VALUES(closing_value),
        base_date = VALUES(base_date),
        updated_at = VALUES(updated_at),
        updated_by = VALUES(updated_by)
      `,
      [
        siteId,
        itemId,
        value,
        closingValue ?? 0,
        baseDate || null,
        updatedAt,
        updatedBy || null
      ]
    );

    res.json({
      success: true
    });

  } catch (err) {
    console.error(
      "POST /consumables-stock error:",
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
});


// ============================================================
// GET SNAPSHOTS
//
// GET /api/consumables-stock/snapshots?siteId=1
// GET /api/consumables-stock/snapshots?siteId=1&date=2026-08-24
// ============================================================
router.get("/snapshots", async (req, res) => {
  try {
    const { siteId, date } = req.query;

    if (!siteId) {
      return res.status(400).json({
        error: "siteId is required"
      });
    }

    let rows;

    if (date) {

      [rows] = await db.query(
        `
        SELECT *
        FROM consumables_daily_snapshot
        WHERE site_id = ?
          AND snapshot_date = ?
        ORDER BY item_id
        `,
        [siteId, date]
      );

    } else {

      [rows] = await db.query(
        `
        SELECT *
        FROM consumables_daily_snapshot
        WHERE site_id = ?
        ORDER BY snapshot_date DESC, item_id
        `,
        [siteId]
      );

    }

    res.json(rows);

  } catch (err) {
    console.error(
      "GET /consumables-stock/snapshots error:",
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
});


// ============================================================
// SAVE DAILY SNAPSHOT
// POST /api/consumables-stock/snapshots
// ============================================================
router.post("/snapshots", async (req, res) => {
  try {

    const {
      siteId,
      date,
      items
    } = req.body;

    if (!siteId || !date || !Array.isArray(items)) {
      return res.status(400).json({
        error: "siteId, date and items[] are required"
      });
    }

    const createdAt = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    for (const it of items) {

      await db.query(
        `
        INSERT INTO consumables_daily_snapshot
        (
          site_id,
          snapshot_date,
          item_id,
          opening_value,
          consumed_value,
          closing_value,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
          opening_value = VALUES(opening_value),
          consumed_value = VALUES(consumed_value),
          closing_value = VALUES(closing_value),
          created_at = VALUES(created_at)
        `,
        [
          siteId,
          date,
          it.itemId,
          it.opening,
          it.consumed,
          it.closing,
          createdAt
        ]
      );
    }

    res.json({
      success: true
    });

  } catch (err) {

    console.error(
      "POST /consumables-stock/snapshots error:",
      err.message
    );

    res.status(500).json({
      error: err.message
    });
  }
});


module.exports = router;