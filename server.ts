import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { GoogleGenAI, createPartFromBase64 } from "@google/genai";
import "dotenv/config";

console.log("SMTP_HOST =", process.env.SMTP_HOST);
console.log("SMTP_PORT =", process.env.SMTP_PORT);
console.log("SMTP_USER =", process.env.SMTP_USER);
console.log("SMTP_PASS exists =", !!process.env.SMTP_PASS);

const app = express();
const db = new Database("urban_pulse.db");

// --------------------
// OFFICERS MIGRATION (add email column if missing)
// --------------------
try {
  db.prepare(`ALTER TABLE officers ADD COLUMN email TEXT`).run();
  console.log("✅ officers.email column added");
} catch (e: any) {
  // if table doesn't exist yet OR column already exists, ignore
  console.log("ℹ️ officers.email already exists (or officers table will be created)");
}

// 1) ✅ CREATE TABLES FIRST
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    userId TEXT,
    category TEXT,
    description TEXT,
    photoUrl TEXT,
    latitude REAL,
    longitude REAL,
    priority TEXT,
    status TEXT,
    workerName TEXT,
    area TEXT,
    city TEXT,
    state TEXT,
    fullAddress TEXT,
    ward TEXT,
    division TEXT,
    department TEXT,
    assignedOfficerId TEXT,
    assignedOfficerName TEXT,
    imageHash TEXT,
    moderationFlags TEXT,
    aiGeneratedFlag INTEGER DEFAULT 0,
    spamFlag INTEGER DEFAULT 0,
    duplicateFlag INTEGER DEFAULT 0,
    classifiedCategory TEXT,
    classificationConfidence REAL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    complaintId TEXT,
    type TEXT,
    message TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

    CREATE TABLE IF NOT EXISTS officers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      ward TEXT,
      division TEXT,
      department TEXT
    );
`);

// Seed default admin user for documented admin login credentials.
db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, password, role)
  VALUES (?, ?, ?, ?, ?)
`).run("USR-ADMIN-001", "System Admin", "admin@civicpulse.org", "admin123", "admin");

// --------------------
// STEP 4: SEED OFFICERS (RUNS SAFE)
// --------------------
const seedOfficer = db.prepare(`
  INSERT OR IGNORE INTO officers (id, name, email, ward, division, department)
  VALUES (?, ?, ?, ?, ?, ?)
`);

seedOfficer.run("OFF-001", "Rohit Patil", "adhalhari2@gmail.com", "Amravati Ward – Pushpak Colony Zone", "Zone-1", "Sanitation");
seedOfficer.run("OFF-002", "Ayesha Khan", "ayeshakhan@gmail.com", "Amravati Ward – Rajapeth Zone", "Zone-2", "Road");
seedOfficer.run("OFF-003", "Suresh Jadhav", "sureshjadhav@gmail.com", "Amravati Ward – Panchvati Zone", "Zone-3", "Water");
seedOfficer.run("OFF-004", "Neha Deshmukh", "nehadesh@gmail.com", "Amravati Ward – Old City Zone", "Zone-4", "Streetlight");

// ✅ FIX: officers already existed, so INSERT OR IGNORE won't update email.
// Force update email for demo/testing.
db.prepare(`UPDATE officers SET email = ? WHERE id = ?`).run("adhalhari2@gmail.com", "OFF-001");
db.prepare(`UPDATE officers SET email = ? WHERE id = ?`).run("adhalhari2@gmail.com", "OFF-002");
db.prepare(`UPDATE officers SET email = ? WHERE id = ?`).run("adhalhari2@gmail.com", "OFF-003");
db.prepare(`UPDATE officers SET email = ? WHERE id = ?`).run("adhalhari2@gmail.com", "OFF-004");

console.log("✅ Officer emails updated");

console.log("✅ Officers seeded (STEP 4)");

