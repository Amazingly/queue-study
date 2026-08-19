/*
 * Client-side session state (§4.7, §4.9).
 *
 * This module holds only NON-AUTHORITATIVE interface state: the language,
 * the server-issued session credentials, the server-returned public round
 * state, and paradata counters. It contains no treatment identifier, no
 * case types, no recovery draws, no payoff arithmetic, and no path by
 * which a reload or reset can obtain a new assignment: the only ways
 * forward are `resume` (same session) or `withdraw` (end participation).
 *
 * Storage. The raw invitation token is held transiently in
 * sessionStorage (§4.4) until `start` succeeds. The server-issued
 * SESSION RECORD (resume token, session id, language) is kept in
 * localStorage — a deliberate, documented revision of the original
 * sessionStorage-only rule: under shared-QR classroom entry there is no
 * paper slip to rescan, so the browser record is the participant's only
 * recovery object and must survive a closed tab. Rescanning the shared
 * QR on the same device therefore resumes the existing session instead
 * of claiming a second slot, and the completion code remains
 * retrievable until cash payout. No treatment, hidden state, or payoff
 * information is ever stored; the authoritative record lives on the
 * server.
 */

const STORAGE_KEY = "queue_study_session_v1";
const TOKEN_KEY = "queue_study_token_v1";
const ENTRY_KEY = "queue_study_entry_v1";
const PENDING_ENTRY_KEY = "queue_study_pending_entry_v1";

export function blankSession() {
  return {
    language: null,
    sessionId: null,
    resumeToken: null,
    participantCode: null,
    stage: null,            // server-reported: consented|instructions|quiz|rounds|beliefs|survey|completed|withdrawn
    nextEventSeq: null,     // last_event_seq (server) + 1
    roundState: null,       // §4.7 public round state, verbatim from the server
    results: null,          // §4.10 components, verbatim from the server
    completion: null,       // completion code + payment summary after finalize
    blurCount: 0
  };
}

/*
 * Pure: fold a server state snapshot into the client session (tested in
 * tests/recovery-ui.test.js). The server snapshot is authoritative; the
 * client never edits round, balance, load, or stage on its own.
 */
export function applyServerState(session, snapshot) {
  const next = { ...session };
  if (!snapshot || typeof snapshot !== "object") return next;
  if (snapshot.session_id) next.sessionId = snapshot.session_id;
  if (snapshot.resume_token) next.resumeToken = snapshot.resume_token;
  if (snapshot.participant_code) next.participantCode = snapshot.participant_code;
  if (snapshot.stage) next.stage = snapshot.stage;
  if (snapshot.language) next.language = snapshot.language;
  if (typeof snapshot.last_event_seq === "number") next.nextEventSeq = snapshot.last_event_seq + 1;
  if ("round_state" in snapshot) next.roundState = snapshot.round_state || null;
  if ("results" in snapshot && snapshot.results) next.results = snapshot.results;
  if ("completion" in snapshot && snapshot.completion) next.completion = snapshot.completion;
  return next;
}

export function takeEventSeq(session) {
  // Do not advance optimistically. The next sequence number comes only
  // from an acknowledged authoritative snapshot (last_event_seq + 1).
  return session.nextEventSeq;
}

export function sessionAuth(session) {
  return { session_id: session.sessionId, resume_token: session.resumeToken };
}

/* ---- sessionStorage persistence (survives reload, not tab close) ---- */

export function persistSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      language: session.language,
      sessionId: session.sessionId,
      resumeToken: session.resumeToken,
      participantCode: session.participantCode
    }));
  } catch (e) { /* private-mode storage failures are non-fatal */ }
}

export function loadPersistedSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearPersistedSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  try { localStorage.removeItem(PENDING_ENTRY_KEY); } catch (e) {}
}

/* ---- Durable pre-acknowledgement gateway claim ---- */

/*
 * A gateway claim can be durably written by Apps Script just before a
 * phone reloads or closes. Until the server acknowledgement delivers the
 * resume token, preserve the SAME request id and claim payload locally so
 * reopening this device retries idempotently rather than consuming a
 * second allocation slot. This record contains no treatment or hidden
 * experimental state and expires after two hours.
 */
export function persistPendingEntry(record) {
  try {
    localStorage.setItem(PENDING_ENTRY_KEY, JSON.stringify({
      action: record.action,
      requestId: record.requestId,
      payload: record.payload,
      createdAt: record.createdAt || Date.now()
    }));
  } catch (e) { /* storage failure falls back to in-page retries */ }
}

export function loadPendingEntry(now = Date.now()) {
  try {
    const raw = localStorage.getItem(PENDING_ENTRY_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || record.action !== "claim" || !record.requestId || !record.payload) {
      localStorage.removeItem(PENDING_ENTRY_KEY);
      return null;
    }
    if (!record.createdAt || now - Number(record.createdAt) > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_ENTRY_KEY);
      return null;
    }
    return record;
  } catch (e) {
    try { localStorage.removeItem(PENDING_ENTRY_KEY); } catch (ignored) {}
    return null;
  }
}

