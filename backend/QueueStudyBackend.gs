/**
 * Queue Study backend — single-file beginner bundle.
 * Generated from the reviewed modular source (reconciled build with the
 * on-demand self-service session model). Paste this file into one Apps
 * Script Code.gs file only; do not also paste the modular .gs files.
 */

/* ==========================================================================
   MODULE: Config.gs
   ========================================================================== */
/**
 * Config.gs — design parameters and Script Properties access (§5.2).
 *
 * The experimental design constants below are the server-side source of
 * truth. They must match the preregistered environment exactly:
 * p = 0.40 i.i.d.; u_H = 120, u_L = 0; w0 = 30, w1 = 70; rho_R = 0.50;
 * 20 rounds; 300-point endowment; 60-second decisions; linear belief
 * rule with BELIEF_MAX = 10; 100 VND per point; 50,000 VND fixed payment.
 *
 * Planner welfare weights (D, V_H, V_L) appear NOWHERE in this project:
 * raw data stay primitive (§9) and welfare indices are computed offline
 * in version-controlled analysis code.
 *
 * Secrets and workbook identifiers live in Script Properties (§5.2),
 * never in source: RESEARCH_SPREADSHEET_ID, PAYMENT_SPREADSHEET_ID,
 * PARENT_ORIGIN, HMAC_SECRET, SEQUENCE_SEED, EXPERIMENT_VERSION,
 * SEQUENCE_VERSION, COLLECTION_OPEN, MAX_PARTICIPANTS,
 * EXPECTED_APP_VERSION, STUDY_BASE_URL.
 */

var DESIGN = Object.freeze({
  NUM_ROUNDS: 20,
  H_PROB: 0.40,
  H_VALUE: 120,
  L_VALUE: 0,
  MIXED_EV: 48,            // 0.40 * 120 + 0.60 * 0
  WAIT_NORMAL: 30,
  WAIT_STRAINED: 70,
  RECOVERY_PROB: 0.50,
  START_BALANCE: 300,
  DECISION_SECONDS: 60,
  BELIEF_MAX: 10,
  VND_PER_POINT: 100,      // 100 points = 10,000 VND
  FIXED_VND: 50000,
  TREATMENTS: ["mixed", "fine", "state_dependent"],
  RESUME_EXPIRY_HOURS: 24,
  MAX_ENVELOPE_BYTES: 32768,
  TEXT_LIMIT_LONG: 1000,   // strategy, confusing (§6.5)
  TEXT_LIMIT_SHORT: 500    // any other free text (§6.5)
});

/** Comprehension answer key (§5.5 quiz; Q7–Q8 per §8.4). */
var QUIZ_KEY = Object.freeze({
  cq1: "C",   // not sending pays 0
  cq2: "C",   // H worth 120
  cq3: "B",   // 40%
  cq4: "B",   // EV 48
  cq5: "A",   // 120 − 70 = 50
  cq6: "B",   // next round: high waiting-cost state
  cq7: 18,    // 48 − 30
  cq8: -22    // 48 − 70
});

var PROPS_REQUIRED = [
  "RESEARCH_SPREADSHEET_ID",
  "PAYMENT_SPREADSHEET_ID",
  "PARENT_ORIGIN",
  "HMAC_SECRET",
  "SEQUENCE_SEED",
  "EXPERIMENT_VERSION",
  "SEQUENCE_VERSION",
  "COLLECTION_OPEN",
  "MAX_PARTICIPANTS",
  "EXPECTED_APP_VERSION"
];

function props_() {
  return PropertiesService.getScriptProperties();
}

/**
 * Execution-scoped cache for the two immutable secrets. Provisioning calls
 * seededUniform_/tokenHash_ tens of thousands of times, and each previously
 * made its own PropertiesService round-trip: at a 1,000-place pool that was
 * ~16,000 redundant service calls, the single largest contributor to the
 * Apps Script six-minute execution limit. SEQUENCE_SEED and HMAC_SECRET are
 * written once at setup and never change during an execution; globals reset
 * on every execution, so the cache cannot outlive a change.
 */
var SECRET_CACHE_ = {};

function secret_(key) {
  var cached = SECRET_CACHE_[key];
  if (cached === undefined) {
    cached = prop_(key);
    SECRET_CACHE_[key] = cached;
  }
  return cached;
}

function clearSecretCache_() { SECRET_CACHE_ = {}; }

function prop_(key) {
  var value = props_().getProperty(key);
  if (value === null || value === undefined || value === "") {
    throw new Error("CONFIG_MISSING:" + key);
  }
  return value;
}

function propOptional_(key, fallback) {
  var value = props_().getProperty(key);
  return (value === null || value === undefined || value === "") ? fallback : value;
}

function collectionOpen_() {
  return prop_("COLLECTION_OPEN") === "TRUE";
}

function maxParticipants_() {
  return parseInt(prop_("MAX_PARTICIPANTS"), 10);
}

function nowIso_() {
  return new Date().toISOString();
}

/** Keyed hash for participation and resume tokens (§5.3). */
function tokenHash_(rawToken) {
  var secret = secret_("HMAC_SECRET");
  var signature = Utilities.computeHmacSha256Signature(
    String(rawToken), secret, Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(signature).replace(/=+$/g, "");
}

/** SHA-256 hex digest of a string (payload hashes, sequence hashes). */
function sha256Hex_(text) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8
  );
  return digest.map(function (b) {
    var v = (b + 256) % 256;
    return (v < 16 ? "0" : "") + v.toString(16);
  }).join("");
}

/**
 * Deterministic uniform draw in [0,1) from the private sequence seed
 * (§7.2, §7.3). HMAC-SHA256 in counter mode: the label fixes block,
 * round, and field, so the entire stochastic environment is reproducible
 * from (SEQUENCE_SEED, SEQUENCE_VERSION, generator_version) and can be
 * frozen and hash-precommitted before recruitment. 56 bits of mantissa.
 */
var GENERATOR_VERSION = "hmac-sha256-ctr-v1";

function seededUniform_(label) {
  var seed = secret_("SEQUENCE_SEED");
  var sig = Utilities.computeHmacSha256Signature(String(label), seed, Utilities.Charset.UTF_8);
  var x = 0;
  for (var i = 0; i < 7; i++) x = x * 256 + ((sig[i] + 256) % 256);
  return x / Math.pow(2, 56);
}

/** Human-safe random code from a UUID: no 0/O/1/I ambiguity. */
function randomCode_(prefix) {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var hex = Utilities.getUuid().replace(/-/g, "");
  var out = "";
  for (var i = 0; i < 6; i++) {
    out += chars[parseInt(hex.substr(i * 2, 2), 16) % chars.length];
  }
  return prefix + "-" + out;
}

/**
 * A completion code guaranteed unique against the payment ledger. Cash is
 * paid against this code, so a collision (~0.1% at N~1650 for a 6-character
 * 32-symbol code) must never produce two ledger rows sharing one code with
 * different sessions. Called only inside the finalize script lock, so the
 * read-then-append is atomic against concurrent completions.
 */
function uniqueCompletionCode_() {
  var sheet = sheet_(paymentBook_(), "payments", PAYMENT_HEADERS.payments);
  var last = sheet.getLastRow();
  var seen = {};
  if (last > 1) {
    var col = PAYMENT_HEADERS.payments.indexOf("completion_code") + 1;
    sheet.getRange(2, col, last - 1, 1).getValues().forEach(function (r) {
      seen[String(r[0])] = true;
    });
  }
  for (var i = 0; i < 100; i++) {
    var code = randomCode_("QL");
    if (!seen[code]) return code;
  }
  // Pathologically unlikely; widen the space to guarantee termination.
  return "QL-" + Utilities.getUuid().replace(/-/g, "").slice(0, 10).toUpperCase();
}

function newOpaqueToken_(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "").slice(0, 8);
}

/** Random six-digit lecture access code (leading zeros allowed). */
function sixDigitCode_() {
  var hex = Utilities.getUuid().replace(/-/g, "");
  var n = parseInt(hex.slice(0, 12), 16) % 1000000;
  return ("000000" + n).slice(-6);
}

/* ==========================================================================
   MODULE: Storage.gs
   ========================================================================== */
/**
 * Storage.gs — workbook schemas (§6.2, §6.3) and sheet access.
 *
 * Two separate workbooks (§6.1):
 *   Research  ("Queue Study Research Data — Production"): config, tokens,
 *             sequences, sessions, events, rounds, participants, errors,
 *             integrity_report. No raw identifiers, no raw tokens.
 *   Payment   ("Queue Study Payment Ledger — Production"): payments and
 *             the invitation ledger (raw tokens for recruitment links).
 *
 * The raw round table stores primitives only (§9): no social_value, no
 * fatigue_cost, no social_score, no theorem_cost. Welfare indices are
 * computed offline from (capacity_before, served, high_burden_served,
 * actual_type).
 */

var SHEETS = Object.freeze({
  CONFIG: "config",
  TOKENS: "tokens",
  SEQUENCES: "sequences",
  SESSIONS: "sessions",
  EVENTS: "events",
  ROUNDS: "rounds",
  PARTICIPANTS: "participants",
  ERRORS: "errors",
  INTEGRITY: "integrity_report",
  LECTURES: "lectures",
  SLOTS: "allocation_slots"
});

var HEADERS = Object.freeze({
  config: ["field", "value", "updated_at"],

  tokens: [
    "token_hash", "batch", "stratum", "block_id", "treatment", "sequence_id",
    "status", "session_id", "assigned_at", "started_at", "completed_at",
    "restart_count", "duplicate_flag"
  ],

  sequences: [
    "sequence_version", "sequence_id", "round", "case_type", "recovery_u",
    "generated_at", "generator_version", "sequence_row_hash"
  ],

  sessions: [
    "session_id", "participant_code", "token_hash", "external_id_hash",
    "treatment", "block_id", "sequence_id", "status", "language",
    "experiment_version", "consented_at", "started_at", "last_seen_at",
    "current_round", "current_load", "current_balance", "last_event_seq",
    "quiz_attempts", "beliefs_submitted", "survey_submitted",
    "completed_at", "withdrawn_at", "integrity_status",
    // Operational extensions (documented in the backend README):
    "resume_token_hash", "last_request_id", "quiz_passed",
    "belief_h", "belief_h_served", "belief_points",
    "completion_code", "receipt_reference", "device_json",
    "entry_mode", "lecture_id"
  ],

  events: [
    "received_at", "request_id", "session_id", "event_seq", "action",
    "payload_hash", "status", "response_code", "response_json",
    "server_execution_id", "app_version"
  ],

  rounds: [
    "session_id", "participant_code", "treatment", "block_id", "sequence_id",
    "round", "actual_type", "display_label", "capacity_before", "wait_cost",
    "choice", "timed_out", "active_rt_ms", "wall_rt_ms", "hidden_ms",
    "instruction_ms", "served", "high_burden_served", "recovery_u",
    "recovered", "capacity_after", "points", "balance_after",
    "request_id", "received_at",
    // §4.8 paradata transmitted with each decision:
    "instruction_opens", "blur_count"
  ],

  participants: [
    "session_id", "participant_code", "treatment", "block_id", "language",
    "consented_at", "started_at", "completed_at", "elapsed_seconds",
    "completion_status", "quiz_failures", "attention_passed",
    "decision_points", "belief_points", "bonus_points", "bonus_vnd",
    "h_served", "l_served", "strained_rounds", "timeouts", "mean_active_rt",
    "label_difficulty", "label_effect", "waiting_effect",
    "understood", "believed", "policy_recognition",
    "age_band", "gender", "field", "year", "prior_experiments",
    "gps_risk", "gps_patience", "device_class", "integrity_status",
    // Preregistered belief outcomes (H5) and documented extensions:
    "belief_h", "belief_h_served", "actual_h", "actual_h_served",
    "policy_noticed", "attention_check", "strategy", "confusing",
    "browser_family", "viewport_width_band", "viewport_height_band",
    "timezone_offset_minutes", "sequence_id", "quiz_attempts"
  ],

  errors: [
    "received_at", "request_id", "session_id", "error_code",
    "safe_error_message", "action", "app_version", "resolved", "resolution_note"
  ],

  integrity_report: [
    "generated_at", "session_id", "check", "status", "detail"
  ],

  /* Shared-entry gateway (classroom deployment). The lecture code is
   * stored only as a keyed hash; codes are short-lived and windowed.
   * Operational extensions beyond the planning table (claimed_count,
   * next_claim_order, slot_row_start, slot_count) give O(1) claiming. */
  lectures: [
    "lecture_id", "code_hash", "opens_at", "closes_at",
    "expected_n", "maximum_n", "status",
    "claimed_count", "next_claim_order", "slot_row_start", "slot_count"
  ],

  /* Permuted blocks of three within every lecture (§5 of the gateway
   * plan): consecutive triples share a block and its frozen sequence,
   * with treatment order permuted inside the triple, so counts differ
   * by at most one at every interim point and are exactly equal after
   * each complete triple. Treatment and sequence stay private: this tab
   * is never shared with the lecturer. */
  allocation_slots: [
    "lecture_id", "claim_order", "block_id", "treatment", "sequence_id",
    "status", "session_id", "claimed_at", "request_id"
  ]
});

var PAYMENT_HEADERS = Object.freeze({
  payments: [
    "participant_code", "external_platform_id", "session_id", "lecture_id", "completion_code",
    "fixed_payment_vnd", "bonus_payment_vnd", "total_payment_vnd",
    "completion_received_at", "payment_status", "payment_date",
    "payment_reference", "withdrawal_status"
  ],
  // Recruitment ledger: the ONLY place raw invitation tokens exist (§5.3).
  // Tokens encode nothing (no treatment, block, sequence, or identity).
  invites: [
    "batch", "invite_url", "raw_token", "created_at"
  ]
});

/* ---- Workbook access ---- */

function researchBook_() {
  return SpreadsheetApp.openById(prop_("RESEARCH_SPREADSHEET_ID"));
}

function paymentBook_() {
  return SpreadsheetApp.openById(prop_("PAYMENT_SPREADSHEET_ID"));
}

function sheet_(book, name, headers) {
  var sheet = book.getSheetByName(name);
  if (!sheet) throw new Error("SHEET_MISSING:" + name + " (run setup first)");
  return sheet;
}

function researchSheet_(name) {
  return sheet_(researchBook_(), name, HEADERS[name]);
}

function headerIndex_(name) {
  var headers = HEADERS[name] || PAYMENT_HEADERS[name];
  var map = {};
  for (var i = 0; i < headers.length; i++) map[headers[i]] = i;
  return map;
}

/* ---- Row helpers ---- */

function appendRowObject_(sheet, headers, obj) {
  var row = headers.map(function (h) {
    return (h in obj && obj[h] !== undefined && obj[h] !== null) ? obj[h] : "";
  });
  sheet.appendRow(row);
}

/**
 * Find the 1-based sheet row whose `columnName` cell equals `value`,
 * searching only that column. Returns -1 if absent.
 */
function findRowByValue_(sheet, headers, columnName, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  // An empty key cannot identify a row, and createTextFinder("") throws
  // "Argument cannot be null: findText". Gateway participants carry no
  // invitation token, so session.token_hash is "" for every classroom
  // entry; without this guard the comprehension quiz and the finalize
  // path both crashed with SERVER_ERROR for on-demand participants.
  // Measured against the live platform on 2026-08-20.
  if (value === null || value === undefined || String(value) === "") return -1;
  var col = headers.indexOf(columnName) + 1;
  if (col < 1) throw new Error("UNKNOWN_COLUMN:" + columnName);
  var finder = sheet.getRange(2, col, lastRow - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true);
  var hit = finder.findNext();
  return hit ? hit.getRow() : -1;
}

function rowObjectFromValues_(headers, values, rowIndex) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) obj[headers[i]] = values[i];
  obj._row = rowIndex;
  return obj;
}

function readRowObject_(sheet, headers, rowIndex) {
  var values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  return rowObjectFromValues_(headers, values, rowIndex);
}

function writeRowObject_(sheet, headers, rowIndex, obj) {
  var row = headers.map(function (h) {
    return (h in obj && obj[h] !== undefined && obj[h] !== null) ? obj[h] : "";
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
}

/* ---- Config tab (key-value) ---- */

function configSet_(field, value) {
  var sheet = researchSheet_(SHEETS.CONFIG);
  var row = findRowByValue_(sheet, HEADERS.config, "field", field);
  if (row === -1) {
    sheet.appendRow([field, value, nowIso_()]);
  } else {
    sheet.getRange(row, 2, 1, 2).setValues([[value, nowIso_()]]);
  }
}

function configGet_(field, fallback) {
  var sheet = researchSheet_(SHEETS.CONFIG);
  var row = findRowByValue_(sheet, HEADERS.config, "field", field);
  if (row === -1) return fallback;
  var value = readRowObject_(sheet, HEADERS.config, row).value;
  return (value === "" || value === null || value === undefined) ? fallback : value;
}

/*
 * Boolean config reads.
 *
 * configSet_ writes the STRING "TRUE", but Google Sheets coerces it into a
 * boolean on the way into the cell, so a later configGet_ returns the
 * boolean true and String(true) is "true" — which does not equal "TRUE".
 * Every boolean config comparison must therefore normalise case.
 *
 * Measured against the live platform on 2026-08-20, after an on-demand
 * session opened successfully and then refused every participant with
 * LECTURE_CLOSED. The mocked-Sheets harness cannot reproduce this: it
 * stores whatever value it is handed, verbatim.
 */
function configTrue_(field) {
  return String(configGet_(field, "")).toUpperCase() === "TRUE";
}

function configSetIfAbsent_(field, value) {
  var sheet = researchSheet_(SHEETS.CONFIG);
  var row = findRowByValue_(sheet, HEADERS.config, "field", field);
  if (row === -1) sheet.appendRow([field, value, nowIso_()]);
}

/* ---- Events ledger (§5.6, §6.2) ---- */

function eventCacheKey_(requestId) {
  return "req:" + requestId;
}

function findStoredResponse_(requestId) {
  var cached = CacheService.getScriptCache().get(eventCacheKey_(requestId));
  if (cached) return JSON.parse(cached);
  var sheet = researchSheet_(SHEETS.EVENTS);
  var row = findRowByValue_(sheet, HEADERS.events, "request_id", requestId);
  if (row === -1) return null;
  var record = readRowObject_(sheet, HEADERS.events, row);
  return {
    payload_hash: String(record.payload_hash),
    response: JSON.parse(String(record.response_json)),
    action: String(record.action || ""),
    session_id: String(record.session_id || "")
  };
}

function responseForAudit_(response) {
  var copy = JSON.parse(JSON.stringify(response));
  // A resume token is a live bearer credential. It may be cached briefly
  // for an immediate idempotent retry, but it must never enter Sheets.
  if (copy && copy.data && copy.data.state) {
    delete copy.data.state.resume_token;
  }
  return copy;
}

function storeEvent_(envelope, response, status) {
  var responseSessionId = response && response.data && response.data.state
    ? response.data.state.session_id : "";
  var auditResponse = responseForAudit_(response);
  var record = {
    received_at: nowIso_(),
    request_id: envelope.request_id,
    session_id: (envelope.payload && envelope.payload.session_id) || responseSessionId || "",
    event_seq: (envelope.payload && envelope.payload.event_seq !== undefined)
      ? envelope.payload.event_seq : "",
    action: envelope.action,
    payload_hash: sha256Hex_(JSON.stringify(envelope.payload || {})),
    status: status,
    response_code: response.ok ? "OK" : (response.error_code || "ERROR"),
    response_json: JSON.stringify(auditResponse),
    server_execution_id: EXECUTION_ID,
    app_version: envelope.app_version
  };
  appendRowObject_(researchSheet_(SHEETS.EVENTS), HEADERS.events, record);
  try {
    CacheService.getScriptCache().put(
      eventCacheKey_(envelope.request_id),
      JSON.stringify({
        payload_hash: record.payload_hash,
        response: response,
        action: envelope.action,
        session_id: record.session_id
      }),
      21600
    );
  } catch (e) { /* cache is an optimization only */ }
}

function logError_(requestId, sessionId, code, message, action, appVersion) {
  try {
    appendRowObject_(researchSheet_(SHEETS.ERRORS), HEADERS.errors, {
      received_at: nowIso_(),
      request_id: requestId || "",
      session_id: sessionId || "",
      error_code: code,
      // Never echo participant text or tokens into the error log (§6.2).
      safe_error_message: String(message || "").replace(/[\r\n]+/g, " ").slice(0, 500),
      action: action || "",
      app_version: appVersion || "",
      resolved: "",
      resolution_note: ""
    });
  } catch (e) { /* last-resort: swallow to protect the response path */ }
}

/* ---- Sequence access (§7) ---- */

/**
 * Read one round of a block's frozen sequence. sequence_id has the form
 * "sq<version>-<block padded to 4>"; rows are written in (block, round)
 * order at generation time, so the row offset is computable. The read is
 * verified against the stored ids and falls back to a search if the
 * sheet has been resorted.
 */
function sequenceRow_(sequenceId, round) {
  var sheet = researchSheet_(SHEETS.SEQUENCES);
  var match = String(sequenceId).match(/-(\d+)$/);
  if (match) {
    var block = parseInt(match[1], 10);
    var expectedRow = 1 + (block - 1) * DESIGN.NUM_ROUNDS + round;
    if (expectedRow >= 2 && expectedRow <= sheet.getLastRow()) {
      var direct = readRowObject_(sheet, HEADERS.sequences, expectedRow);
      if (String(direct.sequence_id) === String(sequenceId) && Number(direct.round) === Number(round)) {
        return direct;
      }
    }
  }
  var lastRow = sheet.getLastRow();
  var col = HEADERS.sequences.indexOf("sequence_id") + 1;
  var finder = sheet.getRange(2, col, lastRow - 1, 1)
    .createTextFinder(String(sequenceId)).matchEntireCell(true);
  var hits = finder.findAll();
  for (var i = 0; i < hits.length; i++) {
    var record = readRowObject_(sheet, HEADERS.sequences, hits[i].getRow());
    if (Number(record.round) === Number(round)) return record;
  }
  throw new Error("SEQUENCE_ROW_MISSING:" + sequenceId + ":" + round);
}

/* ---- Formula-injection defence (§6.5) ---- */

function sanitizeText_(value, maxLen) {
  var text = String(value === undefined || value === null ? "" : value);
  // Strip C0/C1 control characters (tab and newline included: free text
  // is stored single-line) before length capping.
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  text = text.slice(0, maxLen || DESIGN.TEXT_LIMIT_SHORT);
  // Force plain text: a leading =, +, -, or @ must never parse as a formula.
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}


/* ==========================================================================
   MODULE: Validation.gs
   ========================================================================== */
/**
 * Validation.gs — strict request envelope and per-action schemas (§5.4).
 *
 * Policy: reject, never repair. Malformed economic data, unknown keys,
 * out-of-range values, oversized payloads, and attempts to supply
 * treatment, case type, load, points, balance, or bonus are all
 * rejected. Unknown-key rejection makes the forbidden-field rule
 * mechanical: no action schema includes those keys, so any attempt to
 * smuggle them fails validation.
 */

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var TOKEN_RE = /^qt_[0-9a-f]{32,64}$/;
var RESUME_RE = /^qr_[0-9a-f]{32,64}$/;
var SESSION_RE = /^qs_[0-9a-f]{16,64}$/;

var ACTIONS = ["start", "claim", "lecture_status", "host_open", "host_close", "host_status", "quiz", "decision", "beliefs", "finalize", "resume", "heartbeat", "withdraw"];
var LECTURE_CODE_RE = /^\d{6}$/;
var HOST_KEY_RE = /^qh_[0-9a-f]{32,64}$/;

function ValidationError_(code, detail) {
  var err = new Error(code);
  err.validation = true;
  err.code = code;
  err.detail = detail || "";
  return err;
}

function requireKeys_(obj, spec, context) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    throw ValidationError_("BAD_PAYLOAD", context + ": not an object");
  }
  var allowed = {};
  Object.keys(spec).forEach(function (k) { allowed[k] = true; });
  Object.keys(obj).forEach(function (k) {
    if (!allowed[k]) throw ValidationError_("UNEXPECTED_KEY", context + "." + k);
  });
  Object.keys(spec).forEach(function (k) {
    var rule = spec[k];
    var present = (k in obj) && obj[k] !== undefined && obj[k] !== null && obj[k] !== "";
    if (!present) {
      if (rule.optional) return;
      throw ValidationError_("MISSING_FIELD", context + "." + k);
    }
    rule.check(obj[k], context + "." + k);
  });
}