// 2) ✅ THEN MIGRATIONS (for old DBs)
try { db.prepare(`ALTER TABLE complaints ADD COLUMN area TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN city TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN state TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN fullAddress TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN ward TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN division TEXT`).run(); } catch {}
// ✅ STEP 3 EXTRA COLUMNS (needed for division assignment)
try { db.prepare(`ALTER TABLE complaints ADD COLUMN assignedOfficerId TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN assignedOfficerName TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN department TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN imageHash TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN moderationFlags TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN aiGeneratedFlag INTEGER DEFAULT 0`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN spamFlag INTEGER DEFAULT 0`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN duplicateFlag INTEGER DEFAULT 0`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN classifiedCategory TEXT`).run(); } catch {}
try { db.prepare(`ALTER TABLE complaints ADD COLUMN classificationConfidence REAL`).run(); } catch {}
try { db.prepare(`ALTER TABLE officers ADD COLUMN email TEXT`).run(); } catch {}

// --------------------
// APP INIT
// --------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const PORT = 3001;

app.get("/api/debug/complaints", (req, res) => {
  const rows = db.prepare(`
    SELECT id, category, latitude, longitude,
           area, city, state, ward, fullAddress, createdAt
    FROM complaints
    ORDER BY createdAt DESC
  `).all();

  res.json(rows);
});

// --------------------
// HELPERS
// --------------------
function uid(prefix: string) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function newId(prefix: string) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function notifyAdminResolved(complaintId: string, workerName: string) {
  const id = newId("NTF");
  const msg = `Complaint ${complaintId} marked resolved by ${workerName}. Awaiting admin approval.`;

  db.prepare(
    "INSERT INTO notifications (id, complaintId, type, message, isRead) VALUES (?, ?, ?, ?, 0)"
  ).run(id, complaintId, "RESOLVED_PENDING", msg);
}

function assignPriority(category: string, description: string): string {
  const desc = (description || "").toLowerCase();

  if (category === "Water" && (desc.includes("leak") || desc.includes("burst") || desc.includes("overflow"))) return "High";
  if (category === "Road" && (desc.includes("accident") || desc.includes("pothole") || desc.includes("big"))) return "High";
  if (category === "Garbage" && (desc.includes("overflow") || desc.includes("too much"))) return "High";

  const lowKeywords = ["minor", "small", "request", "info"];
  if (lowKeywords.some(k => desc.includes(k))) return "Low";

  return "Medium";
}

const ISSUE_CATEGORIES = ["Garbage", "Road", "Water", "Streetlight", "Other"] as const;
type IssueCategory = typeof ISSUE_CATEGORIES[number];

type GeminiImageScan = {
  isLikelyAiGenerated: boolean;
  aiGeneratedReason: string;
  isSpam: boolean;
  spamReason: string;
  problemCategory: IssueCategory;
  categoryConfidence: number;
};

type ImageModerationResult = {
  imageHash: string | null;
  isLikelyAiGenerated: boolean;
  aiGeneratedReason: string;
  isSpam: boolean;
  spamReason: string;
  isDuplicate: boolean;
  duplicateAgainst: { id: string; status: string } | null;
  classifiedCategory: IssueCategory;
  classificationConfidence: number;
  model: string;
};

function isResolvedStatus(status: string | null | undefined): boolean {
  const value = (status || "").trim().toLowerCase();
  return value === "closed" || value === "resolved" || value === "resolved (pending admin)";
}

function parseImageDataUrl(photoUrl: string): { mimeType: string; data: string } | null {
  const trimmed = (photoUrl || "").trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    data: match[2].replace(/\s+/g, ""),
  };
}

function normalizeCategory(value: string): IssueCategory {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "garbage") return "Garbage";
  if (normalized === "road") return "Road";
  if (normalized === "water") return "Water";
  if (normalized === "streetlight") return "Streetlight";
  return "Other";
}

function classifyFromText(description: string, submittedCategory: string): { category: IssueCategory; confidence: number } {
  const text = (description || "").toLowerCase();

  if (/(garbage|trash|waste|dump|bin)/.test(text)) return { category: "Garbage", confidence: 0.75 };
  if (/(pothole|road|asphalt|traffic|street crack)/.test(text)) return { category: "Road", confidence: 0.75 };
  if (/(water|pipe|leak|sewage|drain|overflow)/.test(text)) return { category: "Water", confidence: 0.75 };
  if (/(streetlight|street light|lamp|dark street|light pole)/.test(text)) return { category: "Streetlight", confidence: 0.75 };

  return { category: normalizeCategory(submittedCategory), confidence: 0.55 };
}

function detectSpamSignals(userId: string, description: string): { isSpam: boolean; reason: string } {
  const text = (description || "").trim();
  const lower = text.toLowerCase();
  const reasons: string[] = [];

  if (text.length < 8) reasons.push("Description is too short.");
  if (/(https?:\/\/|www\.)/.test(lower)) reasons.push("Description contains promotional links.");
  if (/([a-zA-Z])\1{6,}/.test(lower)) reasons.push("Description has repeated characters.");
  if (/(test\s*test|asdf|qwerty|dummy)/.test(lower)) reasons.push("Description looks like spam/test content.");

  const repeatedByUser = db.prepare(`
    SELECT COUNT(*) as total
    FROM complaints
    WHERE userId = ?
      AND lower(trim(description)) = lower(trim(?))
      AND createdAt >= datetime('now', '-7 day')
  `).get(userId, text) as { total: number };

  if ((repeatedByUser?.total || 0) >= 2) {
    reasons.push("Same description was already submitted repeatedly by this user.");
  }

  return {
    isSpam: reasons.length > 0,
    reason: reasons.join(" "),
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function scanWithGeminiIfAvailable(photoUrl: string, description: string): Promise<GeminiImageScan | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const parsed = parseImageDataUrl(photoUrl);
  if (!apiKey || !parsed) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are validating civic complaint image uploads.
Return ONLY strict JSON with this shape:
{
  "isLikelyAiGenerated": boolean,
  "aiGeneratedReason": string,
  "isSpam": boolean,
  "spamReason": string,
  "problemCategory": "Garbage" | "Road" | "Water" | "Streetlight" | "Other",
  "categoryConfidence": number
}
Rules:
- Mark isLikelyAiGenerated true only if there are strong synthetic-image artifacts.
- Mark isSpam true if image/content is irrelevant, meme, advertisement, or not a real civic issue.
- problemCategory must be one of the allowed values.
- categoryConfidence must be between 0 and 1.
Description: ${description}
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, createPartFromBase64(parsed.data, parsed.mimeType)] }],
      config: { responseMimeType: "application/json" },
    });

    const raw = response.text || "";
    const parsedJson = JSON.parse(extractJsonObject(raw)) as Partial<GeminiImageScan>;
    const category = normalizeCategory(String(parsedJson.problemCategory || ""));
    const confidence = Number(parsedJson.categoryConfidence);

    return {
      isLikelyAiGenerated: !!parsedJson.isLikelyAiGenerated,
      aiGeneratedReason: String(parsedJson.aiGeneratedReason || ""),
      isSpam: !!parsedJson.isSpam,
      spamReason: String(parsedJson.spamReason || ""),
      problemCategory: category,
      categoryConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.6,
    };
  } catch (err) {
    console.warn("Gemini image scan failed, falling back to heuristic checks:", err);
    return null;
  }
}

async function runImageModeration(
  userId: string,
  photoUrl: string,
  description: string,
  submittedCategory: string
): Promise<ImageModerationResult> {
  const normalizedPhoto = (photoUrl || "").trim();
  const parsedData = parseImageDataUrl(normalizedPhoto);
  const imageHash = normalizedPhoto
    ? crypto
        .createHash("sha256")
        .update(parsedData ? parsedData.data : normalizedPhoto, "utf8")
        .digest("hex")
    : null;

  const duplicate = imageHash
    ? (db.prepare(`
      SELECT id, status
      FROM complaints
      WHERE imageHash = ?
      ORDER BY datetime(createdAt) DESC
      LIMIT 1
    `).get(imageHash) as { id: string; status: string } | undefined)
    : undefined;

  const spamHeuristic = detectSpamSignals(userId, description);
  const textClassification = classifyFromText(description, submittedCategory);
  const gemini = await scanWithGeminiIfAvailable(normalizedPhoto, description);
  const duplicateIsResolved = !!(duplicate && isResolvedStatus(duplicate.status));
  const duplicateSpamReason = duplicateIsResolved
    ? `Same image was previously reported and resolved (Complaint ${duplicate?.id}).`
    : "";

  return {
    imageHash,
    isLikelyAiGenerated: gemini?.isLikelyAiGenerated ?? false,
    aiGeneratedReason: gemini?.aiGeneratedReason || "",
    isSpam: spamHeuristic.isSpam || !!gemini?.isSpam || duplicateIsResolved,
    spamReason: [spamHeuristic.reason, gemini?.spamReason || "", duplicateSpamReason].filter(Boolean).join(" ").trim(),
    isDuplicate: !!duplicate,
    duplicateAgainst: duplicate ? { id: duplicate.id, status: duplicate.status } : null,
    classifiedCategory: gemini?.problemCategory || textClassification.category,
    classificationConfidence: gemini?.categoryConfidence ?? textClassification.confidence,
    model: gemini ? "gemini-2.5-flash" : "heuristic",
  };
}

function createAdminNotification(complaintId: string, message: string) {
  const id = uid("NTF");
  db.prepare(
    "INSERT INTO notifications (id, complaintId, type, message, isRead) VALUES (?, ?, ?, ?, 0)"
  ).run(id, complaintId, "RESOLVED", message);
}

function notifyAdminAssignment(complaintId: string, workerName: string, category: string, ward: string) {
  const id = uid("NTF");
  const msg = `Complaint ${complaintId} auto-assigned to ${workerName} (${category}) in ${ward}.`;
  db.prepare(
    "INSERT INTO notifications (id, complaintId, type, message, isRead) VALUES (?, ?, ?, ?, 0)"
  ).run(id, complaintId, "ASSIGNED", msg);
}

async function reverseGeocode(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;

  const r = await fetch(url, {
    headers: {
      // IMPORTANT: Nominatim expects a User-Agent
      "User-Agent": "civicpulse-hackathon/1.0",
      "Accept": "application/json",
    },
  });

  if (!r.ok) throw new Error("Reverse geocode failed");

  const data: any = await r.json();
  const a = data.address || {};

  const ward =
  a.suburb ||
  a.neighbourhood ||
  a.city_district ||
  a.district ||
  a.municipality ||
  a.county ||
  a.state_district ||
  "Unknown";

  return {
    area: a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.city || "Unknown",
    city: a.city || a.town || a.village || a.county || "Unknown",
    state: a.state || "Unknown",
    fullAddress: data.display_name || "Unknown",
    ward,
  };
}

function pickOfficerForWardOrDivision(ward: string, division: string) {
  const byWard = db
    .prepare(`SELECT id, name, email, department, division, ward FROM officers WHERE ward = ? LIMIT 1`)
    .get(ward);

  if (byWard) return byWard;

  const byDivision = db
    .prepare(`SELECT id, name, email, department, division, ward FROM officers WHERE division = ? LIMIT 1`)
    .get(division);

  if (byDivision) return byDivision;

  return null;
}

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465, // ✅ true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOfficerEmail(to: string, subject: string, html: string) {
  if (!to) return;

  try {
    await mailer.sendMail({
      from: `"CivicPulse" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log("✅ Email sent to:", to);
  } catch (err) {
    console.error("❌ Email failed:", err);
  }
}

