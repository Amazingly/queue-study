import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const requiredFiles = [
  "assets/config.js",
  "assets/translations-en.js",
  "assets/translations-vi.js",
  "privacy.html",
  "withdrawal.html",
  "docs/sequence-precommitment.md"
];

const forbidden = [
  /REPLACE_WITH/g,
  /\[INSTITUTION\]/g,
  /\[ETHICS_REFERENCE\]/g,
  /\[ETHICS_COMMITTEE_NAME\]/g,
  /\[ETHICS_COMMITTEE_CONTACT\]/g,
  /\[CONTACT_EMAIL\]/g,
  /\[WITHDRAWAL_DEADLINE\]/g,
  /\[CASH_PAYMENT_LOCATION_AND_TIMES\]/g,
  /\[FILL/g,
  /\[PASTE/g
];

const failures = [];
for (const rel of requiredFiles) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) {
    failures.push(`${rel}: missing`);
    continue;
  }
  const text = fs.readFileSync(absolute, "utf8");
  for (const pattern of forbidden) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) failures.push(`${rel}: contains ${pattern.source}`);
  }
}

const configText = fs.readFileSync(path.join(root, "assets/config.js"), "utf8");
const apiMatch = configText.match(/API_URL:\s*["']([^"']+)["']/);
if (!apiMatch || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(apiMatch[1])) {
  failures.push("assets/config.js: API_URL must be the production Apps Script /exec URL");
}

const precommit = fs.readFileSync(path.join(root, "docs/sequence-precommitment.md"), "utf8");
const precommitHashes = new Set((precommit.match(/[a-f0-9]{64}/gi) || []).map((h) => h.toLowerCase()));
if (precommitHashes.size < 3) {
  failures.push(
    "docs/sequence-precommitment.md: expected three distinct 64-character SHA-256 commitments " +
    "(stochastic-sequence, treatment-allocation, design-manifest); found " + precommitHashes.size);
}

if (failures.length) {
  console.error("PUBLIC RELEASE BLOCKED:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Public release check passed.");