function vString_(re, maxLen) {
  return { check: function (v, ctx) {
    if (typeof v !== "string" || v.length > (maxLen || 200)) throw ValidationError_("BAD_FIELD", ctx);
    if (re && !re.test(v)) throw ValidationError_("BAD_FIELD", ctx);
  } };
}

function vEnum_(values) {
  return { check: function (v, ctx) {
    if (values.indexOf(v) === -1) throw ValidationError_("BAD_FIELD", ctx);
  } };
}

function vInt_(lo, hi) {
  return { check: function (v, ctx) {
    if (typeof v !== "number" || !isFinite(v) || Math.floor(v) !== v || v < lo || v > hi) {
      throw ValidationError_("BAD_FIELD", ctx);
    }
  } };
}

function vBool_(expected) {
  return { check: function (v, ctx) {
    if (typeof v !== "boolean") throw ValidationError_("BAD_FIELD", ctx);
    if (expected !== undefined && v !== expected) throw ValidationError_("BAD_FIELD", ctx);
  } };
}

function vText_(maxLen) {
  return { optional: true, check: function (v, ctx) {
    if (typeof v !== "string" || v.length > maxLen) throw ValidationError_("BAD_FIELD", ctx);
  } };
}

function opt_(rule) {
  return { optional: true, check: rule.check };
}

/* ---- Envelope (§5.4) ---- */

function parseEnvelope_(e) {
  var raw = e && e.parameter && e.parameter.envelope;
  if (!raw) throw ValidationError_("MISSING_ENVELOPE");
  if (raw.length > DESIGN.MAX_ENVELOPE_BYTES) throw ValidationError_("PAYLOAD_TOO_LARGE");
  var envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (err) {
    throw ValidationError_("MALFORMED_JSON");
  }
  return envelope;
}

function validateEnvelope_(envelope) {
  requireKeys_(envelope, {
    api_version: vInt_(1, 1),
    app_version: vString_(/^[a-z0-9._-]+$/i, 40),
    action: vEnum_(ACTIONS),
    request_id: vString_(UUID_RE, 36),
    nonce: vString_(UUID_RE, 36),
    payload: { check: function (v, ctx) {
      if (v === null || typeof v !== "object" || Array.isArray(v)) throw ValidationError_("BAD_PAYLOAD", ctx);
    } }
  }, "envelope");
  if (envelope.app_version !== prop_("EXPECTED_APP_VERSION")) {
    throw ValidationError_("APP_VERSION_UNSUPPORTED", envelope.app_version);
  }
  validatePayload_(envelope.action, envelope.payload);
}

/* ---- Per-action payload schemas ---- */

var DEVICE_SPEC = {
  device_class: vEnum_(["mobile", "tablet", "desktop"]),
  browser_family: vEnum_(["Safari", "Chrome", "Firefox", "other"]),
  viewport_width_band: vEnum_(["lt400", "400-767", "768-1023", "ge1024", "unknown"]),
  viewport_height_band: vEnum_(["lt600", "600-899", "ge900", "unknown"]),
  timezone_offset_minutes: vInt_(-900, 900)
};

var SESSION_AUTH_SPEC = {
  session_id: vString_(SESSION_RE, 80),
  resume_token: vString_(RESUME_RE, 80)
};

function withAuth_(spec) {
  var out = {};
  Object.keys(SESSION_AUTH_SPEC).forEach(function (k) { out[k] = SESSION_AUTH_SPEC[k]; });
  Object.keys(spec).forEach(function (k) { out[k] = spec[k]; });
  return out;
}

function validatePayload_(action, payload) {
  if (action === "start") {
    requireKeys_(payload, {
      token: vString_(TOKEN_RE, 128),
      language: vEnum_(["vi", "en"]),
      confirm_18: vBool_(true),
      confirm_not_prior: vBool_(true),
      confirm_read: vBool_(true),
      confirm_voluntary: vBool_(true),
      confirm_consent: vBool_(true),
      device: { check: function (v, ctx) { requireKeys_(v, DEVICE_SPEC, ctx); } }
    }, "start");
    return;
  }

  if (action === "claim") {
    requireKeys_(payload, {
      lecture_code: vString_(LECTURE_CODE_RE, 6),
      language: vEnum_(["vi", "en"]),
      confirm_18: vBool_(true),
      confirm_not_prior: vBool_(true),
      confirm_read: vBool_(true),
      confirm_voluntary: vBool_(true),
      confirm_consent: vBool_(true),
      device: { check: function (v, ctx) { requireKeys_(v, DEVICE_SPEC, ctx); } }
    }, "claim");
    return;
  }

  if (action === "lecture_status") {
    requireKeys_(payload, {
      lecture_code: vString_(LECTURE_CODE_RE, 6)
    }, "lecture_status");
    return;
  }

  if (action === "host_open") {
    requireKeys_(payload, {
      host_key: vString_(HOST_KEY_RE, 80),
      minutes: opt_(vInt_(0, 600)),
      label: { optional: true, check: function (v, ctx) {
        if (typeof v !== "string" || v.length > 60) throw ValidationError_("BAD_FIELD", ctx);
      } }
    }, "host_open");
    return;
  }

  if (action === "host_close" || action === "host_status") {
    requireKeys_(payload, {
      host_key: vString_(HOST_KEY_RE, 80)
    }, action);
    return;
  }

  if (action === "quiz") {
    requireKeys_(payload, withAuth_({
      event_seq: vInt_(1, 100000),
      attempt: vInt_(1, 200),
      active_ms: vInt_(0, 86400000),
      answers: { check: function (v, ctx) {
        requireKeys_(v, {
          cq1: vEnum_(["A", "B", "C"]),
          cq2: vEnum_(["A", "B", "C"]),
          cq3: vEnum_(["A", "B", "C"]),
          cq4: vEnum_(["A", "B", "C"]),
          cq5: vEnum_(["A", "B", "C"]),
          cq6: vEnum_(["A", "B", "C"]),
          cq7: vInt_(-1000, 1000),
          cq8: vInt_(-1000, 1000)
        }, ctx);
      } }
    }), "quiz");
    return;
  }

  if (action === "decision") {
    requireKeys_(payload, withAuth_({
      event_seq: vInt_(1, 100000),
      round: vInt_(1, DESIGN.NUM_ROUNDS),
      choice: vEnum_(["send", "not_send"]),
      timed_out: vBool_(),
      active_rt_ms: vInt_(0, 86400000),
      wall_rt_ms: vInt_(0, 86400000),
      hidden_ms: vInt_(0, 86400000),
      instruction_ms: vInt_(0, 86400000),
      instruction_opens: vInt_(0, 1000),
      blur_count: vInt_(0, 10000)
    }), "decision");
    return;
  }

  if (action === "beliefs") {
    requireKeys_(payload, withAuth_({
      event_seq: vInt_(1, 100000),
      belief_h: vInt_(0, DESIGN.NUM_ROUNDS),
      belief_h_served: vInt_(0, DESIGN.NUM_ROUNDS)
    }), "beliefs");
    return;
  }

  if (action === "finalize") {
    requireKeys_(payload, withAuth_({
      event_seq: vInt_(1, 100000),
      questionnaire: { check: function (v, ctx) {
        requireKeys_(v, {
          label_difficulty: vEnum_(["1", "2", "3", "4", "5", "6", "7"]),
          label_effect: vEnum_(["1", "2", "3", "4", "5", "6", "7"]),
          waiting_effect: vEnum_(["1", "2", "3", "4", "5", "6", "7"]),
          attention_check: vEnum_(["1", "2", "3", "4", "5", "6", "7"]),
          understood: vEnum_(["yes", "no", "unsure"]),
          believed: vEnum_(["yes", "no", "unsure"]),
          policy_recognition: vEnum_(["every_round", "standard_only", "high_only", "never_exact", "not_sure"]),
          policy_noticed: vEnum_(["yes", "no", "unsure"]),
          strategy: vText_(DESIGN.TEXT_LIMIT_LONG),
          confusing: vText_(DESIGN.TEXT_LIMIT_LONG)
        }, ctx);
      } },
      demographics: { check: function (v, ctx) {
        requireKeys_(v, {
          age_band: vEnum_(["18-20", "21-24", "25-29", "30-39", "40-49", "50+", "prefer_not"]),
          gender: vEnum_(["female", "male", "nonbinary", "prefer_not"]),
          field: vEnum_(["econ_business", "stem", "social_science", "humanities", "other"]),
          year: vEnum_(["1", "2", "3", "4", "5"]),
          prior_experiments: vEnum_(["yes", "no"]),
          gps_risk: vEnum_(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]),
          gps_patience: vEnum_(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
        }, ctx);
      } }
    }), "finalize");
    return;
  }

  if (action === "resume") {
    requireKeys_(payload, {
      resume_token: vString_(RESUME_RE, 80),
      session_id: opt_(vString_(SESSION_RE, 80))
    }, "resume");
    return;
  }

  if (action === "heartbeat") {
    requireKeys_(payload, withAuth_({
      stage_marker: vEnum_([
        "instructions_opened", "quiz_started", "rounds_started",
        "round_5_reached", "round_10_reached", "round_15_reached",
        "beliefs_started", "survey_started", "finalization_started"
      ])
    }), "heartbeat");
    return;
  }

  if (action === "withdraw") {
    requireKeys_(payload, withAuth_({
      event_seq: vInt_(1, 100000)
    }), "withdraw");
    return;
  }

  throw ValidationError_("UNKNOWN_ACTION", action);
}

/* ==========================================================================
   MODULE: Responses.gs
   ========================================================================== */
/**
 * Responses.gs — response envelopes and the acknowledged iframe receipt
 * (§4.6, §5.8).
 *
 * Every response echoes the request_id and nonce; the client accepts a
 * receipt only when both match its pending request. The receipt HTML
 * contains no participant-supplied markup: the response object is
 * JSON-embedded with unicode escaping of angle brackets and posted to
 * the exact GitHub Pages origin (window.top: Apps Script may wrap the
 * document in an intermediate googleusercontent frame, and top is the
 * participant's page in either wrapping).
 *
 * XFrameOptionsMode.ALLOWALL permits framing by arbitrary sites, so this
 * endpoint never trusts the embedding page: authorization comes from the
 * participation or resume token in the validated envelope, and the
 * receipt targets only PARENT_ORIGIN.
 */

function okResponse_(envelope, data) {
  return {
    type: "QUEUE_API_RESPONSE",
    ok: true,
    request_id: envelope.request_id,
    nonce: envelope.nonce,
    data: data || {}
  };
}

function errorResponse_(envelope, code, retryable, detail) {
  return {
    type: "QUEUE_API_RESPONSE",
    ok: false,
    request_id: envelope && envelope.request_id ? envelope.request_id : "",
    nonce: envelope && envelope.nonce ? envelope.nonce : "",
    error_code: code,
    retryable: Boolean(retryable),
    detail: detail ? String(detail).slice(0, 200) : ""
  };
}

/** Embed JSON so it can never terminate the script element. */
function safeJsonForScript_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function iframeResponse_(response) {
  var parentOrigin = prop_("PARENT_ORIGIN");
  var html =
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body>" +
    "<script>" +
    "(function () {" +
    "var message = " + safeJsonForScript_(response) + ";" +
    "var target = window.top || window.parent;" +
    "try { target.postMessage(message, " + JSON.stringify(parentOrigin) + "); } catch (e) {}" +
    "})();" +
    "</scr" + "ipt></body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Fallback when even envelope parsing failed: respond without echoing. */
function safeUnexpectedError_(envelope, error) {
  var code = "SERVER_ERROR";
  var message = error && error.message ? String(error.message) : String(error);
  if (message.indexOf("CONFIG_MISSING") === 0) code = "SERVER_MISCONFIGURED";
  logError_(
    envelope && envelope.request_id,
    envelope && envelope.payload && envelope.payload.session_id,
    code, message,
    envelope && envelope.action,
    envelope && envelope.app_version
  );
  // Unexpected failures are safe to retry: every write path is idempotent.
  return errorResponse_(envelope, code, true);
}

/* ==========================================================================
   MODULE: Assignment.gs
   ========================================================================== */
/**
 * Assignment.gs — tokens, sessions, consent, and resumption (§5.5 start,
 * §5.5 resume, §4.9).
 *
 * Treatment, block, and sequence are PREALLOCATED to invitation slots at
 * generation time (§7.1): three tokens per block, one per arm, matched
 * on the block's frozen 20-round sequence, recruitment order permuted.
 * `start` therefore never randomizes; it validates the token, flips its
 * status, creates the session row, and timestamps consent. Assignment
 * occurs only at consent: visitors who never consent never enter the
 * treatment denominator.
 *
 * A raw participation token re-presented after a session exists returns
 * the SAME session with a rotated resume token; the previous browser
 * lease is thereby invalidated and a concurrency warning recorded.
 * Restarting can never change assignment (§13).
 */

function handleStart_(envelope) {
  var payload = envelope.payload;

  var tokensSheet = researchSheet_(SHEETS.TOKENS);
  var hash = tokenHash_(payload.token);
  var tokenRow = findRowByValue_(tokensSheet, HEADERS.tokens, "token_hash", hash);
  if (tokenRow === -1) return errorResponse_(envelope, "TOKEN_INVALID", false);
  var token = readRowObject_(tokensSheet, HEADERS.tokens, tokenRow);

  if (token.status === "completed") {
    var doneSession = loadSessionById_(String(token.session_id));
    return okResponse_(envelope, {
      status: "completed",
      state: publicState_(doneSession, { includeCompletion: true })
    });
  }
  if (token.status === "withdrawn") {
    return errorResponse_(envelope, "SESSION_WITHDRAWN", false);
  }

  if (token.status === "assigned" || token.status === "started") {
    // Collection closure blocks only new assignments. Existing sessions
    // remain recoverable from their original invitation.
    var existing = loadSessionById_(String(token.session_id));
    if (sessionExpired_(existing)) return errorResponse_(envelope, "SESSION_EXPIRED", false);
    // §4.9 / §12: same token on a second device or tab returns the
    // existing session; rotate the resume lease and flag concurrency.
    var rotated = rotateResumeToken_(existing);
    token.restart_count = Number(token.restart_count || 0) + 1;
    token.duplicate_flag = "TRUE";
    writeRowObject_(tokensSheet, HEADERS.tokens, tokenRow, token);
    touchSession_(existing);
    saveSession_(existing);
    return okResponse_(envelope, {
      status: "existing_session",
      state: publicState_(existing, { resumeToken: rotated })
    });
  }

  if (token.status !== "unused") {
    return errorResponse_(envelope, "TOKEN_INVALID", false);
  }
  if (!collectionOpen_()) return errorResponse_(envelope, "COLLECTION_CLOSED", false);

  var startedCount = researchSheet_(SHEETS.SESSIONS).getLastRow() - 1;
  if (startedCount >= maxParticipants_()) {
    return errorResponse_(envelope, "COLLECTION_CLOSED", false, "capacity reached");
  }

  var created = createSession_({
    token_hash: hash,
    treatment: token.treatment,
    block_id: token.block_id,
    sequence_id: token.sequence_id,
    entry_mode: "token",
    lecture_id: ""
  }, payload, envelope);

  var now = nowIso_();
  token.status = "assigned";
  token.session_id = created.session.session_id;
  token.assigned_at = now;
  token.started_at = now;
  writeRowObject_(tokensSheet, HEADERS.tokens, tokenRow, token);

  return okResponse_(envelope, {
    status: "started",
    state: publicState_(created.session, { resumeToken: created.resumeToken })
  });
}

/**
 * Shared session constructor for both entry modes (§token start and the
 * classroom claim). Assignment inputs come exclusively from the server's
 * own inventories (token row or allocation slot); the participant's
 * payload contributes only language, consent confirmations, and the
 * coarse device descriptor.
 */
function createSession_(assignment, payload, envelope) {
  var now = nowIso_();
  var sessionId = "qs_" + Utilities.getUuid().replace(/-/g, "");
  var resumeToken = newOpaqueToken_("qr");
  var session = {
    session_id: sessionId,
    participant_code: randomCode_("QP"),
    token_hash: assignment.token_hash || "",
    external_id_hash: "",
    treatment: assignment.treatment,
    block_id: assignment.block_id,
    sequence_id: assignment.sequence_id,
    status: "instructions",
    language: payload.language,
    experiment_version: prop_("EXPERIMENT_VERSION"),
    consented_at: now,
    started_at: now,
    last_seen_at: now,
    current_round: 1,
    current_load: "normal",
    current_balance: DESIGN.START_BALANCE,
    last_event_seq: 1,
    quiz_attempts: 0,
    beliefs_submitted: "FALSE",
    survey_submitted: "FALSE",
    completed_at: "",
    withdrawn_at: "",
    integrity_status: "",
    resume_token_hash: tokenHash_(resumeToken),
    last_request_id: envelope.request_id,
    quiz_passed: "FALSE",
    belief_h: "", belief_h_served: "", belief_points: "",
    completion_code: "", receipt_reference: "",
    device_json: JSON.stringify(payload.device),
    entry_mode: assignment.entry_mode,
    lecture_id: assignment.lecture_id || ""
  };
  appendRowObject_(researchSheet_(SHEETS.SESSIONS), HEADERS.sessions, session);
  session._row = researchSheet_(SHEETS.SESSIONS).getLastRow();
  return { session: session, resumeToken: resumeToken };
}

function handleResume_(envelope) {
  var payload = envelope.payload;
  var session = loadSessionByResumeToken_(payload.resume_token);
  if (!session) return errorResponse_(envelope, "TOKEN_INVALID", false);
  if (payload.session_id && String(payload.session_id) !== String(session.session_id)) {
    return errorResponse_(envelope, "TOKEN_INVALID", false);
  }
  if (session.status === "withdrawn") {
    return okResponse_(envelope, { state: publicState_(session) });
  }
  if (session.status === "completed") {
    return okResponse_(envelope, { state: publicState_(session, { includeCompletion: true }) });
  }
  if (sessionExpired_(session)) {
    return errorResponse_(envelope, "SESSION_EXPIRED", false);
  }
  touchSession_(session);
  saveSession_(session);
  // §5.5 resume: never reassign, never regenerate; return the exact
  // current server state, plus the id of the last processed request so a
  // client that lost an acknowledgement can retry it idempotently.
  return okResponse_(envelope, {
    state: publicState_(session),
    last_processed_request_id: String(session.last_request_id || "")
  });
}

function handleWithdraw_(envelope, session) {
  var now = nowIso_();
  session.status = "withdrawn";
  session.withdrawn_at = now;
  saveSession_(session);
  var tokensSheet = researchSheet_(SHEETS.TOKENS);
  var tokenRow = findRowByValue_(tokensSheet, HEADERS.tokens, "token_hash", String(session.token_hash));
  if (tokenRow !== -1) {
    var token = readRowObject_(tokensSheet, HEADERS.tokens, tokenRow);
    token.status = "withdrawn";
    writeRowObject_(tokensSheet, HEADERS.tokens, tokenRow, token);
  }
  return okResponse_(envelope, { state: publicState_(session) });
}

function handleHeartbeat_(envelope, session) {
  touchSession_(session);
  saveSession_(session);
  return okResponse_(envelope, { recorded: envelope.payload.stage_marker });
}

/* ---- Session load/save ---- */

function loadSessionById_(sessionId) {
  var sheet = researchSheet_(SHEETS.SESSIONS);
  var row = findRowByValue_(sheet, HEADERS.sessions, "session_id", sessionId);
  if (row === -1) throw new Error("SESSION_MISSING:" + sessionId);
  return readRowObject_(sheet, HEADERS.sessions, row);
}

function loadSessionByResumeToken_(resumeToken) {
  var sheet = researchSheet_(SHEETS.SESSIONS);
  var row = findRowByValue_(sheet, HEADERS.sessions, "resume_token_hash", tokenHash_(resumeToken));
  return row === -1 ? null : readRowObject_(sheet, HEADERS.sessions, row);
}

function saveSession_(session) {
  writeRowObject_(researchSheet_(SHEETS.SESSIONS), HEADERS.sessions, session._row, session);
}

function touchSession_(session) {
  session.last_seen_at = nowIso_();
}

function rotateResumeToken_(session) {
  var fresh = newOpaqueToken_("qr");
  session.resume_token_hash = tokenHash_(fresh);
  return fresh;
}

function sessionExpired_(session) {
  var last = new Date(String(session.last_seen_at || session.started_at)).getTime();
  if (!isFinite(last)) return false;
  return (Date.now() - last) > DESIGN.RESUME_EXPIRY_HOURS * 3600 * 1000;
}

/**
 * Authenticate a stateful action: session exists, resume token matches,
 * session is live. Returns the session or a response object.
 */
function requireSession_(envelope) {
  var payload = envelope.payload;
  var session;
  try {
    session = loadSessionById_(payload.session_id);
  } catch (e) {
    return { error: errorResponse_(envelope, "UNKNOWN_SESSION", false) };
  }
  if (String(session.resume_token_hash) !== tokenHash_(payload.resume_token)) {
    return { error: errorResponse_(envelope, "TOKEN_INVALID", false) };
  }
  if (session.status === "withdrawn") return { error: errorResponse_(envelope, "SESSION_WITHDRAWN", false) };
  if (session.status === "completed" && envelope.action !== "heartbeat") {
    return { error: errorResponse_(envelope, "TOKEN_COMPLETED", false) };
  }
  if (sessionExpired_(session)) return { error: errorResponse_(envelope, "SESSION_EXPIRED", false) };
  return { session: session };
}

/* ---- Public state (§4.7): what the browser is allowed to see ---- */

function displayLabelFor_(treatment, actualType, load) {
  if (treatment === "mixed") return "mixed";
  if (treatment === "fine") return actualType;
  // state_dependent: exact type in the standard state, pooled when high.
  return load === "normal" ? actualType : "mixed";
}

function roundPublicState_(session) {
  if (session.status !== "rounds") return null;
  var round = Number(session.current_round);
  if (round > DESIGN.NUM_ROUNDS) return null;
  var seqRow = sequenceRow_(String(session.sequence_id), round);
  var load = String(session.current_load);
  var label = displayLabelFor_(String(session.treatment), String(seqRow.case_type), load);
  var cost = load === "normal" ? DESIGN.WAIT_NORMAL : DESIGN.WAIT_STRAINED;
  var isMixed = label === "mixed";
  var value = label === "H" ? DESIGN.H_VALUE : DESIGN.L_VALUE;
  return {
    round: round,
    total_rounds: DESIGN.NUM_ROUNDS,
    display_label: label,
    current_load: load,
    wait_cost: cost,
    displayed_case_value: isMixed ? null : value,
    displayed_expected_value: isMixed ? DESIGN.MIXED_EV : null,
    displayed_net_value: (isMixed ? DESIGN.MIXED_EV : value) - cost,
    balance: Number(session.current_balance),
    decision_seconds: DESIGN.DECISION_SECONDS
  };
}

function resultsComponents_(session) {
  var decisionPoints = Number(session.current_balance) - DESIGN.START_BALANCE;
  var beliefPoints = Number(session.belief_points || 0);
  var counted = Math.max(0, DESIGN.START_BALANCE + decisionPoints + beliefPoints);
  return {
    starting_points: DESIGN.START_BALANCE,
    decision_points: decisionPoints,
    belief_points: beliefPoints,
    counted_points: counted,
    bonus_vnd: counted * DESIGN.VND_PER_POINT
  };
}

/**
 * The full client-visible snapshot. NEVER includes: treatment, block,
 * sequence id, actual or future case types, recovery draws, or any
 * planner-side quantity (§4.7).
 */
function publicState_(session, options) {
  options = options || {};
  var state = {
    session_id: String(session.session_id),
    participant_code: String(session.participant_code),
    stage: String(session.status),
    language: String(session.language),
    last_event_seq: Number(session.last_event_seq),
    round_state: roundPublicState_(session)
  };
  if (options.resumeToken) state.resume_token = options.resumeToken;
  if (session.status === "survey" || session.status === "completed") {
    state.results = resultsComponents_(session);
  }
  if ((options.includeCompletion || session.status === "completed") && session.completion_code) {
    var results = resultsComponents_(session);
    state.completion = {
      completion_code: String(session.completion_code),
      fixed_vnd: DESIGN.FIXED_VND,
      bonus_vnd: results.bonus_vnd,
      total_vnd: DESIGN.FIXED_VND + results.bonus_vnd,
      receipt_reference: String(session.receipt_reference)
    };
  }
  return state;
}

/* ==========================================================================
   MODULE: Gateway.gs
   ========================================================================== */
/**
 * Gateway.gs — shared-entry classroom gateway.
 *
 * One permanent QR code opens the public gateway page; entry into the
 * experiment requires a short-lived, lecture-specific six-digit access
 * code. The gateway is a FRONT DOOR, not an invitation: after code
 * validation, eligibility, and consent, the server atomically claims the
 * lecture's next unused allocation slot — permuted blocks of three, so
 * within-lecture treatment counts differ by at most one at any moment
 * and are exactly equal after every completed triple — and creates an
 * ordinary session indistinguishable, from the protocol's perspective,
 * from a token-based one.
 *
 * Codes are stored only as keyed hashes; validity requires the lecture
 * window to be open and capacity to remain. The slot claim runs inside
 * the same script lock as every other write; duplicate claim requests
 * (same request_id) are idempotent, and a claim that durably marked its
 * slot but lost its acknowledgement is recovered from the slot ledger
 * rather than claiming twice.
 */

function lectureCodeHash_(lectureId, rawCode) {
  return tokenHash_("lc:" + String(lectureId) + ":" + String(rawCode));
}

/**
 * Locate the lecture whose code matches. The lectures tab is small (one
 * row per class session), so a keyed comparison per row is cheap and
 * avoids storing any unhashed code.
 */
function findLectureByCode_(rawCode) {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  // One bounded batch read rather than one Spreadsheet call per lecture.
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.lectures.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var lecture = rowObjectFromValues_(HEADERS.lectures, values[i], i + 2);
    if (String(lecture.code_hash) === lectureCodeHash_(String(lecture.lecture_id), rawCode)) {
      return lecture;
    }
  }
  return null;
}

