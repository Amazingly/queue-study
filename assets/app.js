/*
 * Application flow controller.
 *
 * Responsibility split (§3 of the revision plan): this client renders
 * screens, runs the visible countdown, collects choices and survey
 * responses, and displays server-returned state and results. It never
 * assigns treatment, never generates or stores case types or recovery
 * draws, never computes payoffs or completion codes, and offers no path
 * to a new assignment after a reload — recovery is "resume this session"
 * or "end participation" (§4.9).
 */

import { PUBLIC_CONFIG, DISPLAY } from "./config.js";
import { EN } from "./translations-en.js";
import { VI } from "./translations-vi.js";
import { apiCall, heartbeat, newId, ApiError } from "./api.js";
import {
  blankSession, applyServerState, takeEventSeq, sessionAuth,
  persistSession, loadPersistedSession, clearPersistedSession,
  persistPendingEntry, loadPendingEntry, clearPendingEntry,
  captureToken, discardRawToken, adoptManualToken, deviceDescriptor,
  captureEntryMode, clearEntryMode, capturePrefillCode, clearPrefillCode
} from "./state.js";
import {
  fmt, esc, vnd, el, render, progressHtml, radioBlock, checkboxRow,
  selectBlock, likertOpts, getRadio, decisionScreenHtml, feedbackHtml,
  resultsTableHtml, completionHtml, loadName
} from "./ui.js";
import { createActiveClock } from "./timer.js";

const TOTAL_STEPS = 9;

let S = blankSession();
let T = VI;
let rawToken = null;
let gatewayMode = false;   // shared classroom QR entry (/join/)
let lectureCode = null;    // six-digit code, validated by the server
let pendingEntryRequestId = null; // stable id across entry retries: a
                                  // lost claim/start acknowledgement must
                                  // resolve to the SAME session/slot

let clock = null;              // active-time clock for the live round
let tickHandle = null;
let panelOpen = false;
let panelWatchdog = null;
let roundBlursBefore = 0;
let submittingDecision = false;
let pendingDecision = null;    // { requestId, payload } for manual retry
let pendingFinalize = null;    // { requestId, payload } for manual retry
let questionnaireDraft = null;
let quizShownAt = 0;
let quizAttempt = 0;
let sentHeartbeats = {};

function t() { return T; }
function setLanguage(lang) {
  S.language = lang === "en" ? "en" : "vi";
  T = S.language === "en" ? EN : VI;
}

function instructionParams() {
  return {
    N: PUBLIC_CONFIG.NUM_ROUNDS,
    START: DISPLAY.startingPoints,
    H: DISPLAY.hValue, L: DISPLAY.lValue, EV: DISPLAY.mixedEv,
    WL: DISPLAY.waitStandard, WH: DISPLAY.waitHigh,
    HN: DISPLAY.hValue - DISPLAY.waitStandard,
    MN: DISPLAY.netStandardMixed,
    HS: DISPLAY.hValue - DISPLAY.waitHigh,
    MS: DISPLAY.netHighMixed,
    CAP: PUBLIC_CONFIG.INSTRUCTION_PAUSE_LIMIT_SECONDS
  };
}

function markHeartbeat(marker) {
  if (sentHeartbeats[marker]) return;
  sentHeartbeats[marker] = true;
  heartbeat(sessionAuth(S), marker);
}

/* =================== Instructions panel =================== */

function instructionsBodyHtml() {
  const m = instructionParams();
  return '<div class="card"><h3>' + esc(t().inst1_title) + "</h3><p>" + esc(fmt(t().inst1_body, m)) + "</p></div>" +
    '<div class="card"><h3>' + esc(t().inst2_title) + "</h3><p>" + esc(fmt(t().inst2_body, m)) + "</p></div>" +
    '<div class="card"><h3>' + esc(t().inst3_title) + "</h3><p>" + esc(fmt(t().inst3_body, m)) + "</p>" +
    '<div class="formula">' + esc(t().inst3_formula) + "</div></div>" +
    '<div class="card"><h3>' + esc(t().inst4_title) + "</h3><p>" + esc(fmt(t().inst4_body, m)) + "</p></div>" +
    '<div class="card"><h3>' + esc(t().inst5_title) + "</h3><p>" + esc(fmt(t().inst5_body, m)) + "</p></div>";
}

function ensurePanelDom() {
  if (el("instr_fab")) return;
  const fab = document.createElement("button");
  fab.id = "instr_fab"; fab.className = "instr-fab"; fab.type = "button";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.addEventListener("click", openInstructions);
  document.body.appendChild(fab);
  const back = document.createElement("div");
  back.id = "instr_backdrop"; back.className = "instr-backdrop";
  back.addEventListener("click", closeInstructions);
  document.body.appendChild(back);
  const panel = document.createElement("div");
  panel.id = "instr_panel"; panel.className = "instr-panel";
  panel.setAttribute("role", "dialog");
  document.body.appendChild(panel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) closeInstructions(); });
}

function setFabVisible(visible) {
  ensurePanelDom();
  const fab = el("instr_fab");
  fab.textContent = t().instructions_button;
  fab.classList.toggle("visible", Boolean(visible));
}

