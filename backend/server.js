require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const rateLimit = require("express-rate-limit");

const app = express();
const db = require("./db");
const sessionStore = require("./sessionStore");
const requireAuth = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const entryRoutes = require("./routes/entries");
const closingBalanceRoutes = require("./routes/closingBalances");
const orderRoutes = require("./routes/order");
const bulkEntries = require("./routes/Bulkentryroute")(db);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(session({
  key: "ubl_session",
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    sameSite: "lax",
  },
}));

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { error: "Too many login attempts. Try again later." },
// });

// Public
app.use("/api/auth", authRoutes);

// Protected
app.use("/api/entries", requireAuth, entryRoutes);
app.use("/api/closing-balances", requireAuth, closingBalanceRoutes);
app.use("/api", requireAuth, bulkEntries);
app.use("/api/orders", requireAuth, orderRoutes);
app.use("/api/transit-records", requireAuth, require("./routes/transitRecords"));
app.use("/api/consumables-stock", requireAuth, require("./routes/consumables"));

app.listen(5003, "0.0.0.0", () => {
  console.log("✅ Server running on port 5003");
});