/* ============================================================
   On-demand live session (self-service, no advance planning).

   Instead of pre-scheduled named lectures, the study can run from ONE
   large pre-frozen pool (lecture_id "POOL") that the classroom host
   opens and closes herself, in any class, with no plan and no email
   from the coordinator (see Host.gs). A "live session" is the currently
   active code + auto batch label over that pool. Assignment still draws
   permuted blocks of three in claim order, so treatment balance stays
   exact study-wide and within any one class (a contiguous run of
   claims). Each session is auto-labelled (date + counter + optional
   name), preserving a class/session variable for clustering with zero
   advance planning.

   Both entry models coexist: if a live session's code is presented it is
   served from the pool; otherwise the request falls through to the
   pre-scheduled lecture path above.
   ============================================================ */

function liveSession_() {
  var code = String(configGet_("live_code", ""));
  if (!code) return null;
  return {
    open: configTrue_("live_open"),
    code: code,
    batch: String(configGet_("live_batch", "")),
    opened_at: String(configGet_("live_opened_at", "")),
    expires_at: String(configGet_("live_expires_at", ""))
  };
}

/**
 * Null when the live session can currently admit a participant. The
 * branch that calls this only fires when the presented code equals the
 * last live code, so "not currently open" always means a real session
 * that has been closed or has expired — report it as closed.
 */
function liveSessionRefusal_(live) {
  if (!live || !live.open) return "LECTURE_CLOSED";
  if (live.expires_at) {
    var exp = new Date(live.expires_at).getTime();
    if (isFinite(exp) && Date.now() > exp) return "LECTURE_CLOSED";
  }
  return null;
}

function poolLecture_() {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var row = findRowByValue_(sheet, HEADERS.lectures, "lecture_id", "POOL");
  if (row === -1) return null;
  return readRowObject_(sheet, HEADERS.lectures, row);
}

function poolPlacesRemaining_(pool) {
  return Math.max(0, Math.min(
    Number(pool.maximum_n) - Number(pool.claimed_count),
    Number(pool.slot_count) - Number(pool.next_claim_order) + 1
  ));
}

/**
 * Choice 1 (lecture-stratified permuted blocks): reset the pool to a fresh
 * block boundary at the start of a lecture. Any unused remainder of the
 * previous lecture's final block is RETIRED — it is never claimed, so no
 * participant is rejected and no prior assignment is altered. Each lecture
 * therefore draws whole permuted blocks of three: exact treatment balance
 * after every completed block, and at most a one-participant difference if
 * the lecture ends part-way through a block. Runs inside the host lock.
 */
function alignPoolToFreshBlock_(pool) {
  var block = DESIGN.TREATMENTS.length;
  var current = Number(pool.next_claim_order);
  var offset = (current - 1) % block;
  if (offset === 0) return pool;                 // already block-aligned
  var boundary = current + (block - offset);
  for (var order = current; order < boundary && order <= Number(pool.slot_count); order++) {
    var slot = slotSheetRow_(pool, order);
    if (String(slot.status) === "unused") {
      slot.status = "retired";
      slot.claimed_at = nowIso_();
      saveSlot_(slot);
    }
  }
  pool.next_claim_order = Math.min(boundary, Number(pool.slot_count) + 1);
  saveLecture_(pool);
  return pool;
}

/** Claim the pool's next permuted-block slot for a live-session entry. */
function claimFromPool_(envelope, live) {
  var pool = poolLecture_();
  if (!pool) return errorResponse_(envelope, "LECTURE_CODE_INVALID", false);
  if (poolPlacesRemaining_(pool) <= 0) return errorResponse_(envelope, "LECTURE_FULL", false);

  var startedCount = researchSheet_(SHEETS.SESSIONS).getLastRow() - 1;
  if (startedCount >= maxParticipants_()) {
    return errorResponse_(envelope, "COLLECTION_CLOSED", false, "capacity reached");
  }

  var slot = slotSheetRow_(pool, Number(pool.next_claim_order));
  if (String(slot.status) !== "unused") {
    var order = Number(pool.next_claim_order);
    while (order <= Number(pool.slot_count)) {
      slot = slotSheetRow_(pool, order);
      if (String(slot.status) === "unused") break;
      order += 1;
    }
    if (String(slot.status) !== "unused") return errorResponse_(envelope, "LECTURE_FULL", false);
    pool.next_claim_order = order;
  }

  slot.status = "claimed";
  slot.claimed_at = nowIso_();
  slot.request_id = envelope.request_id;
  var created = createSession_({
    token_hash: "",
    treatment: String(slot.treatment),
    block_id: String(slot.block_id),
    sequence_id: String(slot.sequence_id),
    entry_mode: "ondemand",
    // The session's class/analysis label is the live batch, not "POOL".
    lecture_id: live.batch || "POOL"
  }, payload_(envelope), envelope);
  slot.session_id = created.session.session_id;
  saveSlot_(slot);

  pool.next_claim_order = Number(pool.next_claim_order) + 1;
  pool.claimed_count = Number(pool.claimed_count) + 1;
  saveLecture_(pool);

  // Count this claim against the live session for the host dashboard.
  configSet_("live_claimed", String(Number(configGet_("live_claimed", "0")) + 1));

  return okResponse_(envelope, {
    status: "started",
    state: publicState_(created.session, { resumeToken: created.resumeToken })
  });
}

function payload_(envelope) { return envelope.payload; }

/** Window/status/capacity verdict for a lecture; null when claimable. */
function lectureRefusal_(lecture) {
  if (String(lecture.status) === "cancelled") return "LECTURE_CODE_INVALID";
  var now = Date.now();
  var opens = new Date(String(lecture.opens_at)).getTime();
  var closes = new Date(String(lecture.closes_at)).getTime();
  if (!isFinite(opens) || !isFinite(closes)) return "LECTURE_CLOSED";
  if (now < opens) return "LECTURE_NOT_OPEN";
  if (now > closes) return "LECTURE_CLOSED";
  if (Number(lecture.claimed_count) >= Number(lecture.maximum_n)) return "LECTURE_FULL";
  if (Number(lecture.next_claim_order) > Number(lecture.slot_count)) return "LECTURE_FULL";
  return null;
}

/**
 * Read-only pre-check so the class code fails fast on the code screen,
 * before eligibility and consent (§4 step 2 of the gateway plan). The
 * final claim revalidates everything; this response allocates nothing.
 */
function handleLectureStatus_(envelope) {
  if (!collectionOpen_()) return errorResponse_(envelope, "COLLECTION_CLOSED", false);
  // On-demand live session first: fail fast on the code screen.
  var live = liveSession_();
  if (live && String(envelope.payload.lecture_code) === live.code) {
    var liveRefusal = liveSessionRefusal_(live);
    if (liveRefusal) return errorResponse_(envelope, liveRefusal, false);
    var pool = poolLecture_();
    if (!pool) return errorResponse_(envelope, "LECTURE_CODE_INVALID", false);
    var remain = poolPlacesRemaining_(pool);
    if (remain <= 0) return errorResponse_(envelope, "LECTURE_FULL", false);
    return okResponse_(envelope, { lecture_open: true, places_remaining: remain });
  }
  var lecture = findLectureByCode_(envelope.payload.lecture_code);
  if (!lecture) return errorResponse_(envelope, "LECTURE_CODE_INVALID", false);
  var refusal = lectureRefusal_(lecture);
  if (refusal) return errorResponse_(envelope, refusal, false);
  return okResponse_(envelope, {
    lecture_open: true,
    places_remaining: Math.max(0, Math.min(
      Number(lecture.maximum_n) - Number(lecture.claimed_count),
      Number(lecture.slot_count) - Number(lecture.next_claim_order) + 1
    ))
  });
}

function slotSheetRow_(lecture, claimOrder) {
  var sheet = researchSheet_(SHEETS.SLOTS);
  var expectedRow = Number(lecture.slot_row_start) + Number(claimOrder) - 1;
  if (expectedRow >= 2 && expectedRow <= sheet.getLastRow()) {
    var direct = readRowObject_(sheet, HEADERS.allocation_slots, expectedRow);
    if (String(direct.lecture_id) === String(lecture.lecture_id) &&
      Number(direct.claim_order) === Number(claimOrder)) {
      return direct;
    }
  }
  // Fallback scan if the tab was resorted.
  var lastRow = sheet.getLastRow();
  for (var row = 2; row <= lastRow; row++) {
    var slot = readRowObject_(sheet, HEADERS.allocation_slots, row);
    if (String(slot.lecture_id) === String(lecture.lecture_id) &&
      Number(slot.claim_order) === Number(claimOrder)) return slot;
  }
  throw new Error("SLOT_MISSING:" + lecture.lecture_id + ":" + claimOrder);
}

function saveSlot_(slot) {
  writeRowObject_(researchSheet_(SHEETS.SLOTS), HEADERS.allocation_slots, slot._row, slot);
}

function saveLecture_(lecture) {
  writeRowObject_(researchSheet_(SHEETS.LECTURES), HEADERS.lectures, lecture._row, lecture);
}

/**
 * Atomic claim (runs inside the router's script lock). Durable-slot
 * idempotency: if a previous attempt with this request_id already marked
 * a slot, that slot — and its session, created here if the crash
 * preceded it — is returned instead of claiming a second one.
 */
function handleClaim_(envelope) {
  var payload = envelope.payload;

  var slotsSheet = researchSheet_(SHEETS.SLOTS);
  var priorRow = findRowByValue_(slotsSheet, HEADERS.allocation_slots, "request_id", envelope.request_id);
  if (priorRow !== -1) {
    var priorSlot = readRowObject_(slotsSheet, HEADERS.allocation_slots, priorRow);
    return acknowledgeClaimedSlot_(envelope, priorSlot);
  }
  if (!collectionOpen_()) return errorResponse_(envelope, "COLLECTION_CLOSED", false);

  // On-demand live session takes precedence when its code is presented.
  var live = liveSession_();
  if (live && String(payload.lecture_code) === live.code) {
    var liveRefusal = liveSessionRefusal_(live);
    if (liveRefusal) return errorResponse_(envelope, liveRefusal, false);
    return claimFromPool_(envelope, live);
  }

  var lecture = findLectureByCode_(payload.lecture_code);
  if (!lecture) return errorResponse_(envelope, "LECTURE_CODE_INVALID", false);
  var refusal = lectureRefusal_(lecture);
  if (refusal) return errorResponse_(envelope, refusal, false);

  var startedCount = researchSheet_(SHEETS.SESSIONS).getLastRow() - 1;
  if (startedCount >= maxParticipants_()) {
    return errorResponse_(envelope, "COLLECTION_CLOSED", false, "capacity reached");
  }

  var slot = slotSheetRow_(lecture, Number(lecture.next_claim_order));
  if (String(slot.status) !== "unused") {
    // Pointer drift (e.g., a crash after a claim): advance past claimed
    // slots rather than reusing one.
    var order = Number(lecture.next_claim_order);
    while (order <= Number(lecture.slot_count)) {
      slot = slotSheetRow_(lecture, order);
      if (String(slot.status) === "unused") break;
      order += 1;
    }
    if (String(slot.status) !== "unused") return errorResponse_(envelope, "LECTURE_FULL", false);
    lecture.next_claim_order = order;
  }

  // 1. mark the slot claimed;  2. create the session;  3. advance the
  // lecture pointer and count. All inside the lock, then flushed.
  slot.status = "claimed";
  slot.claimed_at = nowIso_();
  slot.request_id = envelope.request_id;
  var created = createSession_({
    token_hash: "",
    treatment: String(slot.treatment),
    block_id: String(slot.block_id),
    sequence_id: String(slot.sequence_id),
    entry_mode: "gateway",
    lecture_id: String(lecture.lecture_id)
  }, payload, envelope);
  slot.session_id = created.session.session_id;
  saveSlot_(slot);

  lecture.next_claim_order = Number(lecture.next_claim_order) + 1;
  lecture.claimed_count = Number(lecture.claimed_count) + 1;
  if (String(lecture.status) === "scheduled") lecture.status = "open";
  saveLecture_(lecture);

  return okResponse_(envelope, {
    status: "started",
    state: publicState_(created.session, { resumeToken: created.resumeToken })
  });
}

function acknowledgeClaimedSlot_(envelope, slot) {
  if (slot.session_id) {
    var session = loadSessionById_(String(slot.session_id));
    if (session.status !== "completed" && sessionExpired_(session)) {
      return errorResponse_(envelope, "SESSION_EXPIRED", false);
    }
    // The original resume token is unrecoverable by design (only its
    // hash is stored); rotate a fresh lease for the retrying browser.
    var rotated = rotateResumeToken_(session);
    touchSession_(session);
    saveSession_(session);
    return okResponse_(envelope, {
      status: "started",
      state: publicState_(session, { resumeToken: rotated })
    });
  }
  // Slot marked but session creation crashed: finish the job now.
  var payload = envelope.payload;
  var created = createSession_({
    token_hash: "",
    treatment: String(slot.treatment),
    block_id: String(slot.block_id),
    sequence_id: String(slot.sequence_id),
    entry_mode: "gateway",
    lecture_id: String(slot.lecture_id)
  }, payload, envelope);
  slot.session_id = created.session.session_id;
  saveSlot_(slot);
  return okResponse_(envelope, {
    status: "started",
    state: publicState_(created.session, { resumeToken: created.resumeToken })
  });
}

/* ==========================================================================
   MODULE: Host.gs
   ========================================================================== */
/**
 * Host.gs — self-service classroom control (on-demand sessions).
 *
 * The classroom host (coauthor) needs no advance planning and nothing
 * from the coordinator during the study. She holds one private control
 * link containing a high-entropy HOST KEY (issued once). From it she can,
 * in any class, at any moment:
 *
 *   host_open   — start a live session now: generate a fresh six-digit
 *                 code, auto-label the batch (date + counter + optional
 *                 name), optionally set an auto-expiry, and begin drawing
 *                 from the frozen pool;
 *   host_close  — end the live session (the code stops admitting anyone);
 *   host_status — poll counts and the current code to re-project.
 *
 * The host key authorizes only these controls; it exposes no treatment,
 * no hidden state, and no participant data. It is stored only as a keyed
 * hash. If it ever leaks, the coordinator resets it (Setup/Operations),
 * and a leaked *entry code* is inert whenever the session is closed.
 *
 * host_open / host_close mutate shared state and therefore run inside the
 * router's script lock; host_status is read-only and runs outside it.
 */

var HOST_MAX_MINUTES = 600;        // safety ceiling on a single session
var HOST_DEFAULT_MINUTES = 90;     // typical lecture length; 0 = no expiry

function hostKeyValid_(rawKey) {
  var stored = propOptional_("HOST_KEY_HASH", "");
  if (!stored) return false;
  return tokenHash_(String(rawKey)) === stored;
}

function requireHost_(envelope) {
  if (!hostKeyValid_(envelope.payload.host_key)) {
    return { error: errorResponse_(envelope, "HOST_KEY_INVALID", false) };
  }
  return { ok: true };
}

function liveStatusData_() {
  var pool = poolLecture_();
  var live = liveSession_();
  var open = live ? live.open : false;
  if (open && live.expires_at) {
    var exp = new Date(live.expires_at).getTime();
    if (isFinite(exp) && Date.now() > exp) open = false;
  }
  return {
    open: open,
    code: live ? live.code : "",
    batch: live ? live.batch : "",
    opened_at: live ? live.opened_at : "",
    expires_at: live ? live.expires_at : "",
    joined_this_session: Number(configGet_("live_claimed", "0")),
    places_remaining: pool ? poolPlacesRemaining_(pool) : 0,
    total_places: pool ? Number(pool.maximum_n) : 0,
    total_claimed: pool ? Number(pool.claimed_count) : 0,
    collection_open: collectionOpen_(),
    join_url: propOptional_("STUDY_BASE_URL", "") + "join/"
  };
}

function handleHostStatus_(envelope) {
  var auth = requireHost_(envelope);
  if (auth.error) return auth.error;
  return okResponse_(envelope, liveStatusData_());
}

function handleHostOpen_(envelope) {
  var auth = requireHost_(envelope);
  if (auth.error) return auth.error;
  if (!collectionOpen_()) return errorResponse_(envelope, "COLLECTION_CLOSED", false);
  var pool = poolLecture_();
  if (!pool) return errorResponse_(envelope, "POOL_NOT_PROVISIONED", false);

  var payload = envelope.payload;
  var minutes = (payload.minutes === undefined || payload.minutes === null)
    ? HOST_DEFAULT_MINUTES : Number(payload.minutes);
  if (!isFinite(minutes) || minutes < 0 || minutes > HOST_MAX_MINUTES) {
    return errorResponse_(envelope, "BAD_FIELD", false, "minutes out of range");
  }

  // Choice 1: begin this lecture on a fresh permuted block (retiring any
  // unused remainder of the previous lecture's block) before checking that
  // places remain, so every lecture is its own lecture-stratified stream.
  pool = alignPoolToFreshBlock_(pool);
  if (poolPlacesRemaining_(pool) <= 0) return errorResponse_(envelope, "LECTURE_FULL", false);

  var counter = Number(configGet_("live_counter", "0")) + 1;
  var label = payload.label ? sanitizeText_(payload.label, 60) : "";
  // Date-stamped batch; the harness/date is server-side and stable.
  var dayTag = nowIso_().slice(0, 10);
  var batch = dayTag + " #" + counter + (label ? " " + label : "");
  var code = sixDigitCode_();

  configSet_("live_open", "TRUE");
  configSet_("live_code", code);
  configSet_("live_batch", batch);
  configSet_("live_opened_at", nowIso_());
  configSet_("live_expires_at", minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : "");
  configSet_("live_counter", String(counter));
  configSet_("live_claimed", "0");
  SpreadsheetApp.flush();

  return okResponse_(envelope, liveStatusData_());
}

function handleHostClose_(envelope) {
  var auth = requireHost_(envelope);
  if (auth.error) return auth.error;
  configSet_("live_open", "FALSE");
  SpreadsheetApp.flush();
  return okResponse_(envelope, liveStatusData_());
}

/* ==========================================================================
   MODULE: Decisions.gs
   ========================================================================== */
/**
 * Decisions.gs — authoritative round processing (§5.5 decision).
 *
 * The browser submits only {round, choice, timed_out, timing paradata}.
 * Everything economic — the hidden type, the label policy, the waiting
 * cost, the payoff, the recovery draw, the transition, the balance — is
 * resolved here from the frozen sequence and the stored session state.
 * The response returns participant-facing feedback and the next round's
 * public state; it never returns future hidden state (§4.7).
 */

function handleDecision_(envelope, session) {
  var payload = envelope.payload;

  if (session.status !== "rounds") {
    return errorResponse_(envelope, "STATE_MISMATCH", false, "stage=" + session.status);
  }
  var round = Number(session.current_round);
  if (Number(payload.round) !== round) {
    return errorResponse_(envelope, "STATE_MISMATCH", false, "round mismatch");
  }

  var seqRow = sequenceRow_(String(session.sequence_id), round);
  var actualType = String(seqRow.case_type);
  var recoveryU = Number(seqRow.recovery_u);
  var load = String(session.current_load);
  var label = displayLabelFor_(String(session.treatment), actualType, load);
  var cost = load === "normal" ? DESIGN.WAIT_NORMAL : DESIGN.WAIT_STRAINED;

  var timedOut = payload.timed_out === true;
  var choice = timedOut ? "not_send" : payload.choice;
  var served = choice === "send";
  var points = served ? (actualType === "H" ? DESIGN.H_VALUE : DESIGN.L_VALUE) - cost : 0;
  var highBurdenServed = served && actualType === "H";

  // Transition (§7.2): H service strains next round; a strained round
  // with no H service recovers iff the round-indexed uniform draw is
  // below 0.50; the standard state persists otherwise.
  var recovered = false;
  var nextLoad;
  if (highBurdenServed) {
    nextLoad = "strained";
  } else if (load === "strained") {
    recovered = recoveryU < DESIGN.RECOVERY_PROB;
    nextLoad = recovered ? "normal" : "strained";
  } else {
    nextLoad = "normal";
  }

  var balanceAfter = Number(session.current_balance) + points;
  var receiptId = Utilities.getUuid();

  appendRowObject_(researchSheet_(SHEETS.ROUNDS), HEADERS.rounds, {
    session_id: session.session_id,
    participant_code: session.participant_code,
    treatment: session.treatment,
    block_id: session.block_id,
    sequence_id: session.sequence_id,
    round: round,
    actual_type: actualType,
    display_label: label,
    capacity_before: load,
    wait_cost: cost,
    choice: choice,
    timed_out: timedOut ? "TRUE" : "FALSE",
    active_rt_ms: payload.active_rt_ms,
    wall_rt_ms: payload.wall_rt_ms,
    hidden_ms: payload.hidden_ms,
    instruction_ms: payload.instruction_ms,
    served: served ? "TRUE" : "FALSE",
    high_burden_served: highBurdenServed ? "TRUE" : "FALSE",
    recovery_u: (load === "strained" && !highBurdenServed) ? recoveryU : "",
    recovered: recovered ? "TRUE" : "FALSE",
    capacity_after: nextLoad,
    points: points,
    balance_after: balanceAfter,
    request_id: envelope.request_id,
    received_at: nowIso_(),
    instruction_opens: payload.instruction_opens,
    blur_count: payload.blur_count
  });

  var lastRound = round >= DESIGN.NUM_ROUNDS;
  session.current_round = round + 1;
  session.current_load = nextLoad;
  session.current_balance = balanceAfter;
  if (lastRound) session.status = "beliefs";
  touchSession_(session);
  saveSession_(session);

  var outcome = {
    round: round,
    total_rounds: DESIGN.NUM_ROUNDS,
    decision: choice,
    timed_out: timedOut,
    points: points,
    balance_after: balanceAfter,
    next_load: nextLoad,
    next_round_available: !lastRound,
    receipt_id: receiptId
  };
  return okResponse_(envelope, {
    outcome: outcome,
    state: publicState_(session)
  });
}

/* ==========================================================================
   MODULE: Scoring.gs
   ========================================================================== */
/**
 * Scoring.gs — comprehension gate, belief scoring, and finalization
 * (§5.5 quiz / beliefs / finalize; §4.10; §8.5).
 *
 * Belief rule (preregistration §2.5, retained by design decision): each
 * estimate earns max(0, BELIEF_MAX − |guess − truth|); the linear rule's
 * optimal report is the median of the subjective distribution. Truths
 * are recomputed here from the frozen sequence and the stored round
 * records — never from client input.
 */

