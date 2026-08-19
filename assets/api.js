/*
 * Acknowledged transport to the Apps Script backend (§4.6).
 *
 * The client never uses fetch/XHR (the page ships with connect-src 'none';
 * §4.5). Each request posts a hidden form into a sandboxed hidden iframe
 * targeted at the Apps Script /exec endpoint; the server answers with a
 * small HTML page that postMessages a receipt to this window. A request
 * is complete only when a receipt arrives whose request_id AND single-use
 * high-entropy nonce match the pending request.
 *
 * Acceptance checks (§4.6), in order:
 *   1. a pending request exists for message.request_id;
 *   2. message.nonce equals the nonce generated for the live attempt;
 *   3. the event source is the response iframe's contentWindow, OR the
 *      event origin is an expected Apps Script origin ("null" included:
 *      the sandboxed response document has an opaque origin). Apps Script
 *      may serve /exec responses through a googleusercontent wrapper
 *      frame, in which case event.source is the inner frame rather than
 *      iframe.contentWindow; the nonce — 122 bits of entropy that never
 *      leaves this page except inside the HTTPS form post — remains the
 *      security boundary in both cases. Validate against the deployed
 *      endpoint during the technical pilot (§12).
 *
 * Retries reuse the SAME request_id (§4.6) so the server can recognize a
 * retry and return the stored response instead of appending a duplicate;
 * each attempt uses a fresh nonce, echoed in that attempt's receipt.
 */

import { PUBLIC_CONFIG, API_RESPONSE_ORIGINS } from "./config.js";

export const RETRYABLE_CODES = Object.freeze(["API_TIMEOUT", "SERVER_BUSY", "NETWORK_ERROR"]);

export function uuidV4FromBytes(input) {
  const buf = new Uint8Array(input);
  if (buf.length !== 16) throw new Error("UUID_REQUIRES_16_BYTES");
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" + hex.slice(20);
}

export function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // RFC 4122 version-4 fallback for older Web Crypto implementations.
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return uuidV4FromBytes(buf);
}

/* Pure: envelope construction (tests/api-idempotency.test.js). */
export function buildEnvelope(action, payload, requestId, nonce, config = PUBLIC_CONFIG) {
  return {
    api_version: 1,
    app_version: config.APP_VERSION,
    action,
    request_id: requestId,
    nonce,
    payload: payload || {}
  };
}

/* Pure: receipt acceptance predicate (tests/api-idempotency.test.js). */
export function acceptMessage(pending, event, allowedOrigins = API_RESPONSE_ORIGINS) {
  const message = event && event.data;
  if (!pending || !message || typeof message !== "object") return false;
  if (message.type !== "QUEUE_API_RESPONSE") return false;
  if (message.request_id !== pending.requestId) return false;
  if (message.nonce !== pending.nonce) return false;
  const fromOurFrame = pending.iframeWindow && event.source === pending.iframeWindow;
  const fromKnownOrigin = allowedOrigins.indexOf(event.origin) !== -1;
  return Boolean(fromOurFrame || fromKnownOrigin);
}

/* Pure: retry schedule with a bounded number of attempts. */
export function retryDelayMs(attempt) {
  const table = [1000, 2000, 4000, 8000];
  return table[Math.min(attempt, table.length - 1)];
}

export class ApiError extends Error {
  constructor(code, retryable, detail) {
    super(code);
    this.code = code;
    this.retryable = Boolean(retryable);
    this.detail = detail || null;
  }
}

/* Monotone counter for unique frame names; no Math.random anywhere in
 * production interface code (§11 release gate). */
let attemptCounter = 0;

/* One transport attempt: hidden form post into a sandboxed hidden iframe. */
export function apiAttempt(action, payload, requestId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const nonce = newId();
    attemptCounter += 1;
    const frameName = "queue_api_" + requestId.replace(/[^a-zA-Z0-9]/g, "") + "_" + attemptCounter;

    const iframe = document.createElement("iframe");
    iframe.name = frameName;
    iframe.hidden = true;
    iframe.setAttribute("sandbox", "allow-forms allow-scripts");
    iframe.referrerPolicy = "no-referrer";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = PUBLIC_CONFIG.API_URL;
    form.target = frameName;
    form.hidden = true;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "envelope";
    input.value = JSON.stringify(buildEnvelope(action, payload, requestId, nonce));
    form.appendChild(input);

    const pending = { requestId, nonce, iframeWindow: null };

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      iframe.remove();
      form.remove();
      clearTimeout(timer);
    };

    const onMessage = (event) => {
      if (!acceptMessage(pending, event)) return;
      const message = event.data;
      cleanup();
      if (!message.ok) {
        reject(new ApiError(message.error_code || "API_ERROR", message.retryable === true, message));
        return;
      }
      resolve(message);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new ApiError("API_TIMEOUT", true));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    document.body.append(iframe, form);
    pending.iframeWindow = iframe.contentWindow;
    try {
      form.submit();
    } catch (e) {
      cleanup();
      reject(new ApiError("NETWORK_ERROR", true, String(e)));
    }
  });
}

/*
 * Acknowledged request with idempotent retries. The request_id is fixed
 * across attempts; the server deduplicates on it. `onRetry(attempt)` lets
 * the UI show a "slow connection" notice. Domain errors (ok:false,
 * retryable:false) reject immediately.
 */
export async function apiCall(action, payload, options = {}) {
  const requestId = options.requestId || newId();
  const timeoutMs = options.timeoutMs || 15000;
  const maxAttempts = options.maxAttempts || 5;
  const attemptFn = options.attempt || apiAttempt; // injectable for tests
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const message = await attemptFn(action, payload, requestId, timeoutMs);
      return { requestId, data: message.data || {}, message };
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && err.retryable;
      if (!retryable || attempt === maxAttempts - 1) break;
      if (typeof options.onRetry === "function") options.onRetry(attempt + 1, err);
      await new Promise((r) => setTimeout(r, retryDelayMs(attempt)));
    }
  }
  if (lastError instanceof ApiError) lastError.requestId = requestId;
  throw lastError;
}

/* Fire-and-forget stage marker (§5.5 heartbeat); never blocks the flow. */
export function heartbeat(sessionAuth, stageMarker) {
  if (!sessionAuth || !sessionAuth.session_id) return;
  apiCall("heartbeat", {
    session_id: sessionAuth.session_id,
    resume_token: sessionAuth.resume_token,
    stage_marker: stageMarker
  }, { maxAttempts: 1, timeoutMs: 10000 }).catch(() => { /* paradata only */ });
}
