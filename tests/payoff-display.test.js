/*
 * payoff-display.test.js — the client renders exactly the server-returned
 * numbers (§4.7) and the §4.10 earnings separation, for every label/load
 * cell of the design (values 120/0/48; waits 30/70).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { decisionScreenHtml, feedbackHtml, resultsTableHtml, completionHtml, vnd, fmt } from "../assets/ui.js";
import { EN } from "../assets/translations-en.js";
import { VI } from "../assets/translations-vi.js";

function roundState(label, load, balance) {
  const cost = load === "normal" ? 30 : 70;
  const isMixed = label === "mixed";
  const value = label === "H" ? 120 : 0;
  return {
    round: 7,
    total_rounds: 20,
    display_label: label,
    current_load: load,
    wait_cost: cost,
    displayed_case_value: isMixed ? null : value,
    displayed_expected_value: isMixed ? 48 : null,
    displayed_net_value: (isMixed ? 48 : value) - cost,
    balance: balance === undefined ? 420 : balance,
    decision_seconds: 60
  };
}

test("mixed case under standard waiting cost shows 48 − 30 = 18", () => {
  const html = decisionScreenHtml(EN, roundState("mixed", "normal"), "Rounds");
  assert.match(html, /48 − 30 = 18/);
  assert.match(html, /Waiting cost this round: 30 points/);
  assert.match(html, /Mixed case/);
  assert.doesNotMatch(html, /Type H case|Type L case/);
});

test("mixed case under high waiting cost shows 48 − 70 = -22 (the §8.4 margin)", () => {
  const html = decisionScreenHtml(EN, roundState("mixed", "strained"), "Rounds");
  assert.match(html, /48 − 70 = -22/);
  assert.match(html, /Waiting cost this round: 70 points/);
});

test("exact H under standard and high waiting cost shows 90 and 50", () => {
  assert.match(decisionScreenHtml(EN, roundState("H", "normal"), "R"), /120 − 30 = 90/);
  assert.match(decisionScreenHtml(EN, roundState("H", "strained"), "R"), /120 − 70 = 50/);
});

test("exact L shows a negative net value in both states", () => {
  assert.match(decisionScreenHtml(EN, roundState("L", "normal"), "R"), /0 − 30 = -30/);
  assert.match(decisionScreenHtml(EN, roundState("L", "strained"), "R"), /0 − 70 = -70/);
});

test("decision screen renders the server balance verbatim", () => {
  const html = decisionScreenHtml(EN, roundState("mixed", "normal", 373), "R");
  assert.match(html, /<strong>373<\/strong>/);
});

test("decision screen never mentions the hidden type for a mixed label", () => {
  const html = decisionScreenHtml(VI, roundState("mixed", "strained"), "R");
  assert.doesNotMatch(html, /actual_type|recovery|sequence/i);
});

test("results table reproduces the §4.10 worked example", () => {
  const html = resultsTableHtml(EN, {
    starting_points: 300,
    decision_points: 30,
    belief_points: 15,
    counted_points: 345,
    bonus_vnd: 34500
  });
  assert.match(html, /Starting points<\/td><td>300/);
  assert.match(html, /decisions<\/td><td>30/);
  assert.match(html, /estimation questions<\/td><td>15/);
  assert.match(html, /calculate bonus<\/td><td>345/);
  assert.match(html, /34\.500 VND/);
});

test("results table shows a floored zero bonus for a negative total", () => {
  const html = resultsTableHtml(EN, {
    starting_points: 300, decision_points: -520, belief_points: 5,
    counted_points: 0, bonus_vnd: 0
  });
  assert.match(html, /calculate bonus<\/td><td>0/);
  assert.match(html, />0 VND/);
});

test("completion screen shows fixed, bonus, and total payment (§8.9)", () => {
  const html = completionHtml(EN, {
    completion_code: "QL-7XK2MD",
    fixed_vnd: 50000,
    bonus_vnd: 34500,
    total_vnd: 84500,
    receipt_reference: "AB12CD34"
  });
  assert.match(html, /QL-7XK2MD/);
  assert.match(html, /50\.000 VND/);
  assert.match(html, /34\.500 VND/);
  assert.match(html, /84\.500 VND/);
  assert.match(html, /AB12CD34/);
});

test("feedback: timeout and not-send report zero points; send reports points", () => {
  const base = { round: 3, total_rounds: 20, balance_after: 288, next_load: "strained", next_round_available: true };
  const timeout = feedbackHtml(EN, { ...base, decision: "not_send", timed_out: true, points: 0 }, "R");
  assert.match(timeout, /Time ran out/);
  const notSent = feedbackHtml(EN, { ...base, decision: "not_send", timed_out: false, points: 0 }, "R");
  assert.match(notSent, /did not send/);
  const sent = feedbackHtml(EN, { ...base, decision: "send", timed_out: false, points: -30 }, "R");
  assert.match(sent, /Points: -30/);
});

test("vnd formats with dot thousands separators", () => {
  assert.equal(vnd(34500), "34.500");
  assert.equal(vnd(0), "0");
  assert.equal(vnd(1234567), "1.234.567");
  assert.equal(vnd(50000), "50.000");
});

test("EN and VI translation catalogs have identical key sets", () => {
  const enKeys = Object.keys(EN).sort();
  const viKeys = Object.keys(VI).sort();
  assert.deepEqual(enKeys, viKeys);
});

test("EN and VI templates use identical placeholder sets per key", () => {
  const holes = (s) => (String(s).match(/\{[A-Z]+\}/g) || []).sort();
  for (const key of Object.keys(EN)) {
    assert.deepEqual(holes(EN[key]), holes(VI[key]), "placeholder mismatch in " + key);
  }
});

test("neutral state language (§8.3): no burden or strain framing in either catalog", () => {
  const all = JSON.stringify(EN) + JSON.stringify(VI);
  assert.doesNotMatch(all, /high-burden|burden/i);
  assert.doesNotMatch(all, /becomes strained|hệ thống trở nên căng/i);
});

test("fmt fills placeholders and leaves unknown ones visible", () => {
  assert.equal(fmt("a {X} b {Y}", { X: 1, Y: 2 }), "a 1 b 2");
  assert.equal(fmt("{Z}", {}), "{Z}");
});