function handleQuiz_(envelope, session) {
  var payload = envelope.payload;
  if (session.status !== "instructions") {
    return errorResponse_(envelope, "STATE_MISMATCH", false, "stage=" + session.status);
  }
  var answers = payload.answers;
  var incorrect = [];
  Object.keys(QUIZ_KEY).forEach(function (item) {
    var expected = QUIZ_KEY[item];
    var given = answers[item];
    var ok = (typeof expected === "number") ? Number(given) === expected : String(given) === expected;
    if (!ok) incorrect.push(item);
  });

  session.quiz_attempts = Number(session.quiz_attempts || 0) + 1;
  var passed = incorrect.length === 0;
  if (passed) {
    session.quiz_passed = "TRUE";
    session.status = "rounds";
    var tokensSheet = researchSheet_(SHEETS.TOKENS);
    var tokenRow = findRowByValue_(tokensSheet, HEADERS.tokens, "token_hash", String(session.token_hash));
    if (tokenRow !== -1) {
      var token = readRowObject_(tokensSheet, HEADERS.tokens, tokenRow);
      token.status = "started";
      writeRowObject_(tokensSheet, HEADERS.tokens, tokenRow, token);
    }
  }
  touchSession_(session);
  saveSession_(session);

  // §5.5 quiz: identify the incorrect items; the client shows its own
  // catalog explanations for exactly those items. The paid rounds open
  // only after every item is correct. Attempt counts are retained for
  // the pre-registered data-quality analysis.
  return okResponse_(envelope, {
    passed: passed,
    incorrect: incorrect,
    attempt: Number(session.quiz_attempts),
    state: publicState_(session)
  });
}

/* ---- Beliefs ---- */

function beliefScore_(guess, truth) {
  return Math.max(0, DESIGN.BELIEF_MAX - Math.abs(Number(guess) - Number(truth)));
}

function sessionRoundRows_(sessionId) {
  var sheet = researchSheet_(SHEETS.ROUNDS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var col = HEADERS.rounds.indexOf("session_id") + 1;
  var hits = sheet.getRange(2, col, lastRow - 1, 1)
    .createTextFinder(String(sessionId)).matchEntireCell(true).findAll();
  return hits.map(function (hit) {
    return readRowObject_(sheet, HEADERS.rounds, hit.getRow());
  }).sort(function (a, b) { return Number(a.round) - Number(b.round); });
}

function trueCounts_(session, roundRows) {
  var actualH = 0;
  for (var r = 1; r <= DESIGN.NUM_ROUNDS; r++) {
    if (String(sequenceRow_(String(session.sequence_id), r).case_type) === "H") actualH += 1;
  }
  var actualHServed = roundRows.filter(function (row) {
    return String(row.high_burden_served) === "TRUE";
  }).length;
  return { actual_h: actualH, actual_h_served: actualHServed };
}

function handleBeliefs_(envelope, session) {
  var payload = envelope.payload;
  if (session.status !== "beliefs") {
    return errorResponse_(envelope, "STATE_MISMATCH", false, "stage=" + session.status);
  }
  var roundRows = sessionRoundRows_(String(session.session_id));
  if (roundRows.length !== DESIGN.NUM_ROUNDS) {
    return errorResponse_(envelope, "STATE_MISMATCH", false, "rounds=" + roundRows.length);
  }
  var truths = trueCounts_(session, roundRows);
  var beliefPoints = beliefScore_(payload.belief_h, truths.actual_h) +
    beliefScore_(payload.belief_h_served, truths.actual_h_served);

  session.belief_h = payload.belief_h;
  session.belief_h_served = payload.belief_h_served;
  session.belief_points = beliefPoints;
  session.beliefs_submitted = "TRUE";
  session.status = "survey";
  touchSession_(session);
  saveSession_(session);

  // Score and provisional results only; true counts stay private (§5.5).
  return okResponse_(envelope, {
    belief_points: beliefPoints,
    state: publicState_(session)
  });
}

/* ---- Finalize (§5.5): full recomputation, receipts, payment record ---- */

function handleFinalize_(envelope, session) {
  var payload = envelope.payload;
  if (session.status !== "survey") {
    return errorResponse_(envelope, "STATE_MISMATCH", false, "stage=" + session.status);
  }
  var roundRows = sessionRoundRows_(String(session.session_id));
  var verification = verifySessionRounds_(session, roundRows);
  var integrityStatus = verification.status;

  var truths = trueCounts_(session, roundRows);
  var results = resultsComponents_(session);
  var recomputedBalance = DESIGN.START_BALANCE + verification.recomputed_decision_points;
  if (recomputedBalance !== Number(session.current_balance)) {
    integrityStatus = "manual_review";
  }

  var now = nowIso_();
  var completionCode = uniqueCompletionCode_();
  var receiptReference = Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
  var q = payload.questionnaire;
  var d = payload.demographics;
  var device = {};
  try { device = JSON.parse(String(session.device_json || "{}")); } catch (e) {}

  var timeouts = roundRows.filter(function (r) { return String(r.timed_out) === "TRUE"; }).length;
  var meanActive = roundRows.length
    ? Math.round(roundRows.reduce(function (acc, r) { return acc + Number(r.active_rt_ms || 0); }, 0) / roundRows.length)
    : "";

  appendRowObject_(researchSheet_(SHEETS.PARTICIPANTS), HEADERS.participants, {
    session_id: session.session_id,
    participant_code: session.participant_code,
    treatment: session.treatment,
    block_id: session.block_id,
    language: session.language,
    consented_at: session.consented_at,
    started_at: session.started_at,
    completed_at: now,
    elapsed_seconds: Math.round((Date.now() - new Date(String(session.consented_at)).getTime()) / 1000),
    completion_status: "completed",
    quiz_failures: Math.max(0, Number(session.quiz_attempts) - 1),
    attention_passed: q.attention_check === "4" ? "TRUE" : "FALSE",
    decision_points: results.decision_points,
    belief_points: results.belief_points,
    bonus_points: results.counted_points,
    bonus_vnd: results.bonus_vnd,
    h_served: roundRows.filter(function (r) { return String(r.high_burden_served) === "TRUE"; }).length,
    l_served: roundRows.filter(function (r) { return String(r.served) === "TRUE" && String(r.actual_type) === "L"; }).length,
    strained_rounds: roundRows.filter(function (r) { return String(r.capacity_before) === "strained"; }).length,
    timeouts: timeouts,
    mean_active_rt: meanActive,
    label_difficulty: q.label_difficulty,
    label_effect: q.label_effect,
    waiting_effect: q.waiting_effect,
    understood: q.understood,
    believed: q.believed,
    policy_recognition: q.policy_recognition,
    age_band: d.age_band,
    gender: d.gender,
    field: d.field,
    year: d.year,
    prior_experiments: d.prior_experiments,
    gps_risk: d.gps_risk,
    gps_patience: d.gps_patience,
    device_class: device.device_class || "",
    integrity_status: integrityStatus,
    belief_h: session.belief_h,
    belief_h_served: session.belief_h_served,
    actual_h: truths.actual_h,
    actual_h_served: truths.actual_h_served,
    policy_noticed: q.policy_noticed,
    attention_check: q.attention_check,
    strategy: sanitizeText_(q.strategy || "", DESIGN.TEXT_LIMIT_LONG),
    confusing: sanitizeText_(q.confusing || "", DESIGN.TEXT_LIMIT_LONG),
    browser_family: device.browser_family || "",
    viewport_width_band: device.viewport_width_band || "",
    viewport_height_band: device.viewport_height_band || "",
    timezone_offset_minutes: device.timezone_offset_minutes,
    sequence_id: session.sequence_id,
    quiz_attempts: session.quiz_attempts
  });

  // Restricted payment record (§6.3): identity-payment mapping only.
  var paymentsSheet = sheet_(paymentBook_(), "payments", PAYMENT_HEADERS.payments);
  appendRowObject_(paymentsSheet, PAYMENT_HEADERS.payments, {
    participant_code: session.participant_code,
    external_platform_id: "",
    session_id: session.session_id,
    lecture_id: session.lecture_id || "",
    completion_code: completionCode,
    fixed_payment_vnd: DESIGN.FIXED_VND,
    bonus_payment_vnd: results.bonus_vnd,
    total_payment_vnd: DESIGN.FIXED_VND + results.bonus_vnd,
    completion_received_at: now,
    payment_status: "pending",
    payment_date: "",
    payment_reference: "",
    withdrawal_status: ""
  });

  session.status = "completed";
  session.survey_submitted = "TRUE";
  session.completed_at = now;
  session.integrity_status = integrityStatus;
  session.completion_code = completionCode;
  session.receipt_reference = receiptReference;
  touchSession_(session);
  saveSession_(session);

  var tokensSheet = researchSheet_(SHEETS.TOKENS);
  var tokenRow = findRowByValue_(tokensSheet, HEADERS.tokens, "token_hash", String(session.token_hash));
  if (tokenRow !== -1) {
    var token = readRowObject_(tokensSheet, HEADERS.tokens, tokenRow);
    token.status = "completed";
    token.completed_at = now;
    writeRowObject_(tokensSheet, HEADERS.tokens, tokenRow, token);
  }

  appendIntegrityRows_(String(session.session_id), verification.rows);

  return okResponse_(envelope, {
    state: publicState_(session)
  });
}

/* ==========================================================================
   MODULE: Router.gs
   ========================================================================== */
/**
 * Router.gs — atomic request processing (§5.6, §5.7).
 *
 * Every state-changing request passes through one short critical section
 * guarded by the script lock: duplicate-request lookup, authoritative
 * session read, handler execution, event-response storage, flush. HTML
 * rendering and envelope validation happen OUTSIDE the lock.
 *
 * Idempotency and ordering rules (§5.6):
 *   - request_id globally unique; a repeat with the SAME payload returns
 *     the stored response verbatim; a repeat with a DIFFERENT payload is
 *     an EVENT_CONFLICT.
 *   - event_seq strictly increasing per session for stateful actions:
 *     seq < last            -> STALE_EVENT
 *     seq == last, same id  -> rebuilt acknowledgement (lost-ack path)
 *     seq == last, new id   -> EVENT_CONFLICT
 *     seq > last + 1        -> SEQUENCE_GAP
 *   - heartbeat and resume carry no sequence obligations.
 */

var SEQUENCED_ACTIONS = { quiz: true, decision: true, beliefs: true, finalize: true, withdraw: true };

function processAtomic_(envelope) {
  // The lecture-code pre-check is read-only and allocates nothing. Keep it
  // outside the global write lock so a classroom scanning wave does not
  // block decisions already in progress. The later claim revalidates all
  // conditions atomically.
  if (envelope.action === "lecture_status") {
    return handleLectureStatus_(envelope);
  }
  // Host status polling is read-only; keep it off the write lock too.
  if (envelope.action === "host_status") {
    return handleHostStatus_(envelope);
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    // Explicitly retryable; must never count as a participant decision (§5.9).
    return errorResponse_(envelope, "SERVER_BUSY", true);
  }
  try {
    var payloadHash = sha256Hex_(JSON.stringify(envelope.payload || {}));
    var stored = findStoredResponse_(envelope.request_id);
    if (stored) {
      if (stored.payload_hash !== payloadHash) {
        return errorResponse_(envelope, "EVENT_CONFLICT", false, "request_id reuse with altered payload");
      }
      // Sheet-persisted entry responses deliberately omit resume_token.
      // Reconstruct a fresh lease rather than storing a bearer credential.
      if ((envelope.action === "start" || envelope.action === "claim") &&
          stored.response && stored.response.ok &&
          stored.response.data && stored.response.data.state &&
          !stored.response.data.state.resume_token) {
        return rebuildEntryAcknowledgement_(envelope, stored);
      }
      var replay = JSON.parse(JSON.stringify(stored.response));
      replay.nonce = envelope.nonce;   // receipt binds to the live attempt
      replay.request_id = envelope.request_id;
      return replay;
    }

    var response = routeAction_(envelope);

    if (response.ok) {
      storeEvent_(envelope, response, "ok");
    } else {
      logError_(envelope.request_id,
        envelope.payload && envelope.payload.session_id,
        response.error_code, response.detail || response.error_code,
        envelope.action, envelope.app_version);
    }
    SpreadsheetApp.flush();
    return response;
  } finally {
    lock.releaseLock();
  }
}

function rebuildEntryAcknowledgement_(envelope, stored) {
  var sessionId = stored.session_id ||
    (stored.response.data && stored.response.data.state && stored.response.data.state.session_id);
  if (!sessionId) return errorResponse_(envelope, "STATE_MISMATCH", false, "entry session missing");
  var session = loadSessionById_(String(sessionId));
  if (session.status === "withdrawn") return errorResponse_(envelope, "SESSION_WITHDRAWN", false);
  if (session.status === "completed") {
    return okResponse_(envelope, {
      status: "completed",
      state: publicState_(session, { includeCompletion: true })
    });
  }
  if (sessionExpired_(session)) return errorResponse_(envelope, "SESSION_EXPIRED", false);
  var fresh = rotateResumeToken_(session);
  touchSession_(session);
  saveSession_(session);
  return okResponse_(envelope, {
    status: (stored.response.data && stored.response.data.status) || "existing_session",
    state: publicState_(session, { resumeToken: fresh })
  });
}

function routeAction_(envelope) {
  var action = envelope.action;
  if (action === "start") return handleStart_(envelope);
  if (action === "claim") return handleClaim_(envelope);
  if (action === "lecture_status") return handleLectureStatus_(envelope);
  if (action === "host_open") return handleHostOpen_(envelope);
  if (action === "host_close") return handleHostClose_(envelope);
  if (action === "host_status") return handleHostStatus_(envelope);
  if (action === "resume") return handleResume_(envelope);

  var auth = requireSession_(envelope);
  if (auth.error) return auth.error;
  var session = auth.session;

  if (action === "heartbeat") {
    var hb = handleHeartbeat_(envelope, session);
    return hb;
  }

  if (SEQUENCED_ACTIONS[action]) {
    var seq = Number(envelope.payload.event_seq);
    var last = Number(session.last_event_seq);
    if (seq < last || (seq === last && String(session.last_request_id) !== envelope.request_id)) {
      return errorResponse_(envelope, seq < last ? "STALE_EVENT" : "EVENT_CONFLICT", false,
        "seq=" + seq + " last=" + last);
    }
    if (seq === last && String(session.last_request_id) === envelope.request_id) {
      // The write succeeded earlier but the acknowledgement (or the event
      // row) was lost: rebuild the acknowledgement from durable state.
      return rebuildAcknowledgement_(envelope, session);
    }
    if (seq > last + 1) {
      return errorResponse_(envelope, "SEQUENCE_GAP", false, "seq=" + seq + " last=" + last);
    }
    // Accept: advance the sequence before the handler persists the session.
    session.last_event_seq = seq;
    session.last_request_id = envelope.request_id;
  }

  if (action === "quiz") return handleQuiz_(envelope, session);
  if (action === "decision") return handleDecisionIdempotent_(envelope, session);
  if (action === "beliefs") return handleBeliefs_(envelope, session);
  if (action === "finalize") return handleFinalizeIdempotent_(envelope, session);
  if (action === "withdraw") return handleWithdraw_(envelope, session);
  return errorResponse_(envelope, "UNKNOWN_ACTION", false);
}

/**
 * Defence in depth for the two append-type writes: if a previous attempt
 * durably appended (round row / participants row) but the session update
 * or event store failed, reprocessing must not append twice.
 */
function handleDecisionIdempotent_(envelope, session) {
  var roundsSheet = researchSheet_(SHEETS.ROUNDS);
  var existing = findRowByValue_(roundsSheet, HEADERS.rounds, "request_id", envelope.request_id);
  if (existing !== -1) {
    var row = readRowObject_(roundsSheet, HEADERS.rounds, existing);
    return acknowledgeFromRoundRow_(envelope, session, row);
  }
  return handleDecision_(envelope, session);
}

function handleFinalizeIdempotent_(envelope, session) {
  var participantsSheet = researchSheet_(SHEETS.PARTICIPANTS);
  var existing = findRowByValue_(participantsSheet, HEADERS.participants, "session_id", String(session.session_id));
  if (existing !== -1) {
    // A previous attempt durably appended the participants row but died
    // before persisting the session (or the payment row). Recover the
    // completion records so the participant always receives their code.
    recoverCompletionRecords_(session);
    session.status = "completed";
    session.survey_submitted = "TRUE";
    if (!session.completed_at) session.completed_at = nowIso_();
    saveSession_(session);
    var tokensSheet = researchSheet_(SHEETS.TOKENS);
    var tokenRow = findRowByValue_(tokensSheet, HEADERS.tokens, "token_hash", String(session.token_hash));
    if (tokenRow !== -1) {
      var token = readRowObject_(tokensSheet, HEADERS.tokens, tokenRow);
      if (token.status !== "completed") {
        token.status = "completed";
        token.completed_at = nowIso_();
        writeRowObject_(tokensSheet, HEADERS.tokens, tokenRow, token);
      }
    }
    return okResponse_(envelope, { state: publicState_(session, { includeCompletion: true }) });
  }
  return handleFinalize_(envelope, session);
}

/**
 * Restore completion_code / receipt_reference / payment row after a
 * partial finalize commit. The payments ledger is the durable source for
 * an already-issued code; if the crash preceded the payment append, the
 * row is created now from recomputed results.
 */
function recoverCompletionRecords_(session) {
  var paymentsSheet = sheet_(paymentBook_(), "payments", PAYMENT_HEADERS.payments);
  var paymentRow = findRowByValue_(paymentsSheet, PAYMENT_HEADERS.payments, "session_id", String(session.session_id));
  if (paymentRow !== -1) {
    var payment = readRowObject_(paymentsSheet, PAYMENT_HEADERS.payments, paymentRow);
    if (!session.completion_code) session.completion_code = String(payment.completion_code);
  } else {
    var results = resultsComponents_(session);
    if (!session.completion_code) session.completion_code = uniqueCompletionCode_();
    appendRowObject_(paymentsSheet, PAYMENT_HEADERS.payments, {
      participant_code: session.participant_code,
      external_platform_id: "",
      session_id: session.session_id,
      completion_code: session.completion_code,
      fixed_payment_vnd: DESIGN.FIXED_VND,
      bonus_payment_vnd: results.bonus_vnd,
      total_payment_vnd: DESIGN.FIXED_VND + results.bonus_vnd,
      completion_received_at: nowIso_(),
      payment_status: "pending",
      payment_date: "",
      payment_reference: "",
      withdrawal_status: ""
    });
  }
  if (!session.receipt_reference) {
    session.receipt_reference = Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
  }
}

function acknowledgeFromRoundRow_(envelope, session, row) {
  // Ensure the session reflects the durably recorded round before
  // acknowledging (covers a crash between round append and session save).
  var round = Number(row.round);
  if (Number(session.current_round) <= round) {
    session.current_round = round + 1;
    session.current_load = String(row.capacity_after);
    session.current_balance = Number(row.balance_after);
    if (round >= DESIGN.NUM_ROUNDS) session.status = "beliefs";
    saveSession_(session);
  }
  return okResponse_(envelope, {
    outcome: {
      round: round,
      total_rounds: DESIGN.NUM_ROUNDS,
      decision: String(row.choice),
      timed_out: String(row.timed_out) === "TRUE",
      points: Number(row.points),
      balance_after: Number(row.balance_after),
      next_load: String(row.capacity_after),
      next_round_available: round < DESIGN.NUM_ROUNDS,
      receipt_id: envelope.request_id
    },
    state: publicState_(session)
  });
}

function rebuildAcknowledgement_(envelope, session) {
  if (envelope.action === "decision") {
    var roundsSheet = researchSheet_(SHEETS.ROUNDS);
    var existing = findRowByValue_(roundsSheet, HEADERS.rounds, "request_id", envelope.request_id);
    if (existing !== -1) {
      return acknowledgeFromRoundRow_(envelope, session,
        readRowObject_(roundsSheet, HEADERS.rounds, existing));
    }
  }
  if (envelope.action === "quiz") {
    return okResponse_(envelope, {
      passed: String(session.quiz_passed) === "TRUE",
      incorrect: [],
      attempt: Number(session.quiz_attempts),
      state: publicState_(session)
    });
  }
  if (envelope.action === "beliefs") {
    return okResponse_(envelope, {
      belief_points: Number(session.belief_points || 0),
      state: publicState_(session)
    });
  }
  // finalize, withdraw: the state snapshot carries everything needed.
  return okResponse_(envelope, { state: publicState_(session) });
}

/* ==========================================================================
   MODULE: Integrity.gs
   ========================================================================== */
/**
 * Integrity.gs — automated verification of every payoff and transition
 * (§10). Runs at finalization for each session and on demand across the
 * dataset. Anomalous rows are never deleted; they are reported and the
 * session is flagged (verified / recoverable_warning / manual_review /
 * invalid).
 */

function expectedWaitCost_(load) {
  return load === "normal" ? DESIGN.WAIT_NORMAL : DESIGN.WAIT_STRAINED;
}

/**
 * Recompute a session's 20 rounds from the frozen sequence and the
 * recorded choices; compare every stored field that follows from them.
 * Returns { status, rows: [{check,status,detail}], recomputed_decision_points }.
 */
function verifySessionRounds_(session, roundRows) {
  var findings = [];
  var fail = function (check, detail) { findings.push({ check: check, status: "fail", detail: detail }); };
  var okCount = 0;

  if (roundRows.length !== DESIGN.NUM_ROUNDS) {
    fail("round_count", "expected " + DESIGN.NUM_ROUNDS + ", found " + roundRows.length);
  }

  var seenRounds = {};
  var seenRequests = {};
  var load = "normal";
  var balance = DESIGN.START_BALANCE;

  for (var i = 0; i < roundRows.length; i++) {
    var row = roundRows[i];
    var r = Number(row.round);

    if (seenRounds[r]) fail("round_unique", "duplicate round " + r);
    seenRounds[r] = true;
    if (r !== i + 1) fail("round_sequential", "position " + (i + 1) + " holds round " + r);
    if (seenRequests[String(row.request_id)]) fail("request_id_unique", "duplicate " + row.request_id);
    seenRequests[String(row.request_id)] = true;

    if (String(row.treatment) !== String(session.treatment)) fail("treatment_constant", "round " + r);
    if (String(row.sequence_id) !== String(session.sequence_id)) fail("sequence_constant", "round " + r);
    if (String(row.block_id) !== String(session.block_id)) fail("block_constant", "round " + r);

    var seqRow = sequenceRow_(String(session.sequence_id), r);
    var type = String(seqRow.case_type);
    if (String(row.actual_type) !== type) fail("type_matches_sequence", "round " + r);

    var expectedLabel = displayLabelFor_(String(session.treatment), type, load);
    if (String(row.display_label) !== expectedLabel) fail("label_policy", "round " + r);

    if (String(row.capacity_before) !== load) fail("capacity_chain", "round " + r);
    if (Number(row.wait_cost) !== expectedWaitCost_(load)) fail("wait_cost", "round " + r);

    var served = String(row.served) === "TRUE";
    var choiceServed = String(row.choice) === "send";
    if (served !== choiceServed) fail("served_flag", "round " + r);
    var highBurden = served && type === "H";
    if ((String(row.high_burden_served) === "TRUE") !== highBurden) fail("high_burden_flag", "round " + r);

    var expectedPoints = served ? (type === "H" ? DESIGN.H_VALUE : DESIGN.L_VALUE) - expectedWaitCost_(load) : 0;
    if (Number(row.points) !== expectedPoints) fail("points", "round " + r);

    var expectedNext;
    var expectedRecovered = false;
    if (highBurden) expectedNext = "strained";
    else if (load === "strained") {
      expectedRecovered = Number(seqRow.recovery_u) < DESIGN.RECOVERY_PROB;
      expectedNext = expectedRecovered ? "normal" : "strained";
    } else expectedNext = "normal";
    if (String(row.capacity_after) !== expectedNext) fail("transition", "round " + r);
    if ((String(row.recovered) === "TRUE") !== expectedRecovered) fail("recovered_flag", "round " + r);

    balance += expectedPoints;
    if (Number(row.balance_after) !== balance) fail("balance_chain", "round " + r);

    load = expectedNext;
    okCount += 1;
  }

  var failures = findings.length;
  var status = failures > 0 ? "manual_review" : "verified";
  if (roundRows.length === 0) status = "invalid";
  findings.push({
    check: "summary",
    status: failures > 0 ? "fail" : "pass",
    detail: okCount + " rounds checked, " + failures + " findings"
  });

  return {
    status: status,
    rows: findings,
    recomputed_decision_points: balance - DESIGN.START_BALANCE
  };
}

function appendIntegrityRows_(sessionId, findings) {
  var sheet = researchSheet_(SHEETS.INTEGRITY);
  var now = nowIso_();
  var rows = findings.map(function (f) {
    return [now, sessionId, f.check, f.status, f.detail];
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.integrity_report.length).setValues(rows);
  }
}

/**
 * Manual, researcher-run audit across the dataset (§6.2 integrity_report):
 * per-session recomputation for every completed session plus aggregate
 * checks — duplicate request ids, treatment balance, token reuse, and
 * bonus reconciliation against the payment ledger.
 */
function rebuildIntegrityReport() {
  var report = researchSheet_(SHEETS.INTEGRITY);
  if (report.getLastRow() > 1) {
    report.getRange(2, 1, report.getLastRow() - 1, HEADERS.integrity_report.length).clearContent();
  }
  var sessionsSheet = researchSheet_(SHEETS.SESSIONS);
  var lastRow = sessionsSheet.getLastRow();
  var counts = { mixed: 0, fine: 0, state_dependent: 0 };
  var completed = 0;

  for (var row = 2; row <= lastRow; row++) {
    var session = readRowObject_(sessionsSheet, HEADERS.sessions, row);
    if (String(session.status) !== "completed") continue;
    completed += 1;
    counts[String(session.treatment)] = (counts[String(session.treatment)] || 0) + 1;
    var roundRows = sessionRoundRows_(String(session.session_id));
    var verification = verifySessionRounds_(session, roundRows);
    appendIntegrityRows_(String(session.session_id), verification.rows);
    if (String(session.integrity_status) !== verification.status) {
      session.integrity_status = verification.status;
      saveSession_(session);
    }
    var results = resultsComponents_(session);
    var paymentsSheet = sheet_(paymentBook_(), "payments", PAYMENT_HEADERS.payments);
    var paymentRow = findRowByValue_(paymentsSheet, PAYMENT_HEADERS.payments, "session_id", String(session.session_id));
    if (paymentRow === -1) {
      appendIntegrityRows_(String(session.session_id), [{ check: "payment_record", status: "fail", detail: "missing payment row" }]);
    } else {
      var payment = readRowObject_(paymentsSheet, PAYMENT_HEADERS.payments, paymentRow);
      if (Number(payment.bonus_payment_vnd) !== results.bonus_vnd) {
        appendIntegrityRows_(String(session.session_id), [{ check: "bonus_match", status: "fail", detail: "ledger " + payment.bonus_payment_vnd + " vs " + results.bonus_vnd }]);
      }
    }
  }

  appendIntegrityRows_("ALL", [
    { check: "completed_sessions", status: "info", detail: String(completed) },
    { check: "treatment_balance", status: "info", detail: JSON.stringify(counts) },
    { check: "duplicate_request_ids", status: duplicateRequestIds_() ? "fail" : "pass", detail: "" },
    { check: "token_reuse", status: tokenReuse_() ? "fail" : "pass", detail: "" }
  ]);
  appendIntegrityRows_("ALL", gatewayChecks_());
  SpreadsheetApp.flush();
  return "integrity report rebuilt: " + completed + " completed sessions checked";
}

/**
 * Gateway audits: every claimed slot must reference an existing session
 * of matching treatment and sequence (an orphaned slot marks a crashed
 * claim that never retried); within each lecture, claimed treatment
 * counts must differ by at most one — the permuted-triple invariant.
 */
function gatewayChecks_() {
  var findings = [];
  var slotsSheet = researchSheet_(SHEETS.SLOTS);
  var lastRow = slotsSheet.getLastRow();
  if (lastRow < 2) return findings;
  var perLecture = {};
  var orphans = 0, mismatches = 0;
  for (var row = 2; row <= lastRow; row++) {
    var slot = readRowObject_(slotsSheet, HEADERS.allocation_slots, row);
    if (String(slot.status) !== "claimed") continue;
    // Stratify the balance check by the actual lecture. In pre-scheduled mode
    // the slot's lecture_id is the lecture; in on-demand pool mode the slot's
    // lecture_id is "POOL" and the lecture (batch) lives on the session, so
    // prefer the session's lecture_id. This verifies Choice 1's per-lecture
    // permuted-block balance rather than only the pool-wide total.
    var lectureId = String(slot.lecture_id);
    var session = null;
    if (slot.session_id) {
      try { session = loadSessionById_(String(slot.session_id)); } catch (e) { session = null; }
    }
    if (!slot.session_id || !session) {
      orphans += 1;
    } else {
      if (String(session.treatment) !== String(slot.treatment) ||
        String(session.sequence_id) !== String(slot.sequence_id)) mismatches += 1;
      if (session.lecture_id) lectureId = String(session.lecture_id);
    }
    perLecture[lectureId] = perLecture[lectureId] || { mixed: 0, fine: 0, state_dependent: 0 };
    perLecture[lectureId][String(slot.treatment)] += 1;
  }
  findings.push({ check: "gateway_orphan_slots", status: orphans ? "fail" : "pass", detail: String(orphans) });
  findings.push({ check: "gateway_slot_session_match", status: mismatches ? "fail" : "pass", detail: String(mismatches) });
  Object.keys(perLecture).forEach(function (lectureId) {
    var c = perLecture[lectureId];
    var values = [c.mixed, c.fine, c.state_dependent];
    var spread = Math.max.apply(null, values) - Math.min.apply(null, values);
    findings.push({
      check: "gateway_balance_" + lectureId,
      status: spread <= 1 ? "pass" : "fail",
      detail: JSON.stringify(c)
    });
  });
  return findings;
}

function duplicateRequestIds_() {
  var sheet = researchSheet_(SHEETS.ROUNDS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return false;
  var col = HEADERS.rounds.indexOf("request_id") + 1;
  var values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0]);
    if (seen[id]) return true;
    seen[id] = true;
  }
  return false;
}