function openInstructions() {
  if (panelOpen) return;
  ensurePanelDom();
  if (clock && !clock.isLocked() && clock.instructionCapReached()) return; // budget spent: panel no longer pauses, keep it closed
  panelOpen = true;
  if (clock && !clock.isLocked()) clock.setInstructionsOpen(true);
  const panel = el("instr_panel");
  panel.innerHTML = '<div class="instr-head"><strong>' + esc(t().instructions_panel_title) + "</strong>" +
    '<button type="button" id="instr_close" class="secondary">' + esc(t().instr_close) + "</button></div>" +
    '<div class="instr-body"><p class="instr-note">' + esc(t().instr_panel_note) + "</p>" + instructionsBodyHtml() + "</div>";
  el("instr_close").addEventListener("click", closeInstructions);
  panel.classList.add("open");
  el("instr_backdrop").classList.add("open");
  document.body.classList.add("modal-open");
  if (clock && !clock.isLocked()) {
    panelWatchdog = setInterval(() => {
      if (clock && clock.instructionCapReached()) closeInstructions();
    }, 1000);
  }
}

function closeInstructions() {
  if (!panelOpen) return;
  panelOpen = false;
  if (panelWatchdog) { clearInterval(panelWatchdog); panelWatchdog = null; }
  if (clock) clock.setInstructionsOpen(false);
  const panel = el("instr_panel"), back = el("instr_backdrop");
  if (panel) panel.classList.remove("open");
  if (back) back.classList.remove("open");
  document.body.classList.remove("modal-open");
}

/* =================== Global visibility / paradata =================== */

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    closeInstructions();                       // §4.8: panel closes first
    if (clock) clock.setVisible(false);
  } else if (clock) {
    clock.setVisible(true);
  }
});
window.addEventListener("blur", () => { S.blurCount += 1; });
window.addEventListener("beforeunload", (e) => {
  if (S.stage === "rounds" || S.stage === "beliefs" || S.stage === "survey") {
    e.preventDefault();
    e.returnValue = "";
  }
});

/* =================== Error handling =================== */

function refFromId(id) { return String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase(); }

function errorScreen(titleKey, bodyKey, map) {
  render(
    '<div class="card"><h3>' + esc(t()[titleKey]) + "</h3>" +
    "<p>" + esc(fmt(t()[bodyKey], map || {})) + "</p></div>"
  );
}

function handleDomainError(err, retryFn) {
  const code = err && err.code;
  const ref = refFromId(err && err.requestId);
  if (code === "TOKEN_INVALID") return errorScreen("err_invalid_token_title", "err_invalid_token");
  if (code === "LECTURE_CODE_INVALID") return errorScreen("err_lecture_invalid_title", "err_lecture_invalid");
  if (code === "LECTURE_NOT_OPEN") return errorScreen("err_lecture_not_open_title", "err_lecture_not_open");
  if (code === "LECTURE_CLOSED") return errorScreen("err_lecture_closed_title", "err_lecture_closed");
  if (code === "LECTURE_FULL") return errorScreen("err_lecture_full_title", "err_lecture_full");
  if (code === "TOKEN_COMPLETED") return errorScreen("err_token_completed_title", "err_token_completed");
  if (code === "SESSION_WITHDRAWN") return errorScreen("err_token_withdrawn_title", "err_token_withdrawn");
  if (code === "COLLECTION_CLOSED") return errorScreen("err_closed_title", "err_closed");
  if (code === "SESSION_EXPIRED") return errorScreen("err_expired_title", "err_expired", { H: PUBLIC_CONFIG.RESUME_EXPIRY_HOURS, CODE: S.participantCode || "—" });
  if (code === "APP_VERSION_UNSUPPORTED") return errorScreen("err_version_title", "err_version");
  if (code === "STALE_EVENT" || code === "EVENT_CONFLICT" || code === "SEQUENCE_GAP" || code === "STATE_MISMATCH") {
    return errorScreen("err_state_title", "err_state");
  }
  render(
    '<div class="card"><h3>' + esc(t().err_generic_title) + "</h3>" +
    '<div class="notice-error">' + esc(fmt(t().err_generic, { REF: ref || "—" })) + "</div>" +
    (retryFn ? '<button id="btn_retry" type="button">' + esc(t().retry_now) + "</button>" : "") +
    "</div>"
  );
  if (retryFn) el("btn_retry").addEventListener("click", retryFn);
}

function retryNotice(attempt) {
  const note = el("net_note");
  if (note) note.classList.remove("hidden");
}

/* =================== Boot =================== */

async function boot() {
  ensurePanelDom();
  rawToken = captureToken();
  const entry = captureEntryMode();
  const prefillCode = capturePrefillCode();
  const persisted = loadPersistedSession();
  const pendingEntry = loadPendingEntry();
  // §10 (gateway plan): a saved session on this device always wins —
  // rescanning the shared QR must offer resumption, never a second slot.
  if (persisted && persisted.resumeToken) {
    S = { ...blankSession(), ...persisted };
    setLanguage(persisted.language || "vi");
    await resumeFlow();
    return;
  }
  // A claim may have reached the server immediately before the browser
  // reloaded. Retry the exact durable request before offering a new claim.
  if (pendingEntry) {
    gatewayMode = true;
    lectureCode = pendingEntry.payload.lecture_code;
    pendingEntryRequestId = pendingEntry.requestId;
    setLanguage(pendingEntry.payload.language || "vi");
    await deliverEntryRequest(pendingEntry);
    return;
  }
  if (entry === "join" || prefillCode) {
    gatewayMode = true;
    if (prefillCode) lectureCode = prefillCode;   // from the projected QR
    screenLanguage();
    return;
  }
  if (!rawToken) { screenLandingNoToken(); return; }
  screenLanguage();
}