app.get("/api/debug/test-email", async (req, res) => {
  const to = String(req.query.to || "").trim();
  if (!to) return res.status(400).json({ error: "Pass ?to=adhalhari2@gmail.com" });

  await sendOfficerEmail(
    to,
    "CivicPulse Test Email ✅",
    "<h3>If you got this, SMTP is working.</h3>"
  );

  res.json({ ok: true, sentTo: to });
});

// --------------------
// DEBUG ROUTES (TEMP / DEV)
// --------------------

// ✅ This helps you verify users quickly in JSON
app.get("/api/debug/users", (req, res) => {
  const users = db.prepare("SELECT id, name, email, role FROM users ORDER BY role, email").all();
  res.json(users);
});

// ✅ One-time helper to update old admin email -> new
app.post("/api/debug/fix-admin-email", (req, res) => {
  const oldEmail = "admin@civicconnect.org";
  const newEmail = "admin@civicpulse.org";

  const result = db
    .prepare("UPDATE users SET email = ? WHERE email = ? AND role = 'admin'")
    .run(newEmail, oldEmail);

  res.json({ updatedRows: result.changes, from: oldEmail, to: newEmail });
});

app.get("/api/debug/users", (req, res) => {
  const users = db.prepare("SELECT id, name, email, role FROM users").all();
  res.json(users);
});

