const express = require("express");

module.exports = function (pool) {
  const router = express.Router();

  router.post("/entries/bulk", async (req, res) => {
  const { date,invType, rows } = req.body;
  const site = req.session.user.site; // never trust client-supplied site

    if (!date || !site || !invType || !Array.isArray(rows) || !rows.length) {
      return res.status(400).json({
        success: false,
        message: "Missing date/site/invType/rows",
      });
    }

    const conn = await pool.getConnection();

    let saved = 0;
    let merged = 0;
    let skipped = 0;

    const closingWrites = new Map();
    const newEntries = [];
    const newTransits = [];

    const catKey = (r) =>
  `${site}|${invType}|${r.cardType}|${r.scheme || ""}|${r.plasticCategory || ""}`;
    try {
      await conn.beginTransaction();

      // Load current closing balances
      const keys = [...new Set(rows.map(catKey))];
      // console.log("BULK KEYS EXPECTED:", keys);
      

      const [balanceRows] = await conn.query(
        `SELECT balance_key, value
         FROM closing_balances
         WHERE balance_key IN (?)`,
        [keys.length ? keys : [""]]
      );
      // console.log("BALANCE KEYS FOUND IN DB:", balanceRows.map(b => b.balance_key));

      const runningClosing = new Map(
        balanceRows.map((b) => [
          b.balance_key,
          Number(b.value) || 0,
        ])
      );

      for (const row of rows) {
        const key = catKey(row);
        const segment = row.segment || "ETB";

        const received = Number(row.stockReceived) || 0;
        const consumed = Number(row.batchCount) || 0;
        const extra = Number(row.extraCount) || 0;
        const damaged = Number(row.damaged) || 0;
        const moved = Number(row.transferred) || 0;

        let existing;

        // ─────────────────────────────
        // FIND EXISTING ENTRY
        // ─────────────────────────────

        if (invType === "PLASTIC") {
          const [result] = await conn.query(
            `SELECT e.*
             FROM entries e
             INNER JOIN plastic_entries pe
               ON pe.entry_id = e.id
             WHERE e.date = ?
               AND e.site = ?
               AND e.inv_type = ?
               AND e.card_type = ?
               AND e.scheme <=> ?
               AND e.plastic_category <=> ?
               AND e.segment = ?
               AND pe.sub_product <=> ?
             LIMIT 1`,
            [
              date,
              site,
              invType,
              row.cardType,
              row.scheme || null,
              row.plasticCategory || null,
              segment,
              row.subProduct || null,
            ]
          );

          existing = result[0];
        } else if (invType === "MAILER" || invType === "ENVELOPE") {
          const [result] = await conn.query(
            `SELECT e.*
             FROM entries e
             INNER JOIN mailer_entries me
               ON me.entry_id = e.id
             WHERE e.date = ?
               AND e.site = ?
               AND e.inv_type = ?
               AND e.card_type = ?
               AND e.scheme <=> ?
               AND e.plastic_category <=> ?
               AND e.segment = ?
               AND me.page_size <=> ?
               AND me.sub_product <=> ?
             LIMIT 1`,
            [
              date,
              site,
              invType,
              row.cardType,
              row.scheme || null,
              row.plasticCategory || null,
              segment,
              row.pageSize || null,
              row.subProduct || null,
            ]
          );

          existing = result[0];
        } else {
          const [result] = await conn.query(
            `SELECT *
             FROM entries
             WHERE date = ?
               AND site = ?
               AND inv_type = ?
               AND card_type = ?
               AND scheme <=> ?
               AND plastic_category <=> ?
               AND segment = ?
             LIMIT 1`,
            [
              date,
              site,
              invType,
              row.cardType,
              row.scheme || null,
              row.plasticCategory || null,
              segment,
            ]
          );

          existing = result[0];
        }

        // ─────────────────────────────
        // MERGE EXISTING
        // ─────────────────────────────

        if (existing) {
          const receivedTotal =
            (Number(existing.received_from_vendor) || 0) + received;

          const consumedTotal =
            (Number(existing.batch_count) || 0) + consumed;

          const extraTotal =
            (Number(existing.extra_count) || 0) + extra;

          const damagedTotal =
            (Number(existing.damaged) || 0) + damaged;

          const movedTotal =
            (Number(existing.moved_to_other_site) || 0) + moved;

          const closing =
            (Number(existing.opening_balance) || 0) +
            receivedTotal -
            consumedTotal -
            damagedTotal -
            movedTotal;

          if (closing < 0) {
            console.log("SKIPPED ROW:", {
              key,
              cardType: row.cardType,
              scheme: row.scheme,
              plasticCategory: row.plasticCategory,
              subProduct: row.subProduct,
              opening: existing ? existing.opening_balance : opening,
              received,
              consumed,
              damaged,
              moved,
              closing,
            });
            skipped++;
            continue;
          }

          await conn.query(
            `UPDATE entries
             SET received_from_vendor = ?,
                 batch_count = ?,
                 extra_count = ?,
                 damaged = ?,
                 moved_to_other_site = ?,
                 closing_balance = ?
             WHERE id = ?`,
            [
              receivedTotal,
              consumedTotal,
              extraTotal,
              damagedTotal,
              movedTotal,
              closing,
              existing.id,
            ]
          );

          runningClosing.set(key, closing);
          closingWrites.set(key, closing);

          if (moved > 0) {
            newTransits.push({
              entryId: existing.id,
              quantity: moved,
              row,
              note: "Bulk import — auto transit",
            });
          }

          merged++;
          continue;
        }

        // ─────────────────────────────
        // CREATE NEW ENTRY
        // ─────────────────────────────

        const opening = Math.max(
          0,
          Number(runningClosing.get(key)) || 0
        );

        const closing =
          opening +
          received -
          consumed -
          damaged -
          moved;

        if (closing < 0) {
          skipped++;
          continue;
        }

        // IMPORTANT:
        // subProduct/pageSize are NOT stored in entries.
        // They are stored in plastic_entries/mailer_entries.
        const [result] = await conn.query(
          `INSERT INTO entries (
            date,
            site,
            inv_type,
            card_type,
            scheme,
            plastic_category,
            segment,
            batch_number,
            opening_balance,
            received_from_vendor,
            batch_count,
            extra_count,
            damaged,
            moved_to_other_site,
            closing_balance,
            saved_at,
            source_excel
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, NOW(), ?
          )`,
          [
            date,
            site,
            invType,
            row.cardType,
            row.scheme || null,
            row.plasticCategory || null,
            segment,
            row.batchNumber || null,
            opening,
            received,
            consumed,
            extra,
            damaged,
            moved,
            closing,
            row.sourceExcel || null,
          ]
        );

        const entryId = result.insertId;

        // ─────────────────────────────
        // PLASTIC DETAILS
        // ─────────────────────────────

        if (invType === "PLASTIC" && row.subProduct) {
          await conn.query(
            `INSERT INTO plastic_entries
              (entry_id, sub_product)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE
              sub_product = VALUES(sub_product)`,
            [entryId, row.subProduct]
          );
        }

        // ─────────────────────────────
        // MAILER / ENVELOPE DETAILS
        // ─────────────────────────────

        if (
          (invType === "MAILER" || invType === "ENVELOPE") &&
          row.pageSize
        ) {
          await conn.query(
            `INSERT INTO mailer_entries
              (entry_id, page_size, scheme, plastic_category, sub_product)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              page_size = VALUES(page_size),
              scheme = VALUES(scheme),
              plastic_category = VALUES(plastic_category),
              sub_product = VALUES(sub_product)`,
            [
              entryId,
              row.pageSize,
              row.scheme || null,
              row.plasticCategory || null,
              row.subProduct || null,
            ]
          );
        }

        runningClosing.set(key, closing);
        closingWrites.set(key, closing);

        newEntries.push({
          id: entryId,
          ...row,
          openingBalance: opening,
          closingBalance: closing,
        });

        if (moved > 0) {
          newTransits.push({
            entryId,
            quantity: moved,
            row,
            note: "Bulk import — auto transit",
          });
        }

        saved++;
      }

      // ─────────────────────────────
      // CLOSING BALANCES
      // ─────────────────────────────

      for (const [key, value] of closingWrites) {
        await conn.query(
          `INSERT INTO closing_balances
            (balance_key, value, entry_date, updated_by, updated_at)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
            value = VALUES(value),
            entry_date = VALUES(entry_date),
            updated_by = VALUES(updated_by),
            updated_at = NOW()`,
          [key, value, date, site]
        );
      }

      // ─────────────────────────────
      // TRANSIT RECORDS
      // ─────────────────────────────

      const transitRecords = [];

      for (const t of newTransits) {
        const toSite = site === "KHI" ? "LHE" : "KHI";

        const [result] = await conn.query(
          `INSERT INTO transit_records
            (entry_id, from_site, to_site, date, quantity, note, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'IN_TRANSIT', NOW())`,
          [
            t.entryId,
            site,
            toSite,
            date,
            t.quantity,
            t.note,
          ]
        );

        transitRecords.push({
          id: result.insertId,
          entryId: t.entryId,
          fromSite: site,
          toSite,
          date,
          quantity: t.quantity,
          note: t.note,
          status: "IN_TRANSIT",
          invType,
          cardType: t.row.cardType,
          scheme: t.row.scheme,
          plasticCategory: t.row.plasticCategory,
          subProduct: t.row.subProduct,
          segment: t.row.segment || "ETB",
        });
      }

      await conn.commit();

      return res.json({
        success: true,
        saved,
        merged,
        skipped,
        newEntries,
        closingBalances: Object.fromEntries(closingWrites),
        transitRecords,
      });
    } catch (err) {
      await conn.rollback();

      console.error("Bulk entries failed:", err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    } finally {
      conn.release();
    }
  });

  return router;
};