async function resumeFlow() {
  render(progressHtml(1, TOTAL_STEPS, t().progress_language) + '<div class="card"><p>' + esc(t().contacting) + "</p></div>");
  try {
    const { data } = await apiCall("resume", { resume_token: S.resumeToken, session_id: S.sessionId }, { onRetry: retryNotice });
    S = applyServerState(S, data.state);
    if (S.language) setLanguage(S.language);
    persistSession(S);
    if (S.stage === "completed") { screenCompleted(); return; }
    if (S.stage === "withdrawn") { screenEnded(); return; }
    screenRecovery();
  } catch (err) {
    if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
    handleDomainError(err, resumeFlow);
  }
}

/* =================== Screens: entry =================== */

function screenLandingNoToken() {
  setFabVisible(false);
  render(
    '<div class="card"><h2>' + esc(VI.landing_title) + "</h2><p>" + esc(VI.landing_no_token) + "</p></div>" +
    '<div class="card"><h2>' + esc(EN.landing_title) + "</h2><p>" + esc(EN.landing_no_token) + "</p></div>" +
    '<div class="card">' +
    "<p>" + esc(VI.landing_manual_label) + "</p>" +
    '<p class="quality-note">' + esc(EN.landing_manual_label) + "</p>" +
    '<div class="q"><input type="text" id="manual_token" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="qt_…"></div>' +
    '<p id="manual_err" class="error hidden">' + esc(VI.landing_manual_error) + "<br>" + esc(EN.landing_manual_error) + "</p>" +
    '<div class="choices"><button id="btn_manual" type="button">' + esc(VI.landing_manual_button) + " / " + esc(EN.landing_manual_button) + "</button></div>" +
    "</div>" +
    '<div class="card"><div class="choices"><button id="btn_gateway" type="button" class="secondary">' +
    esc(VI.landing_gateway_button) + " / " + esc(EN.landing_gateway_button) + "</button></div></div>"
  );
  el("btn_manual").addEventListener("click", () => {
    const token = adoptManualToken(el("manual_token").value);
    if (!token) { el("manual_err").classList.remove("hidden"); return; }
    rawToken = token;
    screenLanguage();
  });
  el("btn_gateway").addEventListener("click", () => {
    gatewayMode = true;
    screenLanguage();
  });
}

function screenLanguage() {
  setFabVisible(false);
  render(
    progressHtml(1, TOTAL_STEPS, "Ngôn ngữ / Language") +
    '<div class="card"><h2>' + esc(VI.language_title) + "</h2>" +
    "<p>" + esc(VI.language_body) + "</p>" +
    '<div class="lang-row">' +
    '<button id="btn_vi" type="button">Tiếng Việt</button>' +
    '<button id="btn_en" type="button" class="secondary">English</button>' +
    "</div></div>"
  );
  el("btn_vi").addEventListener("click", () => { setLanguage("vi"); gatewayMode ? screenGatewayCode() : screenEligibility(); });
  el("btn_en").addEventListener("click", () => { setLanguage("en"); gatewayMode ? screenGatewayCode() : screenEligibility(); });
}

/* Shared classroom gateway (§4 step 2): the six-digit lecture code is
 * validated server-side BEFORE eligibility and consent, so a wrong or
 * expired code fails fast. Nothing is allocated here; the final claim
 * happens only after consent. */
function screenGatewayCode() {
  setFabVisible(false);
  const c = t();
  render(
    progressHtml(2, TOTAL_STEPS, c.progress_eligibility) +
    '<div class="card"><h2>' + esc(c.gateway_title) + "</h2>" +
    "<p>" + esc(c.gateway_body) + "</p>" +
    '<div class="q"><p>' + esc(c.gateway_code_label) + '</p>' +
    '<input type="text" id="lecture_code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" value="' + esc(lectureCode || "") + '"></div>' +
    '<p id="gw_err" class="error hidden">' + esc(c.gateway_code_error) + "</p>" +
    '<p id="net_note" class="quality-note hidden">' + esc(c.slow_network) + "</p>" +
    '<div class="choices"><button id="btn_next" type="button">' + esc(c.gateway_code_submit) + "</button></div></div>"
  );
  el("btn_next").addEventListener("click", async () => {
    const code = String(el("lecture_code").value).replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) { el("gw_err").classList.remove("hidden"); return; }
    el("btn_next").disabled = true;
    try {
      await apiCall("lecture_status", { lecture_code: code }, { onRetry: retryNotice });
      lectureCode = code;
      // Keep the prefilled code until the claim actually succeeds, so a
      // reload during eligibility/consent re-prefills it (the projected-QR
      // case the deep link is designed for). Cleared in deliverEntryRequest.
      screenEligibility();
    } catch (err) {
      el("btn_next").disabled = false;
      if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
      handleDomainError(err, screenGatewayCode);
    }
  });
}

/* §8.1: eligibility precedes consent; underage visitors never consent,
 * never receive treatment, and never generate a research session. The
 * prior-participation attestation (gateway plan §4 step 3) applies in
 * both entry modes and is a preregistered safeguard, not identifying
 * information. */