function tokenReuse_() {
  var sheet = researchSheet_(SHEETS.SESSIONS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return false;
  var col = HEADERS.sessions.indexOf("token_hash") + 1;
  var values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var hash = String(values[i][0]);
    // Gateway sessions intentionally have no invitation-token hash.
    if (!hash) continue;
    if (seen[hash]) return true;
    seen[hash] = true;
  }
  return false;
}

/* ==========================================================================
   MODULE: Setup.gs
   ========================================================================== */
/**
 * Setup.gs — one-time provisioning, sequence freezing, and release
 * management. Researcher-run from the Apps Script editor; nothing here
 * is reachable from the web app.
 *
 * Beginner route (recommended): bind the project to one private Google
 * Sheet, run BEGINNER_FIRST_TIME_SETUP(), and use the Sheet's Queue Study
 * menu. Lecture planning then lives in CONTROL rather than source code.
 *
 * The lower-level functions in this file remain available for advanced
 * or scripted deployments and for the verification harness.
 */

/**
 * ONE-CALL provisioning for researchers who prefer a single step.
 *
 * Prerequisites (once): setupScriptPropertiesTemplate(), then fill the
 * two workbook IDs (or run createWorkbooks()), PARENT_ORIGIN, and
 * STUDY_BASE_URL in Project Settings → Script Properties.
 *
 * For the easiest deployment, do not edit this source. Use the CONTROL
 * Sheet and BEGINNER_PREVIEW_PLAN()/BEGINNER_PROVISION_STUDY() from
 * Operations.gs. The array helpers below remain an advanced fallback and
 * are retained for backwards compatibility and automated testing.
 */
function provisionStudy(numBlocks, blockCounts, sessionLabels) {
  numBlocks = numBlocks || 120;
  var report = [];
  report.push(setupWorkbooks());
  props_().setProperty("MAX_PARTICIPANTS", String(numBlocks * 3));
  configSet_("planned_lectures", sessionLabels ? String(sessionLabels.length) : "0");
  configSet_("target_total", String(numBlocks * 3));
  configSet_("maximum_total", String(numBlocks * 3));
  configSet_("target_per_arm", String(numBlocks));
  report.push(generateAssignmentBlocks(numBlocks, "main"));
  if (blockCounts && sessionLabels) {
    report.push(allocateBlocksToSessions(blockCounts, sessionLabels));
  }
  report.push(freezeDesignPrecommitment());
  report.push(selfCheck());
  return report.join("\n");
}

function setupScriptPropertiesTemplate() {
  var props = props_();
  var defaults = {
    RESEARCH_SPREADSHEET_ID: "PASTE_RESEARCH_SPREADSHEET_ID",
    PAYMENT_SPREADSHEET_ID: "PASTE_PAYMENT_SPREADSHEET_ID",
    PARENT_ORIGIN: "https://amazingly.github.io",
    HMAC_SECRET: Utilities.getUuid() + Utilities.getUuid(),
    SEQUENCE_SEED: Utilities.getUuid() + Utilities.getUuid(),
    EXPERIMENT_VERSION: "queue-study-v1.0.0",
    SEQUENCE_VERSION: "seq-v1",
    COLLECTION_OPEN: "FALSE",
    MAX_PARTICIPANTS: "0",
    EXPECTED_APP_VERSION: "queue-study-v1.0.0",
    STUDY_BASE_URL: "https://amazingly.github.io/queue-study/"
  };
  Object.keys(defaults).forEach(function (key) {
    if (!props.getProperty(key)) props.setProperty(key, defaults[key]);
  });
  clearSecretCache_();
  return "Properties seeded (existing values preserved). Fill the PASTE_* values.";
}

function createWorkbooks() {
  var research = SpreadsheetApp.create("Queue Study Research Data — Production");
  var payment = SpreadsheetApp.create("Queue Study Payment Ledger — Production");
  props_().setProperty("RESEARCH_SPREADSHEET_ID", research.getId());
  props_().setProperty("PAYMENT_SPREADSHEET_ID", payment.getId());
  return "Created. Research: " + research.getId() + "  Payment: " + payment.getId() +
    " — restrict sharing per §6.1 before recruitment.";
}

function ensureSheetWithHeaders_(book, name, headers) {
  var sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  var current = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, headers.length).getValues()[0] : [];
  var matches = headers.every(function (h, i) { return current[i] === h; });
  if (!matches) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  return sheet;
}

function setTextFormat_(sheet, headers, columnNames) {
  columnNames.forEach(function (name) {
    var col = headers.indexOf(name) + 1;
    if (col > 0) sheet.getRange(2, col, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat("@");
  });
}

function setupWorkbooks() {
  var research = researchBook_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheetWithHeaders_(research, name, HEADERS[name]);
  });
  var defaultSheet = research.getSheetByName("Sheet1");
  if (defaultSheet && research.getSheets().length > 1) research.deleteSheet(defaultSheet);

  // §6.5: participant-supplied text must never parse as formulas or numbers.
  setTextFormat_(research.getSheetByName(SHEETS.PARTICIPANTS), HEADERS.participants,
    ["strategy", "confusing", "age_band", "year", "gps_risk", "gps_patience",
      "label_difficulty", "label_effect", "waiting_effect", "attention_check"]);
  setTextFormat_(research.getSheetByName(SHEETS.SESSIONS), HEADERS.sessions, ["device_json"]);
  setTextFormat_(research.getSheetByName(SHEETS.EVENTS), HEADERS.events, ["response_json"]);

  // §6.2: protect assignment-critical tabs from casual manual edits.
  // The lectures and allocation_slots tabs hold private treatment
  // information and are never shared with the session administrator.
  [SHEETS.TOKENS, SHEETS.SEQUENCES, SHEETS.LECTURES, SHEETS.SLOTS].forEach(function (name) {
    var sheet = research.getSheetByName(name);
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (!protections.length) sheet.protect().setWarningOnly(true);
  });

  var payment = paymentBook_();
  Object.keys(PAYMENT_HEADERS).forEach(function (name) {
    ensureSheetWithHeaders_(payment, name, PAYMENT_HEADERS[name]);
  });
  var paymentDefault = payment.getSheetByName("Sheet1");
  if (paymentDefault && payment.getSheets().length > 1) payment.deleteSheet(paymentDefault);

  // Config skeleton (§6.2 config tab). Initialize only missing fields:
  // rerunning setup must never erase release metadata or a frozen hash.
  [
    ["experiment_version", prop_("EXPERIMENT_VERSION")],
    ["sequence_version", prop_("SEQUENCE_VERSION")],
    ["current_schema_version", "schema-v1"],
    ["collection_open", prop_("COLLECTION_OPEN")],
    ["planned_lectures", ""],
    ["target_total", ""],
    ["maximum_total", ""],
    ["target_per_arm", ""],
    ["github_commit_sha", ""],
    ["apps_script_deployment_id", ""],
    ["sequence_hash", ""],
    ["sequence_rows", ""],
    ["sequence_frozen_at", ""],
    ["allocation_hash", ""],
    ["allocation_rows", ""],
    ["design_manifest_hash", ""],
    ["design_frozen_at", ""],
    ["ethics_wording_final", ""],
    ["ethics_confirmed_at", ""],
    ["opened_at", ""],
    ["closed_at", ""]
  ].forEach(function (pair) { configSetIfAbsent_(pair[0], pair[1]); });

  return "Workbooks provisioned.";
}

/* ---- §7: matched blocks, frozen sequences, preallocated tokens ---- */

function pad4_(n) { return ("0000" + n).slice(-4); }

/**
 * Generate `numBlocks` assignment blocks. Each block b carries one
 * frozen 20-round environment — theta_br ~ Bernoulli(0.40) i.i.d. and
 * u_br ~ U[0,1] indexed by round (§7.2) — and exactly three invitation
 * slots, one per arm (§7.1), sharing that environment (common random
 * numbers with exact treatment balance). Invitation order is permuted
 * with the seeded generator so recruitment order carries no information.
 *
 * Sequences for a given SEQUENCE_VERSION are generated exactly once;
 * rerunning is refused so the frozen environment cannot drift (§7.3).
 */
function generateAssignmentBlocks(numBlocks, batchLabel) {
  numBlocks = numBlocks || 120;
  batchLabel = batchLabel || "batch1";
  var version = prop_("SEQUENCE_VERSION");
  var research = researchBook_();
  var sequencesSheet = research.getSheetByName(SHEETS.SEQUENCES);
  if (sequencesSheet.getLastRow() > 1) {
    throw new Error("Sequences already exist for this workbook. Freeze means frozen: " +
      "use a new SEQUENCE_VERSION and a new workbook for a new environment (§7.3).");
  }
  var baseUrl = prop_("STUDY_BASE_URL");
  var now = nowIso_();

  var sequenceRows = [];
  var tokenEntries = [];
  for (var b = 1; b <= numBlocks; b++) {
    var sequenceId = "sq" + version + "-" + pad4_(b);
    var blockId = "b" + pad4_(b);
    for (var r = 1; r <= DESIGN.NUM_ROUNDS; r++) {
      var theta = seededUniform_(version + ":theta:" + b + ":" + r) < DESIGN.H_PROB ? "H" : "L";
      var u = Math.round(seededUniform_(version + ":recovery:" + b + ":" + r) * 1e12) / 1e12;
      sequenceRows.push([
        version, sequenceId, r, theta, u, now, GENERATOR_VERSION,
        sha256Hex_([version, sequenceId, r, theta, u].join("|")).slice(0, 16)
      ]);
    }
    DESIGN.TREATMENTS.forEach(function (treatment) {
      tokenEntries.push({
        raw: newOpaqueToken_("qt"),
        blockId: blockId,
        treatment: treatment,
        sequenceId: sequenceId
      });
    });
  }

  // Seeded Fisher–Yates permutation of recruitment order (§7.1).
  for (var i = tokenEntries.length - 1; i > 0; i--) {
    var j = Math.floor(seededUniform_(version + ":permute:" + i) * (i + 1));
    var tmp = tokenEntries[i]; tokenEntries[i] = tokenEntries[j]; tokenEntries[j] = tmp;
  }

  sequencesSheet.getRange(2, 1, sequenceRows.length, HEADERS.sequences.length).setValues(sequenceRows);

  var tokenRows = tokenEntries.map(function (entry) {
    return [tokenHash_(entry.raw), batchLabel, "", entry.blockId, entry.treatment,
      entry.sequenceId, "unused", "", "", "", "", 0, ""];
  });
  research.getSheetByName(SHEETS.TOKENS)
    .getRange(2, 1, tokenRows.length, HEADERS.tokens.length).setValues(tokenRows);

  // Raw invitation links live ONLY in the payment workbook (§5.3, §6.3).
  var inviteRows = tokenEntries.map(function (entry) {
    return [batchLabel, baseUrl + "?token=" + entry.raw, entry.raw, now];
  });
  var invitesSheet = paymentBook_().getSheetByName("invites");
  invitesSheet.getRange(invitesSheet.getLastRow() + 1, 1, inviteRows.length, PAYMENT_HEADERS.invites.length)
    .setValues(inviteRows);

  SpreadsheetApp.flush();
  return numBlocks + " blocks generated: " + sequenceRows.length + " sequence rows, " +
    tokenRows.length + " tokens. Now run freezeDesignPrecommitment().";
}

/**
 * §7.3: canonical serialization and SHA-256 of the entire sequence set.
 * Commit the returned hash (with SEQUENCE_VERSION and generator_version)
 * to the public repository BEFORE recruitment; keep the table private
 * until data collection closes.
 */