app.get("/api/debug/officers", (req, res) => {
  const rows = db.prepare("SELECT * FROM officers").all();
  res.json(rows);
});

// --------------------
// AUTH ROUTES
// --------------------

// Signup: allow citizen + worker only
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const safeRole = role === "worker" || role === "citizen" ? role : "citizen";
  const id = uid("USR");

  try {
    db.prepare("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)").run(
      id,
      name,
      email,
      password,
      safeRole
    );
    res.status(201).json({ id, name, email, role: safeRole });
  } catch (err) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// Login: validate email+password, then enforce role match (cleaner)
app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const user = db
    .prepare("SELECT id, name, email, role FROM users WHERE email = ? AND password = ?")
    .get(email, password);

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  // enforce portal role correctness
  if (user.role !== role) {
    return res.status(403).json({ error: "Invalid credentials or unauthorized role" });
  }

  res.json(user);
});

// --------------------
// STEP 3: WARD + DIVISION MAPPING (Amravati demo-safe)
// --------------------

function mapToAmravatiWard(lat: number, lon: number, fallbackWard?: string) {
  // Pushpak Colony / VMV / Camp Area
  if (lat >= 20.870 && lat <= 20.890 && lon >= 77.730 && lon <= 77.760) {
    return "Amravati Ward – Pushpak Colony Zone";
  }

  // Rajapeth / Badnera Road
  if (lat >= 20.900 && lat <= 20.930 && lon >= 77.740 && lon <= 77.770) {
    return "Amravati Ward – Rajapeth Zone";
  }

  // Panchvati / Shegaon Naka
  if (lat >= 20.940 && lat <= 20.970 && lon >= 77.750 && lon <= 77.790) {
    return "Amravati Ward – Panchvati Zone";
  }

  // Old City / Jaistambh Chowk
  if (lat >= 20.910 && lat <= 20.930 && lon >= 77.720 && lon <= 77.740) {
    return "Amravati Ward – Old City Zone";
  }

  // If user is inside Amravati but outside demo boxes, use reverse-geocode ward if present
  if (fallbackWard && fallbackWard !== "Unknown") {
    return `Amravati Ward – ${fallbackWard}`;
  }

  return "Amravati Ward – Unassigned";
}