export function clearPendingEntry() {
  try { localStorage.removeItem(PENDING_ENTRY_KEY); } catch (e) {}
}

/* ---- Shared-gateway entry mode (?entry=join via the /join/ QR) ---- */

export function captureEntryMode(win = window) {
  let mode = null;
  try {
    const params = new URLSearchParams(win.location.search);
    if (params.get("entry") === "join") {
      mode = "join";
      sessionStorage.setItem(ENTRY_KEY, "join");
      params.delete("entry");
      const clean = win.location.pathname + (params.toString() ? "?" + params.toString() : "") + win.location.hash;
      win.history.replaceState(null, "", clean);
    } else {
      mode = sessionStorage.getItem(ENTRY_KEY);
    }
  } catch (e) { /* fall through */ }
  return mode === "join" ? "join" : null;
}

export function clearEntryMode() {
  try { sessionStorage.removeItem(ENTRY_KEY); } catch (e) {}
}

/*
 * Optional six-digit code prefill carried by the host's projected QR
 * (…/?entry=join&c=NNNNNN). Captured, sanitized to six digits, stashed,
 * and scrubbed from the visible URL. The server remains the sole judge of
 * validity; this only saves the student typing.
 */
export function capturePrefillCode(win = window) {
  let code = null;
  try {
    const params = new URLSearchParams(win.location.search);
    const raw = params.get("c");
    if (raw) {
      code = String(raw).replace(/\D/g, "").slice(0, 6);
      if (code) sessionStorage.setItem(ENTRY_KEY + "_c", code);
      params.delete("c");
      const clean = win.location.pathname + (params.toString() ? "?" + params.toString() : "") + win.location.hash;
      win.history.replaceState(null, "", clean);
    } else {
      code = sessionStorage.getItem(ENTRY_KEY + "_c");
    }
  } catch (e) { /* fall through */ }
  return code && /^\d{6}$/.test(code) ? code : null;
}

export function clearPrefillCode() {
  try { sessionStorage.removeItem(ENTRY_KEY + "_c"); } catch (e) {}
}

/* ---- Invitation token intake (§4.4) ---- */

/*
 * Read ?token= from the URL, stash it in sessionStorage, and scrub it
 * from the visible URL and history. Returns the raw token or null. The
 * token is opaque: the client never parses or derives anything from it.
 */
export function captureToken(win = window) {
  let token = null;
  try {
    const params = new URLSearchParams(win.location.search);
    token = params.get("token");
    if (token) {
      token = token.slice(0, 128);
      sessionStorage.setItem(TOKEN_KEY, token);
      params.delete("token");
      const clean = win.location.pathname + (params.toString() ? "?" + params.toString() : "") + win.location.hash;
      win.history.replaceState(null, "", clean);
    } else {
      token = sessionStorage.getItem(TOKEN_KEY);
    }
  } catch (e) { /* fall through */ }
  return token || null;
}

export function discardRawToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

/*
 * Manual fallback for classroom slips: a participant whose camera cannot
 * scan the QR types the slip's code instead. Normalizes spacing and case
 * (slips print the token in groups of four), validates the opaque token
 * shape, and stores it exactly as captureToken would. Returns the token
 * or null; the server remains the sole judge of validity.
 */
export function adoptManualToken(input) {
  const cleaned = String(input || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!/^qt_[0-9a-f]{32,64}$/.test(cleaned)) return null;
  try { sessionStorage.setItem(TOKEN_KEY, cleaned); } catch (e) {}
  return cleaned;
}

/* ---- Coarse, pre-specified device descriptors (§6.4) ---- */

const WIDTH_BANDS = [[0, 400, "lt400"], [400, 768, "400-767"], [768, 1024, "768-1023"], [1024, Infinity, "ge1024"]];
const HEIGHT_BANDS = [[0, 600, "lt600"], [600, 900, "600-899"], [900, Infinity, "ge900"]];

export function band(value, table) {
  for (const [lo, hi, label] of table) if (value >= lo && value < hi) return label;
  return "unknown";
}

export function deviceDescriptor(win = window) {
  const w = win.innerWidth || 0;
  const h = win.innerHeight || 0;
  const touch = (win.navigator && win.navigator.maxTouchPoints) ? win.navigator.maxTouchPoints > 0 : false;
  let deviceClass = "desktop";
  if (touch && w < 768) deviceClass = "mobile";
  else if (touch) deviceClass = "tablet";
  const ua = (win.navigator && win.navigator.userAgent) || "";
  let browserFamily = "other";
  if (/firefox/i.test(ua)) browserFamily = "Firefox";
  else if (/edg|chrome|crios/i.test(ua)) browserFamily = "Chrome";
  else if (/safari/i.test(ua)) browserFamily = "Safari";
  return {
    device_class: deviceClass,
    browser_family: browserFamily,
    viewport_width_band: band(w, WIDTH_BANDS),
    viewport_height_band: band(h, HEIGHT_BANDS),
    timezone_offset_minutes: new Date().getTimezoneOffset()
  };
}
