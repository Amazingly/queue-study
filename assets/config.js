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
 * Apps Script serves web-app responses through script.google.com and the
 * googleusercontent redirect domain; a sandboxed response iframe posts
 * with an opaque ("null") origin. Every accepted message must also match
 * the pending request's id and single-use high-entropy nonce, so origin
 * is a coarse filter, not the security boundary. */
export const API_RESPONSE_ORIGINS = Object.freeze([
  "https://script.google.com",
  "https://script.googleusercontent.com",
  "null"
]);