function screenEligibility() {
  setFabVisible(false);
  render(
    progressHtml(2, TOTAL_STEPS, t().progress_eligibility) +
    '<div class="card"><h2>' + esc(t().elig_title) + "</h2>" +
    "<p>" + esc(t().elig_body) + "</p>" +
    checkboxRow("elig_18", t().elig_confirm) +
    checkboxRow("elig_prior", t().elig_confirm_prior) +
    '<p class="quality-note">' + esc(t().elig_prior_note) + "</p>" +
    '<p id="elig_err" class="error hidden">' + esc(t().elig_error) + "</p>" +
    '<div class="choices"><button id="btn_next" type="button">' + esc(t().elig_continue) + "</button></div></div>"
  );
  el("btn_next").addEventListener("click", () => {
    if (!el("elig_18").checked || !el("elig_prior").checked) { el("elig_err").classList.remove("hidden"); return; }
    screenConsent();
  });
}

function screenConsent() {
  setFabVisible(false);
  const c = t();
  render(
    progressHtml(3, TOTAL_STEPS, c.progress_consent) +
    '<div class="card"><h2>' + esc(c.consent_title) + "</h2>" +
    "<p><strong>" + esc(c.consent_study_title) + "</strong></p>" +
    "<p>" + esc(c.consent_team) + "</p>" +
    "<p>" + esc(c.consent_purpose) + "</p>" +
    "<p>" + esc(fmt(c.consent_payment, { FIXED: vnd(DISPLAY.fixedVnd) })) + "</p>" +
    "<p>" + esc(c.consent_voluntary) + "</p>" +
    "<p>" + esc(c.consent_risks) + "</p>" +
    "<p>" + esc(c.consent_data) + "</p>" +
    "<p>" + esc(c.consent_confidentiality) + "</p>" +
    "<p>" + esc(c.consent_withdrawal) + "</p>" +
    "<p>" + esc(c.consent_contact) + "</p>" +
    '<p><a href="privacy.html" target="_blank" rel="noopener">' + esc(c.consent_links) + "</a> · " +
    '<a href="withdrawal.html" target="_blank" rel="noopener">' + esc(c.consent_links_withdrawal) + "</a></p>" +
    '<div class="band">' +
    checkboxRow("cf_age", c.consent_confirm_age) +
    checkboxRow("cf_read", c.consent_confirm_read) +
    checkboxRow("cf_vol", c.consent_confirm_voluntary) +
    checkboxRow("cf_agree", c.consent_confirm_agree) +
    "</div>" +
    '<p id="consent_err" class="error hidden">' + esc(c.consent_error) + "</p>" +
    '<p id="net_note" class="quality-note hidden">' + esc(c.slow_network) + "</p>" +
    '<div class="choices"><button id="btn_next" type="button">' + esc(c.consent_continue) + "</button></div></div>"
  );
  el("btn_next").addEventListener("click", startSession);
}

async function startSession() {
  const boxes = ["cf_age", "cf_read", "cf_vol", "cf_agree"];
  if (!boxes.every((id) => el(id).checked)) { el("consent_err").classList.remove("hidden"); return; }
  el("btn_next").disabled = true;
  const confirms = {
    language: S.language,
    confirm_18: true,
    confirm_not_prior: true,
    confirm_read: true,
    confirm_voluntary: true,
    confirm_consent: true,
    device: deviceDescriptor()
  };
  if (!pendingEntryRequestId) pendingEntryRequestId = newId();
  const pending = {
    action: gatewayMode ? "claim" : "start",
    requestId: pendingEntryRequestId,
    payload: gatewayMode
      ? { lecture_code: lectureCode, ...confirms }
      : { token: rawToken, ...confirms },
    createdAt: Date.now()
  };
  // Gateway participants have no individual invitation to rescan. Persist
  // the pre-ack claim so a reload retries the same request id and slot.
  if (gatewayMode) persistPendingEntry(pending);
  await deliverEntryRequest(pending);
}

async function deliverEntryRequest(pending) {
  render(progressHtml(3, TOTAL_STEPS, t().progress_consent) +
    '<div class="card"><p>' + esc(t().contacting) + '</p>' +
    '<p id="net_note" class="quality-note hidden">' + esc(t().slow_network) + "</p></div>");
  try {
    const options = { onRetry: retryNotice, requestId: pending.requestId };
    const { data } = await apiCall(pending.action, pending.payload, options);
    pendingEntryRequestId = null;
    clearPendingEntry();
    S = applyServerState(S, data.state);
    persistSession(S);
    discardRawToken();
    clearEntryMode();
    clearPrefillCode();
    rawToken = null;
    if (data.status === "completed" || S.stage === "completed") { screenCompleted(); return; }
    if (S.stage === "withdrawn") { screenEnded(); return; }
    if (data.status === "existing_session") { screenRecovery(); return; }
    screenInstructions();
  } catch (err) {
    if (err instanceof ApiError && !err.retryable) {
      pendingEntryRequestId = null;
      clearPendingEntry();
      handleDomainError(err);
      return;
    }
    handleDomainError(err, () => deliverEntryRequest(pending));
  }
}

/* §4.9: after assignment the only recovery options are resume or end. */
function screenRecovery() {
  setFabVisible(false);
  render(
    progressHtml(1, TOTAL_STEPS, t().recover_title) +
    '<div class="card"><h2>' + esc(t().recover_title) + "</h2>" +
    "<p>" + esc(fmt(t().recover_body, { CODE: S.participantCode || "—" })) + "</p>" +
    '<div class="choices"><button id="btn_resume" type="button">' + esc(t().resume) + "</button>" +
    '<button id="btn_end" type="button" class="secondary">' + esc(t().end_participation) + "</button></div></div>"
  );
  el("btn_resume").addEventListener("click", renderStage);
  el("btn_end").addEventListener("click", screenEndConfirm);
}