function canonicalSequenceDigest_() {
  var sheet = researchSheet_(SHEETS.SEQUENCES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("No sequences to freeze; run generateAssignmentBlocks first.");
  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues(); // version, id, round, type, u
  var canonical = values.map(function (row) {
    return [row[0], row[1], row[2], row[3], row[4]].join(",");
  }).join("\n");
  return { hash: sha256Hex_(canonical), rows: values.length };
}

function freezeSequencePrecommitment() {
  var digest = canonicalSequenceDigest_();
  var frozen = configGet_("sequence_hash", "");
  if (frozen && frozen !== digest.hash) {
    throw new Error("SEQUENCE_HASH_MISMATCH: the sequence table changed after freezing.");
  }
  if (!frozen) {
    configSet_("sequence_hash", digest.hash);
    configSet_("sequence_rows", String(digest.rows));
    configSet_("sequence_frozen_at", nowIso_());
  }
  return "sequence_version=" + prop_("SEQUENCE_VERSION") +
    " generator=" + GENERATOR_VERSION +
    " rows=" + digest.rows +
    " sha256=" + digest.hash;
}

function verifyFrozenSequenceHash_() {
  var frozen = configGet_("sequence_hash", "");
  if (!/^[0-9a-f]{64}$/.test(frozen)) {
    throw new Error("SEQUENCE_NOT_FROZEN");
  }
  var digest = canonicalSequenceDigest_();
  if (digest.hash !== frozen) {
    throw new Error("SEQUENCE_HASH_MISMATCH: current=" + digest.hash + " frozen=" + frozen);
  }
  if (String(digest.rows) !== String(configGet_("sequence_rows", ""))) {
    throw new Error("SEQUENCE_ROW_COUNT_MISMATCH");
  }
  return digest;
}

/* ---- Choice 2: dual preregistration commitments + design manifest ----
 *
 * Two independent SHA-256 commitments — one to the stochastic-sequence
 * table (the frozen H/L types and recovery draws), one to the treatment-
 * allocation table (the permuted arm orders and their sequence mapping) —
 * plus a combined design-manifest hash that binds both to the frozen design
 * parameters. Each component verifies on its own (no single sequence-only
 * hash, and no single opaque all-purpose hash), so a later change to the
 * environment, to the treatment orders, or to their binding is detectable.
 */
function canonicalAllocationDigest_() {
  var slots = researchSheet_(SHEETS.SLOTS);
  var slotRows = slots.getLastRow();
  if (slotRows >= 2) {
    // Pool / gateway model: hash the fixed assignment columns of every slot
    // (lecture_id, claim_order, block_id, treatment, sequence_id) so the
    // commitment is stable across run-time status changes (claimed/retired)
    // and session links, which live in later columns.
    var sv = slots.getRange(2, 1, slotRows - 1, 5).getValues();
    var scanon = sv.map(function (r) { return [r[0], r[1], r[2], r[3], r[4]].join(","); }).join("\n");
    return { hash: sha256Hex_(scanon), rows: sv.length, kind: "allocation_slots" };
  }
  // Token / slip model: the tokens table is the treatment-allocation table.
  var tokens = researchSheet_(SHEETS.TOKENS);
  var tokRows = tokens.getLastRow();
  if (tokRows < 2) throw new Error("No allocation table to freeze; provision the study first.");
  var iTh = HEADERS.tokens.indexOf("token_hash"), iB = HEADERS.tokens.indexOf("block_id"),
      iT = HEADERS.tokens.indexOf("treatment"), iS = HEADERS.tokens.indexOf("sequence_id");
  var tv = tokens.getRange(2, 1, tokRows - 1, HEADERS.tokens.length).getValues();
  var tcanon = tv.map(function (r) { return [r[iTh], r[iB], r[iT], r[iS]].join(","); }).join("\n");
  return { hash: sha256Hex_(tcanon), rows: tv.length, kind: "tokens" };
}

function canonicalDesignManifest_(seq, alloc) {
  var lines = [
    "experiment_version=" + prop_("EXPERIMENT_VERSION"),
    "sequence_version=" + prop_("SEQUENCE_VERSION"),
    "generator_version=" + GENERATOR_VERSION,
    "num_rounds=" + DESIGN.NUM_ROUNDS,
    "treatments=" + DESIGN.TREATMENTS.join("|"),
    "sequence_rows=" + seq.rows,
    "sequence_sha256=" + seq.hash,
    "allocation_kind=" + alloc.kind,
    "allocation_rows=" + alloc.rows,
    "allocation_sha256=" + alloc.hash
  ];
  var manifest = lines.join("\n");
  return { hash: sha256Hex_(manifest), manifest: manifest };
}

function freezeComponent_(hashKey, rowsKey, digest, label) {
  var frozen = configGet_(hashKey, "");
  if (frozen && frozen !== digest.hash) {
    throw new Error("PRECOMMITMENT_MISMATCH: the " + label + " commitment changed after freezing.");
  }
  if (!frozen) {
    configSet_(hashKey, digest.hash);
    if (rowsKey) configSet_(rowsKey, String(digest.rows));
  }
}

/**
 * Freeze all three commitments. Idempotent: re-running with an unchanged
 * design re-affirms the same hashes; any drift in a component throws.
 */
function freezeDesignPrecommitment() {
  var seq = canonicalSequenceDigest_();
  var alloc = canonicalAllocationDigest_();
  var manifest = canonicalDesignManifest_(seq, alloc);
  freezeComponent_("sequence_hash", "sequence_rows", seq, "stochastic-sequence");
  freezeComponent_("allocation_hash", "allocation_rows", alloc, "treatment-allocation");
  freezeComponent_("design_manifest_hash", "", { hash: manifest.hash }, "design-manifest");
  if (!configGet_("sequence_frozen_at", "")) configSet_("sequence_frozen_at", nowIso_());
  if (!configGet_("design_frozen_at", "")) configSet_("design_frozen_at", nowIso_());
  return "Frozen preregistration commitments:\n" +
    "  stochastic-sequence  rows=" + seq.rows + " sha256=" + seq.hash + "\n" +
    "  treatment-allocation rows=" + alloc.rows + " (" + alloc.kind + ") sha256=" + alloc.hash + "\n" +
    "  design-manifest      sha256=" + manifest.hash;
}

/** Re-verify all three commitments; throws a specific error on any drift. */
function verifyDesignManifest_() {
  var seqFrozen = configGet_("sequence_hash", "");
  var allocFrozen = configGet_("allocation_hash", "");
  var manifestFrozen = configGet_("design_manifest_hash", "");
  if (!/^[0-9a-f]{64}$/.test(seqFrozen) || !/^[0-9a-f]{64}$/.test(allocFrozen) ||
    !/^[0-9a-f]{64}$/.test(manifestFrozen)) {
    throw new Error("DESIGN_NOT_FROZEN");
  }
  var seq = canonicalSequenceDigest_();
  if (seq.hash !== seqFrozen) throw new Error("SEQUENCE_HASH_MISMATCH: current=" + seq.hash + " frozen=" + seqFrozen);
  if (String(seq.rows) !== String(configGet_("sequence_rows", ""))) throw new Error("SEQUENCE_ROW_COUNT_MISMATCH");
  var alloc = canonicalAllocationDigest_();
  if (alloc.hash !== allocFrozen) throw new Error("ALLOCATION_HASH_MISMATCH: current=" + alloc.hash + " frozen=" + allocFrozen);
  if (String(alloc.rows) !== String(configGet_("allocation_rows", ""))) throw new Error("ALLOCATION_ROW_COUNT_MISMATCH");
  var manifest = canonicalDesignManifest_(seq, alloc);
  if (manifest.hash !== manifestFrozen) throw new Error("DESIGN_MANIFEST_MISMATCH: current=" + manifest.hash + " frozen=" + manifestFrozen);
  return { sequence: seq, allocation: alloc, manifest: manifest };
}

/**
 * Allocate WHOLE blocks to named recruitment sessions (e.g., lectures),
 * stamping tokens.batch (research) and invites.batch (payment ledger).
 *
 * Classroom deployment: each lecture receives complete blocks — three
 * matched slips per block, one per arm — so treatment is exactly
 * balanced WITHIN every class, and the lecture label rides along as the
 * randomization stratum for clustering and lecture-fixed-effect checks.
 * Run once, before printing slips, after generateAssignmentBlocks():
 *
 *   allocateBlocksToSessions([20, 20, 20, 20, 20],
 *     ["lecture1", "lecture2", "lecture3", "lecture4", "lecture5"])
 *
 * gives each lecture 20 blocks = 60 single-use slips. Blocks without a
 * session keep their original batch label (spares). Allocation edits
 * only operational labels; the frozen sequences and preassigned arms
 * are untouched, so rerunning with a different partition before
 * recruitment is safe, and refused once any token has been used.
 */
function allocateBlocksToSessions(blockCounts, sessionLabels) {
  if (!blockCounts || !sessionLabels || blockCounts.length !== sessionLabels.length) {
    throw new Error("Provide matching arrays: block counts and session labels.");
  }
  var research = researchBook_();
  var tokensSheet = research.getSheetByName(SHEETS.TOKENS);
  var lastRow = tokensSheet.getLastRow();
  if (lastRow < 2) throw new Error("No tokens generated yet.");
  var tokenValues = tokensSheet.getRange(2, 1, lastRow - 1, HEADERS.tokens.length).getValues();
  var statusIdx = HEADERS.tokens.indexOf("status");
  var blockIdx = HEADERS.tokens.indexOf("block_id");
  var batchIdx = HEADERS.tokens.indexOf("batch");
  var hashIdx = HEADERS.tokens.indexOf("token_hash");
  if (tokenValues.some(function (r) { return r[statusIdx] !== "unused"; })) {
    throw new Error("Allocation is frozen: at least one token has already been used.");
  }

  var blockIds = [];
  var seen = {};
  tokenValues.forEach(function (r) {
    var b = String(r[blockIdx]);
    if (!seen[b]) { seen[b] = true; blockIds.push(b); }
  });
  blockIds.sort();
  var need = blockCounts.reduce(function (a, b) { return a + b; }, 0);
  if (need > blockIds.length) {
    throw new Error("Requested " + need + " blocks but only " + blockIds.length + " exist.");
  }

  var blockToSession = {};
  var cursor = 0;
  for (var s = 0; s < sessionLabels.length; s++) {
    for (var k = 0; k < blockCounts[s]; k++) {
      blockToSession[blockIds[cursor]] = sessionLabels[s];
      cursor += 1;
    }
  }

  var hashToBatch = {};
  tokenValues.forEach(function (r) {
    var label = blockToSession[String(r[blockIdx])];
    if (label) r[batchIdx] = label;
    hashToBatch[String(r[hashIdx])] = String(r[batchIdx]);
  });
  tokensSheet.getRange(2, 1, tokenValues.length, HEADERS.tokens.length).setValues(tokenValues);

  var payment = paymentBook_();
  var invitesSheet = payment.getSheetByName("invites");
  var invLast = invitesSheet.getLastRow();
  if (invLast >= 2) {
    var invValues = invitesSheet.getRange(2, 1, invLast - 1, PAYMENT_HEADERS.invites.length).getValues();
    var invBatchIdx = PAYMENT_HEADERS.invites.indexOf("batch");
    var invRawIdx = PAYMENT_HEADERS.invites.indexOf("raw_token");
    invValues.forEach(function (r) {
      var mapped = hashToBatch[tokenHash_(String(r[invRawIdx]))];
      if (mapped) r[invBatchIdx] = mapped;
    });
    invitesSheet.getRange(2, 1, invValues.length, PAYMENT_HEADERS.invites.length).setValues(invValues);
  }
  SpreadsheetApp.flush();
  return "Allocated " + need + " blocks across " + sessionLabels.length +
    " sessions (" + (blockIds.length - need) + " spare blocks retain their original batch). " +
    "Filter the invites tab by batch to print each session's slips.";
}

/* ---- Shared-entry gateway provisioning (classroom deployment) ---- */

/**
 * ADVANCED FALLBACK ONLY. Beginner deployments use the CONTROL Sheet.
 *
 * The supplied values are a planning example retained for programmatic
 * deployments and tests: eleven lectures with up to 150 students each.
 * They are not experimental parameters.
 *
 * expected_n: the planned number of eligible consenting participants.
 * maximum_n: the largest number of new sessions the lecture may admit.
 * Set maximum_n to the realistic upper bound for that class. The slot
 * ledger automatically rounds capacity up to complete three-arm blocks,
 * while the gateway still enforces maximum_n exactly.
 */
function plannedGatewayLectures_() {
  return [
    { lecture_id: "L01", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L02", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L03", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L04", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L05", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L06", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L07", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L08", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L09", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L10", expected_n: 150, maximum_n: 150 },
    { lecture_id: "L11", expected_n: 150, maximum_n: 150 }
  ];
}

/**
 * Validate and normalise lecture specifications. `blocks` is optional:
 * when omitted it is derived as ceil(maximum_n / 3), preserving complete
 * three-arm randomisation blocks. Existing lower-level calls that specify
 * blocks remain supported.
 */
function normalizeLectureSpecs_(lectureSpecs) {
  if (!Array.isArray(lectureSpecs) || !lectureSpecs.length) {
    throw new Error("Provide at least one lecture specification.");
  }
  var ids = {};
  return lectureSpecs.map(function (spec, index) {
    spec = spec || {};
    var id = String(spec.lecture_id || ("L" + ("00" + (index + 1)).slice(-2)));
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) {
      throw new Error("Invalid lecture_id: " + id);
    }
    if (ids[id]) throw new Error("Duplicate lecture_id: " + id);
    ids[id] = true;

    var hasExpected = spec.expected_n !== undefined && spec.expected_n !== null && spec.expected_n !== "";
    var hasMaximum = spec.maximum_n !== undefined && spec.maximum_n !== null && spec.maximum_n !== "";
    var hasBlocks = spec.blocks !== undefined && spec.blocks !== null && spec.blocks !== "";

    var expected = hasExpected ? Number(spec.expected_n) : null;
    var maximum = hasMaximum ? Number(spec.maximum_n) : null;
    var blocks = hasBlocks ? Number(spec.blocks) : null;

    if (expected !== null &&
        (!isFinite(expected) || expected < 0 || Math.floor(expected) !== expected)) {
      throw new Error("Lecture " + id + " expected_n must be a non-negative integer.");
    }
    if (maximum !== null &&
        (!isFinite(maximum) || maximum < 1 || Math.floor(maximum) !== maximum)) {
      throw new Error("Lecture " + id + " maximum_n must be a positive integer.");
    }
    if (blocks !== null &&
        (!isFinite(blocks) || blocks < 1 || Math.floor(blocks) !== blocks)) {
      throw new Error("Lecture " + id + " blocks must be a positive integer.");
    }

    if (maximum === null) {
      maximum = blocks !== null ? blocks * 3 : expected;
    }
    if (expected === null) expected = maximum;
    if (blocks === null) blocks = Math.ceil(maximum / 3);

    var slots = blocks * 3;
    if (expected > maximum) {
      throw new Error("Lecture " + id + " expected_n cannot exceed maximum_n.");
    }
    if (maximum > slots) {
      throw new Error("Lecture " + id + " needs at least " + Math.ceil(maximum / 3) +
        " blocks for maximum_n=" + maximum + ".");
    }

    return {
      lecture_id: id,
      blocks: blocks,
      expected_n: expected,
      maximum_n: maximum
    };
  });
}

function gatewayPlanSummary_(lectureSpecs, spareBlocks) {
  var specs = normalizeLectureSpecs_(lectureSpecs);
  var expectedTotal = specs.reduce(function (a, s) { return a + s.expected_n; }, 0);
  var maximumTotal = specs.reduce(function (a, s) { return a + s.maximum_n; }, 0);
  var lectureBlocks = specs.reduce(function (a, s) { return a + s.blocks; }, 0);
  var spares = Number(spareBlocks || 0);
  if (!isFinite(spares) || spares < 0 || Math.floor(spares) !== spares) {
    throw new Error("spareBlocks must be a non-negative integer.");
  }
  return {
    specs: specs,
    lecture_count: specs.length,
    expected_total: expectedTotal,
    maximum_total: maximumTotal,
    expected_per_arm: expectedTotal / 3,
    lecture_blocks: lectureBlocks,
    spare_blocks: spares,
    total_blocks: lectureBlocks + spares,
    allocation_slots: lectureBlocks * 3,
    sequence_rows: (lectureBlocks + spares) * DESIGN.NUM_ROUNDS
  };
}

/**
 * Safe, read-only preview. Run this after editing plannedGatewayLectures_()
 * and before creating production sequences.
 */
function previewPlannedGatewayStudy() {
  var plan = gatewayPlanSummary_(plannedGatewayLectures_(), 0);
  var lines = [
    "PLANNED GATEWAY STUDY — NO DATA CHANGED",
    "lectures=" + plan.lecture_count,
    "expected_total=" + plan.expected_total,
    "maximum_total=" + plan.maximum_total,
    "expected_per_arm≈" + plan.expected_per_arm,
    "matched_blocks=" + plan.lecture_blocks,
    "allocation_slots=" + plan.allocation_slots,
    "sequence_rows=" + plan.sequence_rows,
    ""
  ];
  plan.specs.forEach(function (s) {
    lines.push(s.lecture_id + ": expected=" + s.expected_n +
      ", maximum=" + s.maximum_n + ", blocks=" + s.blocks +
      ", slots=" + (s.blocks * 3));
  });
  return lines.join("\n");
}

/** One-call production provisioning using the editable planning array. */
function provisionPlannedGatewayStudy() {
  return provisionStudyGateway(plannedGatewayLectures_(), 0);
}

/**
 * ONE-CALL gateway provisioning. Lecture count and attendance are inputs,
 * not fixed properties of the experiment. It creates the matched blocks,
 * converts lecture blocks into an ordered allocation-slot ledger, retires
 * those blocks' invitation tokens, records the plan totals, freezes the
 * sequence hash, and runs the self-check.
 *
 * Lecture access codes are created only shortly before class with
 * scheduleLecture(), openLectureNow(), or openLectureByNumber().
 */
/**
 * ONE-CALL provisioning for the on-demand (self-service) model. Builds a
 * single frozen POOL of `totalPlaces` places (rounded up to whole
 * three-arm blocks), plus optional spare token-based blocks, and issues a
 * classroom host key. After this, the coauthor opens and closes sessions
 * herself from the host control link — no lectures are planned, scheduled,
 * or emailed. Size generously: the pool cannot be enlarged after freezing
 * without a fresh environment. Recommended: total expected participants
 * across all classes x ~1.3.
 */
function provisionStudyPool(totalPlaces, spareBlocks) {
  totalPlaces = Number(totalPlaces);
  if (!isFinite(totalPlaces) || totalPlaces < 3) {
    throw new Error("Provide totalPlaces (>= 3), e.g. provisionStudyPool(330).");
  }
  var poolBlocks = Math.ceil(totalPlaces / 3);
  var places = poolBlocks * 3;
  spareBlocks = Number(spareBlocks || 0);
  var report = [];
  report.push(setupWorkbooks());

  props_().setProperty("MAX_PARTICIPANTS", String(places));
  configSet_("planned_lectures", "1");
  configSet_("target_total", String(places));
  configSet_("maximum_total", String(places));
  configSet_("target_per_arm", String(Math.round(places / 3)));

  report.push(generateAssignmentBlocks(poolBlocks + spareBlocks, "spare"));
  report.push(buildAllocationSlots([{ lecture_id: "POOL", blocks: poolBlocks, expected_n: places, maximum_n: places }]));
  report.push(freezeDesignPrecommitment());
  report.push(ensureHostKey_());
  report.push(selfCheck());
  report.push("On-demand pool ready: " + places + " places. Give your coauthor the host link from " +
    "\"Show classroom host link\" (menu) or hostControlLink().");
  return report.join("\n");
}

/** Create the classroom host key once (idempotent); returns its status. */
function ensureHostKey_() {
  var existing = propOptional_("HOST_KEY_HASH", "");
  if (existing) return "Host key already set (use resetHostKey() to rotate).";
  var raw = newOpaqueToken_("qh");
  props_().setProperty("HOST_KEY_HASH", tokenHash_(raw));
  props_().setProperty("HOST_KEY_RAW", raw);
  return "Host key created.";
}

/**
 * Rotate the host key; any previously distributed host link stops working
 * immediately. Use this only if the link may have leaked.
 */
function resetHostKey() {
  var raw = newOpaqueToken_("qh");
  props_().setProperty("HOST_KEY_HASH", tokenHash_(raw));
  props_().setProperty("HOST_KEY_RAW", raw);
  return hostControlLink();
}

/**
 * The classroom control link to email the coauthor. It carries the host
 * key, which authorizes only opening/closing sessions — never data or
 * treatments — so it is retrievable again here whenever you need to
 * re-send it. If it may have leaked, rotate it with resetHostKey().
 */
function hostControlLink() {
  var raw = propOptional_("HOST_KEY_RAW", "");
  var base = propOptional_("STUDY_BASE_URL", "https://amazingly.github.io/queue-study/");
  if (!raw) return "No host key yet. Provision the on-demand pool first (provisionStudyPool).";
  return base + "host/?host=" + raw;
}

function provisionStudyGateway(lectureSpecs, spareBlocks) {
  var plan = gatewayPlanSummary_(lectureSpecs, spareBlocks);
  var report = [];
  report.push(setupWorkbooks());

  props_().setProperty("MAX_PARTICIPANTS", String(plan.maximum_total));
  configSet_("planned_lectures", String(plan.lecture_count));
  configSet_("target_total", String(plan.expected_total));
  configSet_("maximum_total", String(plan.maximum_total));
  configSet_("target_per_arm", String(plan.expected_per_arm));

  report.push("Plan recorded: " + plan.lecture_count + " lectures; expected=" +
    plan.expected_total + "; maximum=" + plan.maximum_total + "; blocks=" +
    plan.total_blocks + ".");
  report.push(generateAssignmentBlocks(plan.total_blocks, "spare"));
  report.push(buildAllocationSlots(plan.specs));
  report.push(freezeDesignPrecommitment());
  report.push(selfCheck());
  return report.join("\n");
}

/**
 * Convert the first N generated blocks into per-lecture allocation
 * slots (§5 of the gateway plan): within each block the three arms are
 * seeded-permuted, blocks are consumed in order, and the first
 * consenting participant receives claim_order 1. Interim treatment
 * counts therefore differ by at most one, and equal counts return after
 * every complete triple. Tokens belonging to converted blocks are
 * retired (status "gateway") so no block can be entered twice through
 * two different doors. One-shot: refused once lectures exist.
 */
function buildAllocationSlots(lectureSpecs) {
  var research = researchBook_();
  var lecturesSheet = research.getSheetByName(SHEETS.LECTURES);
  if (lecturesSheet.getLastRow() > 1) {
    throw new Error("Lectures already provisioned; the slot ledger is frozen with the sequences.");
  }
  var tokensSheet = research.getSheetByName(SHEETS.TOKENS);
  var lastRow = tokensSheet.getLastRow();
  if (lastRow < 2) throw new Error("Generate blocks first (generateAssignmentBlocks).");
  var version = prop_("SEQUENCE_VERSION");
  var tokenValues = tokensSheet.getRange(2, 1, lastRow - 1, HEADERS.tokens.length).getValues();
  var blockIdx = HEADERS.tokens.indexOf("block_id");
  var seqIdx = HEADERS.tokens.indexOf("sequence_id");
  var statusIdx = HEADERS.tokens.indexOf("status");
  var batchIdx = HEADERS.tokens.indexOf("batch");

  var blockIds = [];
  var blockSeq = {};
  var seen = {};
  tokenValues.forEach(function (r) {
    var b = String(r[blockIdx]);
    if (!seen[b]) { seen[b] = true; blockIds.push(b); blockSeq[b] = String(r[seqIdx]); }
  });
  blockIds.sort();
  var need = lectureSpecs.reduce(function (a, s) { return a + s.blocks; }, 0);
  if (need > blockIds.length) throw new Error("Requested " + need + " blocks; only " + blockIds.length + " exist.");

  var slotRows = [];
  var lectureRows = [];
  var cursor = 0;
  var rowStart = 2;
  var blockToLecture = {};
  lectureSpecs.forEach(function (spec, index) {
    var lectureId = spec.lecture_id || ("L" + ("00" + (index + 1)).slice(-2));
    var claimOrder = 0;
    for (var k = 0; k < spec.blocks; k++) {
      var blockId = blockIds[cursor];
      blockToLecture[blockId] = lectureId;
      cursor += 1;
      // Seeded within-block permutation of the three arms.
      var arms = DESIGN.TREATMENTS.slice();
      for (var i = arms.length - 1; i > 0; i--) {
        var j = Math.floor(seededUniform_(version + ":slotperm:" + lectureId + ":" + blockId + ":" + i) * (i + 1));
        var tmp = arms[i]; arms[i] = arms[j]; arms[j] = tmp;
      }
      arms.forEach(function (treatment) {
        claimOrder += 1;
        slotRows.push([lectureId, claimOrder, blockId, treatment, blockSeq[blockId], "unused", "", "", ""]);
      });
    }
    var slotCount = spec.blocks * 3;
    lectureRows.push([
      lectureId, "", "", "",
      spec.expected_n,
      Math.min(spec.maximum_n, slotCount),
      "scheduled", 0, 1, rowStart, slotCount
    ]);
    rowStart += slotCount;
  });

  research.getSheetByName(SHEETS.SLOTS)
    .getRange(2, 1, slotRows.length, HEADERS.allocation_slots.length).setValues(slotRows);
  lecturesSheet.getRange(2, 1, lectureRows.length, HEADERS.lectures.length).setValues(lectureRows);

  // Retire the converted blocks' tokens: gateway blocks have no slips.
  tokenValues.forEach(function (r) {
    var lectureId = blockToLecture[String(r[blockIdx])];
    if (lectureId) {
      r[statusIdx] = "gateway";
      r[batchIdx] = lectureId;
    }
  });
  tokensSheet.getRange(2, 1, tokenValues.length, HEADERS.tokens.length).setValues(tokenValues);

  SpreadsheetApp.flush();
  return "Gateway ledger built: " + lectureSpecs.length + " lectures, " + slotRows.length +
    " allocation slots (" + (blockIds.length - need) + " spare blocks remain token-based).";
}

function lectureCodeUsedByOther_(lectureId, rawCode) {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.lectures.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var otherId = String(values[i][HEADERS.lectures.indexOf("lecture_id")]);
    var storedHash = String(values[i][HEADERS.lectures.indexOf("code_hash")]);
    if (!storedHash || otherId === String(lectureId)) continue;
    if (storedHash === lectureCodeHash_(otherId, rawCode)) return true;
  }
  return false;
}

function freshLectureCode_(lectureId) {
  for (var attempt = 0; attempt < 50; attempt++) {
    var candidate = sixDigitCode_();
    if (!lectureCodeUsedByOther_(lectureId, candidate)) return candidate;
  }
  throw new Error("Could not generate a unique lecture code; try again.");
}

/**
 * Arm one lecture with a fresh six-digit access code and a validity
 * window. Returns the RAW code exactly once — email it to the session
 * administrator shortly before class; only its keyed hash is stored.
 * Rescheduling the same lecture replaces the code and window.
 */
function scheduleLecture(lectureId, opensAtIso, closesAtIso, rawCode) {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var row = findRowByValue_(sheet, HEADERS.lectures, "lecture_id", String(lectureId));
  if (row === -1) throw new Error("Unknown lecture: " + lectureId);
  var lecture = readRowObject_(sheet, HEADERS.lectures, row);
  var code = rawCode ? String(rawCode) : freshLectureCode_(lectureId);
  if (!/^\d{6}$/.test(code)) throw new Error("Lecture code must be six digits.");
  if (rawCode && lectureCodeUsedByOther_(lectureId, code)) {
    throw new Error("Lecture code is already assigned to another lecture. Choose a different code.");
  }
  var opens = new Date(String(opensAtIso));
  var closes = new Date(String(closesAtIso));
  if (!isFinite(opens.getTime()) || !isFinite(closes.getTime()) || closes <= opens) {
    throw new Error("Provide a valid ISO window, e.g. scheduleLecture('L01', '2026-09-14T09:50:00+07:00', '2026-09-14T10:50:00+07:00').");
  }
  lecture.code_hash = lectureCodeHash_(String(lectureId), code);
  lecture.opens_at = opens.toISOString();
  lecture.closes_at = closes.toISOString();
  lecture.status = "scheduled";
  writeRowObject_(sheet, HEADERS.lectures, row, lecture);
  SpreadsheetApp.flush();
  return "Lecture " + lectureId + " scheduled " + lecture.opens_at + " → " + lecture.closes_at +
    ". ACCESS CODE (email to the administrator; shown only once): " + code;
}

/** Convenience: open a lecture immediately for `minutes` (default 70). */
function openLectureNow(lectureId, minutes) {
  var now = new Date();
  var closes = new Date(now.getTime() + (minutes || 70) * 60000);
  return scheduleLecture(lectureId, now.toISOString(), closes.toISOString());
}

/** Close a lecture's window immediately; existing sessions continue. */
function closeLecture(lectureId) {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var row = findRowByValue_(sheet, HEADERS.lectures, "lecture_id", String(lectureId));
  if (row === -1) throw new Error("Unknown lecture: " + lectureId);
  var lecture = readRowObject_(sheet, HEADERS.lectures, row);
  lecture.closes_at = nowIso_();
  writeRowObject_(sheet, HEADERS.lectures, row, lecture);
  SpreadsheetApp.flush();
  return "Lecture " + lectureId + " closed to new sessions (participants already inside continue).";
}

/** Beginner-safe wrapper: open a provisioned lecture by its 1-based number. */
function openLectureByNumber(lectureNumber, minutes) {
  return openLectureNow(lectureIdFromNumber_(lectureNumber), minutes || 70);
}

/** Beginner-safe wrapper: close a provisioned lecture by its 1-based number. */
function closeLectureByNumber(lectureNumber) {
  return closeLecture(lectureIdFromNumber_(lectureNumber));
}

function lectureIdFromNumber_(lectureNumber) {
  var n = Number(lectureNumber);
  if (!isFinite(n) || Math.floor(n) !== n || n < 1) {
    throw new Error("Lecture number must be a positive integer.");
  }
  var id = "L" + ("00" + n).slice(-2);
  var sheet = researchSheet_(SHEETS.LECTURES);
  if (findRowByValue_(sheet, HEADERS.lectures, "lecture_id", id) === -1) {
    throw new Error("Lecture " + id + " was not provisioned. Check plannedGatewayLectures_().");
  }
  return id;
}

/**
 * Read-only classroom launch plan. It divides a lecture's planned
 * expected attendance into waves no larger than `maxWaveSize` (default
 * 25), reducing the initial simultaneous-request surge.
 */
