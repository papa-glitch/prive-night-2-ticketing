require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.warn("DATABASE_URL and JWT_SECRET must be configured for production.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")
    ? { rejectUnauthorized: false } : false
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

const tickets = [
  { code: "EARLY_BIRD", name: "Early Bird", price: 2000, capacity: 200 },
  { code: "REGULAR", name: "Regular", price: 3000, capacity: 500 },
  { code: "VIP", name: "VIP", price: 5000, capacity: 200 },
  { code: "TABLE_FOR_TWO", name: "Table for Two", price: 50000, capacity: 100 },
  { code: "TABLE_FOR_FIVE", name: "Table for Five", price: 100000, capacity: 100 },
  { code: "SILVER_SEAT", name: "Silver Seat", price: 200000, capacity: 50 },
  { code: "GOLDEN_SEAT", name: "Golden Seat", price: 500000, capacity: 50 }
];

async function initDb() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendees (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(160),
      ticket_type VARCHAR(20) NOT NULL,
      amount INTEGER NOT NULL,
      payment_reference VARCHAR(100),
      payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      ticket_status VARCHAR(20) NOT NULL DEFAULT 'reserved',
      ticket_code VARCHAR(40) UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS event_settings (
      key VARCHAR(80) PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const defaults = {
    event_name: "PRIVÉ NIGHT 2.0",
    event_date: "15 October 2026",
    red_carpet: "4:00 PM",
    main_event: "5:00 PM",
    venue: "Reverterton Hotel, GRA Lokoja, Kogi State"
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(
      "INSERT INTO event_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",
      [key, value]
    );
  }
}

function auth(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}

function clean(v, max = 160) {
  return String(v ?? "").trim().slice(0, max);
}

app.get("/api/config", (req, res) => {
  res.json({
    eventName: "PRIVÉ NIGHT 2.0",
    date: "15 October 2026",
    redCarpet: "4:00 PM",
    mainEvent: "5:00 PM",
    venue: "Reverterton Hotel, GRA Lokoja, Kogi State",
    opayName: process.env.OPAY_ACCOUNT_NAME || "Organizer OPay",
    opayNumber: process.env.OPAY_ACCOUNT_NUMBER || "",
    whatsapp: process.env.WHATSAPP_NUMBER || "2349023770047",
    organizerEmail: process.env.ORGANIZER_EMAIL || "mosesayomikutemitope@gmail.com",
    instagram: process.env.INSTAGRAM_HANDLE || "temi_t_couture_1",
    tiktok: process.env.TIKTOK_HANDLE || "temi_t_couture_1",
    tickets
  });
});

app.post("/api/register", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.status(503).json({ error: "Database is not configured." });
    const fullName = clean(req.body.fullName, 120);
    const phone = clean(req.body.phone, 30);
    const email = clean(req.body.email, 160);
    const ticketType = clean(req.body.ticketType, 20).toUpperCase();
    const paymentReference = clean(req.body.paymentReference, 100);
    const t = tickets.find(x => x.code === ticketType);

    if (!fullName || !phone || !t || !paymentReference) {
      return res.status(400).json({ error: "Please complete all required fields and payment reference." });
    }

    const count = await pool.query(
      "SELECT COUNT(*)::int AS count FROM attendees WHERE ticket_type=$1 AND ticket_status <> 'cancelled'",
      [ticketType]
    );
    if (count.rows[0].count >= t.capacity) {
      return res.status(409).json({ error: "That ticket category is sold out." });
    }

    const duplicate = await pool.query(
      "SELECT id FROM attendees WHERE payment_reference=$1 LIMIT 1", [paymentReference]
    );
    if (duplicate.rowCount) return res.status(409).json({ error: "This payment reference has already been submitted." });

    const ticketCode = "PRV-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,7).toUpperCase();
    const result = await pool.query(
      `INSERT INTO attendees(full_name,phone,email,ticket_type,amount,payment_reference,ticket_code)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, ticket_code, payment_status`,
      [fullName, phone, email || null, ticketType, t.price, paymentReference, ticketCode]
    );
    res.status(201).json({
      message: "Registration received. Your payment will be verified by the organizer.",
      registrationId: result.rows[0].id,
      ticketCode: result.rows[0].ticket_code,
      paymentStatus: result.rows[0].payment_status
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not complete registration." });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const email = clean(req.body.email, 160);
  const password = String(req.body.password || "");
  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminEmail || !adminPassword || email.toLowerCase() !== adminEmail.toLowerCase() || password !== adminPassword) {
    return res.status(401).json({ error: "Invalid organizer credentials." });
  }
  const token = jwt.sign({ email: adminEmail, role: "organizer" }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.cookie("admin_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 12*60*60*1000 });
  res.json({ ok: true });
});

app.post("/api/admin/logout", auth, (req, res) => {
  res.clearCookie("admin_token");
  res.json({ ok: true });
});

app.get("/api/admin/me", auth, (req, res) => res.json({ email: req.admin.email, role: req.admin.role }));

app.get("/api/admin/dashboard", auth, async (req, res) => {
  try {
    const totals = await pool.query(`
      SELECT
        COUNT(*)::int AS registrations,
        COUNT(*) FILTER (WHERE payment_status='verified')::int AS confirmed,
        COUNT(*) FILTER (WHERE payment_status='pending')::int AS pending,
        COALESCE(SUM(amount) FILTER (WHERE payment_status='verified'),0)::int AS revenue
      FROM attendees WHERE ticket_status <> 'cancelled'
    `);
    const byType = await pool.query(`
      SELECT ticket_type, COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE payment_status='verified')::int AS verified,
        COUNT(*) FILTER (WHERE payment_status='pending')::int AS pending
      FROM attendees WHERE ticket_status <> 'cancelled'
      GROUP BY ticket_type
    `);
    const recent = await pool.query(`
      SELECT id,full_name,phone,email,ticket_type,amount,payment_reference,payment_status,ticket_code,created_at
      FROM attendees ORDER BY created_at DESC LIMIT 50
    `);
    res.json({ totals: totals.rows[0], byType: byType.rows, attendees: recent.rows, tickets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Dashboard unavailable." });
  }
});

app.patch("/api/admin/attendees/:id/payment", auth, async (req, res) => {
  const status = req.body.status === "verified" ? "verified" : req.body.status === "rejected" ? "rejected" : null;
  if (!status) return res.status(400).json({ error: "Invalid payment status." });
  try {
    const result = await pool.query(
      `UPDATE attendees SET payment_status=$1, ticket_status=$2, verified_at=CASE WHEN $1='verified' THEN NOW() ELSE verified_at END
       WHERE id=$3 RETURNING *`,
      [status, status === "verified" ? "confirmed" : "rejected", Number(req.params.id)]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Attendee not found." });
    res.json({ attendee: result.rows[0] });
  } catch {
    res.status(500).json({ error: "Could not update payment." });
  }
});

app.get("/api/admin/export.csv", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT id,full_name,phone,email,ticket_type,amount,payment_reference,payment_status,ticket_code,created_at FROM attendees ORDER BY created_at DESC"
  );
  const headers = ["ID","Name","Phone","Email","Ticket","Amount","Payment Reference","Payment Status","Ticket Code","Created At"];
  const esc = v => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = [headers.join(","), ...result.rows.map(r => [
    r.id,r.full_name,r.phone,r.email,r.ticket_type,r.amount,r.payment_reference,r.payment_status,r.ticket_code,r.created_at
  ].map(esc).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="prive-night-2-attendees.csv"');
  res.send(csv);
});

app.get("/api/admin/settings", auth, async (req,res) => {
  const r = await pool.query("SELECT key,value FROM event_settings ORDER BY key");
  res.json(Object.fromEntries(r.rows.map(x => [x.key,x.value])));
});

app.put("/api/admin/settings", auth, async (req,res) => {
  const allowed = ["event_name","event_date","red_carpet","main_event","venue"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      await pool.query(
        "INSERT INTO event_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
        [key, clean(req.body[key], 200)]
      );
    }
  }
  res.json({ ok:true });
});

app.get("/admin", (req,res) => res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));

initDb().then(() => app.listen(PORT, () => console.log(`PRIVÉ NIGHT 2.0 running on ${PORT}`)))
  .catch(err => { console.error("Startup failed", err); process.exit(1); });