function screenEndConfirm() {
  render(
    '<div class="card"><h2>' + esc(t().end_confirm_title) + "</h2>" +
    "<p>" + esc(t().end_confirm_body) + "</p>" +
    '<div class="choices"><button id="btn_back" type="button">' + esc(t().end_confirm_no) + "</button>" +
    '<button id="btn_yes" type="button" class="secondary">' + esc(t().end_confirm_yes) + "</button></div></div>"
  );
  el("btn_back").addEventListener("click", screenRecovery);
  el("btn_yes").addEventListener("click", withdrawSession);
}

async function withdrawSession() {
  try {
    const { data } = await apiCall("withdraw", {
      ...sessionAuth(S), event_seq: takeEventSeq(S)
    }, { onRetry: retryNotice });
    S = applyServerState(S, data.state);
    persistSession(S);
    screenEnded();
  } catch (err) {
    if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
    handleDomainError(err, withdrawSession);
  }
}

function screenEnded() {
  setFabVisible(false);
  render('<div class="card"><h2>' + esc(t().ended_title) + "</h2><p>" +
    esc(fmt(t().ended_body, { CODE: S.participantCode || "—" })) + "</p></div>");
}

/* =================== Stage router =================== */

function renderStage() {
  if (S.stage === "instructions") { screenInstructions(); return; }
  if (S.stage === "quiz") { screenQuiz(); return; }
  if (S.stage === "rounds") { screenDecision(); return; }
  if (S.stage === "beliefs") { screenBeliefs(); return; }
  if (S.stage === "survey") { screenQuestionnaire(); return; }
  if (S.stage === "completed") { screenCompleted(); return; }
  if (S.stage === "withdrawn") { screenEnded(); return; }
  screenInstructions();
}

/* =================== Instructions & quiz =================== */

function screenInstructions() {
  setFabVisible(true);
  markHeartbeat("instructions_opened");
  render(
    progressHtml(4, TOTAL_STEPS, t().progress_instructions) +
    instructionsBodyHtml() +
    '<div class="band quality-note">' + esc(fmt(t().inst_timer_note, instructionParams())) + "</div>" +
    '<div class="band quality-note">' + esc(t().instr_hint) + "</div>" +
    '<button id="btn_next" type="button">' + esc(t().continue_btn) + "</button>"
  );
  el("btn_next").addEventListener("click", screenQuiz);
}

function quizQuestions() {
  const c = t(), p = " " + c.points;
  return [
    { n: "cq1", type: "mc", q: c.q1, opts: [{ v: "A", t: "120" + p }, { v: "B", t: "30" + p }, { v: "C", t: "0" + p }], explain: c.q1_explain },
    { n: "cq2", type: "mc", q: c.q2, opts: [{ v: "A", t: "0" }, { v: "B", t: "48" }, { v: "C", t: "120" }], explain: c.q2_explain },
    { n: "cq3", type: "mc", q: c.q3, opts: [{ v: "A", t: "20%" }, { v: "B", t: "40%" }, { v: "C", t: "60%" }], explain: c.q3_explain },
    { n: "cq4", type: "mc", q: c.q4, opts: [{ v: "A", t: "0" + p }, { v: "B", t: "48" + p }, { v: "C", t: "120" + p }], explain: c.q4_explain },
    { n: "cq5", type: "mc", q: c.q5, opts: [{ v: "A", t: "50" + p }, { v: "B", t: "90" + p }, { v: "C", t: "120" + p }], explain: c.q5_explain },
    { n: "cq6", type: "mc", q: c.q6, opts: [{ v: "A", t: c.q6_opt_standard }, { v: "B", t: c.q6_opt_high }, { v: "C", t: c.q6_opt_same }], explain: c.q6_explain },
    { n: "cq7", type: "num", q: c.q7, hint: c.q7_hint, explain: c.q7_explain },
    { n: "cq8", type: "num", q: c.q8, hint: c.q8_hint, explain: c.q8_explain }
  ];
}

function screenQuiz() {
  setFabVisible(true);
  markHeartbeat("quiz_started");
  quizAttempt += 1;
  quizShownAt = performance.now();
  const qs = quizQuestions();
  let html = progressHtml(5, TOTAL_STEPS, t().progress_quiz) +
    '<div class="card"><h3>' + esc(t().quiz_title) + "</h3><p>" + esc(t().quiz_intro) + "</p>";
  for (const q of qs) {
    if (q.type === "mc") html += radioBlock(q.n, q.q, q.opts);
    else html += '<div class="q"><p>' + esc(q.q) + '</p><input type="number" step="1" inputmode="numeric" autocomplete="off" id="' + q.n + '"><p class="quality-note">' + esc(q.hint) + "</p></div>";
  }
  html += '<p id="qerr" class="error hidden">' + esc(t().quiz_error) + "</p>" +
    '<div id="quiz_feedback" class="quiz-feedback hidden"></div>' +
    '<p id="net_note" class="quality-note hidden">' + esc(t().slow_network) + "</p>" +
    '<div class="choices">' +
    '<button id="btn_next" type="button">' + esc(t().continue_btn) + "</button>" +
    '<button id="btn_review" type="button" class="secondary hidden">' + esc(t().review_instructions) + "</button>" +
    "</div></div>";
  render(html);
  el("btn_next").addEventListener("click", submitQuiz);
  el("btn_review").addEventListener("click", screenInstructions);
}

