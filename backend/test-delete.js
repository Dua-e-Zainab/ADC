const db = require("./db");

async function test() {
  try {
    const invType = "PLASTIC";
    const [result] = await db.query("DELETE FROM closing_balances WHERE balance_key LIKE ?", [`%|${invType}|%`]);
    console.log("Success:", result);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    process.exit(0);
  }
}
test();
