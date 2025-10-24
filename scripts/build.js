// Build a minimal, token-optional Nightscout /pebble HTML page
// Ultra-compatible: ASCII arrows, cache-busting, robust TZ, smart unit handling.
// Delta conversion is tied to SGV-inferred source units to avoid wrong ×18.

import fs from "node:fs/promises";
import moment from "moment-timezone";

const NS = process.env.NIGHTSCOUT_URL;
const TOKEN = process.env.NIGHTSCOUT_TOKEN?.trim();
const RAW_TZ = process.env.NIGHTSCOUT_TZ;
const FORCE_MMOL = process.env.FORCE_MMOL?.trim()?.toLowerCase() === "true";
const NS_UNITS = process.env.NIGHTSCOUT_UNITS?.trim()?.toLowerCase(); // "mmol" | "mgdl" | undefined

console.log("DEBUG NIGHTSCOUT_URL exists:", Boolean(NS));
console.log("DEBUG NIGHTSCOUT_TOKEN provided:", Boolean(TOKEN));
console.log("DEBUG NIGHTSCOUT_TZ (raw):", JSON.stringify(RAW_TZ));
console.log("DEBUG FORCE_MMOL (raw):", process.env.FORCE_MMOL, "→", FORCE_MMOL);
console.log("DEBUG NIGHTSCOUT_UNITS (raw):", NS_UNITS);

if (!NS) {
  console.error("❌ Missing NIGHTSCOUT_URL environment variable.");
  process.exit(1);
}

const NS_BASE = NS.replace(/\/+$/, "");
const pebbleURL = NS_BASE + "/pebble" + (TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "");
const statusURLs = [
  NS_BASE + "/status.json" + (TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ""),
  NS_BASE + "/api/v1/status.json" + (TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "")
];
const MGDL_PER_MMOLL = 18.0182;

// ---------- helpers ----------
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// Try both /status endpoints
async function getStatus() {
  for (const u of statusURLs) {
    try {
      const s = await getJSON(u);
      console.log("DEBUG status OK:", u);
      return s;
    } catch (e) {
      console.log("DEBUG status fail:", u, "→", String(e?.message || e));
    }
  }
  return null;
}

function resolveTimezone(status) {
  const override = RAW_TZ?.trim();
  if (override) {
    if (!moment.tz.zone(override)) {
      console.log("DEBUG WARNING: TZ override not found in moment DB:", override);
    } else {
      console.log("DEBUG using TZ override:", override);
    }
    return override;
  }
  const tzFromStatus = status?.settings?.timezone?.trim();
  if (tzFromStatus) {
    if (!moment.tz.zone(tzFromStatus)) {
      console.log("DEBUG WARNING: /status timezone not in moment DB:", tzFromStatus);
    } else {
      console.log("DEBUG using TZ from /status:", tzFromStatus);
    }
    return tzFromStatus;
  }
  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (!moment.tz.zone(localTZ)) {
    console.log("DEBUG WARNING: runner local TZ not in moment DB; using UTC:", localTZ);
    return "UTC";
  }
  console.log("DEBUG using runner local TZ:", localTZ);
  return localTZ;
}

