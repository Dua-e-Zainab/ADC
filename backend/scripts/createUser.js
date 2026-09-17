require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("../db");

async function createUser(username, plainPassword, site, role = "user") {
  const hash = await bcrypt.hash(plainPassword, 10);
  await db.query(
    "INSERT INTO users (username, password_hash, site, role) VALUES (?, ?, ?, ?)",
    [username, hash, site, role]
  );
  console.log(`✅ User "${username}" created for site ${site}`);
  process.exit(0);
}

const [, , username, password, site, role] = process.argv;
if (!username || !password || !site) {
  console.log("Usage: node scripts/createUser.js <username> <password> <KHI|LHE> [role]");
  process.exit(1);
}
createUser(username, password, site, role).catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});