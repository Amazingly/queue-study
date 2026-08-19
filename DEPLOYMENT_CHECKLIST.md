
## Final lecture-plan configuration — `CONTROL` Sheet

- [ ] The technical coordinator created the private Sheet-bound Apps Script project and ran `BEGINNER_FIRST_TIME_SETUP`.
- [ ] The yellow `CONTROL` cells reflect the best current timetable and expected attendance.
- [ ] The 11 × 150 rows are treated as an editable planning example, not a fixed sample requirement.
- [ ] The default reserve percentage or each maximum override provides adequate capacity; calculated maxima are reviewed.
- [ ] `Queue Study → Preview lecture plan` was reviewed before provisioning.
- [ ] `Queue Study → Provision study from CONTROL` was run once in fresh production workbooks.
- [ ] No lecture was added and no provisioned maximum increased afterward.
- [ ] Lecture dates are entered and `Apply lecture dates and generate codes` produces unique six-digit codes and valid windows.
- [ ] The same shared QR encodes `/join/` and no participant token.
- [ ] `DASHBOARD` reconciles lecture capacity and aggregate session counts.
- [ ] Automatic maintenance is installed and the last operational refresh is recent.

## Researcher personal-laptop safeguards

- [ ] Both administrator laptops use passwords, automatic screen locking, current operating systems, current browsers, and two-factor authentication.
- [ ] The private research Sheet is not projected or shared with students.
- [ ] The coauthor downloaded `gateway-poster.html` and tested **Update display** and **Full screen** offline.
- [ ] Do Not Disturb is enabled before projection so Gmail and message notifications cannot appear.
- [ ] The permanent QR, short URL, lecturer instructions, and emergency contact procedure are stored locally as an offline backup.
- [ ] Raw participant data are not downloaded to either laptop unless required for approved analysis.
- [ ] The classroom coauthor receives only the current lecture code and window by Gmail, not research data or treatment information.

# Deployment Checklist and Public-Release Gate

This document operationalizes §12–§13 of the revision plan. The study may not recruit a public sample until every item in the gate is checked and the technical and behavioral pilots meet their acceptance criteria. The prototype (`easy_online_version`) remains suitable for internal testing only.

## 1. Non-negotiable release gate (§13)

- [ ] Treatment is assigned and persisted by Apps Script (preallocated token slots; `start` never randomizes).
- [ ] Hidden types and recovery draws never enter the browser (verify in page source, DOM, sessionStorage, and network responses during the pilot).
- [ ] Forced-treatment query parameters are removed (CI gate forbids `?t=`).
- [ ] Restarting cannot change assignment (resume/end are the only recovery paths).
- [ ] Every decision receives a server acknowledgement (receipt with matching `request_id` and nonce) before the interface proceeds.
- [ ] Duplicate requests are idempotent (same `request_id` → stored response; altered payload → conflict).
- [ ] Consent and 18+ eligibility precede assignment; non-consenting visitors create no research record.
- [ ] Partial sessions are recorded (sessions row at consent; stage heartbeats; withdrawal timestamps).
- [ ] Completion codes are generated server-side and shown only after a verified receipt.
- [ ] Payment is calculated server-side (fixed + floored bonus; §4.10 separation on the results screen).
- [ ] Raw JSON is never displayed (retry screen with attempt reference instead; CI gate enforces).
- [ ] Research and payment data are separated (two workbooks; token hashes only in research; raw invite tokens only in the payment ledger).
- [ ] Raw user agent, referrer, and unnecessary device fields are removed (client transmits only device class, browser family, viewport bands, timezone offset).
- [ ] Planner welfare weights are absent from the deployed client and the raw data (rounds table stores primitives only; CI gate forbids the names).
- [ ] Pilot and production use separate Apps Script deployments and workbooks (never repointed by code edits).
- [ ] Git commit SHA, Apps Script deployment ID, sequence version, and schema version are frozen and recorded in the `config` tab (`recordRelease`).

## 2. Required before the main sample (§13)

