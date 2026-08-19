/*
 * recovery-ui.test.js — session recovery per §4.9: the client folds the
 * server snapshot in verbatim, holds no treatment or hidden state, and
 * offers no path to a new assignment ("start over" does not exist).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blankSession, applyServerState, takeEventSeq, sessionAuth, captureToken, band, persistPendingEntry, loadPendingEntry, clearPendingEntry } from "../assets/state.js";
import { EN } from "../assets/translations-en.js";
import { VI } from "../assets/translations-vi.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, "..", p), "utf8");

test("applyServerState folds the authoritative snapshot in verbatim", () => {
  const s0 = blankSession();
  const s1 = applyServerState(s0, {
    session_id: "qs_ab12", participant_code: "QP-XK2MDA", stage: "rounds",
    language: "vi", last_event_seq: 9,
    round_state: { round: 7, total_rounds: 20, display_label: "mixed", current_load: "strained", wait_cost: 70, displayed_case_value: null, displayed_expected_value: 48, displayed_net_value: -22, balance: 420, decision_seconds: 60 }
  });
  assert.equal(s1.sessionId, "qs_ab12");
  assert.equal(s1.stage, "rounds");
  assert.equal(s1.nextEventSeq, 10);
  assert.equal(s1.roundState.round, 7);
  assert.equal(s1.roundState.balance, 420);
});

test("a resume snapshot restores the same round, load, and balance — nothing regenerates client-side", () => {
  let s = blankSession();
  const snapshot = {
    session_id: "qs_ff", stage: "rounds", last_event_seq: 12,
    round_state: { round: 10, total_rounds: 20, display_label: "H", current_load: "normal", wait_cost: 30, displayed_case_value: 120, displayed_expected_value: null, displayed_net_value: 90, balance: 510, decision_seconds: 60 }
  };
  s = applyServerState(s, snapshot);
  const again = applyServerState(s, snapshot);   // reload -> identical state
  assert.deepEqual(again.roundState, s.roundState);
  assert.equal(again.stage, "rounds");
});

test("the client state never carries a treatment identifier, even if a snapshot smuggles one", () => {
  const s = applyServerState(blankSession(), { session_id: "qs_x", stage: "rounds", treatment: "fine", sequence_id: "sq-1" });
  assert.equal("treatment" in s, false);
  assert.equal("sequence_id" in s, false);
  assert.equal("sequenceId" in s, false);
});

test("takeEventSeq does not advance before server acknowledgement", () => {
  let s = applyServerState(blankSession(), { session_id: "qs_x", last_event_seq: 1 });
  assert.equal(takeEventSeq(s), 2);
  assert.equal(takeEventSeq(s), 2);
  assert.equal(s.nextEventSeq, 2);
  s = applyServerState(s, { last_event_seq: 2 });
  assert.equal(takeEventSeq(s), 3);
});

test("sessionAuth exposes exactly the two credentials", () => {
  const s = applyServerState(blankSession(), { session_id: "qs_x", resume_token: "qr_abc" });
  assert.deepEqual(Object.keys(sessionAuth(s)).sort(), ["resume_token", "session_id"]);
});

test("recovery translations offer resume and end only — no restart wording", () => {
  for (const T of [EN, VI]) {
    assert.ok(T.resume.length > 0);
    assert.ok(T.end_participation.length > 0);
    assert.equal("restart" in T, false);
  }
  assert.doesNotMatch(JSON.stringify(EN), /[Ss]tart over/);
});

test("persisted session record carries only credentials, never experiment state", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const { persistSession, loadPersistedSession, applyServerState } = await import("../assets/state.js");
  const s = applyServerState(blankSession(), {
    session_id: "qs_x", resume_token: "qr_abc", participant_code: "QP-ABCDEF",
    language: "vi", stage: "rounds", last_event_seq: 4,
    round_state: { round: 2, total_rounds: 20, display_label: "mixed", current_load: "normal", wait_cost: 30, displayed_case_value: null, displayed_expected_value: 48, displayed_net_value: 18, balance: 318, decision_seconds: 60 }
  });
  persistSession(s);
  const stored = loadPersistedSession();
  assert.deepEqual(Object.keys(stored).sort(), ["language", "participantCode", "resumeToken", "sessionId"]);
  assert.equal(JSON.stringify(stored).includes("balance"), false);
  assert.equal(JSON.stringify(stored).includes("display_label"), false);
  delete globalThis.localStorage;
});

test("a pre-acknowledgement gateway claim survives reload with the same request id", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const pending = {
    action: "claim",
    requestId: "11111111-2222-4333-8444-555555555555",
    createdAt: 1000,
    payload: {
      lecture_code: "123456", language: "en",
      confirm_18: true, confirm_not_prior: true, confirm_read: true,
      confirm_voluntary: true, confirm_consent: true,
      device: { device_class: "mobile" }
    }
  };
  persistPendingEntry(pending);
  assert.deepEqual(loadPendingEntry(2000), pending);
  clearPendingEntry();
  assert.equal(loadPendingEntry(2000), null);
  delete globalThis.localStorage;
});

test("stale pending gateway claims expire locally after two hours", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  persistPendingEntry({
    action: "claim", requestId: "11111111-2222-4333-8444-555555555555",
    createdAt: 1000, payload: { lecture_code: "123456" }
  });
  assert.equal(loadPendingEntry(1000 + 2 * 60 * 60 * 1000 + 1), null);
  delete globalThis.localStorage;
});

test("gateway entry flag is captured from ?entry=join and scrubbed from the URL", async () => {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const { captureEntryMode, clearEntryMode } = await import("../assets/state.js");
  let replaced = null;
  const win = {
    location: { search: "?entry=join", pathname: "/queue-study/", hash: "" },
    history: { replaceState: (a, b, url) => { replaced = url; } }
  };
  assert.equal(captureEntryMode(win), "join");
  assert.equal(replaced, "/queue-study/");
  // Reload without the parameter: mode survives via sessionStorage.
  const win2 = { location: { search: "", pathname: "/queue-study/", hash: "" }, history: { replaceState: () => {} } };
  assert.equal(captureEntryMode(win2), "join");
  clearEntryMode();
  assert.equal(captureEntryMode(win2), null);
  delete globalThis.sessionStorage;
});

test("app.js has no client-side assignment or plan generation, and no forced-treatment query handling", () => {
  const app = read("assets/app.js") + read("assets/state.js");
  assert.doesNotMatch(app, /assignTreatment|buildPlan|nextLoadAfter|url_forced|url_treatment/);
  assert.doesNotMatch(app, /q\.get\("t"\)/);
});

test("start flow routes completed and withdrawn tokens to their terminal screens", () => {
  const app = read("assets/app.js");
  const startFn = app.slice(app.indexOf("async function startSession"), app.indexOf("function screenRecovery"));
  assert.match(startFn, /data\.status === "completed" \|\| S\.stage === "completed"/);
  assert.match(startFn, /screenCompleted\(\); return;/);
  assert.match(startFn, /S\.stage === "withdrawn"/);
});

test("captureToken strips the token from the URL and stashes it in sessionStorage (§4.4)", () => {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  let replaced = null;
  const win = {
    location: { search: "?token=qt_0123456789abcdef0123456789abcdef", pathname: "/queue-study/", hash: "" },
    history: { replaceState: (a, b, url) => { replaced = url; } }
  };
  const token = captureToken(win);
  assert.equal(token, "qt_0123456789abcdef0123456789abcdef");
  assert.equal(replaced, "/queue-study/");
  // Second load without the query parameter: recovered from sessionStorage.
  const win2 = { location: { search: "", pathname: "/queue-study/", hash: "" }, history: { replaceState: () => {} } };
  assert.equal(captureToken(win2), "qt_0123456789abcdef0123456789abcdef");
  delete globalThis.sessionStorage;
});

test("manual slip-code entry normalizes chunked print format and rejects junk", async () => {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const { adoptManualToken } = await import("../assets/state.js");
  // Slips print the token in groups of four; users may add case and spaces.
  const typed = "QT_0 123 4567 89AB CDEF 0123 4567 89ab cdef";
  assert.equal(adoptManualToken(typed), "qt_0123456789abcdef0123456789abcdef");
  assert.equal(adoptManualToken("hello"), null);
  assert.equal(adoptManualToken("qt_zzzz"), null);
  assert.equal(adoptManualToken(""), null);
  delete globalThis.sessionStorage;
});

test("projected-QR code prefill is captured, sanitized, and scrubbed from the URL", async () => {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const { capturePrefillCode, clearPrefillCode } = await import("../assets/state.js");
  let replaced = null;
  const win = {
    location: { search: "?entry=join&c=483721", pathname: "/queue-study/", hash: "" },
    history: { replaceState: (a, b, url) => { replaced = url; } }
  };
  assert.equal(capturePrefillCode(win), "483721");
  assert.equal(replaced.includes("c=483721"), false, "code stripped from visible URL");
  // Non-numeric or wrong-length codes are ignored.
  const win2 = { location: { search: "?c=abc", pathname: "/q/", hash: "" }, history: { replaceState: () => {} } };
  assert.equal(capturePrefillCode(win2), null);
  clearPrefillCode();
  delete globalThis.sessionStorage;
});

test("host control page ships with the strict CSP and self-hosted scripts", () => {
  const html = read("host/index.html");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /form-action https:\/\/script\.google\.com/);
  assert.match(html, /assets\/qrcode\.js/);
  assert.match(html, /assets\/host\.js/);
  assert.doesNotMatch(html, /<script>[^<]/, "no inline scripts under script-src 'self'");
});

test("viewport banding is coarse and pre-specified (§6.4)", () => {
  const widths = [[0, "lt400"], [399, "lt400"], [400, "400-767"], [767, "400-767"], [768, "768-1023"], [1024, "ge1024"], [2560, "ge1024"]];
  for (const [w, expected] of widths) {
    assert.equal(band(w, [[0, 400, "lt400"], [400, 768, "400-767"], [768, 1024, "768-1023"], [1024, Infinity, "ge1024"]]), expected);
  }
});