function toNumber(x) {
  if (x == null) return NaN;
  const s = String(x).replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Infer whether the *source* SGV is in mmol (typical mmol range ≤ 40)
function inferSourceIsMmol(sgvRaw) {
  const n = toNumber(sgvRaw);
  return Number.isFinite(n) && n > 0 && n <= 40;
}

// Looks-like helper for last-resort units inference
function looksLikeMmol(n) { return Number.isFinite(n) && n > 0 && n <= 40; }

// Units selection: FORCE_MMOL > NIGHTSCOUT_UNITS secret > status > inference(sgv)
function deriveUnits(status, sgvRaw) {
  if (FORCE_MMOL) {
    console.log("DEBUG forcing mmol/L via FORCE_MMOL");
    return "mmol/L";
  }
  if (NS_UNITS === "mmol") {
    console.log("DEBUG NIGHTSCOUT_UNITS=mmol override");
    return "mmol/L";
  }
  if (NS_UNITS === "mgdl") {
    console.log("DEBUG NIGHTSCOUT_UNITS=mgdl override");
    return "mg/dL";
  }
  const raw =
    status?.settings?.units ??
    status?.settings?.units_bg ??
    status?.units ??
    null;
  if (raw) {
    const v = String(raw).toLowerCase();
    const u = v.includes("mmol") ? "mmol/L" : "mg/dL";
    console.log("DEBUG units from status:", raw, "→", u);
    return u;
  }
  const n = toNumber(sgvRaw);
  const u = looksLikeMmol(n) ? "mmol/L" : "mg/dL";
  console.log("DEBUG units inferred from SGV", sgvRaw, "→", u);
  return u;
}

// Format BG/Δ using a *single* source-unit inference from SGV
function formatBGFromSource(valueRaw, outUnits, sourceIsMmol) {
  const n = toNumber(valueRaw);
  if (!Number.isFinite(n)) return String(valueRaw ?? "?");

  if (outUnits === "mmol/L") {
    const mmol = sourceIsMmol ? n : (n / MGDL_PER_MMOLL);
    return mmol.toFixed(1);
  } else {
    // mg/dL
    const mgdl = sourceIsMmol ? (n * MGDL_PER_MMOLL) : n;
    return String(Math.round(mgdl));
  }
}

function formatDeltaFromSource(deltaRaw, outUnits, sourceIsMmol) {
  if (deltaRaw == null || deltaRaw === "") return "";
  const s = String(deltaRaw).trim();
  const signIn = (s[0] === "+" || s[0] === "-") ? s[0] : "";
  const n = toNumber(deltaRaw);
  if (!Number.isFinite(n)) return String(deltaRaw);

  if (outUnits === "mmol/L") {
    const mmol = sourceIsMmol ? n : (n / MGDL_PER_MMOLL);
    const sign = signIn || (mmol >= 0 ? "+" : "-");
    return `${sign}${Math.abs(mmol).toFixed(1)}`;
  } else {
    // mg/dL
    const mgdl = sourceIsMmol ? (n * MGDL_PER_MMOLL) : n;
    const sign = signIn || (mgdl >= 0 ? "+" : "-");
    return `${sign}${Math.round(Math.abs(mgdl))}`;
  }
}

// ---------- main ----------
try {
  const [data, status] = await Promise.all([getJSON(pebbleURL), getStatus()]);

  const bg0 = (data?.bgs && data.bgs[0]) || {};
  const sgvRaw   = bg0.sgv ?? "?";
  const deltaRaw = bg0.bgdelta ?? "";
  const units    = deriveUnits(status, sgvRaw);
  const tz       = resolveTimezone(status);

  // Infer source units once from SGV and use for both BG and Δ
  const sourceIsMmol = inferSourceIsMmol(sgvRaw);

  // ASCII-only trend map (for very old devices)
  const tmap = {
    1: "v",
    2: "v>",
    3: "--",
    4: "^>",
    5: "^",
    DoubleDown: "vv",
    SingleDown: "v",
    FortyFiveDown: "v>",
    Flat: "--",
    FortyFiveUp: "^>",
    SingleUp: "^",
    DoubleUp: "^^"
  };
  const trend = bg0.trend ?? bg0.direction;
  const arrow = tmap[trend] || (typeof trend === "string" ? trend : "");

  const ts = toNumber(bg0.datetime ?? bg0.readingDate);
  let age = "?";
  if (Number.isFinite(ts)) {
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    age = `${mins}m ago`;
  }

  const sgvDisplay   = formatBGFromSource(sgvRaw,  units, sourceIsMmol);
  const deltaDisplay = formatDeltaFromSource(deltaRaw, units, sourceIsMmol);
  const battery = data?.status?.device?.battery ?? data?.status?.battery ?? "?";

  console.log(
    "DEBUG units(out):", units,
    "sourceIsMmol:", sourceIsMmol,
    "| SGV raw→", sgvRaw, "=>", sgvDisplay,
    "| Δ raw→", deltaRaw, "=>", deltaDisplay
  );

  const stamp = moment()
    .tz(tz && moment.tz.zone(tz) ? tz : "UTC")
    .format("YYYY-MM-DD HH:mm:ss z");

  // cache-busting every minute for stubborn proxies
  const cacheBust = Math.floor(Date.now() / 60000);

  const html = `<!doctype html>
<html>
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="pragma" content="no-cache">
<meta http-equiv="expires" content="0">
<meta http-equiv="refresh" content="60;url=./?r=${cacheBust}">
<title>BG Simple</title>
</head>
<body>
<pre>
BG: <big>${sgvDisplay}</big> ${units} ${arrow} ${deltaDisplay}
Time: ${age}
Battery: ${battery}
Updated: ${stamp} (${tz || "UTC"})
</pre>
</body>
</html>`;

  await fs.writeFile("index.html", html, "utf8");
  console.log(`✅ Built index.html from ${pebbleURL} [${tz || "UTC"}] [${units}]`);
} catch (err) {
  const msg = String(err?.message || err);
  const fallback = `<!doctype html><meta charset="utf-8"><pre>Build error: ${msg}
Source: ${pebbleURL}
</pre>`;
  await fs.writeFile("index.html", fallback, "utf8");
  console.error("⚠️ Build failed:", msg);
  process.exitCode = 0;
}