- [ ] Matched stochastic blocks are generated and frozen (`generateAssignmentBlocks`; regeneration refused under the same version).
- [ ] Sequence-set hash is precommitted (run `freezeSequencePrecommitment()`, paste the digest into `docs/sequence-precommitment.md`, commit and tag before recruitment).
- [ ] Integrity checks reproduce every payoff and state transition (`rebuildIntegrityReport()` clean on all pilot sessions).
- [ ] Cross-browser tests pass (matrix in §4 below).
- [ ] Concurrent-submission load tests pass (protocol in §5 below).
- [ ] Vietnamese text receives independent native-language review (all revised §8.3 state-language strings, consent, retry, and completion screens).
- [ ] `npm run release-check` passes; it blocks placeholders, an invalid Apps Script URL, or a missing sequence hash.
- [ ] Ethics-approved consent, privacy, withdrawal, and payment language is installed: replace `[INSTITUTION]`, `[ETHICS_REFERENCE]`, `[ETHICS_COMMITTEE_NAME]`, `[ETHICS_COMMITTEE_CONTACT]`, `[CONTACT_EMAIL]`, `[WITHDRAWAL_DEADLINE]` in both translation catalogs, `privacy.html`, and `withdrawal.html`.
- [ ] The ethics application is amended where the architecture changed it: the consent and IRB text stating that incomplete sessions transmit no data must be replaced by the §5.5 attrition-recording language now in the consent screen (partial records retained, analyzed only in aggregate, withdrawable on request), and the demographics description updated from exact age to age bands.
- [ ] Cash-payment logistics are installed: `[CASH_PAYMENT_LOCATION_AND_TIMES]` is replaced in both translation catalogs with the actual collection location and hours; the cash-desk procedure is staffed and rehearsed (verify the presented code in the payment ledger, pay only `pending` codes, mark `paid` with date and voucher reference before the participant leaves — see backend README §7); a float and numbered voucher or signature sheet are prepared; and the ethics application's compensation section states cash payment.
- [ ] Classroom gateway sessions are prepared (backend README §8): `Queue Study → Provision study from CONTROL` has built the per-lecture allocation-slot ledger (permuted triples; within-class counts verified to differ by at most one in the integrity report); the permanent QR poster is printed from `tools/gateway-poster.html` and encodes exactly the `/join/` gateway URL; the administrator holds the poster, `LECTURER_INSTRUCTIONS.md`, and only the access required for her role; each lecture's six-digit code arrives by email shortly before class; lecture windows are verified to refuse codes outside their window and beyond capacity; the live capacity test includes the largest planned lecture and the proposed 25–30-person scanning waves; the staggered-wave script, one-participation announcement, and approved payment procedure are agreed; and any teacher–student power relationship is addressed exactly as required by the ethics approval.
- [ ] The preregistration identifies primitive outcomes (`h_served`, `l_served`, `strained_rounds`, per-round primitives) as primary and calibrated welfare indices as secondary, computed offline under the benchmark calibration with a pre-specified sensitivity region (§9); the belief rule remains the preregistered linear score.

## 3. Technical test matrix (§12.1)

Execute each row against the production candidate (pilot deployment, pilot workbooks) and record the outcome.

| Test | Required result |
|---|---|
| Valid unused token | Creates exactly one session |
| Invalid token | No assignment; no research record |
| Reused completed token | Returns completed status; creates no new session |
| Reload after consent | Same treatment, block, and round |
| Reload in round 10 | Same balance and capacity state |
| Two simultaneous tabs | At most one accepted decision per round |
| Same request sent twice | One round row; identical response |
| Same request ID with altered choice | Conflict error |
| Round 8 sent after round 9 | Stale-event error |
| Client alters displayed treatment | Server ignores it (labels derive from server state) |
| Client submits false points | Rejected (unexpected key) |
| Client submits false current load | Rejected (unexpected key) |
| Network drops after server write | Retry returns stored acknowledgement |
| Apps Script temporarily busy | Client retries without duplicate |
| Timer expires | One `not_send`, `timed_out = TRUE` record |
| Instructions opened, then tab hidden | No double pause (panel closes first; §4.8) |
| Mobile call / app switch | Session resumes consistently; active clock unaffected |
| Final submission retried | One completion record and one payment record |
| Token entered on another device | Existing session returned; older lease invalidated; concurrency flagged |
| Participant exits in round 6 | Start and progress records remain |
| Formula-like open text (`=SUM(A1)`, `+1`, `-1`, `@x`) | Stored as plain text |
| Overlong payload | Rejected safely (`PAYLOAD_TOO_LARGE`) |
| Vietnamese characters | Preserved exactly end-to-end |
| Completion code | Generated only after verified finalization |

## 4. Browser coverage (§12.2)

Complete the full participant flow on iOS Safari, Android Chrome, desktop Chrome, desktop Safari, and desktop Firefox; additionally on a narrow mobile viewport (≤380 px), under slow-network simulation, and across a temporary offline interval during the rounds. The single mobile-Safari completion observed under the prototype does not validate cross-browser behavior, concurrency, incremental checkpoints, or acknowledged receipt; each cell above must be exercised against this architecture.

## 5. Load test (§5.9)

Run synthetic sessions against the pilot deployment at 10 and 25 concurrent sessions, then test the intended scanning-wave size (normally 25–30 students). Finally, conduct a realistic simulation for the largest planned lecture—for the supplied example, approximately 150 participant devices or a technically valid equivalent workload. Record median acknowledgement time, 95th-percentile acknowledgement time, lock-timeout (`SERVER_BUSY`) rate, duplicate-write rate (must be zero), Apps Script failure rate, and missing-receipt rate. `SERVER_BUSY` responses must retry cleanly and never count as a decision. Monitor active and failed executions in the Apps Script dashboard throughout and confirm quota headroom for the complete recruitment schedule.

## 6. Technical pilot acceptance (§12.3)

Run test tokens covering all three arms on all major devices, writing to the pilot workbooks only (never merged into production data). Acceptance requires: 100% treatment persistence across reloads; zero duplicate round rows; zero bonus discrepancies against `rebuildIntegrityReport()`; zero hidden types exposed in page source, DOM, storage, or network responses; at least 98% acknowledged request completion without manual intervention; recoverable behavior after simulated connection loss; and no raw identifiers in the research workbook.

## 7. Behavioral pilot (§12.4)

A separate small behavioral pilot assesses comprehension (quiz attempts, including the new Q7–Q8 margin questions), coarse-arm entry under the standard state and balking under the high state, exact-H sending and exact-L rejection, timeout frequency, completion time, policy recognition (§8.6 items), and perceived credibility. The substantive continuation condition is the coarse-arm entry rate under the standard waiting cost: the state-dependent-versus-coarse welfare comparison loses force if participants systematically reject the positive-expectation mixed case at the 30-point cost. Behavioral-pilot observations are not pooled into the confirmatory sample unless that inclusion was preregistered before the pilot.