function mapWardToDivision(ward: string) {
  // Simple mapping for hackathon demo
  if (ward.includes("Pushpak Colony")) return "Zone-1";
  if (ward.includes("Rajapeth")) return "Zone-2";
  if (ward.includes("Panchvati")) return "Zone-3";
  if (ward.includes("Old City")) return "Zone-4";
  if (ward.includes("Amravati Ward –")) return "Zone-Unmapped";
  return "Zone-Unmapped";
}

function pickOfficerForDivision(division: string) {
  // Hackathon demo: hardcoded mapping
  const officers: Record<string, { id: string; name: string; department: string }> = {
    "Zone-1": { id: "OFF-001", name: "Rohit Patil", department: "Sanitation" },
    "Zone-2": { id: "OFF-002", name: "Ayesha Khan", department: "Road" },
    "Zone-3": { id: "OFF-003", name: "Suresh Jadhav", department: "Water" },
  };

  return officers[division] ?? null;
}

// --------------------
// COMPLAINT ROUTES
// --------------------

// ✅ GET complaints (Citizen / Worker / Admin)
app.get("/api/complaints", (req, res) => {
  try {
    const userId = String(req.query.userId || "").trim();
    const workerName = String(req.query.workerName || "").trim();

    let rows: any[] = [];

    if (userId) {
      // Citizen: only their complaints
      rows = db.prepare(`
        SELECT *
        FROM complaints
        WHERE userId = ?
        ORDER BY createdAt DESC
      `).all(userId);

    } else if (workerName) {
      // Worker: jobs assigned to that worker OR marked by them
      rows = db.prepare(`
        SELECT *
        FROM complaints
        WHERE workerName = ? OR assignedOfficerName = ?
        ORDER BY createdAt DESC
      `).all(workerName, workerName);

    } else {
      // Admin: all complaints
      rows = db.prepare(`
        SELECT *
        FROM complaints
        ORDER BY createdAt DESC
      `).all();
    }

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load complaints" });
  }
});