function lectureLaunchWavePlan(lectureNumber, maxWaveSize) {
  var lectureId = lectureIdFromNumber_(lectureNumber);
  var sheet = researchSheet_(SHEETS.LECTURES);
  var row = findRowByValue_(sheet, HEADERS.lectures, "lecture_id", lectureId);
  var lecture = readRowObject_(sheet, HEADERS.lectures, row);
  var n = Number(lecture.expected_n || lecture.maximum_n);
  var limit = Number(maxWaveSize || 25);
  if (!isFinite(limit) || limit < 1 || Math.floor(limit) !== limit) {
    throw new Error("maxWaveSize must be a positive integer.");
  }
  var waves = Math.max(1, Math.ceil(n / limit));
  var base = Math.floor(n / waves);
  var extra = n % waves;
  var sizes = [];
  for (var i = 0; i < waves; i++) sizes.push(base + (i < extra ? 1 : 0));
  return lectureId + ": planned attendance=" + n + "; " + waves +
    " scanning waves; sizes=" + sizes.join(", ") +
    ". Separate waves by approximately 45–60 seconds.";
}

/**
 * Researcher-facing monitoring summary. It reports only operational
 * counts—never treatment, sequence, or participant choices—so it is safe
 * to consult remotely while the coauthor administers a lecture.
 */
function lectureProgressSummary() {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "No lectures provisioned.";
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.lectures.length).getValues();
  var idx = headerIndex_(SHEETS.LECTURES);
  var totalClaimed = 0;
  var lines = rows.map(function (r) {
    var claimed = Number(r[idx.claimed_count] || 0);
    var maximum = Number(r[idx.maximum_n] || 0);
    totalClaimed += claimed;
    return String(r[idx.lecture_id]) + ": " + claimed + "/" + maximum +
      " claimed; status=" + String(r[idx.status] || "unscheduled");
  });
  lines.push("TOTAL: " + totalClaimed + "/" + configGet_("maximum_total", "?") +
    " claimed (planned expected=" + configGet_("target_total", "?") + ").");
  return lines.join("\n");
}

/* ---- Collection state and release records (§11) ---- */

function releaseReadinessCheck_() {
  var problems = [];
  var base = selfCheck();
  if (base !== "Self-check passed.") {
    problems.push(base.replace(/^PROBLEMS:\n- /, "").replace(/\n- /g, "; "));
  }
  try { verifyDesignManifest_(); } catch (e) { problems.push(e.message); }

  // Ethics interlock. The participant-facing consent screen may be published
  // with provisional ethics-committee wording so the instrument can be built
  // and tested, but no real participant may ever meet that wording. Opening
  // collection therefore requires a coordinator to state explicitly that the
  // approved ethics text is in place (Queue Study -> "Confirm ethics wording
  // is final", or confirmEthicsWordingFinal() in the editor).
  if (!configTrue_("ethics_wording_final")) {
    problems.push("Ethics wording not confirmed final - run Queue Study > \"Confirm ethics wording is final\" " +
      "once the approved committee name, contact and approval reference are published on the site");
  }

  var sha = String(configGet_("github_commit_sha", ""));
  var deployment = String(configGet_("apps_script_deployment_id", ""));
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) problems.push("Git commit SHA not recorded");
  if (!deployment || /^PASTE_|REPLACE_/i.test(deployment)) problems.push("Apps Script deployment ID not recorded");

  // The server posts every acknowledgement receipt to PARENT_ORIGIN; if it
  // is not the exact deployed site origin, browsers silently drop the
  // receipt and every participant request times out with nothing logged.
  // Verify the two location properties are set and mutually consistent.
  var parentOrigin = String(propOptional_("PARENT_ORIGIN", ""));
  var studyBase = String(propOptional_("STUDY_BASE_URL", ""));
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(parentOrigin)) {
    problems.push("PARENT_ORIGIN must be the exact site origin, e.g. https://USERNAME.github.io (currently '" + parentOrigin + "')");
  } else if (studyBase.indexOf(parentOrigin + "/") !== 0) {
    problems.push("STUDY_BASE_URL ('" + studyBase + "') must begin with PARENT_ORIGIN ('" + parentOrigin +
      "') — check the GitHub username and repository in Script Properties");
  }

  var planned = Number(configGet_("planned_lectures", "0"));
  var lectureSheet = researchSheet_(SHEETS.LECTURES);
  var lectures = lectureSheet.getLastRow() - 1;

  // Gateway deployments have lecture and slot ledgers; token/slip
  // deployments legitimately do not. Reconcile lecture totals only when
  // gateway rows exist or the configuration declares a gateway plan.
  if (lectures > 0 || planned > 0) {
    if (!planned || lectures !== planned) {
      problems.push("planned_lectures=" + planned + " but provisioned=" + lectures);
    }

    var expected = Number(configGet_("target_total", "0"));
    var maximum = Number(configGet_("maximum_total", "0"));
    var sumExpected = 0, sumMaximum = 0, sumSlots = 0;
    if (lectures > 0) {
      var rows = lectureSheet.getRange(2, 1, lectures, HEADERS.lectures.length).getValues();
      var idx = headerIndex_(SHEETS.LECTURES);
      rows.forEach(function (r) {
        sumExpected += Number(r[idx.expected_n] || 0);
        sumMaximum += Number(r[idx.maximum_n] || 0);
        sumSlots += Number(r[idx.slot_count] || 0);
      });
    }
    if (!expected || expected !== sumExpected) {
      problems.push("target_total=" + expected + " but lecture expected_n sums to " + sumExpected);
    }
    if (!maximum || maximum !== sumMaximum) {
      problems.push("maximum_total=" + maximum + " but lecture maximum_n sums to " + sumMaximum);
    }
    if (sumMaximum > sumSlots) problems.push("lecture maximums exceed allocation slots");
    if (maxParticipants_() !== maximum) problems.push("MAX_PARTICIPANTS must equal maximum_total");
  } else if (maxParticipants_() < 1) {
    problems.push("MAX_PARTICIPANTS must be set for token/slip recruitment");
  }
  return problems;
}

/**
 * Record that the approved ethics wording is published on the participant
 * site. Required before openCollection() will run. Reversible: pass false
 * to clear it if the wording is edited again.
 */
function confirmEthicsWordingFinal(isFinal) {
  var value = (isFinal === false) ? "" : "TRUE";
  configSet_("ethics_wording_final", value);
  configSet_("ethics_confirmed_at", value ? nowIso_() : "");
  return value
    ? "Ethics wording confirmed final. Collection may now be opened once the other checks pass."
    : "Ethics confirmation cleared. Collection cannot be opened until it is confirmed again.";
}

function openCollection() {
  var problems = releaseReadinessCheck_();
  if (problems.length) {
    throw new Error("RELEASE_NOT_READY:\n- " + problems.join("\n- "));
  }
  props_().setProperty("COLLECTION_OPEN", "TRUE");
  configSet_("collection_open", "TRUE");
  configSet_("opened_at", nowIso_());
  return "Collection open.";
}

function closeCollection() {
  props_().setProperty("COLLECTION_OPEN", "FALSE");
  configSet_("collection_open", "FALSE");
  configSet_("closed_at", nowIso_());
  return "Collection closed (in-flight sessions may still finalize).";
}

function recordRelease(gitCommitSha, deploymentId) {
  var sha = String(gitCommitSha || "").trim();
  var deployment = String(deploymentId || "").trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error("Provide the deployed Git commit SHA.");
  if (!deployment || /^PASTE_|REPLACE_/i.test(deployment)) throw new Error("Provide the production Apps Script deployment ID.");
  configSet_("github_commit_sha", sha);
  configSet_("apps_script_deployment_id", deployment);
  return "Release recorded.";
}

/** Pre-launch verification of configuration and provisioning. */
function selfCheck() {
  var problems = [];
  PROPS_REQUIRED.forEach(function (key) {
    var value = props_().getProperty(key);
    if (!value || value.indexOf("PASTE_") === 0) problems.push("property " + key + " unset");
  });
  try {
    var research = researchBook_();
    Object.keys(HEADERS).forEach(function (name) {
      if (!research.getSheetByName(name)) problems.push("research tab missing: " + name);
    });
    var payment = paymentBook_();
    Object.keys(PAYMENT_HEADERS).forEach(function (name) {
      if (!payment.getSheetByName(name)) problems.push("payment tab missing: " + name);
    });
    var sequences = research.getSheetByName(SHEETS.SEQUENCES);
    if (sequences && sequences.getLastRow() < 2) problems.push("no sequences generated");
  } catch (e) {
    problems.push("workbook access failed: " + e.message);
  }
  var origin = propOptional_("PARENT_ORIGIN", "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) problems.push("PARENT_ORIGIN must be a bare https origin (no path)");
  var cap = Number(propOptional_("MAX_PARTICIPANTS", "0"));
  if (!isFinite(cap) || cap < 1 || Math.floor(cap) !== cap) {
    problems.push("MAX_PARTICIPANTS must be a positive integer set by provisioning");
  }
  return problems.length ? "PROBLEMS:\n- " + problems.join("\n- ") : "Self-check passed.";
}

/* ==========================================================================
   MODULE: Operations.gs
   ========================================================================== */
/**
 * Operations.gs — beginner-safe researcher control centre.
 *
 * This file deliberately keeps operational complexity behind two private
 * Google Sheets tabs:
 *
 *   CONTROL   — the only place the technical coordinator edits lecture
 *               dates and expected attendance;
 *   DASHBOARD — aggregate operational counts only.
 *
 * Recommended use: bind this Apps Script project to the private research
 * spreadsheet. After first-time setup, the Queue Study menu appears when
 * that spreadsheet is opened. No command line or Apps Script calls are
 * needed during lectures.
 */

var OPS = Object.freeze({
  CONTROL_SHEET: "CONTROL",
  DASHBOARD_SHEET: "DASHBOARD",
  DEFAULT_LECTURES: 11,
  DEFAULT_EXPECTED: 150,
  DEFAULT_RESERVE_PERCENT: 20,
  OPEN_MINUTES_BEFORE: 15,
  CLOSE_MINUTES_AFTER: 75,
  DASHBOARD_REFRESH_MINUTES: 5,
  MAINTENANCE_HANDLER: "BEGINNER_AUTOMATIC_MAINTENANCE"
});

var CONTROL_HEADERS = Object.freeze([
  "lecture_id",
  "lecture_start",
  "expected_students",
  "reserve_percent",
  "maximum_override",
  "provisioned_maximum",
  "new_entries_open",
  "new_entries_close",
  "lecture_code",
  "current_status",
  "started",
  "active",
  "completed",
  "technical_errors",
  "notes"
]);

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Queue Study")
      .addItem("1. First-time setup", "BEGINNER_FIRST_TIME_SETUP")
      .addItem("2. Preview lecture plan", "BEGINNER_PREVIEW_PLAN")
      .addItem("3. Provision study from CONTROL", "BEGINNER_PROVISION_STUDY")
      .addSeparator()
      .addItem("On-demand: set up self-service pool", "BEGINNER_PROVISION_ONDEMAND_POOL")
      .addItem("On-demand: show classroom host link", "BEGINNER_SHOW_HOST_LINK")
      .addSeparator()
      .addItem("Apply lecture dates and generate codes", "BEGINNER_SYNC_LECTURE_SCHEDULES")
      .addItem("Refresh dashboard", "BEGINNER_REFRESH_DASHBOARD")
      .addItem("Install automatic refresh", "BEGINNER_INSTALL_AUTOMATION")
      .addSeparator()
      .addItem("Show frozen precommitment hashes", "BEGINNER_SHOW_SEQUENCE_HASH")
      .addItem("Record Git and Apps Script release", "BEGINNER_RECORD_RELEASE")
      .addItem("Confirm ethics wording is final", "BEGINNER_CONFIRM_ETHICS")
      .addItem("Run release-readiness check", "BEGINNER_RUN_READINESS_CHECK")
      .addItem("Open collection", "BEGINNER_OPEN_COLLECTION")
      .addItem("Close collection", "BEGINNER_CLOSE_COLLECTION")
      .addSeparator()
      .addItem("Show backend tabs", "BEGINNER_SHOW_BACKEND_TABS")
      .addItem("Hide backend tabs", "BEGINNER_HIDE_BACKEND_TABS")
      .addToUi();
  } catch (e) {
    // Web-app and trigger executions do not have a spreadsheet UI.
  }
}

function opsNotify_(title, message) {
  try {
    SpreadsheetApp.getUi().alert(String(title), String(message), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    console.log(title + ": " + message);
  }
  return String(message);
}

function opsConfirm_(title, message) {
  try {
    var ui = SpreadsheetApp.getUi();
    return ui.alert(String(title), String(message), ui.ButtonSet.YES_NO) === ui.Button.YES;
  } catch (e) {
    // Safety first: irreversible provisioning requires an interactive UI.
    return false;
  }
}

function activeResearchBook_() {
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  return active || researchBook_();
}

function ensureOperationsSheet_(book, name, headers) {
  var sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (headers && headers.length) {
    var current = sheet.getLastRow() >= 1
      ? sheet.getRange(1, 1, 1, headers.length).getValues()[0] : [];
    var matches = headers.every(function (h, i) { return current[i] === h; });
    if (!matches) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#dbeafe")
      .setWrap(true);
  }
  return sheet;
}

function capacityFromPlanning_(expected, reservePercent, maximumOverride) {
  var n = Number(expected);
  var reserve = (reservePercent === "" || reservePercent === null || reservePercent === undefined)
    ? OPS.DEFAULT_RESERVE_PERCENT : Number(reservePercent);
  var override = (maximumOverride === "" || maximumOverride === null || maximumOverride === undefined)
    ? null : Number(maximumOverride);

  if (!isFinite(n) || n < 1 || Math.floor(n) !== n) {
    throw new Error("Expected students must be a positive whole number.");
  }
  if (!isFinite(reserve) || reserve < 0 || reserve > 100) {
    throw new Error("Reserve percent must be between 0 and 100.");
  }
  if (override !== null && (!isFinite(override) || override < n || Math.floor(override) !== override)) {
    throw new Error("Maximum override must be a whole number at least as large as expected students.");
  }

  var raw = override !== null ? override : Math.ceil(n * (1 + reserve / 100));
  return Math.ceil(raw / 3) * 3;
}

function setupOperationsSheets_() {
  var book = researchBook_();
  var controlExisted = !!book.getSheetByName(OPS.CONTROL_SHEET);
  var dashboardExisted = !!book.getSheetByName(OPS.DASHBOARD_SHEET);
  var control = ensureOperationsSheet_(book, OPS.CONTROL_SHEET, CONTROL_HEADERS);
  var dashboard = ensureOperationsSheet_(book, OPS.DASHBOARD_SHEET, []);
  var alreadyFormatted = configTrue_("operations_sheets_ready");

  if (control.getLastRow() < 2) {
    var rows = [];
    for (var i = 1; i <= OPS.DEFAULT_LECTURES; i++) {
      rows.push([
        "L" + ("00" + i).slice(-2),
        "",
        OPS.DEFAULT_EXPECTED,
        OPS.DEFAULT_RESERVE_PERCENT,
        "",
        capacityFromPlanning_(OPS.DEFAULT_EXPECTED, OPS.DEFAULT_RESERVE_PERCENT, ""),
        "", "", "",
        "PLANNING",
        0, 0, 0, 0,
        ""
      ]);
    }
    control.getRange(2, 1, rows.length, CONTROL_HEADERS.length).setValues(rows);
  }

  if (!alreadyFormatted || !controlExisted || !dashboardExisted) {
  // The coordinator edits only B–E and O. Script-managed columns are grey.
  var maxRows = Math.max(50, control.getMaxRows() - 1);
  control.getRange(2, 2, maxRows, 4).setBackground("#fff7d6");
  control.getRange(2, 15, maxRows, 1).setBackground("#fff7d6");
  control.getRange(2, 6, maxRows, 9).setBackground("#f1f5f9");
  control.getRange(2, 2, maxRows, 1).setNumberFormat("yyyy-mm-dd hh:mm");
  control.getRange(2, 7, maxRows, 2).setNumberFormat("yyyy-mm-dd hh:mm");
  control.getRange(2, 9, maxRows, 1).setNumberFormat("000000");
  control.setColumnWidth(1, 90);
  control.setColumnWidth(2, 150);
  control.setColumnWidth(3, 120);
  control.setColumnWidth(4, 100);
  control.setColumnWidth(5, 125);
  control.setColumnWidth(6, 135);
  control.setColumnWidth(7, 150);
  control.setColumnWidth(8, 150);
  control.setColumnWidth(9, 100);
  control.setColumnWidth(10, 130);
  control.setColumnWidth(15, 240);

  try {
    control.getRange("B1:E1").setNote(
      "EDIT THESE COLUMNS ONLY. Enter the lecture start, expected number of eligible consenting students, " +
      "reserve percentage (20% is the default), and an optional maximum override."
    );
    control.getRange("F1:N1").setNote("Calculated or updated automatically. Do not edit during data collection.");
  } catch (e) {}

  if (dashboard.getLastRow() < 1) {
    dashboard.getRange(1, 1).setValue("Queue Study operational dashboard");
  }
  try {
    book.setActiveSheet(control);
    book.moveActiveSheet(1);
    book.setActiveSheet(dashboard);
    book.moveActiveSheet(2);
    book.setActiveSheet(control);
  } catch (e) {}
  configSet_("operations_sheets_ready", "TRUE");
  }

  return "CONTROL and DASHBOARD prepared.";
}

function controlIndex_() {
  var out = {};
  CONTROL_HEADERS.forEach(function (h, i) { out[h] = i; });
  return out;
}

function parseLectureStart_(value) {
  if (value instanceof Date && isFinite(value.getTime())) return new Date(value.getTime());
  if (value === "" || value === null || value === undefined) return null;
  var parsed = new Date(String(value));
  return isFinite(parsed.getTime()) ? parsed : null;
}

function readControlPlan_() {
  var control = researchBook_().getSheetByName(OPS.CONTROL_SHEET);
  if (!control) throw new Error("CONTROL sheet missing. Run Queue Study → First-time setup.");
  var lastRow = control.getLastRow();
  if (lastRow < 2) throw new Error("CONTROL has no lecture rows.");

  var values = control.getRange(2, 1, lastRow - 1, CONTROL_HEADERS.length).getValues();
  var idx = controlIndex_();
  var ids = {};
  var rows = [];

  values.forEach(function (r, offset) {
    var id = String(r[idx.lecture_id] || "").trim();
    var expectedCell = r[idx.expected_students];
    if (!id && (expectedCell === "" || expectedCell === null || expectedCell === undefined)) return;
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) {
      throw new Error("CONTROL row " + (offset + 2) + ": invalid lecture_id.");
    }
    if (ids[id]) throw new Error("CONTROL contains duplicate lecture_id " + id + ".");
    ids[id] = true;

    var expected = Number(expectedCell);
    var reserve = (r[idx.reserve_percent] === "" ? OPS.DEFAULT_RESERVE_PERCENT : Number(r[idx.reserve_percent]));
    var override = r[idx.maximum_override];
    var maximum = capacityFromPlanning_(expected, reserve, override);
    var start = parseLectureStart_(r[idx.lecture_start]);
    if (r[idx.lecture_start] && !start) {
      throw new Error("CONTROL row " + (offset + 2) + ": lecture_start is not a valid date and time.");
    }

    rows.push({
      row: offset + 2,
      lecture_id: id,
      expected_n: expected,
      reserve_percent: reserve,
      maximum_n: maximum,
      lecture_start: start,
      lecture_code: String(r[idx.lecture_code] || "").trim()
    });
  });

  if (!rows.length) throw new Error("CONTROL contains no usable lecture rows.");
  return rows;
}

function controlSpecs_() {
  return readControlPlan_().map(function (r) {
    return { lecture_id: r.lecture_id, expected_n: r.expected_n, maximum_n: r.maximum_n };
  });
}

function controlCapacityHash_() {
  var canonical = controlSpecs_().map(function (s) {
    return [s.lecture_id, s.expected_n, s.maximum_n].join("|");
  }).join("\n");
  return sha256Hex_(canonical);
}

function updateControlCalculatedCells_(planRows) {
  var sheet = researchBook_().getSheetByName(OPS.CONTROL_SHEET);
  var idx = controlIndex_();
  planRows.forEach(function (r) {
    sheet.getRange(r.row, idx.provisioned_maximum + 1).setValue(r.maximum_n);
  });
}

function planSummaryText_(specs) {
  var plan = gatewayPlanSummary_(specs, 0);
  var lines = [
    "LECTURE PLAN — NO RANDOMISATION DATA CHANGED",
    "Lectures: " + plan.lecture_count,
    "Expected participants: " + plan.expected_total,
    "Provisioned maximum: " + plan.maximum_total,
    "Approximate expected participants per arm: " + plan.expected_per_arm,
    "Matched blocks: " + plan.lecture_blocks,
    "Allocation slots: " + plan.allocation_slots,
    "Private sequence rows: " + plan.sequence_rows,
    ""
  ];
  plan.specs.forEach(function (s) {
    lines.push(s.lecture_id + ": expected " + s.expected_n +
      ", maximum " + s.maximum_n + ", blocks " + s.blocks);
  });
  return lines.join("\n");
}

/**
 * First-time browser-only setup. Recommended workflow:
 * 1. Create one blank private Google Sheet.
 * 2. Open Extensions → Apps Script and paste the supplied beginner bundle.
 * 3. Run this function once and reload the Sheet.
 */
function BEGINNER_FIRST_TIME_SETUP() {
  setupScriptPropertiesTemplate();
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("Open this Apps Script project from the private research Google Sheet.");

  var props = props_();
  var existingResearch = props.getProperty("RESEARCH_SPREADSHEET_ID");
  if (!existingResearch || /^PASTE_/.test(existingResearch)) {
    props.setProperty("RESEARCH_SPREADSHEET_ID", active.getId());
  } else if (existingResearch !== active.getId()) {
    throw new Error("This project is linked to a different research workbook. Open the correct workbook.");
  }

  var paymentId = props.getProperty("PAYMENT_SPREADSHEET_ID");
  if (!paymentId || /^PASTE_/.test(paymentId)) {
    var payment = SpreadsheetApp.create("Queue Study Payment Ledger — Production");
    props.setProperty("PAYMENT_SPREADSHEET_ID", payment.getId());
    paymentId = payment.getId();
  }

  try {
    props.setProperty("STUDY_TIME_ZONE", active.getSpreadsheetTimeZone());
  } catch (e) {}
  if (!props.getProperty("CONTROL_OPEN_BEFORE_MINUTES")) {
    props.setProperty("CONTROL_OPEN_BEFORE_MINUTES", String(OPS.OPEN_MINUTES_BEFORE));
  }
  if (!props.getProperty("CONTROL_CLOSE_AFTER_MINUTES")) {
    props.setProperty("CONTROL_CLOSE_AFTER_MINUTES", String(OPS.CLOSE_MINUTES_AFTER));
  }

  setupWorkbooks();
  setupOperationsSheets_();
  BEGINNER_HIDE_BACKEND_TABS();
  BEGINNER_REFRESH_DASHBOARD();
  // Install the recurring maintenance trigger last, after every sheet
  // mutation is done, so the five-minute handler can never fire mid-setup
  // and contend with the setup run for the same tabs.
  BEGINNER_INSTALL_AUTOMATION();
  onOpen();

  var message = "Setup completed. Edit only the yellow cells in CONTROL. " +
    "The example contains 11 lectures and 150 expected students per lecture; change, add, or remove rows before provisioning.\n\n" +
    "Research workbook: " + active.getUrl() + "\n" +
    "Payment workbook: https://docs.google.com/spreadsheets/d/" + paymentId + "/edit";
  return opsNotify_("Queue Study setup completed", message);
}

function BEGINNER_PREVIEW_PLAN() {
  setupOperationsSheets_();
  var rows = readControlPlan_();
  updateControlCalculatedCells_(rows);
  var text = planSummaryText_(rows.map(function (r) {
    return { lecture_id: r.lecture_id, expected_n: r.expected_n, maximum_n: r.maximum_n };
  }));
  writePlanPreviewToDashboard_(text);
  return opsNotify_("Lecture-plan preview", text);
}

function BEGINNER_PROVISION_STUDY() {
  setupOperationsSheets_();
  var rows = readControlPlan_();
  updateControlCalculatedCells_(rows);
  var specs = rows.map(function (r) {
    return { lecture_id: r.lecture_id, expected_n: r.expected_n, maximum_n: r.maximum_n };
  });
  var summary = planSummaryText_(specs);
  var warning = summary + "\n\nProvisioning freezes the randomisation blocks and private sequences. " +
    "After this point you may change lecture dates and expected attendance, but you cannot add lectures or increase a lecture's provisioned maximum without creating a fresh production environment.\n\nProceed?";
  if (!opsConfirm_("Provision the production study?", warning)) return "Provisioning cancelled.";

  var report = provisionStudyGateway(specs, 0);
  configSet_("control_capacity_hash", controlCapacityHash_());
  syncLectureSchedulesFromControl_(true);
  BEGINNER_INSTALL_AUTOMATION();
  BEGINNER_HIDE_BACKEND_TABS();
  BEGINNER_REFRESH_DASHBOARD();
  return opsNotify_("Provisioning completed", report);
}

