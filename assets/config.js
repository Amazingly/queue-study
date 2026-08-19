/*
 * Public, non-authoritative configuration (revision plan §4.2).
 *
 * Everything in this file is public by construction: GitHub Pages serves
 * client-side source to anyone. Nothing here determines treatment, hidden
 * case types, recovery draws, payoffs, or completion. The Apps Script
 * server is the sole source of truth for every experimental and payment
 * variable; the client renders what the server returns.
 *
 * The API URL is not a secret (§4.2). Security rests on token validation,
 * server-side state, idempotency, and payload validation on the server.
 */

export const PUBLIC_CONFIG = Object.freeze({
  APP_VERSION: "queue-study-v1.0.0",
  API_URL: "https://script.google.com/macros/s/AKfycbwpdwoYEpcowdx6s7_7-yPu2W-0fN-rTasUZFM_8Z9o0FYZa8zfUkR5TMFzVicHKJ1_/exec",
  PARENT_ORIGIN: "https://amazingly.github.io",
  NUM_ROUNDS: 20,
  DECISION_SECONDS: 60,
  INSTRUCTION_PAUSE_LIMIT_SECONDS: 120,
  RESUME_EXPIRY_HOURS: 24
});

/*
 * Participant-facing display values (§4.2: "The interface may display
 * participant-facing values such as 120, 0, 30, 70, and the stated 40%
 * probability."). These fill instruction templates only. The decision
 * screen itself renders the wait cost, displayed value, expected value,
 * net value, and balance returned by the server for the current round
 * (§4.7); these constants are never used to compute payoffs, transitions,
 * or payments. No planner welfare weights appear anywhere in the client.
 */
export const DISPLAY = Object.freeze({
  hValue: 120,
  lValue: 0,
  mixedEv: 48,
  waitStandard: 30,
  waitHigh: 70,
  hPercent: 40,
  recoveryPercent: 50,
  startingPoints: 300,
  beliefMax: 10,
  fixedVnd: 50000,
  vndPerPoint: 100,
  netStandardMixed: 18,   // 48 − 30, quoted in instructions and quiz Q7
  netHighMixed: -22       // 48 − 70, quoted in instructions and quiz Q8
});

/* Origins from which acknowledged API receipts may arrive (§4.6, §5.8).
 *
 * Measured against the production deployment on 2026-08-19, not assumed:
 * Apps Script serves the /exec response through a PER-DEPLOYMENT
 * user-content host of the form
 *   https://n-<opaque-hash>-script.googleusercontent.com
 * so the bare googleusercontent host listed below is never the observed
 * origin, and the receipt is posted by Apps Script's inner wrapper frame
 * rather than by the iframe's own contentWindow. Matching on the exact
 * list alone therefore rejected every valid receipt, and the request
 * failed with API_TIMEOUT. isAllowedResponseOrigin handles the
 * per-deployment host.
 *
 * Every accepted message must still match the pending request's id and
 * its single-use 122-bit nonce, which never leaves this page except
 * inside the HTTPS form post. Origin is a coarse filter; the nonce is
 * the security boundary. */
export const API_RESPONSE_ORIGINS = Object.freeze([
  "https://script.google.com",
  "https://script.googleusercontent.com",
  "null"
]);

/* Apps Script user-content hosts: exactly one label of [a-z0-9-] before
 * .googleusercontent.com. Anchored end to end and https-only, so
 * "https://googleusercontent.com.evil.example" and
 * "https://evil.example/x.googleusercontent.com" both fail, as does any
 * origin carrying userinfo or a port. */
const APPS_SCRIPT_USER_CONTENT = /^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/;

export function isAllowedResponseOrigin(origin, allowed = API_RESPONSE_ORIGINS) {
  if (typeof origin !== "string") return false;
  if (allowed.indexOf(origin) !== -1) return true;
  return APPS_SCRIPT_USER_CONTENT.test(origin);
}
