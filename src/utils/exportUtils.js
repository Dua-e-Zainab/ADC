import * as XLSX from "xlsx";

export function downloadStyledExcel({ title, headers, rows, footerRow, filename, headerColor = "#0f254a" }) {
  // Build a plain 2D array: header row + data rows + optional footer row
  const aoa = [headers, ...rows];
  if (footerRow) aoa.push(footerRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto column widths, same heuristic as before
  ws["!cols"] = headers.map((_, i) => {
    const maxLen = Math.max(
      String(headers[i] ?? "").length,
      ...rows.map(r => String(r[i] ?? "").length),
      footerRow ? String(footerRow[i] ?? "").length : 0
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (title || "Sheet1").slice(0, 30));

  // Was `/\.(xls|csv)$/i` — that never matches a ".xlsx" filename (it requires the
  // string to end in exactly ".xls", not ".xlsx"), so any caller passing a ".xlsx"
  // filename (e.g. ForecastTab) ended up with a double extension: "name.xlsx.xlsx".
  // Now strips .xls, .xlsx, or .csv regardless of which one was passed in.
  const cleanName = filename.replace(/\.(xlsx|xls|csv)$/i, "");
  XLSX.writeFile(wb, `${cleanName}.xlsx`);
}

/* downloadStyledPDF stays exactly as-is — no changes needed there */
export function downloadStyledPDF({ title, headers, rows, footerRow, filename, headerColor = "#0f254a", numericFromIndex = 2 }) {
  const html = `<html><head><title>${title}</title><style>
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #1e293b; }
    h2 { font-size: 15px; margin-bottom: 14px; color: ${headerColor}; }
    table { width: 100%; border-collapse: collapse; }
    th { background: ${headerColor}; color: #fff; padding: 9px 12px; font-size: 9px; text-transform: uppercase; text-align: left; white-space: nowrap; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 10px; white-space: nowrap; }
    tr:nth-child(even) td { background: #f5f7fa; }
    tfoot td { background: ${headerColor} !important; color: #fff; font-weight: 700; }
    td.num, th.num { text-align: right; }
    .sig-block { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
    .sig-col { width: 22%; text-align: center; }
    .sig-line { border-top: 1px solid #1e293b; margin-bottom: 6px; }
    .sig-label { font-size: 10px; color: #1e293b; }
    @media print { @page { size: landscape; margin: 12mm; } }
  </style></head><body>
    <h2>${title}</h2>
    <table>
      <thead><tr>${headers.map((h, i) => `<th class="${i >= numericFromIndex ? "num" : ""}">${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i >= numericFromIndex ? "num" : ""}">${c ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
      ${footerRow ? `<tfoot><tr>${footerRow.map((c, i) => `<td class="${i >= numericFromIndex ? "num" : ""}">${c ?? ""}</td>`).join("")}</tr></tfoot>` : ""}
    </table>
    <div class="sig-block">
      <div class="sig-col"><div class="sig-line"></div><div class="sig-label">Officer</div></div>
      <div class="sig-col"><div class="sig-line"></div><div class="sig-label">Supervisor</div></div>
      <div class="sig-col"><div class="sig-line"></div><div class="sig-label">Custodian</div></div>
      <div class="sig-col"><div class="sig-line"></div><div class="sig-label">Custodian</div></div>
    </div>
  </body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}