# Queue Decision Study — Public Interface

This repository contains the public, statically hosted interface of the Capacity Exposure Online Study (*Public Predictive Labels and Queue-Entry Behavior in Service Systems*). It is one of three layers in a server-authoritative architecture and is deliberately the least powerful of them:

> **GitHub displays the experiment; Google Apps Script runs it; Google Sheets records it.**

GitHub Pages serves this site to participants. Every experimental object — treatment assignment, the frozen 20-round case sequences, recovery draws, payoffs, balances, belief scores, bonuses, and completion codes — is determined, validated, and stored by a private Google Apps Script web app backed by two private Google Sheets workbooks (research data and payment ledger, kept separate). The client renders what the server returns and nothing else. Because GitHub Pages is public hosting, everything in this repository — including all interface logic — is publicly inspectable by construction; the design assumes that inspection and remains sound under it. Security rests on single-use participation tokens, server-side state, idempotent writes, and strict payload validation, not on concealment of client code.

## Entry modes

Participants enter one of two ways, both server-authorized. **Invitation tokens** (`/?token=qt_…`): personal single-use links, used for pilots and contingency slips. **The classroom gateway** (`/join/`, the URL inside the one permanent QR poster): after scanning, the student enters a six-digit lecture code announced by the session administrator; the server validates the code's window and capacity and — only after eligibility and consent — atomically claims the lecture's next allocation slot (permuted blocks of three, so within-class treatment counts never differ by more than one). The shared QR is a front door, never an invitation: it must encode `/join/` exactly, and an ordinary token must never be placed in a shared QR.

The backend derives lecture batches and capacities from the final production plan. The supplied example is 11 lectures with up to 150 students each, but both values may be changed before provisioning. Every lecture uses the same `/join/` QR and a fresh six-digit code.

## What this client never does

The client contains no treatment identifier and no assignment code; no case-type sequences, recovery draws, or transition arithmetic; no payoff, balance, belief-score, or bonus computation; no completion-code generation; and no forced-treatment URL handling. Browser storage holds exactly one thing beyond the transient invitation token: the opaque pseudonymous recovery credential (resume token, session id, language), kept in persistent storage so that under shared-QR entry — where no paper slip exists — the same device can resume its own session after a closed tab and re-display the completion code until cash payout; no experiment state is ever stored. A page reload leads only to *resume this session* or *end participation* — a fresh assignment cannot be obtained from the browser (plan §4.9). These prohibitions are enforced mechanically: `tests/forbidden-patterns.test.js` fails the deployment workflow if a forbidden pattern (e.g., `assignTreatment(`, `buildPlan(`, `Math.random(`, `?t=`, planner-weight names, hidden-state field names, `no-cors`, or a raw-payload display) enters production interface code (plan §11).

## Layout

```
index.html                 application shell: CSP, no-referrer, noindex, module entry
privacy.html               participant-facing privacy notice (VI + EN)
withdrawal.html            withdrawal procedure and deadline (VI + EN)
robots.txt                 Disallow: / (discourages indexing; does not confer privacy)
assets/
  config.js                PUBLIC_CONFIG (API URL, origin, public constants) + display values
  app.js                   flow controller: screens, heartbeats, error handling
  api.js                   acknowledged transport: form-post → hidden iframe → postMessage receipt
  state.js                 non-authoritative client state; token intake; coarse device descriptor
  ui.js                    pure HTML builders (unit-tested payoff and results rendering)
  timer.js                 single active-time decision clock (§4.8), DOM-free and unit-tested
  translations-en.js       English catalog
  translations-vi.js       Vietnamese catalog (requires native review before the main sample)
  styles.css               all styling (no inline styles; CSP style-src 'self')
tests/                     node --test suite, including the §11 forbidden-pattern release gate
docs/sequence-precommitment.md   §7.3 hash commitment for the frozen sequence set
.github/workflows/deploy-pages.yml  test-gated Pages deployment from main
DEPLOYMENT_CHECKLIST.md    §12–§13 test matrix and public-release gate
```

## Configuration

Exactly two values in `assets/config.js` bind this client to a deployment: `API_URL`, the versioned `/exec` URL of the production Apps Script deployment, and `PARENT_ORIGIN`, the exact origin of this Pages site (used by the server's receipt `postMessage` and configured identically in the backend's Script Properties). `APP_VERSION` must match the backend's `EXPECTED_APP_VERSION`; the server rejects other versions, which is how a stale cached client is forced to reload rather than submit under an outdated protocol. The remaining constants are public display values (120, 0, 30, 70, 48, the 40% and 50% probabilities, the 300-point endowment, payment values); they template instruction text only, and the decision screen renders exclusively the numbers the server returns for the current round (§4.7).

## Transport

The page ships with `connect-src 'none'`: it performs no fetch or XHR. Each request serializes a versioned envelope — `{api_version, app_version, action, request_id, nonce, payload}` — into a hidden form posted into a sandboxed hidden iframe targeted at the Apps Script endpoint; the server's HTML response posts a receipt back with `postMessage` to this site's exact origin. A receipt is accepted only if its `request_id` and single-use high-entropy `nonce` match the pending request and it arrives from the response frame or a recognized Apps Script origin (the sandboxed response document has an opaque origin, so the nonce — never exposed outside the HTTPS post — carries the binding). Retries, automatic and manual, reuse the same `request_id`, which the server deduplicates; a lost acknowledgement therefore can never create a second decision. Note one deliberate refinement of plan §4.5: `form-action` also lists `script.googleusercontent.com` because Apps Script serves `/exec` responses through that redirect domain and some engines evaluate `form-action` across redirects; §4.5's instruction to test the exact policy against the production deployment stands.

## Development and deployment

Run the suite with `npm test` (Node 20+; no dependencies). Work on `develop`; merge to `main` through a reviewed pull request. Pushes and pull requests run the tests but never change the live study. Production deployment is an explicit `workflow_dispatch` action from `main`, and the workflow additionally runs `npm run release-check` and publishes only the minimal `dist/` artifact. For each production release: tag it (e.g., `v1.0.0`), increment `APP_VERSION` together with the backend's `EXPECTED_APP_VERSION`, and record the deployed commit SHA and the Apps Script deployment ID in the research workbook's `config` tab (`recordRelease` in the backend). Do not modify the production interface during an active experimental wave (§11).

The backend source, workbook schemas, sequence generation, and operational runbook live in the separate private repository `queue-study-api`. Never place tokens, seeds, HMAC secrets, workbook identifiers, sequence tables, or any experiment data in this public repository (§4.1).

## Placeholders that block release

`[INSTITUTION]`, `[ETHICS_REFERENCE]`, `[ETHICS_COMMITTEE_NAME]`, `[ETHICS_COMMITTEE_CONTACT]`, `[CONTACT_EMAIL]`, `[WITHDRAWAL_DEADLINE]`, and `[CASH_PAYMENT_LOCATION_AND_TIMES]` (payments are disbursed in cash against the completion code, since most participants are unbanked) appear in the translation catalogs and the privacy and withdrawal pages. They must be replaced with the ethics-approved language, and the Vietnamese catalog must receive independent native-language review, before the main sample (§13). `DEPLOYMENT_CHECKLIST.md` tracks these items.