/**
 * On-demand (self-service) provisioning from the beginner menu. Asks for
 * the total number of participants across the whole study, freezes one
 * pool sized to that number plus a reserve, and issues the classroom host
 * link. After this the coauthor runs every class herself with no plan.
 */
function BEGINNER_PROVISION_ONDEMAND_POOL() {
  setupOperationsSheets_();
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {
    throw new Error("Run this from the Queue Study menu in the Sheet.");
  }
  if (researchSheet_(SHEETS.LECTURES).getLastRow() > 1) {
    return opsNotify_("Already provisioned",
      "This study is already frozen. To change the pool size you must create a fresh production environment.");
  }
  var ans = ui.prompt("Set up on-demand pool",
    "About how many participants in total across ALL classes?\n\n" +
    "The pool is frozen once and cannot be enlarged later, so enter a generous number " +
    "(your expected total plus ~30%). Example: for a 240-participant target, enter 330.",
    ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK) return "Cancelled.";
  var n = parseInt(String(ans.getResponseText()).replace(/[^0-9]/g, ""), 10);
  if (!isFinite(n) || n < 3) return opsNotify_("Invalid number", "Please enter a whole number of at least 3.");
  if (!opsConfirm_("Freeze the on-demand pool?",
    "This will freeze randomisation for " + (Math.ceil(n / 3) * 3) + " places and cannot be enlarged later. Proceed?")) {
    return "Cancelled.";
  }
  var report = provisionStudyPool(n, 0);
  BEGINNER_INSTALL_AUTOMATION();
  BEGINNER_HIDE_BACKEND_TABS();
  BEGINNER_REFRESH_DASHBOARD();
  var link = hostControlLink();
  return opsNotify_("On-demand pool ready",
    report + "\n\nCLASSROOM HOST LINK (email this to your coauthor once; it is shown only once):\n" + link);
}

function BEGINNER_SHOW_HOST_LINK() {
  var link = hostControlLink();
  return opsNotify_("Classroom host link",
    link + "\n\nEmail this to your coauthor. She opens it on her laptop, taps \"Open a session\" in any class, " +
    "and projects the code it shows. If the link was already shown once and you no longer have it, " +
    "run resetHostKey() (Apps Script editor) to issue a new one.");
}

function provisionedLecturesMap_() {
  var sheet = researchSheet_(SHEETS.LECTURES);
  var last = sheet.getLastRow();
  var map = {};
  if (last < 2) return map;
  var rows = sheet.getRange(2, 1, last - 1, HEADERS.lectures.length).getValues();
  rows.forEach(function (r, i) {
    var obj = rowObjectFromValues_(HEADERS.lectures, r, i + 2);
    map[String(obj.lecture_id)] = obj;
  });
  return map;
}

function scheduleHashFromControl_() {
  var canonical = readControlPlan_().map(function (r) {
    return [r.lecture_id, r.lecture_start ? r.lecture_start.toISOString() : "", r.lecture_code].join("|");
  }).join("\n");
  return sha256Hex_(canonical);
}

/** On-demand mode is active once the single frozen POOL exists. */
function isOnDemandMode_() {
  var sheet = researchBook_().getSheetByName(SHEETS.LECTURES);
  if (!sheet || sheet.getLastRow() < 2) return false;
  return findRowByValue_(sheet, HEADERS.lectures, "lecture_id", "POOL") !== -1;
}

function syncLectureSchedulesFromControl_(force) {
  if (isOnDemandMode_()) {
    return "On-demand mode: your coauthor opens and closes sessions herself; there are no lecture schedules to sync.";
  }
  var rows = readControlPlan_();
  var provisioned = provisionedLecturesMap_();
  if (!Object.keys(provisioned).length) return "Study not provisioned yet; no schedules applied.";

  var control = researchBook_().getSheetByName(OPS.CONTROL_SHEET);
  var idx = controlIndex_();
  var before = Number(propOptional_("CONTROL_OPEN_BEFORE_MINUTES", String(OPS.OPEN_MINUTES_BEFORE)));
  var after = Number(propOptional_("CONTROL_CLOSE_AFTER_MINUTES", String(OPS.CLOSE_MINUTES_AFTER)));
  if (!isFinite(before) || !isFinite(after)) {
    throw new Error("Window minutes are misconfigured (CONTROL_OPEN_BEFORE_MINUTES / CONTROL_CLOSE_AFTER_MINUTES).");
  }
  var currentHash = scheduleHashFromControl_();
  if (!force && currentHash === String(configGet_("control_schedule_hash", ""))) {
    return "Lecture schedule unchanged.";
  }

  var controlIds = {};
  rows.forEach(function (r) { controlIds[r.lecture_id] = true; });
  Object.keys(provisioned).forEach(function (id) {
    if (!controlIds[id]) {
      throw new Error("CONTROL no longer contains provisioned lecture " + id + ". Restore that row; unused lectures may simply remain without a date.");
    }
  });

  // Lecture rows are shared with the live claim path, which mutates
  // claimed_count and next_claim_order under the script lock. Take the
  // same lock for this read-modify-write sweep so a schedule edit during
  // a scanning wave can never write back a stale claim counter. If the
  // lock is contended, defer: the five-minute maintenance trigger (or a
  // manual re-run) retries once the wave subsides.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return "Lecture schedules not applied: the server is busy with participant traffic. Retry in a few minutes.";
  }
  try {
  // Re-read the provisioned rows under the lock so claim counters and
  // pointers written by concurrent claims are current.
  provisioned = provisionedLecturesMap_();

  var messages = [];
  rows.forEach(function (r) {
    var lecture = provisioned[r.lecture_id];
    if (!lecture) {
      throw new Error("Lecture " + r.lecture_id + " was added after provisioning. Use a fresh production environment to add lectures.");
    }
    if (r.maximum_n > Number(lecture.maximum_n)) {
      throw new Error(r.lecture_id + " now requires maximum " + r.maximum_n +
        " but only " + lecture.maximum_n + " places were provisioned. Do not launch; create a fresh environment or reduce the plan.");
    }

    // Expected attendance may be updated after provisioning for wave planning.
    lecture.expected_n = r.expected_n;
    saveLecture_(lecture);
    control.getRange(r.row, idx.provisioned_maximum + 1).setValue(Number(lecture.maximum_n));

    if (!r.lecture_start) {
      control.getRange(r.row, idx.current_status + 1).setValue("DATE NEEDED");
      return;
    }

    var rawCode = r.lecture_code;
    if (!/^\d{6}$/.test(rawCode)) rawCode = freshLectureCode_(r.lecture_id);
    var opens = new Date(r.lecture_start.getTime() - before * 60000);
    var closes = new Date(r.lecture_start.getTime() + after * 60000);
    scheduleLecture(r.lecture_id, opens.toISOString(), closes.toISOString(), rawCode);

    control.getRange(r.row, idx.new_entries_open + 1).setValue(opens);
    control.getRange(r.row, idx.new_entries_close + 1).setValue(closes);
    control.getRange(r.row, idx.lecture_code + 1).setValue(rawCode);
    messages.push(r.lecture_id + " scheduled; code " + rawCode);
  });

  configSet_("control_schedule_hash", scheduleHashFromControl_());
  SpreadsheetApp.flush();
  return messages.length ? messages.join("\n") : "No lecture dates entered yet.";
  } finally {
    lock.releaseLock();
  }
}

function BEGINNER_SYNC_LECTURE_SCHEDULES() {
  var message = syncLectureSchedulesFromControl_(true);
  BEGINNER_REFRESH_DASHBOARD();
  return opsNotify_("Lecture schedules", message);
}

function currentOperationalStatus_(lecture, start, collectionOpen) {
  if (!lecture) return "NOT PROVISIONED";
  if (!start && !lecture.opens_at) return "DATE NEEDED";
  if (!collectionOpen) return "COLLECTION CLOSED";
  if (Number(lecture.claimed_count || 0) >= Number(lecture.maximum_n || 0)) return "FULL";
  var now = Date.now();
  var opens = lecture.opens_at ? new Date(String(lecture.opens_at)).getTime() : NaN;
  var closes = lecture.closes_at ? new Date(String(lecture.closes_at)).getTime() : NaN;
  if (!isFinite(opens) || !isFinite(closes)) return "DATE NEEDED";
  if (now < opens) return "SCHEDULED";
  if (now <= closes) return "OPEN";
  return "CLOSED";
}

function sessionOperationalCounts_() {
  var sessionSheet = researchSheet_(SHEETS.SESSIONS);
  var last = sessionSheet.getLastRow();
  var counts = {};
  var sessionLecture = {};
  if (last >= 2) {
    var rows = sessionSheet.getRange(2, 1, last - 1, HEADERS.sessions.length).getValues();
    var idx = headerIndex_(SHEETS.SESSIONS);
    rows.forEach(function (r) {
      var lecture = String(r[idx.lecture_id] || "");
      if (!lecture) return;
      var id = String(r[idx.session_id] || "");
      var status = String(r[idx.status] || "");
      sessionLecture[id] = lecture;
      if (!counts[lecture]) counts[lecture] = { started: 0, completed: 0, withdrawn: 0, errors: 0 };
      counts[lecture].started += 1;
      if (status === "completed") counts[lecture].completed += 1;
      if (status === "withdrawn") counts[lecture].withdrawn += 1;
    });
  }

  var errorSheet = researchSheet_(SHEETS.ERRORS);
  var eLast = errorSheet.getLastRow();
  if (eLast >= 2) {
    var errorRows = errorSheet.getRange(2, 1, eLast - 1, HEADERS.errors.length).getValues();
    var eIdx = headerIndex_(SHEETS.ERRORS);
    errorRows.forEach(function (r) {
      var lecture = sessionLecture[String(r[eIdx.session_id] || "")];
      if (lecture && counts[lecture]) counts[lecture].errors += 1;
    });
  }
  return counts;
}

function writePlanPreviewToDashboard_(text) {
  var sheet = researchBook_().getSheetByName(OPS.DASHBOARD_SHEET) ||
    ensureOperationsSheet_(researchBook_(), OPS.DASHBOARD_SHEET, []);
  sheet.clearContents();
  sheet.getRange(1, 1).setValue("Queue Study plan preview").setFontWeight("bold").setFontSize(16);
  var lines = String(text).split("\n");
  if (lines.length) sheet.getRange(3, 1, lines.length, 1).setValues(lines.map(function (x) { return [x]; }));
  sheet.setColumnWidth(1, 520);
}

function BEGINNER_REFRESH_DASHBOARD() {
  setupOperationsSheets_();
  if (isOnDemandMode_()) return refreshOnDemandDashboard_();
  var book = researchBook_();
  var dashboard = book.getSheetByName(OPS.DASHBOARD_SHEET);
  var control = book.getSheetByName(OPS.CONTROL_SHEET);
  var plan = readControlPlan_();
  var lectures = provisionedLecturesMap_();
  var counts = sessionOperationalCounts_();
  var cIdx = controlIndex_();
  var collection = propOptional_("COLLECTION_OPEN", "FALSE") === "TRUE";

  var output = [[
    "lecture_id", "lecture_start", "expected", "provisioned_maximum",
    "lecture_code", "status", "started", "active", "completed", "technical_errors"
  ]];
  var totals = { expected: 0, maximum: 0, started: 0, active: 0, completed: 0, errors: 0 };

  plan.forEach(function (r) {
    var lecture = lectures[r.lecture_id] || null;
    var count = counts[r.lecture_id] || { started: 0, completed: 0, withdrawn: 0, errors: 0 };
    var active = Math.max(0, count.started - count.completed - count.withdrawn);
    var maximum = lecture ? Number(lecture.maximum_n) : r.maximum_n;
    var status = currentOperationalStatus_(lecture, r.lecture_start, collection);
    output.push([
      r.lecture_id,
      r.lecture_start || "",
      r.expected_n,
      maximum,
      r.lecture_code,
      status,
      count.started,
      active,
      count.completed,
      count.errors
    ]);
    totals.expected += r.expected_n;
    totals.maximum += maximum;
    totals.started += count.started;
    totals.active += active;
    totals.completed += count.completed;
    totals.errors += count.errors;

    // The five script-managed status columns (current_status..technical_errors)
    // are contiguous (CONTROL columns 10-14). Write them in a single setValues
    // per row rather than five setValue round-trips: on a full lecture list
    // this cuts the write count fivefold and keeps first-time setup and the
    // recurring refresh comfortably under the Apps Script 6-minute limit.
    control.getRange(r.row, cIdx.current_status + 1, 1, 5)
      .setValues([[status, count.started, active, count.completed, count.errors]]);
  });
  output.push(["TOTAL", "", totals.expected, totals.maximum, "", collection ? "OPEN" : "CLOSED",
    totals.started, totals.active, totals.completed, totals.errors]);

  dashboard.clearContents();
  dashboard.getRange(1, 1).setValue("Queue Study operational dashboard")
    .setFontWeight("bold").setFontSize(16);
  dashboard.getRange(2, 1).setValue("Last updated");
  dashboard.getRange(2, 2).setValue(new Date()).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  dashboard.getRange(3, 1).setValue("Collection");
  dashboard.getRange(3, 2).setValue(collection ? "OPEN" : "CLOSED")
    .setFontWeight("bold")
    .setBackground(collection ? "#dcfce7" : "#fee2e2");
  dashboard.getRange(5, 1, output.length, output[0].length).setValues(output);
  dashboard.getRange(5, 1, 1, output[0].length).setFontWeight("bold").setBackground("#dbeafe");
  dashboard.getRange(6, 2, Math.max(1, output.length - 1), 1).setNumberFormat("yyyy-mm-dd hh:mm");
  dashboard.setFrozenRows(5);
  // Explicit column widths instead of autoResizeColumns(): auto-resize is a
  // slow per-column content measurement that, run on every refresh, was the
  // largest contributor to first-time setup approaching the Apps Script
  // 6-minute execution limit. Fixed widths render the same and cost little.
  dashboard.setColumnWidth(1, 110);
  dashboard.setColumnWidth(2, 150);
  dashboard.setColumnWidth(4, 150);
  dashboard.setColumnWidth(5, 110);
  dashboard.setColumnWidth(6, 140);
  SpreadsheetApp.flush();
  return "Dashboard refreshed.";
}

/**
 * On-demand dashboard: the live session (open/closed, current code,
 * joined-this-session, auto-expiry), the pool's used/remaining places,
 * and a per-session-batch table of starts and completions. No treatment
 * or hidden state appears. Read-only; safe to refresh during live claims.
 */
function refreshOnDemandDashboard_() {
  var book = researchBook_();
  var dashboard = book.getSheetByName(OPS.DASHBOARD_SHEET) ||
    ensureOperationsSheet_(book, OPS.DASHBOARD_SHEET, []);
  var pool = poolLecture_();
  var live = liveSession_();
  var collection = propOptional_("COLLECTION_OPEN", "FALSE") === "TRUE";
  var counts = sessionOperationalCounts_();      // grouped by session batch label

  var liveOpen = live ? live.open : false;
  if (liveOpen && live.expires_at) {
    var exp = new Date(live.expires_at).getTime();
    if (isFinite(exp) && Date.now() > exp) liveOpen = false;
  }

  dashboard.clearContents();
  dashboard.getRange(1, 1).setValue("Queue Study — on-demand dashboard").setFontWeight("bold").setFontSize(16);
  dashboard.getRange(2, 1).setValue("Last updated");
  dashboard.getRange(2, 2).setValue(new Date()).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  dashboard.getRange(3, 1).setValue("Collection");
  dashboard.getRange(3, 2).setValue(collection ? "OPEN" : "CLOSED")
    .setFontWeight("bold").setBackground(collection ? "#dcfce7" : "#fee2e2");
  dashboard.getRange(4, 1).setValue("Live session");
  dashboard.getRange(4, 2).setValue(liveOpen ? "OPEN — code " + (live ? live.code : "") : "closed")
    .setFontWeight("bold").setBackground(liveOpen ? "#dcfce7" : "#f1f5f9");
  dashboard.getRange(5, 1).setValue("Current batch");
  dashboard.getRange(5, 2).setValue(live ? live.batch : "");
  dashboard.getRange(6, 1).setValue("Joined this session");
  dashboard.getRange(6, 2).setValue(Number(configGet_("live_claimed", "0")));
  dashboard.getRange(7, 1).setValue("Pool places used / total");
  dashboard.getRange(7, 2).setValue(pool ? (Number(pool.claimed_count) + " / " + Number(pool.maximum_n)) : "—");
  dashboard.getRange(8, 1).setValue("Places remaining");
  dashboard.getRange(8, 2).setValue(pool ? poolPlacesRemaining_(pool) : 0);

  var header = ["session_batch", "started", "active", "completed", "technical_errors"];
  var rows = [header];
  var batches = Object.keys(counts).sort();
  var tot = { started: 0, active: 0, completed: 0, errors: 0 };
  batches.forEach(function (b) {
    var c = counts[b];
    var active = Math.max(0, c.started - c.completed - c.withdrawn);
    rows.push([b, c.started, active, c.completed, c.errors]);
    tot.started += c.started; tot.active += active; tot.completed += c.completed; tot.errors += c.errors;
  });
  rows.push(["TOTAL", tot.started, tot.active, tot.completed, tot.errors]);
  dashboard.getRange(10, 1, rows.length, header.length).setValues(rows);
  dashboard.getRange(10, 1, 1, header.length).setFontWeight("bold").setBackground("#dbeafe");
  dashboard.setFrozenRows(10);
  dashboard.setColumnWidth(1, 260);
  SpreadsheetApp.flush();
  return "On-demand dashboard refreshed.";
}

function BEGINNER_AUTOMATIC_MAINTENANCE() {
  try {
    if (researchSheet_(SHEETS.LECTURES).getLastRow() > 1) {
      syncLectureSchedulesFromControl_(false);
    }
    BEGINNER_REFRESH_DASHBOARD();
    configSet_("last_operational_error", "");
  } catch (e) {
    try { configSet_("last_operational_error", nowIso_() + " " + e.message); } catch (ignored) {}
    console.log("Operational maintenance failed: " + e.stack);
  }
}

function BEGINNER_INSTALL_AUTOMATION() {
  try {
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === OPS.MAINTENANCE_HANDLER) ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger(OPS.MAINTENANCE_HANDLER)
      .timeBased()
      .everyMinutes(OPS.DASHBOARD_REFRESH_MINUTES)
      .create();
    return "Automatic schedule synchronization and dashboard refresh installed (every " +
      OPS.DASHBOARD_REFRESH_MINUTES + " minutes).";
  } catch (e) {
    return "Automation could not be installed automatically: " + e.message;
  }
}

function BEGINNER_REMOVE_AUTOMATION() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === OPS.MAINTENANCE_HANDLER) {
      ScriptApp.deleteTrigger(trigger); removed += 1;
    }
  });
  return "Removed " + removed + " Queue Study maintenance trigger(s).";
}


function BEGINNER_SHOW_SEQUENCE_HASH() {
  var d = verifyDesignManifest_();
  var message = "Paste all three commitments into queue-study/docs/sequence-precommitment.md before the public release.\n\n" +
    "sequence_version: " + prop_("SEQUENCE_VERSION") + "\n" +
    "generator_version: " + GENERATOR_VERSION + "\n\n" +
    "1) Stochastic-sequence table\n   rows: " + d.sequence.rows + "\n   SHA-256: " + d.sequence.hash + "\n\n" +
    "2) Treatment-allocation table (" + d.allocation.kind + ")\n   rows: " + d.allocation.rows +
    "\n   SHA-256: " + d.allocation.hash + "\n\n" +
    "3) Combined design manifest\n   SHA-256: " + d.manifest.hash;
  return opsNotify_("Frozen preregistration commitments", message);
}

function BEGINNER_RECORD_RELEASE() {
  var ui = SpreadsheetApp.getUi();
  var git = ui.prompt("Record Git release", "Paste the full Git commit SHA deployed to GitHub Pages.", ui.ButtonSet.OK_CANCEL);
  if (git.getSelectedButton() !== ui.Button.OK) return "Cancelled.";
  var deployment = ui.prompt("Record Apps Script release", "Paste the production Apps Script deployment ID (not the full URL).", ui.ButtonSet.OK_CANCEL);
  if (deployment.getSelectedButton() !== ui.Button.OK) return "Cancelled.";
  var message = recordRelease(git.getResponseText().trim(), deployment.getResponseText().trim());
  return opsNotify_("Release recorded", message);
}

function BEGINNER_CONFIRM_ETHICS() {
  if (!opsConfirm_("Confirm ethics wording is final?",
    "Confirm ONLY if the participant site now shows the approved ethics-committee name, " +
    "contact and approval reference. Data collection cannot open until you confirm this.\n\nProceed?")) {
    return "Cancelled.";
  }
  return opsNotify_("Ethics wording", confirmEthicsWordingFinal(true));
}

function BEGINNER_RUN_READINESS_CHECK() {
  var problems = releaseReadinessCheck_();
  var message = problems.length
    ? "NOT READY:\n- " + problems.join("\n- ")
    : "Backend release-readiness check passed.";
  return opsNotify_("Release readiness", message);
}

function BEGINNER_OPEN_COLLECTION() {
  if (!opsConfirm_("Open data collection?", "Open collection only after the public release check and live technical pilot have passed. Continue?")) return "Opening cancelled.";
  var message = openCollection();
  BEGINNER_REFRESH_DASHBOARD();
  return opsNotify_("Collection", message);
}

function BEGINNER_CLOSE_COLLECTION() {
  if (!opsConfirm_("Close data collection?", "New participants will be refused. Participants already inside may finish. Continue?")) return "Closing cancelled.";
  var message = closeCollection();
  BEGINNER_REFRESH_DASHBOARD();
  return opsNotify_("Collection", message);
}

function BEGINNER_HIDE_BACKEND_TABS() {
  var book = researchBook_();
  var keep = {};
  keep[OPS.CONTROL_SHEET] = true;
  keep[OPS.DASHBOARD_SHEET] = true;
  book.getSheets().forEach(function (sheet) {
    if (!keep[sheet.getName()]) {
      try { sheet.hideSheet(); } catch (e) {}
    }
  });
  return "Backend tabs hidden. Data remain available through Queue Study → Show backend tabs.";
}

function BEGINNER_SHOW_BACKEND_TABS() {
  researchBook_().getSheets().forEach(function (sheet) {
    try { sheet.showSheet(); } catch (e) {}
  });
  return "All research-workbook tabs are visible.";
}

/* ==========================================================================
   MODULE: Code.gs
   ========================================================================== */
/**
 * Code.gs — web-app entry points (§5.8).
 *
 * Queue Study API — Production. Deploy as a versioned web app executing
 * as the study account with anonymous access; the /exec deployment must
 * point at an explicit released version, never at /dev (README §2).
 *
 * doPost: parse -> validate -> processAtomic_ -> acknowledged iframe
 * receipt. All failure paths return a safe, structured receipt; no stack
 * traces, participant text, or tokens ever appear in a response.
 */

var EXECUTION_ID = Utilities.getUuid();

function doPost(e) {
  var envelope = null;
  try {
    envelope = parseEnvelope_(e);
    validateEnvelope_(envelope);
    var response = processAtomic_(envelope);
    return iframeResponse_(response);
  } catch (error) {
    if (error && error.validation) {
      logError_(
        envelope && envelope.request_id,
        envelope && envelope.payload && envelope.payload.session_id,
        error.code, error.detail || error.code,
        envelope && envelope.action,
        envelope && envelope.app_version
      );
      return iframeResponse_(errorResponse_(envelope, error.code, false, error.detail));
    }
    return iframeResponse_(safeUnexpectedError_(envelope, error));
  }
}

/**
 * doGet performs no data operation and reveals no configuration. The
 * public entry point for participants is the GitHub Pages site.
 */
function doGet() {
  return HtmlService.createHtmlOutput(
    "<!DOCTYPE html><html><body><p>Queue Decision Study — study endpoint. " +
    "This address serves the study application and has no browsable content.</p></body></html>"
  );
}