async function submitQuiz() {
  const answers = {
    cq1: getRadio("cq1"), cq2: getRadio("cq2"), cq3: getRadio("cq3"),
    cq4: getRadio("cq4"), cq5: getRadio("cq5"), cq6: getRadio("cq6"),
    cq7: el("cq7").value === "" ? null : parseInt(el("cq7").value, 10),
    cq8: el("cq8").value === "" ? null : parseInt(el("cq8").value, 10)
  };
  const incomplete = Object.values(answers).some((v) => v === null || v === undefined || Number.isNaN(v));
  if (incomplete) { el("qerr").classList.remove("hidden"); return; }
  el("btn_next").disabled = true;
  try {
    const { data } = await apiCall("quiz", {
      ...sessionAuth(S),
      event_seq: takeEventSeq(S),
      attempt: quizAttempt,
      answers,
      active_ms: Math.round(performance.now() - quizShownAt)
    }, { onRetry: retryNotice });
    S = applyServerState(S, data.state);
    persistSession(S);
    if (data.passed) {
      markHeartbeat("rounds_started");
      screenDecision();
      return;
    }
    el("btn_next").disabled = false;
    el("qerr").classList.remove("hidden");
    el("btn_review").classList.remove("hidden");
    showQuizFeedback(data.incorrect || []);
  } catch (err) {
    el("btn_next").disabled = false;
    if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
    handleDomainError(err, screenQuiz);
  }
}

/* §5.5 quiz: the server returns WHICH items were wrong; explanations are
 * shown only for those items, from the translation catalog. */
function showQuizFeedback(incorrectIds) {
  const qs = quizQuestions().filter((q) => incorrectIds.indexOf(q.n) !== -1);
  let html = "<h4>" + esc(t().quiz_feedback_title) + "</h4>";
  for (const q of qs) {
    html += '<div class="item"><strong>' + esc(q.q) + "</strong>" +
      '<div class="quality-note">' + esc(q.explain) + "</div></div>";
  }
  const panel = el("quiz_feedback");
  panel.innerHTML = html;
  panel.classList.remove("hidden");
}

/* =================== Decision rounds =================== */

function screenDecision() {
  setFabVisible(true);
  const rs = S.roundState;
  if (!rs) { resumeFlow(); return; }
  if (rs.round >= 5) markHeartbeat("round_5_reached");
  if (rs.round >= 10) markHeartbeat("round_10_reached");
  if (rs.round >= 15) markHeartbeat("round_15_reached");
  submittingDecision = false;
  pendingDecision = null;
  roundBlursBefore = S.blurCount;
  render(decisionScreenHtml(t(), rs, t().progress_rounds));

  clock = createActiveClock({
    limitMs: rs.decision_seconds * 1000,
    instructionCapMs: PUBLIC_CONFIG.INSTRUCTION_PAUSE_LIMIT_SECONDS * 1000
  });
  clock.start();
  if (document.hidden) clock.setVisible(false);

  tickHandle = setInterval(() => {
    if (!clock || clock.isLocked()) return;
    const remaining = Math.ceil(clock.remainingMs() / 1000);
    const c = el("clock");
    if (c) c.textContent = String(remaining);
    if (clock.expired()) submitDecision(null, true);
  }, 250);

  el("btn_send").addEventListener("click", () => submitDecision("send", false));
  el("btn_not").addEventListener("click", () => submitDecision("not_send", false));
}

async function submitDecision(choice, timedOut) {
  if (submittingDecision || !clock || clock.isLocked()) return;
  submittingDecision = true;
  closeInstructions();
  clock.lock();
  clearInterval(tickHandle);
  const sendBtn = el("btn_send"), notBtn = el("btn_not");
  if (sendBtn) sendBtn.disabled = true;
  if (notBtn) notBtn.disabled = true;

  const rs = S.roundState;
  const paradata = clock.paradata();
  const payload = {
    ...sessionAuth(S),
    event_seq: takeEventSeq(S),
    round: rs.round,
    choice: timedOut ? "not_send" : choice,
    timed_out: Boolean(timedOut),
    active_rt_ms: paradata.active_rt_ms,
    wall_rt_ms: paradata.wall_rt_ms,
    hidden_ms: paradata.hidden_ms,
    instruction_ms: paradata.instruction_ms,
    instruction_opens: paradata.instruction_opens,
    blur_count: S.blurCount - roundBlursBefore
  };
  pendingDecision = { requestId: newId(), payload };
  await deliverDecision();
}

/* Retries — automatic and manual — reuse the SAME request_id (§4.6, §5.6),
 * so a lost acknowledgement can never append a second decision. */