app.post("/api/complaints", async (req, res) => {
  const { userId, category, description, photoUrl, latitude, longitude } = req.body;

  if (!userId || !category || !description) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: "Missing location" });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  const id = uid("CMP");
  const rawPhotoUrl = String(photoUrl || "").trim();

  const moderation = await runImageModeration(
    String(userId),
    rawPhotoUrl,
    String(description),
    String(category)
  );

  if (moderation.isLikelyAiGenerated) {
    return res.status(422).json({
      error: "Uploaded image appears AI-generated. Please upload a real issue photo.",
      reason: moderation.aiGeneratedReason || "Image authenticity check failed.",
    });
  }

  if (moderation.isDuplicate && moderation.duplicateAgainst && !isResolvedStatus(moderation.duplicateAgainst.status)) {
    return res.status(409).json({
      error: "Problem already reported and not resolved yet.",
      duplicateAgainst: moderation.duplicateAgainst,
    });
  }

  if (moderation.isSpam) {
    return res.status(422).json({
      error: "Upload flagged as spam. Please provide a valid civic issue report.",
      reason: moderation.spamReason || "Spam signal detected.",
    });
  }

  const classifiedCategory =
    moderation.classificationConfidence >= 0.6
      ? moderation.classifiedCategory
      : normalizeCategory(String(category));

  const priority = assignPriority(classifiedCategory, description);

  try {
    // ✅ reverse geocode (with fallback so it never blocks submission)
    let loc;
    try {
      loc = await reverseGeocode(lat, lon);
    } catch (e) {
      console.warn("Reverse geocode failed, using fallback", e);
      loc = {
        area: "Unknown",
        city: "Amravati",
        state: "Maharashtra",
        fullAddress: "Unknown",
        ward: "Unknown",
      };
    }

    // ✅ STEP 3: map to ward + division
    const ward = mapToAmravatiWard(lat, lon, loc.ward);
    const division = mapWardToDivision(ward);

    // ✅ STEP 4 (basic): officer assignment by division
    const officer = pickOfficerForWardOrDivision(ward, division);

    // ✅ STEP 5: Notify Officer via Email
    if (officer?.email) {
      await sendOfficerEmail(
        officer.email,
        "New Complaint Assigned",
        `
          <h2>New Complaint Assigned</h2>
          <p><b>ID:</b> ${id}</p>
          <p><b>Category:</b> ${classifiedCategory}</p>
          <p><b>Priority:</b> ${priority}</p>
          <p><b>Ward:</b> ${ward}</p>
          <p><b>Division:</b> ${division}</p>
          <p><b>Description:</b> ${description}</p>
          <p><b>Location:</b> ${loc.fullAddress}</p>
          <p><b>GPS:</b> ${lat}, ${lon}</p>
        `
      );
    }
    const assignedOfficerId = officer?.id ?? null;
    const assignedOfficerName = officer?.name ?? null;
    const workerName = assignedOfficerName ?? null;
    const status = assignedOfficerName ? "In Progress" : "Submitted";
    const department = officer?.department ?? category;

    if (assignedOfficerName) {
      notifyAdminAssignment(id, assignedOfficerName, classifiedCategory, ward);
    }

    db.prepare(`
      INSERT INTO complaints (
        id, userId, category, description, photoUrl,
        latitude, longitude,
        workerName,
        area, city, state, fullAddress, ward, division,
        department, assignedOfficerId, assignedOfficerName,
        imageHash, moderationFlags, aiGeneratedFlag, spamFlag, duplicateFlag,
        classifiedCategory, classificationConfidence,
        priority, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, classifiedCategory, description, rawPhotoUrl,
      lat, lon,
      workerName,
      loc.area, loc.city, loc.state, loc.fullAddress,
      ward, division,
      department, assignedOfficerId, assignedOfficerName,
      moderation.imageHash,
      JSON.stringify({
        model: moderation.model,
        aiGenerated: moderation.isLikelyAiGenerated,
        spam: moderation.isSpam,
        duplicate: moderation.isDuplicate,
      }),
      moderation.isLikelyAiGenerated ? 1 : 0,
      moderation.isSpam ? 1 : 0,
      moderation.isDuplicate ? 1 : 0,
      classifiedCategory,
      moderation.classificationConfidence,
      priority, status
    );

    return res.status(201).json({
      id,
      userId,
      category: classifiedCategory,
      description,
      photoUrl: rawPhotoUrl,
      latitude: lat,
      longitude: lon,
      area: loc.area,
      city: loc.city,
      state: loc.state,
      ward,
      division,
      department,
      assignedOfficerId,
      assignedOfficerName,
      fullAddress: loc.fullAddress,
      priority,
      status,
      classifiedCategory,
      classificationConfidence: moderation.classificationConfidence,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ create complaint error:", err);
    return res.status(500).json({
      error: "Failed to create complaint",
      details: err?.message || String(err),
    });
  }
});

// ✅ When worker marks Resolved => Admin gets notification
app.patch("/api/complaints/:id", (req, res) => {
  const { id } = req.params;
  const { status, workerName } = req.body;

  try {
    const existing = db.prepare("SELECT * FROM complaints WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Complaint not found" });

    // Update fields
    if (status && workerName) {
      db.prepare("UPDATE complaints SET status = ?, workerName = ? WHERE id = ?").run(status, workerName, id);
    } else if (status) {
      db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run(status, id);
    } else if (workerName) {
      db.prepare("UPDATE complaints SET workerName = ? WHERE id = ?").run(workerName, id);
    }

    // If worker marks resolved -> set pending admin + notify
    if (status === "Resolved") {
      db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run("Resolved (Pending Admin)", id);

      if (existing.status !== "Resolved (Pending Admin)") {
        notifyAdminResolved(id, workerName || existing.workerName || "Worker");
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

app.delete("/api/complaints/:id", (req, res) => {
  const id = req.params.id.trim();
  try {
    const result = db.prepare("DELETE FROM complaints WHERE id = ?").run(id);
    if (result.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "Complaint not found" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete complaint" });
  }
});

// --------------------
// ADMIN NOTIFICATIONS
// --------------------
app.get("/api/admin/notifications", (req, res) => {
  const unreadOnly = req.query.unread === "1";

  const rows = unreadOnly
    ? db.prepare("SELECT * FROM notifications WHERE isRead = 0 ORDER BY createdAt DESC").all()
    : db.prepare("SELECT * FROM notifications ORDER BY createdAt DESC").all();

  res.json(rows);
});

app.patch("/api/admin/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  const result = db.prepare("UPDATE notifications SET isRead = 1 WHERE id = ?").run(id);
  res.json({ success: true, updatedRows: result.changes });
});

// Admin approves or rejects worker resolution
app.post("/api/admin/complaints/:id/decision", (req, res) => {
  const { id } = req.params;
  const { decision } = req.body; // "approve" | "reject"

  const complaint = db.prepare("SELECT * FROM complaints WHERE id = ?").get(id);
  if (!complaint) return res.status(404).json({ error: "Complaint not found" });

  if (decision === "approve") {
    db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run("Closed", id);
    return res.json({ success: true, status: "Closed" });
  }

  if (decision === "reject") {
    db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run("In Progress", id);
    return res.json({ success: true, status: "In Progress" });
  }

  return res.status(400).json({ error: "Invalid decision" });
});

// --------------------
// VITE / STATIC
// --------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // IMPORTANT: API routes are already registered above.
    // Vite middleware goes AFTER, so /api/* won't become a webpage.
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