async function deliverDecision() {
  const rs = S.roundState;
  render(progressHtml(6, TOTAL_STEPS, t().progress_rounds) +
    '<div class="status"><span>' + esc(t().round) + " <strong>" + rs.round + " / " + rs.total_rounds + "</strong></span></div>" +
    '<div class="card"><p>' + esc(t().submitting_decision) + "</p>" +
    '<p id="net_note" class="quality-note hidden">' + esc(t().slow_network) + "</p></div>");
  try {
    const { data } = await apiCall("decision", pendingDecision.payload, {
      requestId: pendingDecision.requestId, onRetry: retryNotice
    });
    S = applyServerState(S, data.state);
    persistSession(S);
    const outcome = data.outcome;
    render(feedbackHtml(t(), outcome, t().progress_rounds));
    el("btn_next").addEventListener("click", () => {
      if (outcome.next_round_available) screenDecision();
      else screenBeliefs();
    });
  } catch (err) {
    if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
    handleDomainError(err, deliverDecision);
  }
}

/* =================== Beliefs and results =================== */

function screenBeliefs() {
  setFabVisible(true);
  markHeartbeat("beliefs_started");
  const N = PUBLIC_CONFIG.NUM_ROUNDS, M = DISPLAY.beliefMax;
  render(
    progressHtml(7, TOTAL_STEPS, t().progress_beliefs) +
    '<div class="card"><h3>' + esc(t().beliefs_title) + "</h3>" +
    '<div class="band">' + esc(fmt(t().beliefs_intro, { M })) + "</div>" +
    '<p class="quality-note">' + esc(fmt(t().beliefs_examples, { M, MEX: M - 3 })) + "</p>" +
    '<div class="q"><p>' + esc(fmt(t().belief1, { N })) + '</p><input type="number" step="1" min="0" max="' + N + '" inputmode="numeric" autocomplete="off" id="b1"></div>' +
    '<div class="q"><p>' + esc(fmt(t().belief2, { N })) + '</p><input type="number" step="1" min="0" max="' + N + '" inputmode="numeric" autocomplete="off" id="b2"></div>' +
    '<p id="berr" class="error hidden">' + esc(t().belief_error) + "</p>" +
    '<p id="net_note" class="quality-note hidden">' + esc(t().slow_network) + "</p>" +
    '<button id="btn_next" type="button">' + esc(t().belief_submit) + "</button></div>"
  );
  el("btn_next").addEventListener("click", submitBeliefs);
}

async function submitBeliefs() {
  const N = PUBLIC_CONFIG.NUM_ROUNDS;
  const b1 = parseInt(el("b1").value, 10), b2 = parseInt(el("b2").value, 10);
  if (isNaN(b1) || b1 < 0 || b1 > N || isNaN(b2) || b2 < 0 || b2 > N) {
    el("berr").classList.remove("hidden"); return;
  }
  el("btn_next").disabled = true;
  try {
    const { data } = await apiCall("beliefs", {
      ...sessionAuth(S), event_seq: takeEventSeq(S), belief_h: b1, belief_h_served: b2
    }, { onRetry: retryNotice });
    S = applyServerState(S, data.state);
    persistSession(S);
    screenResults();
  } catch (err) {
    el("btn_next").disabled = false;
    if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
    handleDomainError(err, submitBeliefs);
  }
}

/* §4.10: the display separates endowment, decision points, belief points,
 * and the floored bonus base. All values computed by the server. */
function screenResults() {
  const r = S.results;
  if (!r) { resumeFlow(); return; }
  render(
    progressHtml(7, TOTAL_STEPS, t().progress_beliefs) +
    '<div class="card"><h3>' + esc(t().results_title) + "</h3>" +
    resultsTableHtml(t(), r) +
    '<p class="muted">' + esc(t().r_floor) + "</p>" +
    '<button id="btn_next" type="button">' + esc(t().continue_btn) + "</button></div>"
  );
  el("btn_next").addEventListener("click", screenQuestionnaire);
}

/* =================== Questionnaire, demographics, finalize =================== */

function screenQuestionnaire() {
  setFabVisible(true);
  markHeartbeat("survey_started");
  const c = t();
  const ynu = [{ v: "yes", t: c.yes }, { v: "no", t: c.no }, { v: "unsure", t: c.unsure }];
  render(
    progressHtml(8, TOTAL_STEPS, c.progress_survey) +
    '<div class="card"><h3>' + esc(c.quest_title) + '</h3><p class="muted">' + esc(c.quest_intro) + "</p>" +
    selectBlock("lk1", c.lik1, likertOpts(1, 7)) +
    selectBlock("lk2", c.lik2, likertOpts(1, 7)) +
    selectBlock("lk3", c.lik3, likertOpts(1, 7)) +
    selectBlock("attn", c.attention, likertOpts(1, 7)) +
    radioBlock("understood", c.understood, ynu) +
    radioBlock("believed", c.believed, ynu) +
    radioBlock("policy_when", c.policy_when, [
      { v: "every_round", t: c.policy_when_every },
      { v: "standard_only", t: c.policy_when_standard },
      { v: "high_only", t: c.policy_when_high },
      { v: "never_exact", t: c.policy_when_never },
      { v: "not_sure", t: c.policy_when_unsure }
    ]) +
    radioBlock("policy_noticed", c.policy_noticed, ynu) +
    '<div class="q"><p>' + esc(c.strategy) + '</p><textarea id="strategy" maxlength="1000"></textarea>' +
    '<p class="quality-note">' + esc(c.open_text_note) + "</p></div>" +
    '<div class="q"><p>' + esc(c.confusing) + '</p><textarea id="confusing" maxlength="1000"></textarea></div>' +
    '<p id="qerr2" class="error hidden">' + esc(c.form_error) + "</p>" +
    '<button id="btn_next" type="button">' + esc(c.continue_btn) + "</button></div>"
  );
  el("btn_next").addEventListener("click", () => {
    const v = {
      label_difficulty: el("lk1").value, label_effect: el("lk2").value, waiting_effect: el("lk3").value,
      attention_check: el("attn").value,
      understood: getRadio("understood"), believed: getRadio("believed"),
      policy_recognition: getRadio("policy_when"), policy_noticed: getRadio("policy_noticed"),
      strategy: el("strategy").value.trim(), confusing: el("confusing").value.trim()
    };
    if (!v.label_difficulty || !v.label_effect || !v.waiting_effect || !v.attention_check ||
      !v.understood || !v.believed || !v.policy_recognition || !v.policy_noticed) {
      el("qerr2").classList.remove("hidden"); return;
    }
    questionnaireDraft = v;   // strategy and confusing are optional (§8.7)
    screenDemographics();
  });
}

function screenDemographics() {
  const c = t();
  render(
    progressHtml(8, TOTAL_STEPS, c.progress_survey) +
    '<div class="card"><h3>' + esc(c.demo_title) + '</h3><p class="muted">' + esc(c.demo_intro) + "</p>" +
    selectBlock("age_band", c.age_band, [
      { v: "18-20", t: c.age_18_20 }, { v: "21-24", t: c.age_21_24 }, { v: "25-29", t: c.age_25_29 },
      { v: "30-39", t: c.age_30_39 }, { v: "40-49", t: c.age_40_49 }, { v: "50+", t: c.age_50_plus },
      { v: "prefer_not", t: c.prefer_not }
    ]) +
    radioBlock("gender", c.gender, [
      { v: "female", t: c.female }, { v: "male", t: c.male },
      { v: "nonbinary", t: c.nonbinary }, { v: "prefer_not", t: c.prefer_not }
    ]) +
    selectBlock("field", c.field, [
      { v: "econ_business", t: c.f1 }, { v: "stem", t: c.f2 },
      { v: "social_science", t: c.f3 }, { v: "humanities", t: c.f4 }, { v: "other", t: c.f5 }
    ]) +
    selectBlock("year", c.year, [
      { v: "1", t: c.y1 }, { v: "2", t: c.y2 }, { v: "3", t: c.y3 }, { v: "4", t: c.y4 }, { v: "5", t: c.y5 }
    ]) +
    radioBlock("prior", c.prior, [{ v: "yes", t: c.yes }, { v: "no", t: c.no }]) +
    selectBlock("risk", c.risk, likertOpts(0, 10)) +
    selectBlock("patience", c.patience, likertOpts(0, 10)) +
    '<p id="derr" class="error hidden">' + esc(c.form_error) + "</p>" +
    '<button id="btn_next" type="button">' + esc(c.submit_all) + "</button></div>"
  );
  el("btn_next").addEventListener("click", () => {
    const v = {
      age_band: el("age_band").value, gender: getRadio("gender"), field: el("field").value,
      year: el("year").value, prior_experiments: getRadio("prior"),
      gps_risk: el("risk").value, gps_patience: el("patience").value
    };
    if (!v.age_band || !v.gender || !v.field || !v.year || !v.prior_experiments || v.gps_risk === "" || v.gps_patience === "") {
      el("derr").classList.remove("hidden"); return;
    }
    el("btn_next").disabled = true;
    markHeartbeat("finalization_started");
    pendingFinalize = {
      requestId: newId(),
      payload: {
        ...sessionAuth(S),
        event_seq: takeEventSeq(S),
        questionnaire: questionnaireDraft,
        demographics: v
      }
    };
    deliverFinalize();
  });
}

/* §4.11: no raw JSON is ever displayed; a failed final submission keeps
 * the participant on a retry screen and the identical request (same
 * request_id) is retried until the server acknowledges. The completion
 * code appears only after a server receipt. */
async function deliverFinalize() {
  render(progressHtml(9, TOTAL_STEPS, t().progress_done) +
    '<div class="card"><p>' + esc(t().finalizing) + "</p>" +
    '<p id="net_note" class="quality-note hidden">' + esc(t().slow_network) + "</p></div>");
  try {
    const { data } = await apiCall("finalize", pendingFinalize.payload, {
      requestId: pendingFinalize.requestId, onRetry: retryNotice, timeoutMs: 20000
    });
    S = applyServerState(S, data.state);
    persistSession(S);
    screenCompleted();
  } catch (err) {
    if (err instanceof ApiError && !err.retryable) { handleDomainError(err); return; }
    screenFinalRetry();
  }
}

function screenFinalRetry() {
  const ref = refFromId(pendingFinalize && pendingFinalize.requestId);
  render(
    progressHtml(9, TOTAL_STEPS, t().progress_done) +
    '<div class="card"><h3>' + esc(t().final_retry_title) + "</h3>" +
    '<div class="notice-error">' + esc(t().final_retry_body) + "</div>" +
    '<p class="muted">' + esc(fmt(t().final_retry_ref, { REF: ref })) + "</p>" +
    '<button id="btn_retry" type="button">' + esc(t().final_retry_btn) + "</button></div>"
  );
  el("btn_retry").addEventListener("click", deliverFinalize);
}

function screenCompleted() {
  setFabVisible(false);
  const completion = S.completion;
  if (!completion) { resumeFlow(); return; }
  render(progressHtml(9, TOTAL_STEPS, t().progress_done) + completionHtml(t(), completion));
}

/* =================== Start =================== */

boot();
